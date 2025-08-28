// buy.js — confirm 모달 전용 (결제 로직 없음)

function openConfirmModal(message = 'Are you sure you want to buy it?') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmOverlay');
    const title   = document.getElementById('confirmTitle');
    const yesBtn  = document.getElementById('confirmYes');
    const noBtn   = document.getElementById('confirmNo');

    // 모달 DOM 없으면 기본 confirm
    if (!overlay || !title || !yesBtn || !noBtn) {
      return resolve(window.confirm(message));
    }

    // 내용/표시
    title.textContent = message;
    overlay.classList.remove('hidden');

    // 🔧 클릭 가능/최상위 보장
    overlay.style.removeProperty('display');
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = '2147483647';

    // 리스너
    const close = (ans) => {
      overlay.classList.add('hidden');
      overlay.style.removeProperty('pointer-events');
      overlay.style.removeProperty('z-index');

      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      overlay.removeEventListener('click', onBg);
      document.removeEventListener('keydown', onEsc);
      resolve(ans);
    };

    const onYes = () => close(true);
    const onNo  = () => close(false);
    const onBg  = (e) => { if (e.target === overlay) close(false); };
    const onEsc = (e) => { if (e.key === 'Escape') close(false); };

    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
    overlay.addEventListener('click', onBg);
    document.addEventListener('keydown', onEsc);
  });
}




