'use strict';

const { Pool }  = require('pg');
const session   = require('express-session');
const bcrypt    = require('bcryptjs');

/* ── 연결 풀 ── */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/* ── 스키마 초기화 ── */
let _initPromise = null;
async function initDB() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        email         TEXT UNIQUE,
        password_hash TEXT NOT NULL DEFAULT '$GOOGLE$',
        role          TEXT NOT NULL DEFAULT 'editor'
                      CHECK(role IN ('admin','editor')),
        google_id     TEXT UNIQUE,
        created_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content (
        key        TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        sess    TEXT NOT NULL,
        expired BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sess_expired ON sessions(expired);
    `);

    const { rows } = await pool.query('SELECT COUNT(*) AS c FROM users');
    if (parseInt(rows[0].c, 10) === 0) {
      const hash = await bcrypt.hash('kickoff2026', 12);
      await pool.query(
        `INSERT INTO users (id, username, email, password_hash, role, created_at)
         VALUES ($1,$2,$3,$4,'admin',$5)`,
        ['1', 'admin', 'admin@kickoff.com', hash, new Date().toISOString()]
      );
      console.log('[DB] 초기 관리자 계정 생성 완료 (admin / kickoff2026)');
    }
    console.log('[DB] PostgreSQL 연결 및 스키마 확인 완료');
  })();
  return _initPromise;
}

/* ══════════════════════════════════════════════════════
   PostgreSQL 세션 스토어
═══════════════════════════════════════════════════════ */
class PgSessionStore extends session.Store {
  constructor() {
    super();
    const t = setInterval(async () => {
      try { await pool.query('DELETE FROM sessions WHERE expired < $1', [Date.now()]); }
      catch (_) {}
    }, 15 * 60 * 1000);
    if (t.unref) t.unref();
  }

  async get(sid, cb) {
    try {
      const { rows } = await pool.query(
        'SELECT sess FROM sessions WHERE sid=$1 AND expired>$2',
        [sid, Date.now()]
      );
      cb(null, rows[0] ? JSON.parse(rows[0].sess) : null);
    } catch (e) { cb(e); }
  }

  async set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      await pool.query(
        `INSERT INTO sessions (sid, sess, expired) VALUES ($1,$2,$3)
         ON CONFLICT (sid) DO UPDATE SET sess=$2, expired=$3`,
        [sid, JSON.stringify(sess), ttl]
      );
      cb(null);
    } catch (e) { cb(e); }
  }

  async destroy(sid, cb) {
    try {
      await pool.query('DELETE FROM sessions WHERE sid=$1', [sid]);
      cb(null);
    } catch (e) { cb(e); }
  }

  async touch(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      await pool.query(
        'UPDATE sessions SET expired=$1 WHERE sid=$2',
        [ttl, sid]
      );
      cb(null);
    } catch (e) { cb(e); }
  }
}

module.exports = { pool, initDB, PgSessionStore };
