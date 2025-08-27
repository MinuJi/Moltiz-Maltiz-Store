// === 0) 돔 로드 후 실행 ===
document.addEventListener('DOMContentLoaded', () => {
  // === 1) 검색 버튼 (해당 요소가 있을 때만) ===
  const searchBtn = document.querySelector('.search-btn');
  const searchInput = document.querySelector('.search-bar input');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', (e) => {
      // 폼 이동 막고 JS 처리만 하려면:
      e.preventDefault();
      const query = (searchInput.value || '').trim();
      if (query) alert(`Searching for: ${query}`);
      else alert('Please enter a search term.');
    });
  }

  // === 2) 하트 버튼: 이벤트 위임 BookMark.js에서 처리 ===




  // === 3) 로그인 상태 스위칭(UI) ===
  (function initAuthUI() {
    const guest   = document.getElementById('auth-guest');
    const member  = document.getElementById('auth-member');
    const welcome = document.getElementById('welcome-name');
    const logout  = document.getElementById('logoutBtn');
    if (!guest || !member) return;

    const showGuest = () => {
      guest.style.display  = 'inline';
      member.style.display = 'none';
      // ✅ 캐시 클리어
      localStorage.removeItem('moltiz:userName');
      localStorage.removeItem('userName');
      localStorage.removeItem('memberTheme');
    };

    const showMember = (name) => {
      guest.style.display  = 'none';
      member.style.display = 'inline-flex';
      if (welcome) welcome.textContent = `Wellcome, ${name}!`;
    };

    const cachedName = localStorage.getItem('moltiz:userName');
    if (cachedName) showMember(cachedName); else showGuest();

    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : { ok: false }))
      .then(data => {
        if (data?.ok && data.user?.name) {
          localStorage.setItem('moltiz:userName', data.user.name);
          showMember(data.user.name);
        } else {
          showGuest();
        }
      })
      .catch(showGuest);

    if (logout) {
      logout.addEventListener('click', () => {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
          .catch(() => {})
          .finally(() => {
            // ✅ 로그아웃 후 캐시 완전 정리
            localStorage.removeItem('moltiz:userName');
            localStorage.removeItem('userName');
            localStorage.removeItem('memberTheme');
            showGuest();
          });
      });
    }
  })();

  // === 4) 장바구니 결제 버튼(해당 페이지에 있을 때만) ===
  const checkoutBtn = document.getElementById('checkoutBtn');
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401) {
        alert('로그인 후 이용해주세요.');
        location.href = '/Login.html';
        return;
      }
      if (!resp.ok || !data.ok) {
        if (data.error === 'OUT_OF_STOCK') {
          alert('재고가 부족한 상품이 있습니다. 수량을 조정해주세요.');
        } else if (data.error === 'CART_EMPTY') {
          alert('장바구니가 비었습니다.');
        } else {
          alert('결제 실패: ' + (data.error || 'UNKNOWN'));
        }
        return;
      }

      const total = Number(data.breakdown?.total ?? 0);
      alert(`주문 완료! 주문번호: ${data.orderId}\n결제금액: ${total.toLocaleString()}원`);
      location.href = '/MyPage.html';
    } catch (e) {
      console.error(e);
      alert('네트워크 오류가 발생했습니다.');
    }
    });
  }
});
