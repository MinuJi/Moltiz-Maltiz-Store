// app.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const cors = require('cors');

const app = express();

/* ─────────────────────────────────────────────────────────────
 * 1) 프록시/HTTPS 환경(Codespaces 등)에서 쿠키 잘 전달되도록
 * ───────────────────────────────────────────────────────────── */
app.set('trust proxy', 1); // Codespaces/리버스프록시 환경 권장

/* ─────────────────────────────────────────────────────────────
 * 2) CORS & JSON
 * ───────────────────────────────────────────────────────────── */
app.use(cors({
  origin: true,              // 요청 Origin을 그대로 허용
  credentials: true,         // 쿠키 포함 허용
}));
app.use(express.json());

/* ─────────────────────────────────────────────────────────────
 * 3) 세션 (MySQL에 저장)
 * ───────────────────────────────────────────────────────────── */
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host:     process.env.MYSQL_HOST,
  port:     process.env.MYSQL_PORT,
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  // 필요시: createDatabaseTable: true
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60,   // 1시간
    sameSite: 'lax',          // 기본값. 다른 오리진에서 쓰면 'none' + secure 필요
    // secure: true,          // HTTPS 고정 환경이면 활성화
  },
}));

/* ─────────────────────────────────────────────────────────────
 * 4) API 라우터
 * ───────────────────────────────────────────────────────────── */
const authRouter = require('./api/auth.mysql');
const shopRouter = require('./api/shop.mysql');

app.use('/api/auth', authRouter);

// 프론트 코드 호환성 위해 **두 위치 모두** 마운트
// - /api/shop/... (원래 경로)
// - /api/...      (프론트가 /api/checkout, /api/cart/add로 부를 때도 동작)
app.use('/api/shop', shopRouter);
app.use('/api',      shopRouter);

/* ─────────────────────────────────────────────────────────────
 * 5) 정적 파일 (public 폴더 없이, 프로젝트 루트 전체)
 *    ※ 개발 편의용. 운영시엔 전용 public 폴더를 권장.
 * ───────────────────────────────────────────────────────────── */
app.use(express.static(path.join(__dirname)));

// 루트 접근 시 Home.html이 있으면 보여주기(선택)
app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'Home.html'), (err) => {
    if (err) next(); // Home.html 없으면 넘김
  });
});

/* ─────────────────────────────────────────────────────────────
 * 6) 헬스 체크
 * ───────────────────────────────────────────────────────────── */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ─────────────────────────────────────────────────────────────
 * 7) 에러 핸들러 (JSON)
 * ───────────────────────────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ ok: false, error: 'INTERNAL_SERVER_ERROR' });
});

/* ─────────────────────────────────────────────────────────────
 * 8) 서버 시작
 * ───────────────────────────────────────────────────────────── */
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`✅ API server on http://localhost:${port}`);
});
