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
        rem INTEGER NOT NULL DEFAULT 0,
        tok TEXT,
        text TEXT,
        hidden INTEGER NOT NULL DEFAULT 0,
        reports INTEGER NOT NULL DEFAULT 0,
        sid TEXT
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
      // Free Keep entitlement (no Stripe) — email/phone unlock for lives / home / carry
      `CREATE TABLE IF NOT EXISTS keep_passes (
        tok TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        left_n INTEGER NOT NULL DEFAULT 99,
        created_at INTEGER NOT NULL,
        used_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS keep_passes_email ON keep_passes(email)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS keep_passes_phone ON keep_passes(phone)`,
      // OTP auth users + sessions
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        keep_tok TEXT,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS users_phone ON users(phone)`,
      `CREATE INDEX IF NOT EXISTS users_keep_tok ON users(keep_tok)`,
      `CREATE TABLE IF NOT EXISTS auth_challenges (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        identifier TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at INTEGER,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS auth_challenges_ident ON auth_challenges(channel, identifier, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        keep_tok TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id)`,
      // Fixed-window rate limit buckets (auth / admin / etc.)
      `CREATE TABLE IF NOT EXISTS rate_buckets (
        id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS rate_buckets_expires ON rate_buckets(expires_at)`,
      `CREATE TABLE IF NOT EXISTS keep_devices (
        tok TEXT NOT NULL,
        dv TEXT NOT NULL,
        ml INTEGER NOT NULL DEFAULT 0,
        last_at INTEGER NOT NULL,
        PRIMARY KEY (tok, dv)
      )`,
      `CREATE INDEX IF NOT EXISTS keep_devices_last ON keep_devices(tok, last_at DESC)`,
      `CREATE TABLE IF NOT EXISTS keep_carry (
        code TEXT PRIMARY KEY,
        tok TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER
      )`,
      // Cloud life locker (max 3 devices per pass)
      `CREATE TABLE IF NOT EXISTS lives_state (
        tok TEXT PRIMARY KEY,
        on_flag INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS lives_blobs (
        tok TEXT NOT NULL,
        dv TEXT NOT NULL,
        z INTEGER NOT NULL DEFAULT 0,
        d TEXT NOT NULL,
        c INTEGER NOT NULL DEFAULT 0,
        w INTEGER NOT NULL DEFAULT 0,
        at INTEGER NOT NULL,
        PRIMARY KEY (tok, dv)
      )`,
      // One-shot device transfer codes (3 days)
      `CREATE TABLE IF NOT EXISTS move_codes (
        code TEXT PRIMARY KEY,
        z INTEGER NOT NULL DEFAULT 0,
        d TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER
      )`,
      // Past-life home profile + optional room décor keyed by memorial id
      `CREATE TABLE IF NOT EXISTS homes (
        tok TEXT PRIMARY KEY,
        nm TEXT NOT NULL DEFAULT '',
        pub INTEGER NOT NULL DEFAULT 0,
        hk TEXT UNIQUE,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS homes_hk ON homes(hk)`,
      `CREATE TABLE IF NOT EXISTS home_rooms (
        mem_id TEXT PRIMARY KEY,
        tok TEXT,
        dk TEXT,
        rm TEXT NOT NULL,
        name TEXT,
        lang TEXT,
        iso TEXT,
        sex TEXT,
        born INTEGER,
        age INTEGER,
        rd TEXT,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS home_rooms_tok ON home_rooms(tok)`,
      // Lightweight memorial social (candles / words)
      `CREATE TABLE IF NOT EXISTS mem_stats (
        id TEXT PRIMARY KEY,
        candles INTEGER NOT NULL DEFAULT 0,
        act INTEGER NOT NULL DEFAULT 0,
        last_word TEXT,
        last_at INTEGER NOT NULL DEFAULT 0,
        hidden INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS mem_reacts (
        id TEXT NOT NULL,
        sid TEXT NOT NULL,
        kind TEXT NOT NULL,
        at INTEGER NOT NULL,
        PRIMARY KEY (id, sid, kind)
      )`,
      // Memorial CMS (free Keep slots; no Stripe)
      `CREATE TABLE IF NOT EXISTS memorials (
        id TEXT PRIMARY KEY,
        tok TEXT NOT NULL,
        dk TEXT NOT NULL,
        lk TEXT,
        at INTEGER NOT NULL,
        lang TEXT,
        name TEXT,
        iso TEXT,
        sex TEXT,
        age INTEGER,
        born INTEGER,
        urban INTEGER DEFAULT 0,
        epi TEXT,
        rd TEXT,
        cm TEXT,
        d TEXT NOT NULL,
        cv INTEGER DEFAULT -1,
        st TEXT,
        rm TEXT,
        gw TEXT,
        hidden INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS memorials_tok_at ON memorials(tok, at DESC)`,
      `CREATE INDEX IF NOT EXISTS memorials_at ON memorials(at DESC)`,
      `CREATE INDEX IF NOT EXISTS memorials_iso_at ON memorials(iso, at DESC)`,
      `CREATE INDEX IF NOT EXISTS memorials_lang_at ON memorials(lang, at DESC)`,
      // In-app feedback (replaces Google Forms)
      `CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        lang TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        nick TEXT,
        ctx TEXT,
        sid TEXT,
        ua TEXT,
        hidden INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS feedback_at ON feedback(at DESC)`,
      `CREATE INDEX IF NOT EXISTS feedback_lang_at ON feedback(lang, at DESC)`,
      `CREATE INDEX IF NOT EXISTS feedback_sid_at ON feedback(sid, at DESC)`,
    ],
    "write",
  );

  // Soft-add columns for DBs created before the extended posts / keep schema
  for (const sql of [
    "ALTER TABLE posts ADD COLUMN tok TEXT",
    "ALTER TABLE posts ADD COLUMN text TEXT",
    "ALTER TABLE posts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE posts ADD COLUMN reports INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE posts ADD COLUMN sid TEXT",
    "ALTER TABLE keep_passes ADD COLUMN phone TEXT",
  ]) {
    try {
      await db.execute(sql);
    } catch {
      // column already exists
    }
  }

  try {
    await db.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS keep_passes_phone ON keep_passes(phone)",
    );
  } catch {
    // index may already exist
  }

  await migrateKeepPassesNullableEmail(db);
}

/** Rebuild keep_passes so email can be NULL (phone-only OTP). Idempotent via meta. */
async function migrateKeepPassesNullableEmail(db) {
  const flag = "keep_passes_email_nullable";
  const { rows } = await db.execute({
    sql: "SELECT value FROM meta WHERE key = ?",
    args: [flag],
  });
  if (rows.length) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS keep_passes_mig (
      tok TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      left_n INTEGER NOT NULL DEFAULT 99,
      created_at INTEGER NOT NULL,
      used_at INTEGER
    )
  `);

  // phone column may be missing on very old copies; SELECT phone fails — fall back
  try {
    await db.execute(`
      INSERT OR IGNORE INTO keep_passes_mig (tok, email, phone, left_n, created_at, used_at)
      SELECT tok, NULLIF(email, ''), phone, left_n, created_at, used_at FROM keep_passes
    `);
  } catch {
    await db.execute(`
      INSERT OR IGNORE INTO keep_passes_mig (tok, email, phone, left_n, created_at, used_at)
      SELECT tok, NULLIF(email, ''), NULL, left_n, created_at, used_at FROM keep_passes
    `);
  }

  await db.execute("DROP TABLE keep_passes");
  await db.execute("ALTER TABLE keep_passes_mig RENAME TO keep_passes");
  await db.execute(
    "CREATE INDEX IF NOT EXISTS keep_passes_email ON keep_passes(email)",
  );
  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS keep_passes_phone ON keep_passes(phone)",
  );
  await db.execute({
    sql: "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    args: [flag, "1"],
  });
}

export function sessionTtlMs() {
  return SESSION_TTL_MS;
}

export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
