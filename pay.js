// pay.js — 결제 로직 + 완료 알림 모달 재사용

// 완료 알림: 기존 confirmOverlay를 OK만 보이는 모달로 재활용
async function showCompleteModal(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmOverlay');
    const title   = document.getElementById('confirmTitle');
    const yesBtn  = document.getElementById('confirmYes');
    const noBtn   = document.getElementById('confirmNo');

    if (!overlay || !title || !yesBtn) {
      alert(message || 'Completed');
      return resolve();
    }

    const prevTitle = title.textContent;
    const prevYes   = yesBtn.textContent;
    const noWasHidden = !!noBtn?.classList.contains('hidden');

    title.textContent = message || 'Completed';
    yesBtn.textContent = 'OK';
    if (noBtn) noBtn.classList.add('hidden');

    overlay.classList.remove('hidden');
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = '2147483647';

    const cleanup = () => {
      title.textContent = prevTitle;
      yesBtn.textContent = prevYes;
      if (noBtn && !noWasHidden) noBtn.classList.remove('hidden');
      overlay.classList.add('hidden');
      overlay.style.removeProperty('pointer-events');
      overlay.style.removeProperty('z-index');

      yesBtn.removeEventListener('click', onOk);
      overlay.removeEventListener('click', onOutside);
      document.removeEventListener('keydown', onEsc);
    };

    const onOk = () => { cleanup(); resolve(); };
    const onOutside = (e) => { if (e.target === overlay) { cleanup(); resolve(); } };
    const onEsc = (e) => { if (e.key === 'Escape') { cleanup(); resolve(); } };

    yesBtn.addEventListener('click', onOk);
    overlay.addEventListener('click', onOutside);
    document.addEventListener('keydown', onEsc);
  });
}

(() => {
  const $ = (sel) => document.querySelector(sel);

  let purchasing = false;

  // Product/Quantity helpers
  const getProductId = () => {
    if (typeof window.PRODUCT_ID !== 'undefined') {
      const n = Number(window.PRODUCT_ID);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const el = document.getElementById('buyNow') || $('.buy-btn');
    const d  = el?.dataset?.productId;
    const n  = Number(d);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };

  const getQuantity = () => {
    const el = document.getElementById('quantity-input');
    const v  = Number(el?.value ?? 1);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
  };

  // 선택된 쿠폰코드 읽기 (없으면 null)
  const getSelectedCouponCode = () => {
    const sel = document.getElementById('couponSelect');
    const val = sel?.value || '';
    return val && val !== 'none' ? val : null;
  };

  // 확인 모달(있으면 사용)
  const confirmBuy = async (msg = 'Are you sure you want to buy it?') => {
    if (typeof window.openConfirmModal === 'function') {
      try { return await window.openConfirmModal(msg); } catch {}
    }
    return window.confirm(msg);
  };

  const buyBtn = document.getElementById('buyNow') || $('.buy-btn');
  if (!buyBtn) return;

  buyBtn.setAttribute('type', 'button');
  buyBtn.disabled = false;

  // 혹시 남아 있는 오버레이가 클릭을 막지 않도록
  const ov = document.getElementById('confirmOverlay');
  if (ov) {
    ov.classList.add('hidden');
    ov.style.removeProperty('pointer-events');
    ov.style.removeProperty('z-index');
  }

  buyBtn.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    if (purchasing) return;
    purchasing = true;

    const productId = getProductId();
    if (!Number.isFinite(productId) || productId <= 0) {
      purchasing = false;
      return alert('Product ID가 설정되지 않았습니다.');
    }

    const ok = await confirmBuy('Are you sure you want to buy it?');
    if (!ok) { purchasing = false; return; }

    const quantity   = getQuantity();
    const couponCode = getSelectedCouponCode();

    const origText = buyBtn.textContent;
    buyBtn.disabled = true;
    buyBtn.textContent = 'Processing...';

    try {
      // 1) 장바구니 담기
      const addRes = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, quantity })
      });
      if (addRes.status === 401) { location.href = '/Login.html'; return; }
      const addJson = await addRes.json().catch(() => ({}));
      if (!addRes.ok || !addJson.ok) throw new Error(addJson.error || 'CART_ADD_FAILED');

      // 2) 체크아웃 (선택된 쿠폰 있으면 함께 전송)
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ couponCode })
      });
      if (checkoutRes.status === 401) { location.href = '/Login.html'; return; }
      const data = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok || !data.ok) throw new Error(data.error || 'CHECKOUT_FAILED');

      const total = Number(data.breakdown?.total ?? 0);
      await showCompleteModal(`Purchase completed! Total: ${total.toLocaleString()}원`);
      location.href = '/MyPage.html';
    } catch (err) {
      console.error('Purchase error:', err);
      alert('Purchase failed: ' + (err?.message || 'Unknown error'));
    } finally {
      purchasing = false;
      buyBtn.disabled = false;
      buyBtn.textContent = origText;
    }
  });
})();

