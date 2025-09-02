// api/ai.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// (선택) OpenAI 사용: 키 없으면 자동 폴백
let openai = null;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
if (process.env.OPENAI_API_KEY) {
  try {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    console.warn('[AI] openai 패키지가 없거나 초기화 실패. 폴백 모드로 진행합니다.');
  }
}

/* ---------------------  A) 자동완성  --------------------- */
router.get('/suggest', async (req, res, next) => {
  try {
    const raw = String(req.query.q || '').trim();
    if (!raw) return res.json({ ok: true, items: [] });

    const tokens = raw.split(/[\s,/|]+/).map(s => s.trim()).filter(Boolean);

    const SYN = [
      ['blanket','이불','담요'],
      ['bag','가방','에코백','토트'],
      ['keyring','키링','key ring','키 체인'],
      ['logistic','러기지','네임택','name tag','택','tag'],
      ['figure','피규어'],
      ['memo','메모','포스트잇','post-it','postit'],
      ['mousepad','마우스패드','mouse pad'],
      ['diary','다이어리'],
      ['note','노트'],
      ['pouch','파우치'],
      ['neck pillow','목베개','neckpillow'],
      ['airplane','비행기'],
      ['moltiz','mol'],
      ['maltiz','mal'],
    ];
    const expand = (arr) => {
      const set = new Set(arr.map(t => t.toLowerCase()));
      for (const g of SYN) if (g.some(x => set.has(x.toLowerCase()))) g.forEach(x => set.add(x.toLowerCase()));
      return [...set];
    };

    const qTokens      = expand(tokens);
    const likePatterns = qTokens.map(t => `%${t}%`);
    const firstToken   = qTokens[0] || '';
    const whereAnyLike = likePatterns.map(() => 'name LIKE ?').join(' OR ');

    const sql = `
      SELECT
        id, name, image_url, stock,
        IF(sale_price IS NOT NULL AND (sale_ends_at IS NULL OR sale_ends_at > NOW()),
           sale_price, price) AS effective_price,
        (CASE WHEN ? <> '' AND name LIKE CONCAT(?, '%') THEN 1 ELSE 0 END) AS is_prefix,
        (CASE WHEN sale_price IS NOT NULL AND (sale_ends_at IS NULL OR sale_ends_at > NOW()) THEN 1 ELSE 0 END) AS is_sale,
        LOCATE(?, name) AS pos
      FROM products
      WHERE stock > 0
        AND (${whereAnyLike})
      ORDER BY
        is_prefix DESC,
        is_sale   DESC,
        CASE WHEN pos = 0 THEN 9999 ELSE pos END ASC,
        CHAR_LENGTH(name) ASC,
        id DESC
      LIMIT 8
    `;

    const params = [firstToken, firstToken, firstToken, ...likePatterns];
    const [rows] = await pool.query(sql, params);

    let list = rows;
    if (!list.length) {
      const [fallback] = await pool.query(
        `SELECT id, name, image_url,
                IF(sale_price IS NOT NULL AND (sale_ends_at IS NULL OR sale_ends_at > NOW()),
                   sale_price, price) AS effective_price
           FROM products
          WHERE stock > 0 AND name LIKE ?
          ORDER BY id DESC
          LIMIT 5`,
        [`%${raw}%`]
      );
      list = fallback;
    }

    res.json({
      ok: true,
      items: list.map(r => ({
        id: String(r.id),
        name: r.name,
        price: Number(r.effective_price || 0),
        image: r.image_url || null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/* ---------------------  B) Ask AI (상품 Q&A)  --------------------- */
/**
 * body: { productId:number|string, question:string, qty?:number }
 * - 로그인 여부와 무관하게 작동. 로그인 시 쿠폰/등급까지 반영해서 설명.
 * - OpenAI 키가 없으면 규칙 기반(mini) 답변으로 폴백.
 */
router.post('/ask', async (req, res, next) => {
  try {
    const { productId, question, qty } = req.body || {};
    const q = String(question || '').trim();
    const id = Number(productId);
    const nQty = Math.max(1, Number(qty || 1));

    if (!id || !q) {
      return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
    }

    // 1) 상품/가격/재고
    const [[p]] = await pool.query(
      `SELECT id, name, stock, shipping_fee,
              IF(sale_price IS NOT NULL AND (sale_ends_at IS NULL OR sale_ends_at > NOW()),
                 sale_price, price) AS price
         FROM products WHERE id=? LIMIT 1`, [id]
    );
    if (!p) return res.status(404).json({ ok:false, error:'PRODUCT_NOT_FOUND' });

    // 2) 유저/멤버십/쿠폰 (로그인X면 스킵)
    const userId = req.session?.user?.id || null;

    // 누적/레벨
    let lifetime = 0, level = 'LV1';
    const decideLevel = (sum) => (sum >= 1_000_000 ? 'LV100' : sum >= 100_000 ? 'LV10' : 'LV1');
    if (userId) {
      const [[sumRow]] = await pool.query(
        `SELECT COALESCE(SUM(total_price),0) AS lifetime
           FROM orders
          WHERE user_id=? AND UPPER(status) IN ('CREATED','PAID','FULFILLED')`,
        [userId]
      );
      lifetime = Number(sumRow?.lifetime || 0);
      level = decideLevel(lifetime);
    }

    // 보유 쿠폰
    let coupons = [];
    if (userId) {
      const [rows] = await pool.query(
        `SELECT uc.coupon_code AS code, ct.label, ct.kind, ct.amount,
                uc.expires_at, uc.used_order_id
           FROM user_coupons uc
           JOIN coupon_types ct ON ct.code = uc.coupon_code
          WHERE uc.user_id=?
          ORDER BY uc.id DESC`, [userId]
      );
      const now = new Date();
      coupons = rows.filter(c => !c.used_order_id && (!c.expires_at || new Date(c.expires_at) > now));
    }

    // 3) 배송 정책(프론트와 통일): 합계 >= 20,000이면 무료, 아니면 DB shipping_fee
    const FREE_SHIP_THRESHOLD = 20_000;
    const productTotal = Number(p.price) * nQty;
    const deliveryFee = productTotal >= FREE_SHIP_THRESHOLD ? 0 : Number(p.shipping_fee || 0);

    // 4) 컨텍스트 텍스트
    const ctx = {
      product: { id: p.id, name: p.name, price: Number(p.price), stock: Number(p.stock), shippingFee: Number(p.shipping_fee || 0) },
      ask: { qty: nQty, subtotal: productTotal, deliveryFee, freeThreshold: FREE_SHIP_THRESHOLD },
      user: userId ? { id: userId, lifetime, level, coupons } : null
    };

    // 5) 규칙 기반(폴백) 한-두 문장 답변 생성
    const ruleAnswer = (() => {
      const lc = q.toLowerCase();
      const parts = [];

      // 배송/배송비
      if (lc.includes('배송') || lc.includes('shipping') || lc.includes('delivery')) {
        const shipMsg = productTotal >= FREE_SHIP_THRESHOLD
          ? `이 상품을 ${nQty}개 담으면 합계 ${productTotal.toLocaleString('ko-KR')}원이라 배송비가 무료예요.`
          : `현재 ${productTotal.toLocaleString('ko-KR')}원이라 배송비는 ${deliveryFee.toLocaleString('ko-KR')}원이에요(합계 20,000원 이상 무료).`;
        parts.push(shipMsg);
      }

      // 재고
      if (lc.includes('재고') || lc.includes('stock') || lc.includes('없') || lc.includes('품절')) {
        parts.push(`재고는 ${p.stock.toLocaleString('ko-KR')}개 남아 있어요.`);
      }

      // 쿠폰/할인
      if (lc.includes('쿠폰') || lc.includes('할인') || lc.includes('디스카운트')) {
        if (!userId) {
          parts.push('로그인하면 보유한 쿠폰을 확인해 적용할 수 있어요.');
        } else if (coupons.length) {
          const top = coupons[0];
          if (top.kind === 'shipping') {
            parts.push(`보유 쿠폰 중 ‘${top.label}’로 배송비를 0원으로 만들 수 있어요.`);
          } else if (top.kind === 'amount') {
            parts.push(`보유 쿠폰 중 ‘${top.label}’으로 최대 ${Number(top.amount).toLocaleString('ko-KR')}원 할인돼요.`);
          }
        } else {
          parts.push('현재 적용 가능한 쿠폰이 없어 보여요.');
        }
      }

      if (!parts.length) {
        parts.push(
          `${p.name} 가격은 ${Number(p.price).toLocaleString('ko-KR')}원, ${nQty}개 기준 합계 ${productTotal.toLocaleString('ko-KR')}원이에요.`,
          productTotal >= FREE_SHIP_THRESHOLD ? '이 수량이면 배송비는 무료예요.' : `이 수량이면 배송비는 ${deliveryFee.toLocaleString('ko-KR')}원이에요(20,000원 이상 무료).`
        );
      }
      return parts.join(' ');
    })();

    // 6) OpenAI 사용 가능하면 간단 프롬프트로 2~5문장 답변 생성
    let final = ruleAnswer;
    if (openai) {
      try {
        const messages = [
          { role: 'system', content: '너는 쇼핑몰 고객 Q&A 도우미야. 반드시 한국어로 2~5문장으로 간단/정확하게 답해. 모르면 모른다고 말해. 수치/정책은 제공된 컨텍스트만 사용해.' },
          { role: 'user', content:
`[컨텍스트]
상품명: ${p.name}
단가: ${Number(p.price)}원
수량: ${nQty}개
합계: ${productTotal}원
배송정책: 합계 20,000원 이상 무료, 미만은 ${Number(p.shipping_fee || 0)}원
재고: ${p.stock}개
사용자: ${userId ? `로그인됨, 등급 ${level}, 누적 ${lifetime}원, 보유쿠폰 ${coupons.map(c=>`${c.label}(${c.kind}${c.amount?`:${c.amount}`:''})`).join(', ') || '없음'}` : '비로그인'}

[질문]
${q}

위 정보만 사용해서 답변해. 숫자는 원 단위로 콤마 표기(예: 13,000원).`}
        ];
        const r = await openai.chat.completions.create({
          model: AI_MODEL,
          messages,
          temperature: 0.2,
        });
        const txt = r?.choices?.[0]?.message?.content?.trim();
        if (txt) final = txt;
      } catch (e) {
        console.warn('[AI] OpenAI 호출 실패, 폴백 사용:', e?.message);
      }
    }

    return res.json({ ok:true, answer: final, ctx });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
