document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = ''; // 같은 오리진이면 빈 문자열

  // ===== 1) Find ID (name+phone → email) =====
  const findIdForm   = document.getElementById('findIdForm');
  const findIdBtn    = document.getElementById('findIdBtn');
  const nameEl       = document.getElementById('findName');
  const phoneEl      = document.getElementById('findPhone');
  const findIdResult = document.getElementById('findIdResult');

  findIdForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name  = (nameEl.value || '').trim();
    const phone = (phoneEl.value || '').replace(/[^0-9]/g, '');
    if (!name || !phone) {
      findIdResult.textContent = 'Please enter your name and phone number.';
      return;
    }

    try {
      findIdBtn.disabled = true;
      const res = await fetch(`${API_BASE}/api/auth/find-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.email) {
        const masked = data.email.replace(/^(.{2}).+(@.+)$/, (_, a, b) => a + '***' + b);
        findIdResult.textContent = `Your registered email: ${masked}`;
      } else {
        findIdResult.textContent = 'No account found with the provided information.';
      }
    } catch (err) {
      console.error('[FIND-ID] error:', err);
      findIdResult.textContent = 'Server error. Please try again later.';
    } finally {
      findIdBtn.disabled = false;
    }
  });

  // ===== 2) Password reset start (email만 필요) =====
  const findPwForm   = document.getElementById('findPwForm');
  const findPwBtn    = document.getElementById('findPwBtn');
  const pwEmailEl    = document.getElementById('pwEmail');
  const pwNameEl     = document.getElementById('pwName');   // UI 유지 (서버엔 안 보냄)
  const pwPhoneEl    = document.getElementById('pwPhone');  // UI 유지 (서버엔 안 보냄)
  const findPwResult = document.getElementById('findPwResult');

  findPwForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = (pwEmailEl.value || '').trim();
    if (!email) {
      findPwResult.textContent = 'Please enter your email.';
      return;
    }

    try {
      findPwBtn.disabled = true;
      // 서버 스펙: /password/forgot 은 email만 받음
      const res = await fetch(`${API_BASE}/api/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        // DEV: 토큰 있으면 보여줌
        findPwResult.textContent = data.token
          ? `Reset token (DEV): ${data.token}`
          : 'If the email exists, reset instruction has been sent.';
      } else {
        findPwResult.textContent = 'If the email exists, reset instruction has been sent.';
      }
    } catch (err) {
      console.error('[RESET/START] error:', err);
      findPwResult.textContent = 'Server error. Please try again later.';
    } finally {
      findPwBtn.disabled = false;
    }
  });

  // ===== 3) Reset Confirm (token → new password) =====
  const form  = document.getElementById('resetConfirmForm');
  if (form) {
    const btn   = document.getElementById('resetConfirmBtn');
    const token = document.getElementById('resetToken');
    const pw1   = document.getElementById('newPw');
    const pw2   = document.getElementById('newPw2');
    const out   = document.getElementById('resetConfirmResult');
    const goBtn = document.getElementById('goLoginBtn');

    // ?token=...로 들어오면 자동 채우기
    const qs = new URLSearchParams(location.search);
    const tFromUrl = qs.get('token');
    if (tFromUrl) token.value = tFromUrl;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const t  = (token.value || '').trim();
      const p1 = pw1.value || '';
      const p2 = pw2.value || '';

      if (!t || !p1 || !p2) return (out.textContent = 'Fill all fields.');
      if (p1 !== p2)        return (out.textContent = 'Passwords do not match.');
      if (p1.length < 4)    return (out.textContent = 'Password too short.');

      try {
        btn.disabled = true;
        // 서버 스펙: /password/reset 은 { token, newPassword }
        const res = await fetch(`${API_BASE}/api/auth/password/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: t, newPassword: p1 }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.ok) {
          out.textContent = 'Password changed. Please login with your new password.';
          goBtn?.classList.remove('hidden');
          pw1.value = ''; pw2.value = ''; token.value = '';
        } else {
          out.textContent = data?.error || 'Invalid or expired token.';
        }
      } catch (err) {
        console.error('[RESET/CONFIRM] error:', err);
        out.textContent = 'Server error.';
      } finally {
        btn.disabled = false;
      }
    });
  }
});