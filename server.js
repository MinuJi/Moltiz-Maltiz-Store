// server.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const morgan = require('morgan');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8080);

// 제일 먼저 헬스체크
app.get('/api/ping', (_req, res) => res.send('pong'));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
app.use(session({
  name: 'moltiz.sid',
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: ONE_WEEK_MS }
}));

// DB 핑
app.get('/api/db-ping', async (_req, res, next) => {
  try {
    const pool = require('./db');
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, rows });
  } catch (e) { next(e); }
});

// 정적
app.use(express.static(path.join(__dirname)));

// ★ 라우터: 404보다 위에!
app.use('/api/ai',   require('./api/ai'));
app.use('/api/auth', require('./api/auth.mysql'));
app.use('/api',      require('./api/shop.mysql'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Home.html'));
});

// 404(API)
app.use('/api', (_req, res) => res.status(404).json({ ok: false, error: 'NOT_FOUND' }));

// 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error('UNHANDLED ERROR:', err);
  res.status(500).json({ ok: false, error: err?.message || 'INTERNAL_ERROR' });
});

// 리슨: 127.0.0.1로 고정
app.listen(port, '127.0.0.1', () => {
  console.log(`서버 실행 중: http://127.0.0.1:${port}`);
  const url = `http://127.0.0.1:${port}`;
  switch (process.platform) {
    case 'win32': exec(`start ${url}`); break;
    case 'darwin': exec(`open ${url}`); break;
    case 'linux': exec(`xdg-open ${url}`); break;
  }
});
