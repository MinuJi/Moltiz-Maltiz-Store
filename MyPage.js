/* MyPage (Orders + Coupons) — read-only: no auto-claim */
"use strict";

/* -------------- 로그인 이름 -------------- */
async function ensureSignedInName() {
  let name = (document.getElementById('welcome-name')?.textContent || '').trim();
  if (!name) {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) {
        const me = await r.json().catch(() => ({}));
        name = (me?.user?.name || me?.name || me?.username || me?.displayName || '').trim();
      }
    } catch {}
  }
  if (!name) name = (localStorage.getItem('userName') || '').trim();
  if (!name) name = 'Guest';
  document.getElementById('welcome-name')?.replaceChildren(name);
  localStorage.setItem('userName', name);
  return name;
}

/* -------------- 멤버십 티어 -------------- */
const TIERS = [
  { level: 'LV100', min: 1_000_000 },
  { level: 'LV10',  min:   100_000 },
  { level: 'LV1',   min:         0 },
];
const decideLevel = (n) => TIERS.find(t => n >= t.min).level;
const nextTierInfo = (n) => {
  const h = TIERS.filter(t => n < t.min).sort((a,b)=>a.min-b.min)[0];
  return h ? { nextLevel:h.level, remain:h.min-n } : { nextLevel:null, remain:0 };
};

/* -------------- 유틸 -------------- */
async function safeJson(r){ try { return await r.json(); } catch { return {}; } }
function esc(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function toLocal(v){ if(!v) return ''; const d=new Date(v); return isNaN(d)? String(v): d.toLocaleString(); }

const isAvailable = (c) => !c.used_order_id && (!c.expires_at || new Date(c.expires_at) > new Date());
const codePriority = (code='') => code.startsWith('M_LV100') ? 3 : code.startsWith('M_LV10') ? 2 : 1;

/* -------------- 쿠폰: 조회 전용 렌더 -------------- */
async function fetchMyCoupons() {
  const r = await fetch('/api/coupons/me', { credentials:'include' });
  if (!r.ok) return [];
  const d = await safeJson(r);
  return Array.isArray(d.coupons) ? d.coupons : [];
}

/** 마이페이지: 보유 쿠폰 전체 렌더(가용 먼저, 그 다음 사용/만료) */
function renderCouponsListAll(coupons) {
  const box = document.getElementById('couponList');
  if (!box) return;

  const now = new Date();
  const avail = [];
  const others = [];

  for (const c of coupons) {
    const expired = !!(c.expires_at && new Date(c.expires_at) < now);
    const used    = !!c.used_order_id;
    ( !used && !expired ? avail : others ).push(c);
  }

  // 가용 쿠폰: 등급 높은 코드 우선
  avail.sort((a,b)=> codePriority(b.code) - codePriority(a.code));

  const tpl = (c) => {
    const expired = !!(c.expires_at && new Date(c.expires_at) < new Date());
    const used    = !!c.used_order_id;
    const badge   = used ? `<span class="badge expired">USED</span>`
                  : expired ? `<span class="badge expired">EXPIRED</span>`
                  : `<span class="badge">AVAILABLE</span>`;
    const benefit = c.kind === 'shipping'
      ? 'Free Shipping'
      : `${Number(c.amount || 0).toLocaleString()}₩ Discount`;
    const expTxt  = c.expires_at ? ` (exp. ${new Date(c.expires_at).toLocaleDateString()})` : '';
    const label   = esc(c.label || c.code);

    return `
      <div class="coupon-item">
        <img src="https://ninjastorage.blob.core.windows.net/companyfiles/205623498/e13f727c-1a10-4a10-a878-3dba92afb77f.png" alt="Coupon">
        <div>
          <div><strong>${label}</strong>${expTxt}</div>
          <div>${benefit}</div>
        </div>
        ${badge}
      </div>`;
  };

  const html = [...avail, ...others].map(tpl).join('');
  box.innerHTML = html || `<div class="coupon-item">No coupons yet.</div>`;
}

/* -------------- 주문 로더 -------------- */
async function loadOrders() {
  const listEl = document.getElementById('orderList');
  const noEl   = document.getElementById('noOrder');
  if (!listEl || !noEl) return;

  listEl.innerHTML = '<div class="order-card">Loading...</div>';
  noEl.style.display = 'none';

  try {
    const r = await fetch('/api/orders/me', { credentials:'include' });
    if (r.status === 401) { location.href = '/Login.html'; return; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const p = await safeJson(r);
    const orders = Array.isArray(p.orders) ? p.orders : [];
    const items  = Array.isArray(p.items)  ? p.items  : [];

    if (orders.length === 0) {
      listEl.innerHTML = '';
      noEl.style.display = 'block';

      const lifetimeKRW = 0;
      localStorage.setItem('lifetimeSpendKRW','0');
      localStorage.setItem('membershipLevel','LV1');
      renderMembershipSummary(lifetimeKRW, 'LV1');

      // 조회 전용: 서버가 보장/시드해준 것만 표시
      const coupons = await fetchMyCoupons();
      renderCouponsListAll(coupons);
      return;
    }

    // orderId -> items
    const byOrder = new Map();
    for (const it of items) {
      const k = it?.order_id;
      if (k == null) continue;
      (byOrder.get(k) ?? byOrder.set(k,[]).get(k)).push(it);
    }

    // Render orders
    const fr = document.createDocumentFragment();
    for (const od of orders) {
      const its = byOrder.get(od?.id) || [];
      const card = document.createElement('div');
      card.className = 'order-card';

      // 검색용 텍스트 구성
      const createdAt = toLocal(od?.created_at);
      const searchText = [
        its.map(x => x?.name || '').join(' '),
        od?.status || '',
        createdAt || '',
        String(od?.total_price ?? '')
      ].join(' ').toLowerCase();
      card.dataset.searchText = searchText;

      const itemsHTML = its.map(x => {
        const qty = Number(x?.quantity ?? 0);
        const price = Number(x?.price ?? 0);
        const line = qty * price;
        const img = x?.image_url || x?.imageUrl || (x?.product_id ? `/api/images/${x.product_id}` : '');
        return `
          <div class="order-item">
            ${img ? `<img class="order-thumb" src="${img}" alt="${esc(x?.name || '')}" onerror="this.style.display='none'">` : ''}
            <div class="order-item-text">• ${esc(x?.name || '')} × ${qty} — ${line.toLocaleString()}원</div>
          </div>`;
      }).join('');

      card.innerHTML = `
        <div class="order-head">
          <div>
            <strong>Order #${od?.id}</strong>
            <span class="badge ${String(od?.status || '').toLowerCase()}">${esc(od?.status || '')}</span>
          </div>
          <div class="order-date">${createdAt || '-'}</div>
        </div>
        <div class="order-body">
          <div class="order-items">${itemsHTML}</div>
          <div class="order-total"><strong>Total: ${Number(od?.total_price ?? 0).toLocaleString()}원</strong></div>
        </div>`;
      fr.appendChild(card);
    }
    listEl.innerHTML = '';
    listEl.appendChild(fr);
    noEl.style.display = 'none';

    // 누적(즉시 반영)
    const ELIGIBLE = new Set(['CREATED','PAID','FULFILLED']);
    const lifetimeKRW = orders
      .filter(o => ELIGIBLE.has(String(o?.status||'').toUpperCase()))
      .reduce((s,o)=> s + Number(o?.total_price || 0), 0);
    const level = decideLevel(lifetimeKRW);

    localStorage.setItem('lifetimeSpendKRW', String(lifetimeKRW));
    localStorage.setItem('membershipLevel', level);
    renderMembershipSummary(lifetimeKRW, level);

    // 쿠폰: 조회 전용으로 전체 렌더
    const coupons = await fetchMyCoupons();
    renderCouponsListAll(coupons);

  } catch (e) {
    console.error('[orders]', e);
    listEl.innerHTML = `<div class="order-card">Failed to load orders</div>`;
    noEl.style.display = 'none';

    const coupons = await fetchMyCoupons();
    renderCouponsListAll(coupons);
  }
}

/* -------------- 검색 -------------- */
function debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function bindOrderSearch() {
  const input = document.getElementById('orderSearch');
  const btn   = document.getElementById('orderSearchBtn');
  const noEl  = document.getElementById('noOrder');
  const listEl= document.getElementById('orderList');
  if (!input || !btn || !noEl || !listEl) return;

  const doFilter = () => {
    const q = (input.value || '').toLowerCase().trim();
    const cards = listEl.querySelectorAll('.order-card');
    if (!cards.length) { noEl.style.display = 'block'; return; }
    let visible = 0;
    cards.forEach(c => {
      const hit = !q || (c.dataset.searchText || '').includes(q);
      c.style.display = hit ? '' : 'none';
      if (hit) visible++;
    });
    noEl.style.display = visible === 0 ? 'block' : 'none';
  };

  input.addEventListener('input', debounce(doFilter, 150));
  btn.addEventListener('click', doFilter);
}

/* -------------- 멤버십 요약 -------------- */
function renderMembershipSummary(lifetimeKRW, level) {
  const box = document.getElementById('membershipSummary');
  if (!box) return;
  const { nextLevel, remain } = nextTierInfo(lifetimeKRW);
  box.innerHTML = `
    <div class="membership-box">
      <strong>Membership</strong>
      <span class="badge">${level}</span>
      <span class="sum">누적 ${Number(lifetimeKRW).toLocaleString()}원</span>
      ${nextLevel
        ? `<div class="next">다음 등급 <b>${nextLevel}</b>까지 <b>${remain.toLocaleString()}원</b> 남았어요</div>`
        : `<div class="next">최고 등급이에요! 🎉</div>`}
    </div>`;
}

/* -------------- 초기화 -------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await ensureSignedInName();
  await loadOrders();
  bindOrderSearch();
});