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
    const phone = (phoneEl?.value || '').replace(/[^0-9]/g, '');

    let gender = '';
    if (genderMaleEl?.checked) gender = 'Male';
    if (genderFemaleEl?.checked) gender = 'Female';

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
          case 'EMAIL_EXISTS':
            return showError('This email is already registered.');
          case 'INVALID_GENDER':
            return showError('Invalid gender selected.');
          default:
            return showError(data?.error || `Sign-up failed (HTTP ${res.status}).`);
        }
      }

      // 성공 → 테마 저장
      const theme = gender === 'Female' ? 'Maltiz' : 'Retriever';
      localStorage.setItem('memberTheme', theme);
      localStorage.setItem('userName', name);

      alert('Sign-up successful! Redirecting to login page...');
      location.href = '/Login.html';
    } catch (err) {
      console.error('[JOIN] network error:', err);
      showError('Network error. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

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