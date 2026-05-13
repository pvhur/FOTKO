/**
 * database.js — SQLite 데이터베이스 설정
 *
 * better-sqlite3 기반의 단일 .db 파일 구조.
 * 테이블: users, content, sessions
 * 기존 football.json → content 테이블로 자동 마이그레이션.
 */
'use strict';

const Database = require('better-sqlite3');
const session  = require('express-session');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');

/* ── DB 경로 ── */
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '../data/kickoff.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

/* ── DB 연결 ── */
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // 쓰기 성능 향상
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -16000');  // 16MB 캐시

/* ── 스키마 생성 (테이블만, 인덱스는 아래에서 처리) ── */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '$GOOGLE$',
    role          TEXT NOT NULL DEFAULT 'editor'
                  CHECK(role IN ('admin','editor')),
    google_id     TEXT,
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
    expired INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sess_expired ON sessions(expired);
`);

/* ── 기존 DB 마이그레이션: google_id 컬럼 추가 ── */
(function migrateGoogleId() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
    console.log('[DB] google_id 컬럼 추가 완료');
  }
})();

/* ── google_id 유니크 인덱스 (신규/기존 모두) ── */
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
         ON users(google_id) WHERE google_id IS NOT NULL`);

/* ── 기본 관리자 계정 시드 ── */
(function seedAdmin() {
  const cnt = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (cnt > 0) return;
  const hash = bcrypt.hashSync('kickoff2026', 12);
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, created_at)
    VALUES (?,?,?,?,?,?)
  `).run('1', 'admin', 'admin@kickoff.com', hash, 'admin', new Date().toISOString());
  console.log('[DB] 초기 관리자 계정 생성 완료 (admin / kickoff2026)');
})();

/* ── football.json → DB 마이그레이션 ── */
(function migrateContent() {
  const exists = db.prepare("SELECT key FROM content WHERE key='football'").get();
  if (exists) return;
  const jsonPath = path.join(__dirname, '../data/football.json');
  if (!fs.existsSync(jsonPath)) return;
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    JSON.parse(raw); // 유효성 검사
    db.prepare(`
      INSERT OR REPLACE INTO content (key, data, updated_at, updated_by)
      VALUES ('football', ?, ?, 'migration')
    `).run(raw, new Date().toISOString());
    console.log('[DB] football.json 마이그레이션 완료');
  } catch (e) {
    console.error('[DB] 마이그레이션 실패:', e.message);
  }
})();

/* ══════════════════════════════════════════════════════
   SQLite 세션 스토어 (better-sqlite3 기반, 외부 패키지 불필요)
═══════════════════════════════════════════════════════ */
class BetterSQLiteStore extends session.Store {
  constructor(database) {
    super();
    this._db = database;
    // 만료 세션 주기적 정리 (15분)
    setInterval(() => {
      this._db.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now());
    }, 15 * 60 * 1000).unref();
  }

  get(sid, cb) {
    try {
      const row = this._db
        .prepare('SELECT sess FROM sessions WHERE sid=? AND expired>?')
        .get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this._db
        .prepare('INSERT OR REPLACE INTO sessions (sid,sess,expired) VALUES (?,?,?)')
        .run(sid, JSON.stringify(sess), ttl);
      cb(null);
    } catch (e) { cb(e); }
  }

  destroy(sid, cb) {
    try {
      this._db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);
      cb(null);
    } catch (e) { cb(e); }
  }

  touch(sid, sess, cb) {
    try {
      const ttl = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this._db.prepare('UPDATE sessions SET expired=? WHERE sid=?').run(ttl, sid);
      cb(null);
    } catch (e) { cb(e); }
  }
}

module.exports = { db, BetterSQLiteStore };
