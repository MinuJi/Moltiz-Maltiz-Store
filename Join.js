// Join.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.getElementById('joinForm');
  const btn    = document.getElementById('joinBtn');

  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('password');
  const pass2El = document.getElementById('password2');
  const nameEl  = document.getElementById('name');
  const addrEl  = document.getElementById('address');
  const phoneEl = document.getElementById('phone');
  const genderMaleEl   = document.getElementById('genderMale');
  const genderFemaleEl = document.getElementById('genderFemale');

  // same-origin이면 빈 문자열
  const API_BASE = '';

  form?.addEventListener('submit', onSubmit);

  async function onSubmit(e) {
    e.preventDefault();
    clearError();

    const email = (emailEl.value || '').trim();
    const password = passEl.value || '';
    const password2 = pass2El.value || '';
    const name = (nameEl.value || '').trim();
    const address = (addrEl?.value || '').trim();
    // 숫자만 저장
    const phone = (phoneEl?.value || '').replace(/[^0-9]/g, '');

    // ✅ Gender
    let gender = '';
    if (genderMaleEl?.checked) gender = 'male';
    if (genderFemaleEl?.checked) gender = 'female';

    // --- 클라 검증 ---
    if (!email || !password || !name) {
      return showError('Email, password, and name are required.');
    }
    if (!gender) {
      return showError('Please select your gender.');
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return showError('Please enter a valid email address.');
    }
    if (password.length < 6) {
      passEl.focus();
      return showError('Password must be at least 6 characters long.');
    }
    if (password !== password2) {
      pass2El.focus();
      return showError('Passwords do not match.');
    }

    const body = { email, name, password, address, phone, gender };

    try {
      setBusy(true);

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      let data = {};
      try { data = await res.json(); } catch {}

      if (!res.ok || !data.ok) {
        const code = data?.error || '';
        switch (code) {
          case 'INVALID_INPUT':
            return showError('Invalid input. Please check your fields.');
          case 'REGISTER_FAILED':
            return showError('Sign-up failed. The email may already be in use.');
          default:
            return showError(data?.error || `Sign-up failed (HTTP ${res.status}).`);
        }
      }

      // 성공 시: 프론트에서도 theme 저장 (Male→Retriever, Female→Maltiz)
      const theme = gender === 'female' ? 'Maltiz' : 'Retriever';
      localStorage.setItem('memberTheme', theme);
      localStorage.setItem('userName', name); // 편의상 이름도 저장

      alert('Sign-up successful! Redirecting to login page...');
      location.href = '/Login.html';
    } catch (err) {
      console.error('[JOIN] network error:', err);
      showError('Network error. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  // ---- 유틸 ----
  function setBusy(flag) {
    if (btn) btn.disabled = flag;
    if (form) form.style.opacity = flag ? 0.7 : 1;
  }
  function showError(msg) {
    const err = document.getElementById('joinErr');
    if (err) err.textContent = msg; else alert(msg);
  }
  function clearError() {
    const err = document.getElementById('joinErr');
    if (err) err.textContent = '';
  }
});