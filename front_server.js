'use strict';
require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const compression  = require('compression');
const bodyParser   = require('body-parser');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');
const bcrypt       = require('bcryptjs');
const { pool, initDB, PgSessionStore } = require('./config/database');

/* ── DB 초기화 (모듈 로드 시 1회 실행) ── */
initDB().catch(e => console.error('[DB] 초기화 오류:', e.message));

const app    = express();
const PORT   = process.env.PORT   || 3000;
const isProd = process.env.NODE_ENV === 'production';

/* ══════════════════════════════════════════════════════
   헬퍼
═══════════════════════════════════════════════════════ */
function sendHTML(res, filePath) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('Not Found');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'`]/g, '').trim().slice(0, 200);
}

function sessionSave(sess) {
  return new Promise((resolve, reject) => sess.save(e => e ? reject(e) : resolve()));
}

function sessionRegenerate(sess) {
  return new Promise((resolve, reject) => sess.regenerate(e => e ? reject(e) : resolve()));
}

/* ══════════════════════════════════════════════════════
   보안 헤더 (Helmet)
═══════════════════════════════════════════════════════ */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc:     ["'self'", "'unsafe-inline'", 'https://vercel.live'],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc:    ["'self'", 'https://vercel.live', 'wss://ws-us3.pusher.com'],
      imgSrc:        ["'self'", 'data:', 'https:'],
      frameSrc:      ["'self'", 'https://vercel.live'],
      frameAncestors: ["'none'"],
      formAction:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

/* ══════════════════════════════════════════════════════
   프록시 신뢰 (Heroku/Railway/Render 등)
═══════════════════════════════════════════════════════ */
if (isProd) app.set('trust proxy', 1);

/* ══════════════════════════════════════════════════════
   압축
═══════════════════════════════════════════════════════ */
app.use(compression());

/* ══════════════════════════════════════════════════════
   CORS
═══════════════════════════════════════════════════════ */
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',').map(s => s.trim());
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Vercel 프리뷰 배포 URL 허용 (*.vercel.app)
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return cb(null, true);
    const e = new Error('CORS: 허용되지 않은 Origin');
    e.status = 403;
    cb(e);
  },
  credentials: true,
}));

/* ══════════════════════════════════════════════════════
   Rate Limiting
═══════════════════════════════════════════════════════ */
// 인증 엔드포인트: 15분에 20회
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '요청이 너무 많습니다. 15분 후 다시 시도하세요.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
// 일반 API: 1분에 200회
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

/* ══════════════════════════════════════════════════════
   바디 파싱
═══════════════════════════════════════════════════════ */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({ limit: '1mb' }));

/* ══════════════════════════════════════════════════════
   정적 파일
═══════════════════════════════════════════════════════ */
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProd ? '1d' : 0,
  etag: true,
}));

/* ══════════════════════════════════════════════════════
   세션 (PostgreSQL 스토어)
═══════════════════════════════════════════════════════ */
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-CHANGE-IN-PROD',
  resave:            false,
  saveUninitialized: false,
  store:             new PgSessionStore(),
  name:              'kickoff.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure:   isProd,           // HTTPS 환경에서만 true
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

/* ══════════════════════════════════════════════════════
   인증 미들웨어
═══════════════════════════════════════════════════════ */
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin')
    return res.status(403).json({ error: 'forbidden — admin only' });
  next();
}
function requireEditor(req, res, next) {
  if (!req.session.userId)
    return res.status(401).json({ error: 'unauthorized' });
  if (!['admin', 'editor'].includes(req.session.role))
    return res.status(403).json({ error: 'forbidden' });
  next();
}

/* ══════════════════════════════════════════════════════
   Auth API
═══════════════════════════════════════════════════════ */

// 현재 세션
app.get('/api/auth/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.session.userId) return res.status(401).json({ error: 'unauthorized' });
  res.json({ id: req.session.userId, username: req.session.username, role: req.session.role });
});

// 로그인 (아이디 또는 이메일)
app.post('/api/auth/login', async (req, res) => {
  // identifier = username 또는 email
  const identifier = sanitize(req.body.identifier || req.body.username || '');
  const password   = req.body.password || '';

  if (!identifier || !password)
    return res.status(400).json({ error: '아이디/이메일과 비밀번호를 입력하세요.' });
  if (password.length > 128)
    return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });

  try {
    await initDB();
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username=$1 OR email=$2',
      [identifier, identifier]
    );
    const user = rows[0];

    const dummyHash = '$2b$12$invalidhashinvalidhash1234567890';
    if (!user) {
      await bcrypt.compare(password, dummyHash);
      return res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    if (!user.password_hash || user.password_hash === '$GOOGLE$') {
      await bcrypt.compare(password, dummyHash);
      return res.status(401).json({ error: '이 계정은 구글 로그인으로만 접속할 수 있습니다.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다.' });

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: '서버 오류' });
      req.session.userId   = user.id;
      req.session.username = user.username;
      req.session.role     = user.role;
      res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
    });
  } catch (e) {
    console.error('[Login]', e.message);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 회원가입
app.post('/api/auth/signup', async (req, res) => {
  const username = sanitize(req.body.username || '');
  const email    = sanitize(req.body.email    || '');
  const password = req.body.password || '';

  if (!username || !email || !password)
    return res.status(400).json({ error: '모든 항목을 입력하세요.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
    return res.status(400).json({ error: '아이디는 영문, 숫자, 언더스코어 3-30자입니다.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: '올바른 이메일 주소를 입력하세요.' });
  if (password.length < 8 || password.length > 128)
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });

  try {
    await initDB();
    const { rows: existRows } = await pool.query(
      'SELECT id FROM users WHERE username=$1 OR email=$2',
      [username, email]
    );
    if (existRows.length > 0)
      return res.status(409).json({ error: '이미 사용 중인 아이디 또는 이메일입니다.' });

    // 첫 가입자는 자동으로 관리자(admin), 이후 가입자는 편집자(editor)
    const { rows: cntRows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    const role = cntRows[0].c === 0 ? 'admin' : 'editor';

    const hash = await bcrypt.hash(password, 12);
    const id   = Date.now().toString();
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, role, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, username, email, hash, role, new Date().toISOString()]
    );

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: '서버 오류' });
      req.session.userId   = id;
      req.session.username = username;
      req.session.role     = role;
      res.json({ ok: true, user: { id, username, role } });
    });
  } catch (e) {
    console.error('[Signup]', e.message);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 로그아웃
app.post('/api/auth/logout', (req, res) => {
  const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax', secure: isProd };
  if (!req.session?.userId) {
    res.clearCookie('kickoff.sid', cookieOpts);
    return res.json({ ok: true });
  }
  req.session.destroy(err => {
    if (err) console.error('[Logout] session destroy error:', err);
    res.clearCookie('kickoff.sid', cookieOpts);
    res.json({ ok: true });
  });
});

/* ══════════════════════════════════════════════════════
   사용자 관리 API (admin only)
═══════════════════════════════════════════════════════ */

// 목록
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 역할 변경
app.patch('/api/users/:id', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'editor'].includes(role))
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  if (req.params.id === req.session.userId)
    return res.status(400).json({ error: '자신의 역할은 변경할 수 없습니다.' });

  try {
    const { rowCount } = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2', [role, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 삭제
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.userId)
    return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' });

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM users WHERE id=$1', [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   콘텐츠 API
═══════════════════════════════════════════════════════ */

// 공개 조회
app.get('/api/data', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT data FROM content WHERE key='football'");
    if (!rows[0]) return res.status(404).json({ error: 'data not found' });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.send(rows[0].data);
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 저장 (editor 이상)
app.post('/api/data', requireEditor, async (req, res) => {
  let payload;
  try {
    payload = JSON.stringify(req.body);
  } catch {
    return res.status(400).json({ error: '올바르지 않은 데이터입니다.' });
  }
  try {
    await pool.query(
      `INSERT INTO content (key, data, updated_at, updated_by) VALUES ('football',$1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET data=$1, updated_at=$2, updated_by=$3`,
      [payload, new Date().toISOString(), req.session.username || 'unknown']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   팀 팔로우 API (로그인 필요)
═══════════════════════════════════════════════════════ */

// 내 팔로우 목록
app.get('/api/follows', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT team_id, team_name, league_id FROM follows WHERE user_id=$1 ORDER BY created_at',
      [req.session.userId]
    );
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 팔로우 추가
app.put('/api/follows/:teamId', requireAuth, async (req, res) => {
  const teamId   = sanitize(req.params.teamId);
  const teamName = sanitize(req.body.teamName || '');
  const leagueId = sanitize(req.body.leagueId || '');
  if (!teamId) return res.status(400).json({ error: '팀 정보가 올바르지 않습니다.' });
  try {
    await pool.query(
      `INSERT INTO follows (user_id, team_id, team_name, league_id, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, team_id) DO UPDATE SET team_name=$3, league_id=$4`,
      [req.session.userId, teamId, teamName, leagueId, new Date().toISOString()]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 언팔로우
app.delete('/api/follows/:teamId', requireAuth, async (req, res) => {
  const teamId = sanitize(req.params.teamId);
  try {
    await pool.query('DELETE FROM follows WHERE user_id=$1 AND team_id=$2',
      [req.session.userId, teamId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   카카오톡 알림 (구조만 — 실제 발송 연동은 추후)
═══════════════════════════════════════════════════════ */

// 알림 설정 조회
app.get('/api/notify/kakao', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT kakao_id, kakao_notify FROM users WHERE id=$1', [req.session.userId]
    );
    const u = rows[0] || {};
    res.set('Cache-Control', 'no-store');
    res.json({ linked: !!u.kakao_id, notify: !!u.kakao_notify });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 알림 on/off 토글 (연동 전이라 설정값만 저장)
app.post('/api/notify/kakao', requireAuth, async (req, res) => {
  const notify = !!req.body.notify;
  try {
    await pool.query('UPDATE users SET kakao_notify=$1 WHERE id=$2',
      [notify, req.session.userId]);
    // TODO: 카카오 채널/알림톡 API 연동 시 여기서 구독 처리
    res.json({ ok: true, notify });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   헬스체크 (호스팅 플랫폼용)
═══════════════════════════════════════════════════════ */
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.json({}));

/* ══════════════════════════════════════════════════════
   전역 에러 핸들러
═══════════════════════════════════════════════════════ */
app.use((err, req, res, _next) => {
  const code = err.status || 500;
  if (!isProd) console.error(err);
  res.status(code).json({ error: isProd ? '서버 오류가 발생했습니다.' : err.message });
});

/* ══════════════════════════════════════════════════════
   페이지 라우트
═══════════════════════════════════════════════════════ */
const V = (p) => path.join(__dirname, './views', p);
app.get('/',                  (req, res) => res.redirect('/kickoff'));
app.get('/kickoff',           (req, res) => sendHTML(res, V('health/index.html')));
app.get('/kickoff/league',    (req, res) => sendHTML(res, V('health/league.html')));
app.get('/kickoff/results',   (req, res) => sendHTML(res, V('health/results.html')));
app.get('/kickoff/transfers', (req, res) => sendHTML(res, V('health/transfers.html')));
app.get('/kickoff/analysis',  (req, res) => sendHTML(res, V('health/analysis.html')));
app.get('/kickoff/login',     (req, res) => sendHTML(res, V('health/login.html')));
app.get('/kickoff/signup',    (req, res) => sendHTML(res, V('health/signup.html')));
app.get('/kickoff/admin',     (req, res) => sendHTML(res, V('health/admin.html')));

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () =>
    console.log(`[Kickoff] http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`)
  );
}

module.exports = app;
