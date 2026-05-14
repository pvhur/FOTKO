'use strict';

const { neon } = require('@neondatabase/serverless');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');

/* ── HTTP 쿼리 클라이언트 (TCP 연결 없음 — 콜드 스타트 타임아웃 없음) ── */
const _sql = neon(
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING
);

// pg Pool.query() 호환 래퍼
async function dbQuery(text, params) {
  const rows = await _sql(text, params);
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
        password_hash TEXT NOT NULL DEFAULT '$GOOGLE$',
        role          TEXT NOT NULL DEFAULT 'editor'
                      CHECK(role IN ('admin','editor')),
        google_id     TEXT UNIQUE,
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

    const [row] = await _sql`SELECT COUNT(*)::int AS c FROM users`;
    if (row.c === 0) {
      const hash = await bcrypt.hash('kickoff2026', 12);
      await _sql`
        INSERT INTO users (id, username, email, password_hash, role, created_at)
        VALUES ('1', 'admin', 'admin@kickoff.com', ${hash}, 'admin', ${new Date().toISOString()})
      `;
      console.log('[DB] 초기 관리자 계정 생성 완료 (admin / kickoff2026)');
    }
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
