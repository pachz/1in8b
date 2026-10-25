import { createClient } from "@libsql/client/web";
import { tursoConfig } from "./env.mjs";

let client = null;
let ready = null;

const SESSION_TTL_MS = 20 * 60 * 1000;

export function isTursoConfigured() {
  return tursoConfig().configured;
}

export function getTurso() {
  const { url, authToken, configured } = tursoConfig();
  if (!configured) return null;
  if (!client) {
    client = createClient({ url, authToken });
  }
  return client;
}

export async function ensureTurso() {
  const db = getTurso();
  if (!db) return null;
  if (!ready) {
    ready = migrate(db).catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
  return db;
}

async function migrate(db) {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        screen TEXT,
        country TEXT,
        here TEXT,
        age INTEGER,
        speed REAL,
        era TEXT,
        auto INTEGER,
        lang TEXT,
        src TEXT,
        device TEXT,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS sessions_updated ON sessions(updated_at)`,
      `CREATE INDEX IF NOT EXISTS sessions_screen ON sessions(screen)`,
      `CREATE TABLE IF NOT EXISTS life_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        country TEXT NOT NULL,
        age INTEGER NOT NULL DEFAULT 0,
        sid TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS life_events_at ON life_events(at DESC)`,
      `CREATE INDEX IF NOT EXISTS life_events_kind_country ON life_events(kind, country)`,
      `CREATE TABLE IF NOT EXISTS daily_stats (
        day TEXT NOT NULL,
        event TEXT NOT NULL,
        key TEXT NOT NULL DEFAULT '',
        n INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, event, key)
      )`,
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY,
        lang TEXT NOT NULL,
        at INTEGER NOT NULL,
        iso TEXT,
        sex TEXT,
        age INTEGER,
        name TEXT,
        story TEXT,
        rem INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS posts_lang_at ON posts(lang, at DESC)`,
      `CREATE TABLE IF NOT EXISTS today_tallies (
        k TEXT PRIMARY KEY,
        m INTEGER NOT NULL DEFAULT 0,
        f INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
    "write",
  );
}

export function sessionTtlMs() {
  return SESSION_TTL_MS;
}

export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
