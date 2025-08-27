// server.js (MySQL)
const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const morgan = require('morgan');
// const cors = require('cors'); // 다른 오리진에서 프론트 띄울 때만 사용

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// (선택) 다른 오리진용 CORS
// app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// 1) 로깅/파서
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2) 세션
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
app.use(session({
  name: 'moltiz.sid',
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_WEEK_MS,
  }
}));

// 3) 헬스체크
app.get('/api/ping', (req, res) => res.send('pong'));

// 3.5) DB 핑 (연결 확인용)
app.get('/api/db-ping', async (req, res, next) => {
  try {
    const pool = require('./db');           // 풀 자체 import
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, rows });
  } catch (e) {
    console.error('DB Ping Error:', e);
    next(e);
  }
});

// 4) 정적 파일
app.use(express.static(path.join(__dirname)));

// 5) API 라우터
app.use('/api/auth', require('./api/auth.mysql'));
app.use('/api', require('./api/shop.mysql')); // /api/products, /api/cart/*, /api/checkout, /api/orders/me

// 6) 루트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Home.html'));
});

// 6.5) 404 (API)
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'NOT_FOUND' });
});

// 6.6) 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ ok: false, error: err?.message || 'INTERNAL_ERROR' });
});

// 7) 서버 시작
app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
  const url = `http://localhost:${port}`;
  switch (process.platform) {
    case 'win32': exec(`start ${url}`); break;
    case 'darwin': exec(`open ${url}`); break;
    case 'linux': exec(`xdg-open ${url}`); break;
  }
});
