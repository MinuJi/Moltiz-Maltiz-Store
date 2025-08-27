// coupon.js — 쿠폰 로딩 + 합계 미리보기 (가용 0개면 resync→claim→재조회)
(function (global) {
  const DEFAULTS = {
    selectSelector: '#couponSelect',
    hintSelector:   '#couponHint',
    couponsUrl:     '/api/coupons/me',
    claimUrl:       '/api/membership/claim',
    resyncUrl:      '/api/membership/resync',
    previewUrl:     '/api/checkout/preview',
    locale:         'ko-KR',
    currencySuffix: '원',
    autoPreviewOnLoad: true,
    filterExpired:  true,
    filterUsed:     true,
    onPreview:      null
  };

  const isAvailable = (c) =>
    !c.used_order_id && (!c.expires_at || new Date(c.expires_at) > new Date());

  // LV100 > LV10 > LV1 정렬
  const priority = (code = '') =>
    code.startsWith('M_LV100') ? 3 : code.startsWith('M_LV10') ? 2 : 1;

  function fmt(n, locale, suffix) {
    const num = Number(n || 0);
    return `${num.toLocaleString(locale)}${suffix || ''}`;
  }

  async function fetchJSON(url, init) {
    const res = await fetch(url, { credentials: 'include', ...init });
    let data = {};
    try { data = await res.json(); } catch {}
    // 서버가 {ok:false}를 주더라도 HTTP 200이면 ok를 false로 취급
    const ok = res.ok && (data?.ok !== false);
    return { ok, data, status: res.status };
  }

  function clearOptions(selectEl) {
    // 첫 번째 기본 옵션(— No coupon —)만 남기고 전부 삭제
    while (selectEl.options.length > 1) selectEl.remove(1);
  }

  function fillOptions(selectEl, coupons, { filterExpired, filterUsed }) {
    clearOptions(selectEl);
    const now = new Date();
    const filtered = coupons.filter(c => {
      if (filterUsed && c.used_order_id) return false;
      if (filterExpired && c.expires_at && new Date(c.expires_at) < now) return false;
      return true;
    });

    filtered.sort((a,b) => priority(b.code) - priority(a.code));

    for (const c of filtered) {
      const opt = document.createElement('option');
      opt.value = c.code;                 // 서버에서 내려준 코드
      opt.textContent = c.label || c.code;
      selectEl.appendChild(opt);
    }
    return filtered;
  }

  async function ensureCouponsWhenEmpty(opts) {
    // 가용 쿠폰이 없을 때만 호출됨. 레벨/조건 재정렬 후 발급 시도.
    const { resyncUrl, claimUrl, couponsUrl } = opts;
    try { await fetchJSON(resyncUrl, { method: 'POST' }); } catch {}
    try { await fetchJSON(claimUrl,  { method: 'POST' }); } catch {}
    const again = await fetchJSON(couponsUrl);
    return Array.isArray(again.data?.coupons) ? again.data.coupons : [];
  }

  async function loadCoupons(opts) {
    const { couponsUrl, selectEl, filterExpired, filterUsed } = opts;

    // 1) 조회
    let { ok, data, status } = await fetchJSON(couponsUrl);
    if (status === 401) return [];           // 비로그인
    if (!ok) { console.error('쿠폰 불러오기 실패', data); return []; }

    let coupons = Array.isArray(data.coupons) ? data.coupons : [];

    // 2) 가용 쿠폰이 0개면 → resync→claim→재조회로 한 번 더 보장 시도
    if (!coupons.some(isAvailable)) {
      coupons = await ensureCouponsWhenEmpty(opts);
    }

    // 3) select 채우기
    const filled = fillOptions(selectEl, coupons, { filterExpired, filterUsed });

    // 기본 선택: 가장 높은 등급 1장
    if (filled.length) selectEl.value = filled[0].code;

    return coupons;
  }

  async function previewTotals(opts) {
    const { previewUrl, selectEl, hintEl, locale, currencySuffix, onPreview } = opts;
    const couponCode = (selectEl?.value || '') || null;

    const body = couponCode ? { couponCode } : {};
    const { ok, data, status } = await fetchJSON(previewUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!ok) {
      if (hintEl) hintEl.textContent = '';
      if (status !== 401) console.error('미리보기 실패', data);
      return null;
    }

    const t = data || {};
    if (hintEl) {
      const parts = [
        `상품합계 ${fmt(t.subtotal, locale, currencySuffix)}`,
        `- 할인 ${fmt(t.discount, locale, currencySuffix)}`,
        `+ 배송비 ${fmt(t.shippingFee, locale, currencySuffix)}`,
        `= 총 ${fmt(t.total, locale, currencySuffix)}`
      ];
      const applied = t.applied ? ` (쿠폰: ${t.applied.label || t.applied.code})` : '';
      hintEl.textContent = parts.join(' ') + applied;
    }
    if (typeof onPreview === 'function') {
      try { onPreview(t); } catch (e) { console.warn(e); }
    }
    return t;
  }

  async function init(userOptions = {}) {
    const opts = { ...DEFAULTS, ...userOptions };

    const selectEl = document.querySelector(opts.selectSelector);
    const hintEl   = document.querySelector(opts.hintSelector);
    if (!selectEl) {
      console.warn('[coupon.js] select 요소를 찾지 못했습니다:', opts.selectSelector);
      return null;
    }
    opts.selectEl = selectEl;
    opts.hintEl   = hintEl;

    await loadCoupons(opts);

    selectEl.addEventListener('change', () => previewTotals(opts));

    if (opts.autoPreviewOnLoad) {
      await previewTotals(opts);
    }

    return {
      options: opts,
      preview: () => previewTotals(opts),
      getSelectedCouponCode: () => {
        const v = opts.selectEl?.value || '';
        return v || null;
      }
    };
  }

  const API = { init };
  global.Coupon = API;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector(DEFAULTS.selectSelector)) API.init();
    });
  } else {
    if (document.querySelector(DEFAULTS.selectSelector)) API.init();
  }
})(window);