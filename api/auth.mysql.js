// api/auth.mysql.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/** gender 정규화 유틸: DB 스키마 ENUM('Male','Female')에 맞춤 */
function normalizeGender(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'male' || s === 'm') return 'Male';
  if (s === 'female' || s === 'f') return 'Female';
  return null;
}

/** /api/auth/me */
router.get('/me', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ ok:false, error:'NOT_LOGGED_IN' });
    }
    const [[u]] = await pool.query(
      'SELECT id, email, name, gender FROM users WHERE id=? LIMIT 1',
      [req.session.user.id]
    );
    if (!u) return res.status(401).json({ ok:false, error:'NOT_LOGGED_IN' });

    req.session.user = { id: u.id, email: u.email, name: u.name, gender: u.gender || null };
    return res.json({ ok:true, user: req.session.user });
  } catch (e) {
    console.error('GET /api/auth/me error:', e);
    res.status(500).json({ ok:false, error:'ME_FAILED' });
  }
});

/** 회원가입 */
router.post('/register', async (req, res) => {
  try {
    const { email, name, password, address, phone, gender } = req.body || {};
    if (!email || !name || !password) {
      return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
    }

    // 이메일 중복 검사
    const [[dup]] = await pool.query('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
    if (dup) return res.status(409).json({ ok:false, error:'EMAIL_EXISTS' });

    const hash = await bcrypt.hash(password, 10);
    const phoneNorm = (phone || '').replace(/\D/g, '') || null;
    const genderNorm = normalizeGender(gender); // 'Male' | 'Female' | null

    await pool.query(
      'INSERT INTO users (email, name, password_hash, address, phone, gender) VALUES (?, ?, ?, ?, ?, ?)',
      [email, name, hash, address || null, phoneNorm, genderNorm]
    );

    res.json({ ok:true });
  } catch (e) {
    console.error('POST /api/auth/register error:', e);
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok:false, error:'EMAIL_EXISTS' });
    }
    if (e?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      return res.status(400).json({ ok:false, error:'INVALID_GENDER' });
    }
    res.status(400).json({ ok:false, error:'REGISTER_FAILED' });
  }
});

/** 로그인 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
    }
    const [rows] = await pool.query(
      'SELECT id, email, name, password_hash, gender FROM users WHERE email=? LIMIT 1',
      [email]
    );
    if (!rows.length) return res.status(401).json({ ok:false, error:'NO_SUCH_USER' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ ok:false, error:'WRONG_PASSWORD' });

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      gender: user.gender || null,
    };
    res.json({ ok:true, user: req.session.user });
  } catch (e) {
    console.error('POST /api/auth/login error:', e);
    res.status(500).json({ ok:false, error:'LOGIN_FAILED' });
  }
});

/** 로그아웃 */
router.post('/logout', (req, res) => {
  try {
    req.session.destroy(() => res.json({ ok:true }));
  } catch (e) {
    res.json({ ok:true });
  }
});

/** 이름+전화로 이메일 찾기 */
router.post('/find-id', async (req, res) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
    }
    const phoneNorm = String(phone).replace(/\D/g, '');
    const [rows] = await pool.query(
      'SELECT email FROM users WHERE name=? AND phone=? LIMIT 1',
      [name, phoneNorm]
    );
    if (!rows.length) return res.json({ ok:true, email: null });
    return res.json({ ok:true, email: rows[0].email });
  } catch (e) {
    console.error('POST /api/auth/find-id error:', e);
    return res.status(500).json({ ok:false, error:'FIND_ID_FAILED' });
  }
});

/** 비밀번호 찾기(토큰 발급) */
router.post('/password/forgot', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ ok:false, error:'INVALID_INPUT' });

    const [[user]] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (!user) return res.json({ ok:true }); // 존재 여부 숨김

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30분
    await pool.query(
      `INSERT INTO password_resets (token, user_id, expires_at, used)
       VALUES (?, ?, ?, 0)`,
      [token, user.id, expiresAt]
    );
    res.json({ ok:true, token });
  } catch (e) {
    console.error('POST /api/auth/password/forgot error:', e);
    res.status(500).json({ ok:false, error:'FORGOT_FAILED' });
  }
});

/** 비밀번호 재설정 */
router.post('/password/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ ok:false, error:'INVALID_INPUT' });
    }

    const [[row]] = await pool.query(
      `SELECT pr.id, pr.user_id
       FROM password_resets pr
       WHERE pr.token=? AND pr.used=0 AND pr.expires_at > NOW()
       LIMIT 1`, [token]
    );
    if (!row) return res.status(400).json({ ok:false, error:'INVALID_OR_EXPIRED' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, row.user_id]);
    await pool.query('UPDATE password_resets SET used=1 WHERE id=?', [row.id]);

    res.json({ ok:true });
  } catch (e) {
    console.error('POST /api/auth/password/reset error:', e);
    res.status(500).json({ ok:false, error:'RESET_FAILED' });
  }
});

module.exports = router;
