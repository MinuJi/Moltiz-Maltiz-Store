// app.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStoreFactory = require('express-mysql-session');
const cors = require('cors');

const app = express();

/* 1) 프록시/HTTPS 환경(Codespaces/리버스프록시) */
app.set('trust proxy', 1);

/* 2) CORS & JSON */
const ALLOW_ORIGINS = [
  // 프론트(정적) 도메인들을 여기에 추가
  'https://opulent-fortnight-jjgi9x65jprc5j6v-8080.app.github.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // 서버내 요청/헬스체크 등
    cb(null, ALLOW_ORIGINS.includes(origin));
  },
  credentials: true,
}));
app.options('*', cors({
  origin: (origin, cb) => cb(null, !origin || ALLOW_ORIGINS.includes(origin)),
  credentials: true,
}));

app.use(express.json());

/* 3) 세션 (MySQL 저장) */
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host:     process.env.MYSQL_HOST,
  port:     process.env.MYSQL_PORT,
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

// 크로스도메인(https 정적 사이트 ↔ API)에서 쿠키 전달
const USE_SECURE_COOKIE = true; // 깃허브 dev/https면 true
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60,     // 1시간
    sameSite: USE_SECURE_COOKIE ? 'none' : 'lax',
    secure:   USE_SECURE_COOKIE, // https 필수
  },
}));

/* 4) API 라우터 */
const authRouter = require('./api/auth.mysql');
const shopRouter = require('./api/shop.mysql');

app.use('/api/auth', authRouter);

// 프론트 호환을 위해 두 경로 모두 제공
app.use('/api/shop', shopRouter);
app.use('/api',      shopRouter);

/* 5) 정적 파일(프로젝트 루트) */
app.use(express.static(path.join(__dirname)));

// 루트 접근 시 Home.html 제공(옵션)
app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'Home.html'), (err) => {
    if (err) next();
  });
});

/* 6) 헬스 체크 */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* 7) 에러 핸들러 */
app.use((err, _req, res, _next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ ok: false, error: 'INTERNAL_SERVER_ERROR' });
});

/* 8) 서버 시작 */
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`✅ API server on http://localhost:${port}`);
});

