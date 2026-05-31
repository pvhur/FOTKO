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

    const hash = await bcrypt.hash(password, 12);
    const id   = Date.now().toString();
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, role, created_at)
       VALUES ($1,$2,$3,$4,'editor',$5)`,
      [id, username, email, hash, new Date().toISOString()]
    );

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: '서버 오류' });
      req.session.userId   = id;
      req.session.username = username;
      req.session.role     = 'editor';
      res.json({ ok: true, user: { id, username, role: 'editor' } });
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
    // 데이터 없으면 빈 구조 반환 (404 대신) — 프론트 graceful 처리
    if (!rows[0]) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send('{"transfers":[],"news":[],"matches":[],"standings":{}}');
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.send(rows[0].data);
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 저장
app.post('/api/data', async (req, res) => {
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
   포스트 API (X 스타일 게시글)
═══════════════════════════════════════════════════════ */

// 전체 조회
app.get('/api/posts', async (req, res) => {
  try {
    await initDB();
    const { rows } = await pool.query(
      'SELECT * FROM posts ORDER BY created_at DESC LIMIT 100'
    );
    res.json(rows);
  } catch (e) {
    console.error('[Posts GET]', e.message);
    res.json([]);
  }
});

// 작성 (editor 이상)
app.post('/api/posts', requireEditor, async (req, res) => {
  const content   = (req.body.content   || '').trim();
  const title     = (req.body.title     || '').trim().slice(0, 100);
  const category  = sanitize(req.body.category  || '이적');
  const image_url = sanitize(req.body.image_url || '');

  if (!content || content.length < 1)
    return res.status(400).json({ error: '내용을 입력하세요.' });
  if (content.length > 2000)
    return res.status(400).json({ error: '내용은 2000자 이하입니다.' });

  try {
    await initDB();
    const id = Date.now().toString();
    await pool.query(
      `INSERT INTO posts (id, title, content, category, image_url, author, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, title || null, content, category, image_url || null,
       req.session.username || 'admin', new Date().toISOString()]
    );
    const { rows } = await pool.query('SELECT * FROM posts WHERE id=$1', [id]);
    res.json({ ok: true, post: rows[0] });
  } catch (e) {
    console.error('[Posts POST]', e.message);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 좋아요
app.post('/api/posts/:id/like', async (req, res) => {
  try {
    await pool.query('UPDATE posts SET likes = likes + 1 WHERE id=$1', [req.params.id]);
    const { rows } = await pool.query('SELECT likes FROM posts WHERE id=$1', [req.params.id]);
    res.json({ ok: true, likes: rows[0]?.likes ?? 0 });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

// 삭제 (admin)
app.delete('/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   방문자 추적
═══════════════════════════════════════════════════════ */

// 방문 기록 (클라이언트 → 서버)
app.post('/api/track', async (req, res) => {
  try {
    await initDB();
    const page   = (req.body.page || '/').slice(0, 100);
    const ip     = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
    const now    = Date.now();
    const date   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const id     = `${date}_${page.replace(/\//g,'_')}_${ipHash}`;
    // 하루 한 번만 동일 IP + 페이지 조합 기록 (UPSERT로 중복 방지)
    await pool.query(
      `INSERT INTO pageviews (id, page, ip_hash, date, ts)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET ts=$5`,
      [id, page, ipHash, date, now]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Track]', e.message);
    res.json({ ok: false });
  }
});

// 방문자 통계 조회 (어드민용)
app.get('/api/stats', async (req, res) => {
  try {
    await initDB();
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const week      = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [todayR, yesterdayR, weekR, totalR, byPageR] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM pageviews WHERE date=$1', [today]),
      pool.query('SELECT COUNT(*) AS c FROM pageviews WHERE date=$1', [yesterday]),
      pool.query('SELECT COUNT(*) AS c FROM pageviews WHERE date>=$1', [week]),
      pool.query('SELECT COUNT(*) AS c FROM pageviews'),
      pool.query(`SELECT page, COUNT(*) AS c FROM pageviews WHERE date>=$1
                  GROUP BY page ORDER BY c DESC LIMIT 10`, [week]),
    ]);

    res.json({
      today:     parseInt(todayR.rows[0]?.c || 0),
      yesterday: parseInt(yesterdayR.rows[0]?.c || 0),
      week:      parseInt(weekR.rows[0]?.c || 0),
      total:     parseInt(totalR.rows[0]?.c || 0),
      byPage:    byPageR.rows.map(r => ({ page: r.page, count: parseInt(r.c) })),
    });
  } catch (e) {
    console.error('[Stats]', e.message);
    res.json({ today: 0, yesterday: 0, week: 0, total: 0, byPage: [] });
  }
});

/* ══════════════════════════════════════════════════════
   이적 뉴스 API (transfer_posts)
═══════════════════════════════════════════════════════ */

app.get('/api/transfer-posts', async (req, res) => {
  try {
    await initDB();
    const { rows } = await pool.query(
      'SELECT * FROM transfer_posts ORDER BY updated_at DESC'
    );
    res.json(rows);
  } catch (e) {
    console.error('[TP GET]', e.message);
    res.json([]);
  }
});

app.get('/api/transfer-posts/:id', async (req, res) => {
  try {
    await initDB();
    const { rows } = await pool.query(
      'SELECT * FROM transfer_posts WHERE id=$1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: '없음' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

app.post('/api/transfer-posts', async (req, res) => {
  try {
    await initDB();
    const { player, from_team='', to_team='', fee='', badge='rumor', detail='', source='', hot=0 } = req.body;
    if (!player) return res.status(400).json({ error: '선수명 필수' });
    const id  = Date.now().toString();
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO transfer_posts (id,player,from_team,to_team,fee,badge,detail,source,hot,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, player.trim(), from_team, to_team, fee, badge, detail, source, hot ? 1 : 0, now, now]
    );
    const { rows } = await pool.query('SELECT * FROM transfer_posts WHERE id=$1', [id]);
    res.json({ ok: true, post: rows[0] });
  } catch (e) {
    console.error('[TP POST]', e.message);
    res.status(500).json({ error: '서버 오류' });
  }
});

app.put('/api/transfer-posts/:id', async (req, res) => {
  try {
    await initDB();
    const { player, from_team='', to_team='', fee='', badge='rumor', detail='', source='', hot=0 } = req.body;
    const now = new Date().toISOString();
    const { rowCount } = await pool.query(
      `UPDATE transfer_posts
       SET player=$1, from_team=$2, to_team=$3, fee=$4, badge=$5,
           detail=$6, source=$7, hot=$8, updated_at=$9
       WHERE id=$10`,
      [player, from_team, to_team, fee, badge, detail, source, hot ? 1 : 0, now, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '없음' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

app.delete('/api/transfer-posts/:id', async (req, res) => {
  try {
    await initDB();
    await pool.query('DELETE FROM transfer_posts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '서버 오류' });
  }
});

/* ══════════════════════════════════════════════════════
   헬스체크 (호스팅 플랫폼용)
═══════════════════════════════════════════════════════ */
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
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
const MAINTENANCE = (req, res) => sendHTML(res, V('health/maintenance.html'));

app.get('/',                  (req, res) => res.redirect('/transfers'));
app.get('/transfers',         (req, res) => sendHTML(res, V('health/transfers-list.html')));
app.get('/transfers/:id',     (req, res) => sendHTML(res, V('health/transfers-detail.html')));
app.get('/kickoff',           MAINTENANCE);
app.get('/kickoff/league',    MAINTENANCE);
app.get('/kickoff/results',   MAINTENANCE);
app.get('/kickoff/transfers', (req, res) => sendHTML(res, V('health/transfers.html')));
app.get('/kickoff/analysis',  MAINTENANCE);
app.get('/kickoff/login',     (req, res) => sendHTML(res, V('health/login.html')));
app.get('/kickoff/signup',    (req, res) => sendHTML(res, V('health/signup.html')));
app.get('/kickoff/admin',     (req, res) => sendHTML(res, V('health/admin.html')));
app.get('/kickoff/feed',      (req, res) => sendHTML(res, V('health/feed.html')));
app.get('/kickoff/write',     (req, res) => sendHTML(res, V('health/write.html')));

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () =>
    console.log(`[Kickoff] http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`)
  );
}

module.exports = app;
