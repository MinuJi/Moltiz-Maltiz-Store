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

/* ====== 공통: 사이트 정책(FAQ/고객센터) 컨텍스트 ====== */
const SITE_POLICY = {
  contactPhone: '010-xxxx-xxxx',
  csHours: 'AM 09:00 ~ PM 18:00',
  deliveryTime: '2–3 business days',
  refundPolicy: '결제 후에는 제품 하자(불량) 외 환불 불가',
  changeWindowHours: 12,
  tracking: '발송 후 이메일로 송장 안내',
  freeShipThreshold: 20000, // 합계 2만원 이상 무료
  shippingNote: '2만원 미만은 상품별 기본 배송비가 적용됩니다(상품 상세 참고).'
};

/* ====== 공통: 멤버십 정책 ======
   - 화면 카드와 동일하게 반영
   - 계산 로직(배송비 무료)은 실제 결제 엔진 기준(합계 2만원 이상)으로 안내.
     LV100 "무료배송"은 보유 쿠폰 등으로 제공될 수 있음을 설명만 함. */
const MEMBERSHIP_POLICY = {
  levels: [
    { id: 'LV1',   min: 0,        next: 'LV10',  nextAt: 100000,  benefits: ['5,000원 할인 쿠폰 1장'] },
    { id: 'LV10',  min: 100000,   next: 'LV100', nextAt: 1000000, benefits: ['10,000원 할인 쿠폰 1장', '5,000원 할인 쿠폰 1장'] },
    { id: 'LV100', min: 1000000,  next: null,    nextAt: null,    benefits: ['모든 주문 무료 배송(정책/쿠폰으로 제공될 수 있음)', '100,000원 할인 쿠폰 1장'] },
  ],
  summary: 'LV1(0원~) / LV10(10만원~) / LV100(100만원~)'
};

// 유틸: 현재 등급/다음 등급 계산
function decideLevel(sum) {
  return sum >= 1_000_000 ? 'LV100' : sum >= 100_000 ? 'LV10' : 'LV1';
}
function getLevelInfo(sum) {
  const level = decideLevel(sum);
  const def = MEMBERSHIP_POLICY.levels.find(l => l.id === level);
  const nextAt = def?.nextAt ?? null;
  const remaining = nextAt ? Math.max(0, nextAt - sum) : 0;
  return { level, benefits: def?.benefits || [], next: def?.next || null, nextAt, remaining };
}
const krw = n => Number(n || 0).toLocaleString('ko-KR') + '원';

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

/* ---------------------  B) Ask AI (상품 Q&A + 일반 Q&A + 멤버십)  --------------------- */
/**
 * body: { productId?:number|string, question:string, qty?:number }
 * - productId 없으면: 고객센터/FAQ/멤버십 Q&A
 * - productId 있으면: 상품 + 사용자 혜택(쿠폰/등급 요약) 포함 Q&A
 * - OpenAI가 없으면 규칙기반 답변
 */
router.post('/ask', async (req, res, next) => {
  try {
    const { productId, question, qty } = req.body || {};
    const q = String(question || '').trim();
    const id = productId ? Number(productId) : null;
    const nQty = Math.max(1, Number(qty || 1));
    if (!q) return res.status(400).json({ ok:false, error:'INVALID_INPUT' });

    // 사용자(로그인) 정보
    const userId = req.session?.user?.id || null;
    let lifetime = 0;
    let levelInfo = getLevelInfo(0);
    if (userId) {
      const [[sumRow]] = await pool.query(
        `SELECT COALESCE(SUM(total_price),0) AS lifetime
           FROM orders
          WHERE user_id=? AND UPPER(status) IN ('CREATED','PAID','FULFILLED')`,
        [userId]
      );
      lifetime = Number(sumRow?.lifetime || 0);
      levelInfo = getLevelInfo(lifetime);
    }

    /* ===== 케이스 1: productId 없음 → 일반(FAQ/멤버십) Q&A ===== */
    if (!id) {
      const lc = q.toLowerCase();
      const parts = [];

      // 멤버십 질문 키워드
      const isMembership =
        ['멤버','멤버십','회원','혜택','등급','레벨','승급','level','benefit','membership','tier']
          .some(k => lc.includes(k));

      if (isMembership) {
        parts.push(
          `현재 등급: ${levelInfo.level}${userId ? ` (누적 ${krw(lifetime)})` : ''}.`,
          `혜택: ${levelInfo.benefits.join(', ') || '등급 혜택 정보 없음'}.`
        );
        if (levelInfo.next) {
          parts.push(
            `다음 등급(${levelInfo.next})까지 ${krw(levelInfo.remaining)} 남았어요.`,
            `등급 요약: ${MEMBERSHIP_POLICY.summary}.`
          );
        } else {
          parts.push('최고 등급이에요. 🎉');
        }
      }

      // 일반 고객센터/배송/환불/변경/트래킹/상담
      if (lc.includes('배송') || lc.includes('delivery') || lc.includes('shipping')) {
        parts.push(
          `배송 기간은 보통 ${SITE_POLICY.deliveryTime}이에요.`,
          `합계 ${krw(SITE_POLICY.freeShipThreshold)} 이상은 무료배송, 미만은 ${SITE_POLICY.shippingNote}`
        );
      }
      if (lc.includes('환불') || lc.includes('refund') || lc.includes('반품')) {
        parts.push(`환불은 ${SITE_POLICY.refundPolicy}입니다.`);
      }
      if (lc.includes('변경') || lc.includes('수정') || lc.includes('change')) {
        parts.push(`주문은 결제 후 ${SITE_POLICY.changeWindowHours}시간 이내에만 변경할 수 있어요.`);
      }
      if (lc.includes('송장') || lc.includes('트래킹') || lc.includes('tracking')) {
        parts.push(`${SITE_POLICY.tracking}로 받아보실 수 있어요.`);
      }
      if (lc.includes('상담') || lc.includes('영업') || lc.includes('운영') || lc.includes('시간') || lc.includes('연락') || lc.includes('전화') || lc.includes('customer')) {
        parts.push(`상담시간은 ${SITE_POLICY.csHours}, 연락처는 ${SITE_POLICY.contactPhone} 입니다.`);
      }

      if (!parts.length) {
        parts.push(
          '무엇을 도와드릴까요? (예: 멤버십 등급/혜택, 배송비/배송기간, 환불/주문변경, 트래킹, 상담시간/연락처)',
          `멤버십 요약: ${MEMBERSHIP_POLICY.summary}.`
        );
      }
      let final = parts.join(' ');

      // OpenAI가 있으면 멤버십/정책 포함해 자연스럽게
      if (openai) {
        try {
          const messages = [
            { role: 'system', content: '너는 쇼핑몰 고객 Q&A 도우미야. 반드시 한국어로 2~5문장으로 간단/정확하게 답해. 제공된 정책/멤버십만 사실로 사용해.' },
            { role: 'user', content:
`[사이트 정책]
- 고객센터: ${SITE_POLICY.contactPhone}
- 상담 시간: ${SITE_POLICY.csHours}
- 배송 기간: ${SITE_POLICY.deliveryTime}
- 무료배송: 합계 ${SITE_POLICY.freeShipThreshold}원 이상
- 그 외 배송비: ${SITE_POLICY.shippingNote}
- 환불 정책: ${SITE_POLICY.refundPolicy}
- 주문 변경: 결제 후 ${SITE_POLICY.changeWindowHours}시간 이내
- 트래킹: ${SITE_POLICY.tracking}

[멤버십 정책]
- 등급 요약: ${MEMBERSHIP_POLICY.summary}
- LV1 혜택: ${MEMBERSHIP_POLICY.levels[0].benefits.join(', ')}
- LV10 혜택: ${MEMBERSHIP_POLICY.levels[1].benefits.join(', ')}
- LV100 혜택: ${MEMBERSHIP_POLICY.levels[2].benefits.join(', ')}
(참고: 실제 결제 계산은 "합계 2만원 이상 무료배송" 규칙 기준이며, LV100 무료배송은 쿠폰/정책으로 제공될 수 있음)

[사용자]
- 로그인: ${Boolean(userId)}
- 현재 등급: ${levelInfo.level}
- 누적 결제금액: ${krw(lifetime)}
- 다음 등급: ${levelInfo.next ? levelInfo.next : '없음'}
- 다음 등급까지 남은 금액: ${levelInfo.next ? krw(levelInfo.remaining) : '0원'}

[질문]
${q}

위 정보만 근거로 2~5문장, 친절하고 간결하게 한국어로 답변해. 숫자는 원 단위 콤마 표기.`}
          ];
          const r = await openai.chat.completions.create({
            model: AI_MODEL,
            messages,
            temperature: 0.2,
          });
          const txt = r?.choices?.[0]?.message?.content?.trim();
          if (txt) final = txt;
        } catch (e) {
          console.warn('[AI] OpenAI(일반/멤버십) 실패, 폴백 사용:', e?.message);
        }
      }

      return res.json({
        ok: true,
        answer: final,
        ctx: { site: SITE_POLICY, membership: { policy: MEMBERSHIP_POLICY, user: { lifetime, ...levelInfo } } }
      });
    }

    /* ===== 케이스 2: productId 있음 → 상품 컨텍스트 Q&A ===== */
    // 1) 상품
    const [[p]] = await pool.query(
      `SELECT id, name, stock, shipping_fee,
              IF(sale_price IS NOT NULL AND (sale_ends_at IS NULL OR sale_ends_at > NOW()),
                 sale_price, price) AS price
       FROM products WHERE id=? LIMIT 1`, [id]
    );
    if (!p) return res.status(404).json({ ok:false, error:'PRODUCT_NOT_FOUND' });

    // 2) 쿠폰
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

    // 3) 배송 계산(통일): 합계 >= 20,000 무료, 아니면 상품 shipping_fee
    const FREE_SHIP_THRESHOLD = SITE_POLICY.freeShipThreshold;
    const productTotal = Number(p.price) * nQty;
    const deliveryFee = productTotal >= FREE_SHIP_THRESHOLD ? 0 : Number(p.shipping_fee || 0);

    // 4) 규칙 기반 답변
    const lc = q.toLowerCase();
    const parts = [];

    // 멤버십 관련 질문이면 우선 안내
    const isMembershipQ =
      ['멤버','멤버십','회원','혜택','등급','레벨','승급','level','benefit','membership','tier']
        .some(k => lc.includes(k));
    if (isMembershipQ) {
      parts.push(
        `현재 등급: ${levelInfo.level}${userId ? ` (누적 ${krw(lifetime)})` : ''}.`,
        `혜택: ${levelInfo.benefits.join(', ') || '등급 혜택 정보 없음'}.`
      );
      if (levelInfo.next) {
        parts.push(`다음 등급(${levelInfo.next})까지 ${krw(levelInfo.remaining)} 남았어요.`);
      } else {
        parts.push('최고 등급이에요. 🎉');
      }
    }

    if (lc.includes('배송') || lc.includes('shipping') || lc.includes('delivery')) {
      const shipMsg = productTotal >= FREE_SHIP_THRESHOLD
        ? `이 상품을 ${nQty}개 담으면 합계 ${productTotal.toLocaleString('ko-KR')}원이라 배송비가 무료예요.`
        : `현재 합계 ${productTotal.toLocaleString('ko-KR')}원이라 배송비는 ${deliveryFee.toLocaleString('ko-KR')}원이에요(합계 ${FREE_SHIP_THRESHOLD.toLocaleString('ko-KR')}원 이상 무료).`;
      parts.push(shipMsg, `배송 기간은 보통 ${SITE_POLICY.deliveryTime}입니다.`);
    }
    if (lc.includes('재고') || lc.includes('stock') || lc.includes('없') || lc.includes('품절')) {
      parts.push(`재고는 ${p.stock.toLocaleString('ko-KR')}개 남아 있어요.`);
    }
    if (lc.includes('쿠폰') || lc.includes('할인') || lc.includes('디스카운트')) {
      if (!userId) {
        parts.push('로그인하면 보유한 쿠폰을 확인해 적용할 수 있어요.');
      } else if (coupons.length) {
        const ship = coupons.find(c => c.kind === 'shipping');
        const amount = coupons
          .filter(c => c.kind === 'amount')
          .sort((a,b) => Number(b.amount||0) - Number(a.amount||0))[0];
        if (ship) parts.push(`‘${ship.label}’(배송비) 쿠폰으로 배송비를 0원으로 만들 수 있어요.`);
        if (amount) parts.push(`금액할인 쿠폰 ‘${amount.label}’로 최대 ${krw(amount.amount)} 할인돼요.`);
        if (!ship && !amount) parts.push('보유 쿠폰이 있긴 하지만 적용 가능한 종류가 없어 보여요.');
      } else {
        parts.push('현재 적용 가능한 쿠폰이 없어 보여요.');
      }
    }
    if (lc.includes('환불') || lc.includes('반품')) {
      parts.push(`환불 정책: ${SITE_POLICY.refundPolicy}입니다.`);
    }
    if (lc.includes('변경') || lc.includes('수정')) {
      parts.push(`주문 변경은 결제 후 ${SITE_POLICY.changeWindowHours}시간 이내에 가능해요.`);
    }
    if (lc.includes('송장') || lc.includes('트래킹') || lc.includes('tracking')) {
      parts.push(`${SITE_POLICY.tracking}로 안내드려요.`);
    }

    if (!parts.length) {
      parts.push(
        `${p.name} 가격은 ${Number(p.price).toLocaleString('ko-KR')}원, ${nQty}개 기준 합계 ${productTotal.toLocaleString('ko-KR')}원이에요.`,
        productTotal >= FREE_SHIP_THRESHOLD ? '이 수량이면 배송비는 무료예요.' : `이 수량이면 배송비는 ${deliveryFee.toLocaleString('ko-KR')}원이에요(20,000원 이상 무료).`
      );
    }
    let final = parts.join(' ');

    // 5) OpenAI(있으면)으로 다듬기 — 멤버십 정책까지 컨텍스트 제공
    if (openai) {
      try {
        const messages = [
          { role: 'system', content: '너는 쇼핑몰 고객 Q&A 도우미야. 반드시 한국어로 2~5문장으로 간단/정확하게 답해. 모르면 모른다고 말하고, 수치/정책은 제공된 컨텍스트만 사용해.' },
          { role: 'user', content:
`[컨텍스트]
상품명: ${p.name}
단가: ${Number(p.price)}원
수량: ${nQty}개
합계: ${productTotal}원
배송정책: 합계 ${SITE_POLICY.freeShipThreshold}원 이상 무료, 미만은 ${Number(p.shipping_fee || 0)}원
재고: ${p.stock}개
사이트정책: 배송기간 ${SITE_POLICY.deliveryTime}, 환불 "${SITE_POLICY.refundPolicy}", 변경 ${SITE_POLICY.changeWindowHours}시간 이내, 트래킹 "${SITE_POLICY.tracking}"
멤버십 요약: ${MEMBERSHIP_POLICY.summary}
LV1 혜택: ${MEMBERSHIP_POLICY.levels[0].benefits.join(', ')}
LV10 혜택: ${MEMBERSHIP_POLICY.levels[1].benefits.join(', ')}
LV100 혜택: ${MEMBERSHIP_POLICY.levels[2].benefits.join(', ')}
(참고: 실제 결제 계산은 "합계 2만원 이상 무료배송" 규칙 기준이며, LV100 무료배송은 쿠폰/정책으로 제공될 수 있음)

사용자: ${userId ? `로그인됨, 등급 ${levelInfo.level}, 누적 ${krw(lifetime)}, 다음 등급 ${levelInfo.next ?? '없음'}, 남은 금액 ${levelInfo.next ? krw(levelInfo.remaining) : '0원'}` : '비로그인'}

[질문]
${q}

위 정보만 사용해서 2~5문장, 자연스럽고 간결하게 한국어로 답변해. 숫자는 원 단위 콤마 표기(예: 13,000원).`}
        ];
        const r = await openai.chat.completions.create({
          model: AI_MODEL,
          messages,
          temperature: 0.2,
        });
        const txt = r?.choices?.[0]?.message?.content?.trim();
        if (txt) final = txt;
      } catch (e) {
        console.warn('[AI] OpenAI(상품/멤버십) 실패, 폴백 사용:', e?.message);
      }
    }

    return res.json({
      ok: true,
      answer: final,
      ctx: {
        site: SITE_POLICY,
        membership: { policy: MEMBERSHIP_POLICY, user: { lifetime, ...levelInfo } },
        product: { id: p.id, name: p.name, price: Number(p.price), stock: Number(p.stock), shippingFee: Number(p.shipping_fee || 0) },
        ask: { qty: nQty, subtotal: productTotal, deliveryFee, freeThreshold: SITE_POLICY.freeShipThreshold }
      }
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

