'use strict';

const { neon } = require('@neondatabase/serverless');
const session  = require('express-session');

/* ── HTTP 쿼리 클라이언트 (TCP 연결 없음 — 콜드 스타트 타임아웃 없음) ── */
const _sql = neon(
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING
);

// pg Pool.query() 호환 래퍼
async function dbQuery(text, params) {
  const rows = await _sql.query(text, params);
  return { rows, rowCount: rows.length };
}

// front_server.js의 pool.query() 호출을 그대로 유지하기 위한 객체
const pool = { query: dbQuery };

/* ── 스키마 초기화 ── */
let _initPromise = null;
async function initDB() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    // neon HTTP 드라이버는 다중 구문 불가 — 쿼리 분리
    await _sql`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        email         TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'editor'
                      CHECK(role IN ('admin','editor')),
        created_at    TEXT NOT NULL
      )
    `;
    await _sql`
      CREATE TABLE IF NOT EXISTS content (
        key        TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      )
    `;
    await _sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        sess    TEXT NOT NULL,
        expired BIGINT NOT NULL
      )
    `;
    await _sql`
      CREATE INDEX IF NOT EXISTS idx_sess_expired ON sessions(expired)
    `;
    await _sql`
      CREATE TABLE IF NOT EXISTS posts (
        id         TEXT PRIMARY KEY,
        title      TEXT,
        content    TEXT NOT NULL,
        category   TEXT NOT NULL DEFAULT '이적',
        image_url  TEXT,
        author     TEXT NOT NULL DEFAULT 'admin',
        likes      INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `;
    await _sql`
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)
    `;
    await _sql`
      CREATE TABLE IF NOT EXISTS pageviews (
        id       TEXT PRIMARY KEY,
        page     TEXT NOT NULL,
        ip_hash  TEXT NOT NULL,
        date     TEXT NOT NULL,
        ts       BIGINT NOT NULL
      )
    `;
    await _sql`
      CREATE INDEX IF NOT EXISTS idx_pv_date ON pageviews(date)
    `;

    console.log('[DB] 스키마 확인 완료');
  })().catch(e => {
    _initPromise = null; // 실패 시 다음 요청에서 재시도
    throw e;
  });
  return _initPromise;
}

/* ══════════════════════════════════════════════════════
   PostgreSQL 세션 스토어
═══════════════════════════════════════════════════════ */
class PgSessionStore extends session.Store {
  constructor() {
    super();
    const t = setInterval(async () => {
      try { await _sql`DELETE FROM sessions WHERE expired < ${Date.now()}`; }
      catch (_) {}
    }, 15 * 60 * 1000);
    if (t.unref) t.unref();
  }

  async get(sid, cb) {
    try {
      const rows = await _sql`
        SELECT sess FROM sessions WHERE sid=${sid} AND expired>${Date.now()}
      `;
      cb(null, rows[0] ? JSON.parse(rows[0].sess) : null);
    } catch (e) {
      console.error('[Session.get]', e.message);
      cb(null, null);
    }
  }

  async set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      await _sql`
        INSERT INTO sessions (sid, sess, expired) VALUES (${sid}, ${JSON.stringify(sess)}, ${ttl})
        ON CONFLICT (sid) DO UPDATE SET sess=${JSON.stringify(sess)}, expired=${ttl}
      `;
      cb(null);
    } catch (e) {
      console.error('[Session.set]', e.message);
      cb(null);
    }
  }

  async destroy(sid, cb) {
    try {
      await _sql`DELETE FROM sessions WHERE sid=${sid}`;
      cb(null);
    } catch (e) { cb(null); }
  }

  async touch(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      await _sql`UPDATE sessions SET expired=${ttl} WHERE sid=${sid}`;
      cb(null);
    } catch (e) { cb(null); }
  }
}

module.exports = { pool, initDB, PgSessionStore };
