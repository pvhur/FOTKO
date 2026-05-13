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
const { db, BetterSQLiteStore } = require('./config/database');

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
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
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
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: 허용되지 않은 Origin'));
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
   세션 (SQLite 영구 스토어)
═══════════════════════════════════════════════════════ */
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-CHANGE-IN-PROD',
  resave:            false,
  saveUninitialized: false,
  store:             new BetterSQLiteStore(db),
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
    const user = db.prepare(
      'SELECT * FROM users WHERE username=? OR email=?'
    ).get(identifier, identifier);

    // timing-safe: always run bcrypt to prevent enumeration attacks
    const dummyHash = '$2b$12$invalidhashinvalidhash1234567890';
    if (!user) {
      await bcrypt.compare(password, dummyHash);
      return res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    // 구글 전용 계정 (비밀번호 없음)
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
  } catch {
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
    const existing = db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(username, email);
    if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디 또는 이메일입니다.' });

    const hash = await bcrypt.hash(password, 12);
    const id   = Date.now().toString();
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at)
      VALUES (?,?,?,?,'editor',?)
    `).run(id, username, email, hash, new Date().toISOString());

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: '서버 오류' });
      req.session.userId   = id;
      req.session.username = username;
      req.session.role     = 'editor';
      res.json({ ok: true, user: { id, username, role: 'editor' } });
    });
  } catch (e) {
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

/* ── Google OAuth ── */
const GOOGLE_AUTH_URL      = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL     = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL  = 'https://www.googleapis.com/oauth2/v3/userinfo';

function googleCallbackURL() {
  return process.env.GOOGLE_CALLBACK_URL ||
    `http://localhost:${PORT}/api/auth/google/callback`;
}

// Google 로그인 시작
app.get('/api/auth/google', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID)
    return res.redirect('/kickoff/login?error=google_not_configured');

  const state    = crypto.randomBytes(20).toString('hex');
  const redirect = req.query.redirect || '/kickoff';
  const safe     = redirect.startsWith('/kickoff') ? redirect : '/kickoff';

  req.session.oauthState    = state;
  req.session.oauthRedirect = safe;
  try { await sessionSave(req.session); } catch { return res.redirect('/kickoff/login'); }

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  googleCallbackURL(),
    response_type: 'code',
    scope:         'openid email profile',
    state,
    prompt:        'select_account',
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// Google 콜백
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect('/kickoff/login?error=google_denied');
  if (!code || !state || state !== req.session.oauthState)
    return res.redirect('/kickoff/login?error=invalid_state');

  try {
    // 1. 코드 → 액세스 토큰 교환
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  googleCallbackURL(),
        grant_type:    'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error || 'token_error');

    // 2. 사용자 정보 조회
    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await infoRes.json();
    if (!infoRes.ok) throw new Error('userinfo_error');

    const googleId = profile.sub;
    const email    = profile.email    || null;
    const name     = profile.name     || profile.given_name || 'user';

    // 3. 유저 조회 / 생성
    let user = db.prepare('SELECT * FROM users WHERE google_id=?').get(googleId);

    if (!user && email) {
      // 같은 이메일로 가입된 계정이 있으면 연결
      user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (user) {
        db.prepare('UPDATE users SET google_id=? WHERE id=?').run(googleId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
      }
    }

    if (!user) {
      // 신규 계정 생성
      let base = name.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 20) || 'user';
      if (base.length < 3) base = 'user';
      let username = base;
      let n = 1;
      while (db.prepare('SELECT id FROM users WHERE username=?').get(username)) {
        username = `${base}${n++}`;
      }
      const id = Date.now().toString();
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, google_id, created_at)
        VALUES (?,?,?,'$GOOGLE$','editor',?,?)
      `).run(id, username, email, googleId, new Date().toISOString());
      user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    }

    const oauthRedirect = req.session.oauthRedirect || '/kickoff';
    await sessionRegenerate(req.session);
    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.role     = user.role;
    res.redirect(oauthRedirect);

  } catch (e) {
    console.error('[Google OAuth]', e.message);
    res.redirect('/kickoff/login?error=oauth_failed');
  }
});

/* ══════════════════════════════════════════════════════
   사용자 관리 API (admin only)
═══════════════════════════════════════════════════════ */

// 목록
app.get('/api/users', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, email, role, created_at FROM users ORDER BY created_at'
  ).all();
  res.json(users);
});

// 역할 변경
app.patch('/api/users/:id', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'editor'].includes(role))
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  if (req.params.id === req.session.userId)
    return res.status(400).json({ error: '자신의 역할은 변경할 수 없습니다.' });

  const result = db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true });
});

// 삭제
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.session.userId)
    return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' });
  const result = db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   콘텐츠 API
═══════════════════════════════════════════════════════ */

// 공개 조회
app.get('/api/data', (req, res) => {
  const row = db.prepare("SELECT data FROM content WHERE key='football'").get();
  if (!row) return res.status(404).json({ error: 'data not found' });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.send(row.data);
});

// 저장 (editor 이상)
app.post('/api/data', requireEditor, (req, res) => {
  let payload;
  try {
    payload = JSON.stringify(req.body); // 유효한 JSON인지 검증됨
  } catch {
    return res.status(400).json({ error: '올바르지 않은 데이터입니다.' });
  }
  db.prepare(`
    INSERT OR REPLACE INTO content (key, data, updated_at, updated_by)
    VALUES ('football', ?, ?, ?)
  `).run(payload, new Date().toISOString(), req.session.username || 'unknown');
  res.json({ ok: true });
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
app.listen(PORT, () => console.log(`[Kickoff] http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`));

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
