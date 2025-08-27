// api/shop.mysql.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); // db.js가 풀 자체 export

/* ======================== 공통 ======================== */

function requireLogin(req, res, next) {
  if (req.session && req.session.user && req.session.user.id) return next();
  return res.status(401).json({ ok:false, error:'LOGIN_REQUIRED' });
}

// 누적 합산에 포함할 주문 상태
const ELIGIBLE_STATUSES = new Set(['CREATED','PAID','FULFILLED']);

// 멤버십 레벨 결정
function decideLevel(krw) {
  if (krw >= 1_000_000) return 'LV100';
  if (krw >=   100_000) return 'LV10';
  return 'LV1';
}

// 배송비(원)
const BASE_SHIPPING_FEE = 1000;

/* 장바구니 합계(트랜잭션 내, 재고잠금) */
async function computeCartSubtotal(conn, userId) {
  const [items] = await conn.query(`
    SELECT ci.product_id, ci.quantity, p.price, p.stock, p.shipping_fee
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ?
     FOR UPDATE
  `, [userId]);

  if (items.length === 0) throw new Error('CART_EMPTY');
  for (const it of items) {
    if (it.quantity > it.stock) throw new Error('OUT_OF_STOCK');
  }

  const subtotal = items.reduce((sum, it) => sum + (it.price * it.quantity), 0);

  // 규칙: 담긴 모든 상품이 무료배송이면 0원, 아니면 1,000원
  const allFree = items.every(it => Number(it.shipping_fee ?? BASE_SHIPPING_FEE) === 0);
  const shippingFee = allFree ? 0 : BASE_SHIPPING_FEE;

  return { items, subtotal, shippingFee };
}

/* 쿠폰 조회/검증(미사용/미만료) */
async function getValidCoupon(conn, userId, couponCode) {
  if (!couponCode) return null;
  const [[row]] = await conn.query(`
    SELECT uc.id AS user_coupon_id, uc.coupon_code, uc.used_order_id, uc.expires_at,
           ct.kind, ct.amount, ct.label
      FROM user_coupons uc
      JOIN coupon_types ct ON ct.code = uc.coupon_code
     WHERE uc.user_id = ? AND uc.coupon_code = ?
     LIMIT 1
  `, [userId, couponCode]);

  if (!row) throw new Error('COUPON_NOT_FOUND');
  if (row.used_order_id) throw new Error('COUPON_ALREADY_USED');
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new Error('COUPON_EXPIRED');
  }
  return row; // { user_coupon_id, coupon_code, kind, amount, label, ... }
}

/* ======================== 1) 상품 목록 ======================== */
router.get('/products', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim(); // GET 파라미터 ?q=...
    const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);

    let sql = 'SELECT id, name, price, stock, image_url FROM products';
    const params = [];

    if (q) {
      sql += ' WHERE name LIKE ?';     // 상품명에서 검색
      params.push(`%${q}%`);
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok:true, products: rows });
  } catch (e) { next(e); }
});


/* ======================== 2) 장바구니 조회 ======================== */
router.get('/cart', requireLogin, async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await pool.query(`
      SELECT ci.id, ci.product_id, p.name, p.price, p.stock, ci.quantity, p.image_url
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ?`, [userId]);
    res.json({ ok:true, items: rows });
  } catch (e) { next(e); }
});

/* ======================== 3) 장바구니 담기 ======================== */
router.post('/cart/add', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity < 1) {
    return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query('SELECT id, stock FROM products WHERE id=? FOR UPDATE', [productId]);
    if (!p) throw new Error('PRODUCT_NOT_FOUND');
    await conn.query(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = LEAST(quantity + VALUES(quantity), ?)
    `, [userId, productId, quantity, p.stock]);
    await conn.commit();
    res.json({ ok:true });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ ok:false, error:e.message });
  } finally {
    conn.release();
  }
});

/* ======================== 4) 장바구니 수량 변경/삭제 ======================== */
router.post('/cart/update', requireLogin, async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { productId, quantity } = req.body;
    if (!productId || quantity == null || quantity < 0) {
      return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
    }
    if (quantity === 0) {
      await pool.query('DELETE FROM cart_items WHERE user_id=? AND product_id=?', [userId, productId]);
      return res.json({ ok:true });
    }
    const [[p]] = await pool.query('SELECT stock FROM products WHERE id=?', [productId]);
    if (!p) return res.status(404).json({ ok:false, error:'PRODUCT_NOT_FOUND' });
    if (quantity > p.stock) return res.status(400).json({ ok:false, error:'OUT_OF_STOCK' });
    await pool.query('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?',
      [quantity, userId, productId]);
    res.json({ ok:true });
  } catch (e) { next(e); }
});

/* ======================== 5) 장바구니 아이템 삭제 ======================== */
router.delete('/cart/:id', requireLogin, async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const id = Number(req.params.id);
    await pool.query('DELETE FROM cart_items WHERE id=? AND user_id=?', [id, userId]);
    res.json({ ok:true });
  } catch (e) { next(e); }
});

/* ======================== 6) 결제 미리보기(쿠폰 적용) ======================== */
router.post('/checkout/preview', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { couponCode } = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { subtotal, shippingFee: baseShippingFee } = await computeCartSubtotal(conn, userId);

    // 기본은 장바구니 기준 배송비
    let shippingFee = baseShippingFee;
    let discount = 0;
    let applied = null;

    if (couponCode) {
      const c = await getValidCoupon(conn, userId, couponCode);
      applied = { code: c.coupon_code, kind: c.kind, amount: c.amount, label: c.label };
      if (c.kind === 'shipping') {
        shippingFee = 0; // 무료배송 쿠폰
      } else if (c.kind === 'amount') {
        discount = Math.min(subtotal, Number(c.amount || 0));
      }
    }

    const total = Math.max(0, subtotal - discount) + shippingFee;

    await conn.rollback(); // 미리보기: DB 변경 없음
    res.json({ ok:true, subtotal, discount, shippingFee, total, applied });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ ok:false, error: e.message || 'PREVIEW_FAILED' });
  } finally {
    conn.release();
  }
});


/* ======================== 6-0) 체크아웃(장바구니→주문, 쿠폰 적용) ======================== */
router.post('/checkout', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { couponCode } = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) 합계
    const { items, subtotal, shippingFee: baseShippingFee } = await computeCartSubtotal(conn, userId);

    // 2) 쿠폰 적용
    let shippingFee = baseShippingFee;
    let discount = 0;
    let usedUserCouponId = null;
    let applied = null;

    if (couponCode) {
      const c = await getValidCoupon(conn, userId, couponCode);
      usedUserCouponId = c.user_coupon_id;
      applied = { code: c.coupon_code, kind: c.kind, amount: c.amount, label: c.label };
      if (c.kind === 'shipping') {
        shippingFee = 0;
      } else if (c.kind === 'amount') {
        discount = Math.min(subtotal, Number(c.amount || 0));
      }
    }

    const total = Math.max(0, subtotal - discount) + shippingFee;

    // 3) 주문 생성(최종 결제금액 저장)
    const [orderRes] = await conn.query(
      'INSERT INTO orders (user_id, status, total_price) VALUES (?, "CREATED", ?)',
      [userId, total]
    );
    const orderId = orderRes.insertId;

    // 4) 아이템 복사 + 재고 차감
    for (const it of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, price, quantity) VALUES (?, ?, ?, ?)',
        [orderId, it.product_id, it.price, it.quantity]
      );
      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [it.quantity, it.product_id]
      );
    }

    // 5) 쿠폰 사용 처리
    if (usedUserCouponId) {
      await conn.query(
        'UPDATE user_coupons SET used_order_id = ? WHERE id = ?',
        [orderId, usedUserCouponId]
      );
    }

    // 6) 장바구니 비우기
    await conn.query('DELETE FROM cart_items WHERE user_id=?', [userId]);

    await conn.commit();
    res.json({
      ok:true,
      orderId,
      breakdown: { subtotal, discount, shippingFee, total, applied }
    });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ ok:false, error: e.message || 'CHECKOUT_FAILED' });
  } finally {
    conn.release();
  }
});


/* ======================== 6-1) 즉시구매(옵션) ======================== */
router.post('/checkout/direct', requireLogin, async (req, res) => {
  // 필요 시 couponCode 동일 패턴으로 추가 가능
  const userId = req.session.user.id;
  const { items } = req.body; // [{ productId, quantity }]
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ ok:false, error:'INVALID_ITEMS' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const ids = items.map(it => it.productId);
    const placeholders = ids.map(() => '?').join(',');
    const [prods] = await conn.query(
      `SELECT id, price, stock FROM products WHERE id IN (${placeholders}) FOR UPDATE`, ids
    );
    const map = new Map(prods.map(p => [p.id, p]));

    let total = 0;
    for (const it of items) {
      const p = map.get(it.productId);
      if (!p) throw new Error('PRODUCT_NOT_FOUND');
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw new Error('INVALID_QTY');
      if (qty > p.stock) throw new Error('OUT_OF_STOCK');
      total += p.price * qty;
    }

    const [orderRes] = await conn.query(
      'INSERT INTO orders (user_id, status, total_price) VALUES (?, "CREATED", ?)',
      [userId, total]
    );
    const orderId = orderRes.insertId;

    for (const it of items) {
      const p = map.get(it.productId);
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, price, quantity) VALUES (?, ?, ?, ?)',
        [orderId, p.id, p.price, it.quantity]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, p.id]);
    }

    await conn.commit();
    res.json({ ok:true, orderId, total });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ ok:false, error:e.message });
  } finally {
    conn.release();
  }
});

/* ======================== 7) 내 주문내역(+lifetime/level) ======================== */
router.get('/orders/me', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const [orders] = await pool.query(
      'SELECT id, status, total_price, created_at FROM orders WHERE user_id=? ORDER BY id DESC',
      [userId]
    );

    // lifetime 계산(정책: CREATED/PAID/FULFILLED 포함)
    const [[sumRow]] = await pool.query(
      `SELECT COALESCE(SUM(total_price),0) AS lifetime
         FROM orders
        WHERE user_id=? AND UPPER(status) IN ('CREATED','PAID','FULFILLED')`,
      [userId]
    );
    const lifetime = Number(sumRow?.lifetime || 0);
    const level = decideLevel(lifetime);

    if (orders.length === 0) {
      return res.json({ ok: true, orders: [], items: [], lifetime, level });
    }

    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const [items] = await pool.query(`
      SELECT 
        oi.order_id,
        oi.product_id,
        p.name,
        p.image_url,
        oi.price,
        oi.quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.order_id DESC, oi.id DESC
    `, orderIds);

    return res.json({ ok: true, orders, items, lifetime, level });
  } catch (e) {
    console.error('GET /orders/me error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'INTERNAL_ERROR' });
  }
});

/* ======================== 8) 멤버십 쿠폰 발급(한 번만) ======================== */
router.post('/membership/claim', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 이미 한 번이라도 웰컴 쿠폰을 받은 적이 있으면 재발급 금지
    const [[welcomed]] = await conn.query(
      `SELECT 1 FROM user_coupons WHERE user_id=? AND coupon_code='M_LV1_5K' LIMIT 1`,
      [userId]
    );
    if (welcomed) {
      await conn.commit();
      return res.json({ ok:true, issued: [], note: 'ALREADY_WELCOMED' });
    }

    // lifetime 계산
    const [[sumRow]] = await conn.query(
      `SELECT COALESCE(SUM(total_price),0) AS lifetime
         FROM orders
        WHERE user_id=? AND UPPER(status) IN ('CREATED','PAID','FULFILLED')`,
      [userId]
    );
    const lifetime = Number(sumRow?.lifetime || 0);
    const level = decideLevel(lifetime);

    const issued = [];
    // 웰컴 쿠폰은 첫 진입(누적 0원)일 때만 1장 지급
    if (lifetime === 0) {
      await conn.query(
        `INSERT INTO user_coupons (user_id, coupon_code, expires_at, used_order_id)
         VALUES (?, 'M_LV1_5K', NULL, NULL)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [userId]
      );
      issued.push({ code: 'M_LV1_5K', label: 'Level 1: 5,000₩ Discount' });
    }

    await conn.commit();
    res.json({ ok:true, lifetime, level, issued });
  } catch (e) {
    await conn.rollback();
    console.error('POST /membership/claim error:', e);
    res.status(500).json({ ok:false, error:e.message || 'INTERNAL_ERROR' });
  } finally {
    conn.release();
  }
});

/* ======================== 9) 내 쿠폰 목록(조회 전용 + 1회 시드) ======================== */
router.get('/coupons/me', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 최신 lifetime
    const [[sumRow]] = await conn.query(
      `SELECT COALESCE(SUM(total_price),0) AS lifetime
         FROM orders
        WHERE user_id=? AND UPPER(status) IN ('CREATED','PAID','FULFILLED')`,
      [userId]
    );
    const lifetime = Number(sumRow?.lifetime || 0);

    // ── 평생 1회 시드 ───────────────────────────────────────────
    // LV1: 0원일 때만
    if (lifetime === 0) {
      await conn.query(
        `INSERT IGNORE INTO user_coupons (user_id, coupon_code, expires_at)
         VALUES (?, 'M_LV1_5K', NULL)`,
        [userId]
      );
    }

    // LV10: 10만원 이상이면 코드별 1회씩(있으면 무시)
    if (lifetime >= 100000) {
      await conn.query(
        `INSERT IGNORE INTO user_coupons (user_id, coupon_code, expires_at)
         VALUES (?, 'M_LV10_10K', NULL)`,
        [userId]
      );
      // 필요 시 보조 코드도 1회만
      await conn.query(
        `INSERT IGNORE INTO user_coupons (user_id, coupon_code, expires_at)
         VALUES (?, 'M_LV10_5K', NULL)`,
        [userId]
      );
    }

    // LV100: 100만원 이상이면 코드별 1회씩(있으면 무시)
    if (lifetime >= 1000000) {
      await conn.query(
        `INSERT IGNORE INTO user_coupons (user_id, coupon_code, expires_at)
         VALUES (?, 'M_LV100_100K', NULL)`,
        [userId]
      );
      await conn.query(
        `INSERT IGNORE INTO user_coupons (user_id, coupon_code, expires_at)
         VALUES (?, 'M_LV100_SHP', NULL)`,
        [userId]
      );
    }
    // ───────────────────────────────────────────────────────────

    await conn.commit();

    // 최종 목록 (조회 전용)
    const [rows] = await pool.query(
      `SELECT uc.id,
              uc.coupon_code AS code,
              ct.label, ct.kind, ct.amount,
              uc.expires_at, uc.used_order_id
         FROM user_coupons uc
         JOIN coupon_types ct ON ct.code = uc.coupon_code
        WHERE uc.user_id=?
        ORDER BY uc.id DESC`,
      [userId]
    );
    res.json({ ok:true, coupons: rows });
  } catch (e) {
    await conn.rollback();
    console.error('GET /coupons/me error:', e);
    res.status(500).json({ ok:false, error:'INTERNAL_ERROR' });
  } finally {
    conn.release();
  }
});



/* ======================== 10) 멤버십/쿠폰 재동기화(정리만, 재발급 없음) ======================== */
router.post('/membership/resync', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 최신 lifetime
    const [[sumRow]] = await conn.query(
      `SELECT COALESCE(SUM(total_price),0) AS lifetime
         FROM orders
        WHERE user_id=? AND UPPER(status) IN ('CREATED','PAID','FULFILLED')`,
      [userId]
    );
    const lifetime = Number(sumRow?.lifetime || 0);
    const level = decideLevel(lifetime);

    // 조건 미달 "미사용" 쿠폰 삭제만 수행 (재발급 없음)
    await conn.query(`
      DELETE uc
      FROM user_coupons uc
      JOIN coupon_types ct ON ct.code = uc.coupon_code
      WHERE uc.user_id = ?
        AND uc.used_order_id IS NULL
        AND (
          (ct.level_required='LV100' AND ? < 1000000) OR
          (ct.level_required='LV10'  AND ? < 100000)
        )
    `, [userId, lifetime, lifetime]);

    await conn.commit();
    res.json({ ok:true, lifetime, level });
  } catch (e) {
    await conn.rollback();
    console.error('POST /membership/resync error:', e);
    res.status(500).json({ ok:false, error:'RESYNC_FAILED' });
  } finally {
    conn.release();
  }
});

module.exports = router;

