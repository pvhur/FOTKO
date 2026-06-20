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
      scriptSrc:     ["'self'", "'unsafe-inline'", 'https://vercel.live',
                      'https://pagead2.googlesyndication.com', 'https://*.googlesyndication.com',
                      'https://*.googleadservices.com', 'https://partner.googleadservices.com',
                      'https://adservice.google.com', 'https://*.google.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc:    ["'self'", 'https://vercel.live', 'wss://ws-us3.pusher.com',
                      'https://pagead2.googlesyndication.com', 'https://*.googlesyndication.com',
                      'https://*.google.com', 'https://*.doubleclick.net', 'https://*.g.doubleclick.net'],
      imgSrc:        ["'self'", 'data:', 'https:'],
      frameSrc:      ["'self'", 'https://vercel.live', 'https://googleads.g.doubleclick.net',
                      'https://*.doubleclick.net', 'https://*.googlesyndication.com', 'https://*.google.com'],
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
app.use(express.json({ limit: '8mb' })); // 뉴스 이미지(base64) 업로드 여유

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
    // 발송 비교용: 기존 transfers 읽기
    let prevTransfers = [];
    try {
      const { rows } = await pool.query("SELECT data FROM content WHERE key='football'");
      if (rows[0]) prevTransfers = (JSON.parse(rows[0].data).transfers) || [];
    } catch (_) {}

    await pool.query(
      `INSERT INTO content (key, data, updated_at, updated_by) VALUES ('football',$1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET data=$1, updated_at=$2, updated_by=$3`,
      [payload, new Date().toISOString(), req.session.username || 'unknown']
    );

    // 서버리스(Vercel)에서는 응답 후 비동기 작업이 종료되므로, 응답 전에 await
    let notified = 0;
    try {
      notified = await notifyNewTransfers(prevTransfers, req.body.transfers || []);
    } catch (e) {
      console.error('[notifyNewTransfers]', e.message);
    }
    res.json({ ok: true, notified });
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
   카카오톡 알림 — OAuth 연결 + "나에게 보내기" 발송
═══════════════════════════════════════════════════════ */
const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY || '';
const KAKAO_REDIRECT  = process.env.KAKAO_REDIRECT_URI ||
  `http://localhost:${PORT}/api/auth/kakao/callback`;
const KAKAO_AUTH_URL  = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_MEMO_URL  = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';

// 카카오 연결 시작 (동의 화면으로)
app.get('/api/auth/kakao', requireAuth, async (req, res) => {
  if (!KAKAO_REST_KEY)
    return res.redirect('/kickoff/transfers?kakao=not_configured');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.kakaoState = state;
  try { await sessionSave(req.session); } catch { return res.redirect('/kickoff/transfers'); }
  const params = new URLSearchParams({
    client_id:     KAKAO_REST_KEY,
    redirect_uri:  KAKAO_REDIRECT,
    response_type: 'code',
    scope:         'talk_message',
    state,
  });
  res.redirect(`${KAKAO_AUTH_URL}?${params}`);
});

// 카카오 연결 완전 해제 (unlink) → 재동의를 위해
app.get('/api/auth/kakao/reset', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT kakao_access_token FROM users WHERE id=$1', [req.session.userId]);
    const token = rows[0]?.kakao_access_token;
    if (token) {
      try {
        await fetch('https://kapi.kakao.com/v1/user/unlink', {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch (_) {}
    }
    await pool.query(
      `UPDATE users SET kakao_id=NULL, kakao_access_token=NULL, kakao_refresh_token=NULL,
         kakao_token_expires=NULL, kakao_notify=false WHERE id=$1`,
      [req.session.userId]
    );
  } catch (e) { console.error('[Kakao reset]', e.message); }
  // 해제 직후 바로 재연결 동의 화면으로
  res.redirect('/api/auth/kakao');
});

// 카카오 콜백 → 토큰 저장
app.get('/api/auth/kakao/callback', requireAuth, async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code) return res.redirect('/kickoff/transfers?kakao=denied');
  if (!state || state !== req.session.kakaoState)
    return res.redirect('/kickoff/transfers?kakao=invalid_state');
  try {
    const tokenParams = {
      grant_type:   'authorization_code',
      client_id:    KAKAO_REST_KEY,
      redirect_uri: KAKAO_REDIRECT,
      code,
    };
    if (process.env.KAKAO_CLIENT_SECRET) tokenParams.client_secret = process.env.KAKAO_CLIENT_SECRET;
    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });
    const t = await tokenRes.json();
    if (!tokenRes.ok || !t.access_token)
      throw new Error(t.error_code ? `${t.error_code}:${t.error_description||t.error}` : (t.error_description || 'token_error'));

    const expires = Date.now() + (t.expires_in || 21600) * 1000;
    await pool.query(
      `UPDATE users SET kakao_id=COALESCE(kakao_id, $1),
         kakao_access_token=$2, kakao_refresh_token=COALESCE($3, kakao_refresh_token),
         kakao_token_expires=$4, kakao_notify=true WHERE id=$5`,
      ['linked', t.access_token, t.refresh_token || null, expires, req.session.userId]
    );
    res.redirect('/kickoff/transfers?kakao=connected');
  } catch (e) {
    console.error('[Kakao OAuth]', e.message);
    res.redirect('/kickoff/transfers?kakao=failed&reason=' + encodeURIComponent(e.message));
  }
});

// 알림 설정 조회
app.get('/api/notify/kakao', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT kakao_access_token, kakao_notify FROM users WHERE id=$1', [req.session.userId]
    );
    const u = rows[0] || {};
    res.set('Cache-Control', 'no-store');
    res.json({ linked: !!u.kakao_access_token, notify: !!u.kakao_notify });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 알림 on/off 토글
app.post('/api/notify/kakao', requireAuth, async (req, res) => {
  const notify = !!req.body.notify;
  try {
    const { rows } = await pool.query(
      'SELECT kakao_access_token FROM users WHERE id=$1', [req.session.userId]
    );
    if (notify && !rows[0]?.kakao_access_token)
      return res.status(400).json({ error: 'not_linked' }); // 카카오 연결 먼저 필요
    await pool.query('UPDATE users SET kakao_notify=$1 WHERE id=$2',
      [notify, req.session.userId]);
    res.json({ ok: true, notify });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 진단용: 현재 사용자에게 직접 테스트 메모 발송하고 카카오 응답 그대로 반환
app.get('/api/notify/test', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.session.userId]);
    const u = rows[0];
    if (!u) return res.json({ error: 'no_user' });
    const token = await kakaoValidToken(u);
    if (!token) return res.json({ error: 'no_token', hasAccess: !!u.kakao_access_token, hasRefresh: !!u.kakao_refresh_token });
    const template = { object_type:'text', text:'🔔 Kickoff 테스트 알림',
      link:{ web_url:'https://fotko.vercel.app/kickoff/transfers', mobile_web_url:'https://fotko.vercel.app/kickoff/transfers' },
      button_title:'보기' };
    const r = await fetch(KAKAO_MEMO_URL, {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${token}`, 'Content-Type':'application/x-www-form-urlencoded' },
      body:new URLSearchParams({ template_object: JSON.stringify(template) }),
    });
    const body = await r.text();
    res.json({ status: r.status, body });
  } catch (e) {
    res.json({ error: e.message });
  }
});

/* ── 카카오 토큰 갱신 + 발송 헬퍼 ── */
async function kakaoValidToken(user) {
  if (!user.kakao_refresh_token && !user.kakao_access_token) return null;
  // 만료 5분 전이면 갱신
  if (user.kakao_token_expires && Date.now() < Number(user.kakao_token_expires) - 5 * 60 * 1000)
    return user.kakao_access_token;
  if (!user.kakao_refresh_token) return user.kakao_access_token;
  try {
    const r = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     KAKAO_REST_KEY,
        refresh_token: user.kakao_refresh_token,
        ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
      }),
    });
    const t = await r.json();
    if (!r.ok || !t.access_token) return user.kakao_access_token;
    const expires = Date.now() + (t.expires_in || 21600) * 1000;
    await pool.query(
      `UPDATE users SET kakao_access_token=$1, kakao_token_expires=$2,
         kakao_refresh_token=COALESCE($3, kakao_refresh_token) WHERE id=$4`,
      [t.access_token, expires, t.refresh_token || null, user.id]
    );
    return t.access_token;
  } catch { return user.kakao_access_token; }
}

async function kakaoSendMemo(user, text, linkUrl) {
  const token = await kakaoValidToken(user);
  if (!token) return false;
  const template = {
    object_type: 'text',
    text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: '이적시장 보기',
  };
  try {
    const r = await fetch(KAKAO_MEMO_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
    });
    return r.ok;
  } catch { return false; }
}

// 새 이적 건이 추가되면 알림 켠 사용자에게 카카오 발송
async function notifyNewTransfers(prevTransfers, nextTransfers) {
  if (!KAKAO_REST_KEY) { console.log('[Kakao notify] REST 키 없음'); return 0; }
  const prevKeys = new Set((prevTransfers || []).map(t => `${t.player}|${t.from}|${t.to}`));
  const added = (nextTransfers || []).filter(t => !prevKeys.has(`${t.player}|${t.from}|${t.to}`));
  console.log(`[Kakao notify] 새 이적 ${added.length}건`);
  if (!added.length) return 0;

  const siteUrl = (process.env.CORS_ORIGINS || '').split(',')[0].trim()
    || 'https://fotko.vercel.app';
  const link = `${siteUrl}/kickoff/transfers`;
  const lines = added.slice(0, 5).map(t => `· ${t.player}: ${t.from} → ${t.to} (${t.fee || ''})`);
  const text = `⚽ 새 이적 소식 ${added.length}건\n\n${lines.join('\n')}`;

  let sent = 0;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE kakao_notify=true AND kakao_access_token IS NOT NULL'
    );
    console.log(`[Kakao notify] 발송 대상 ${rows.length}명`);
    for (const u of rows) { if (await kakaoSendMemo(u, text, link)) sent++; }
  } catch (e) {
    console.error('[Kakao notify]', e.message);
  }
  return sent;
}

/* ══════════════════════════════════════════════════════
   뉴스 수집 (GNews) — 어드민 가져오기용 (editor 이상)
═══════════════════════════════════════════════════════ */
app.get('/api/collect/news', requireEditor, async (req, res) => {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return res.status(400).json({ error: 'GNEWS_API_KEY 미설정' });

  const q    = (req.query.q || '축구').toString().slice(0, 80);
  const lang = (req.query.lang || 'ko').toString().slice(0, 5);
  const url  = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}`
             + `&lang=${encodeURIComponent(lang)}&max=10&sortby=publishedAt&apikey=${key}`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d.errors?.[0] || 'GNews 오류' });
    const items = (d.articles || []).map(a => ({
      title:       a.title || '',
      desc:        a.description || '',
      url:         a.url || '',
      image:       a.image || '',
      source:      a.source?.name || '',
      publishedAt: a.publishedAt || '',
    }));
    res.set('Cache-Control', 'no-store');
    res.json({ items });
  } catch (e) {
    console.error('[collect/news]', e.message);
    res.status(500).json({ error: '수집 중 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   좋아요(하트) API — 항목 키별 누적 카운트
═══════════════════════════════════════════════════════ */

// 전체 좋아요 맵 조회
app.get('/api/likes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, count FROM likes');
    const map = {};
    for (const r of rows) map[r.key] = r.count;
    res.set('Cache-Control', 'no-store');
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 좋아요 증감 (+1 / -1)
app.post('/api/likes/:key', async (req, res) => {
  const key = String(req.params.key).slice(0, 300);
  const delta = req.body.delta === -1 ? -1 : 1;
  try {
    const { rows } = await pool.query(
      `INSERT INTO likes (key, count) VALUES ($1, GREATEST($2,0))
       ON CONFLICT (key) DO UPDATE SET count = GREATEST(likes.count + $2, 0)
       RETURNING count`,
      [key, delta]
    );
    res.json({ ok: true, count: rows[0]?.count ?? 0 });
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
app.get('/kickoff/privacy',   (req, res) => sendHTML(res, V('health/privacy.html')));
app.get('/kickoff/terms',     (req, res) => sendHTML(res, V('health/terms.html')));

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () =>
    console.log(`[Kickoff] http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`)
  );
}

module.exports = app;
