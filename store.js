/**
 * Store — SQLite storage for config, sessions, usage tracking.
 * Data lives in ~/.lion/lion.db
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LION_DIR = join(homedir(), '.lion');
if (!existsSync(LION_DIR)) mkdirSync(LION_DIR, { recursive: true });

const db = new Database(join(LION_DIR, 'lion.db'));
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    cwd TEXT,
    provider TEXT,
    model TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    role TEXT,
    content TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

// === Config ===
export function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

export function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

export function getProvider() {
  return getConfig('provider') || null;
}

export function setProvider(provider) {
  setConfig('provider', provider);
}

// === Sessions ===
export function createSession(cwd, provider, model) {
  const result = db.prepare(
    'INSERT INTO sessions (cwd, provider, model) VALUES (?, ?, ?)'
  ).run(cwd, provider, model);
  return result.lastInsertRowid;
}

export function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function listSessions(limit = 20) {
  return db.prepare('SELECT * FROM sessions ORDER BY id DESC LIMIT ?').all(limit);
}

export function updateSessionTitle(id, title) {
  db.prepare(`UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`).run(title, id);
}

// === Messages ===
export function addMessage(sessionId, role, content, tokensIn = 0, tokensOut = 0) {
  db.prepare(
    'INSERT INTO messages (session_id, role, content, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?)'
  ).run(sessionId, role, content, tokensIn, tokensOut);

  // Update session totals
  db.prepare(`
    UPDATE sessions SET 
      tokens_in = tokens_in + ?,
      tokens_out = tokens_out + ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(tokensIn, tokensOut, sessionId);
}

export function getMessages(sessionId) {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id').all(sessionId);
}

// === Usage ===
export function getSessionUsage(sessionId) {
  const s = getSession(sessionId);
  return s ? { tokens_in: s.tokens_in, tokens_out: s.tokens_out, total: s.tokens_in + s.tokens_out } : null;
}

export function getTotalUsage() {
  const row = db.prepare('SELECT SUM(tokens_in) as tin, SUM(tokens_out) as tout FROM sessions').get();
  return { tokens_in: row.tin || 0, tokens_out: row.tout || 0, total: (row.tin || 0) + (row.tout || 0) };
}
