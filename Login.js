// Login.js
document.addEventListener('DOMContentLoaded', () => {
  const form    = document.getElementById('loginForm');
  const btn     = document.getElementById('loginBtn');
  const emailEl = document.getElementById('loginEmail');
  const passEl  = document.getElementById('loginPassword');
  const autoEl  = document.getElementById('autoLogin');

  const API_BASE = ''; // 같은 오리진이면 빈 값 유지

  // 자동 로그인 체크 저장(로컬)
  const SAVED_AUTO_KEY = 'moltiz:autoLogin';
  if (autoEl) {
    autoEl.checked = localStorage.getItem(SAVED_AUTO_KEY) === '1';
    autoEl.addEventListener('change', () => {
      localStorage.setItem(SAVED_AUTO_KEY, autoEl.checked ? '1' : '0');
    });
  }

  form?.addEventListener('submit', onLogin);

  async function onLogin(e) {
    e.preventDefault();

    const email = (emailEl.value || '').trim();
    const password = passEl.value || '';
    const autoLogin = !!(autoEl && autoEl.checked);

    if (!email || !password) {
      alert('Please enter your email and password.');
      return;
    }

    try {
      setBusy(true);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 세션 쿠키 필수
        body: JSON.stringify({ email, password, autoLogin }),
      });

      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (!res.ok || !data.ok) {
        const code = data?.error || '';
        switch (code) {
          case 'NO_SUCH_USER':
            alert('No account found with that email.');
            break;
          case 'WRONG_PASSWORD':
            alert('Incorrect password. Please try again.');
            break;
          case 'INVALID_INPUT':
            alert('Invalid input.');
            break;
          case 'LOGIN_FAILED':
            alert('Login failed. Please try again.');
            break;
          default:
            alert(data?.error ? `Login failed: ${data.error}` : `Login failed (HTTP ${res.status}).`);
        }
        return;
      }

      // 성공
      location.href = '/Home.html';
    } catch (err) {
      console.error('[LOGIN] network error:', err);
      alert('Network error. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  function setBusy(b) {
    if (btn) btn.disabled = b;
    if (form) form.style.opacity = b ? 0.7 : 1;
  }
});