import crypto from "node:crypto";
import { adminConfig } from "./env.mjs";
import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { checkRate, enforceRate, enforceRates } from "./rate-limit.mjs";
import { int, str } from "./util.mjs";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const TRUNCATE_AT = 400;

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) {
    crypto.timingSafeEqual(aa, aa);
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

function signToken(exp, password) {
  const payload = `admin|${exp}`;
  const sig = crypto
    .createHmac("sha256", password)
    .update(payload)
    .digest("hex");
  return `${exp}.${sig}`;
}

function verifyToken(token, password) {
  const raw = str(token, 200);
  const dot = raw.indexOf(".");
  if (dot < 1) return false;
  const exp = Number(raw.slice(0, dot));
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = signToken(exp, password);
  return timingSafeEqualStr(raw, expected);
}

function checkAuth(body) {
  const { password, configured } = adminConfig();
  if (!configured) return { ok: false, why: "off" };
  const tok = str(body?.token, 200);
  if (tok && verifyToken(tok, password)) return { ok: true };
  const pw = String(body?.password ?? "");
  if (pw && timingSafeEqualStr(pw, password)) return { ok: true };
  return { ok: false, why: "auth" };
}

function needDb() {
  return { ok: false, why: "busy" };
}

/** Quote an identifier safely (table names from sqlite_master only). */
function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function isSafeTableName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(name || ""));
}

function truncateValue(v) {
  if (v == null) return v;
  if (typeof v === "string" && v.length > TRUNCATE_AT) {
    return {
      _trunc: true,
      len: v.length,
      preview: v.slice(0, TRUNCATE_AT),
    };
  }
  return v;
}

function rowToObject(columns, row) {
  const out = {};
  for (const col of columns) {
    out[col] = truncateValue(row[col]);
  }
  return out;
}

async function listUserTables(db) {
  const { rows } = await db.execute(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_litestream%'
      AND name NOT LIKE 'libsql_%'
    ORDER BY name
  `);
  return rows.map((r) => String(r.name)).filter(isSafeTableName);
}

/** POST { password } → { ok, token, expiresAt }. meta: { clientIp? } */
export async function adminLogin(body, meta = {}) {
  const ip = str(meta?.clientIp, 64) || "anon";

  // Lock out after too many wrong passwords (read-only check first)
  const locked = await checkRate("adminLoginFailIp", ip);
  if (!locked.ok) return locked;

  const limited = await enforceRates([
    ["adminLoginIp", ip],
    ["adminLoginIpHour", ip],
  ]);
  if (!limited.ok) return limited;

  const gate = checkAuth(body);
  if (!gate.ok) {
    await enforceRate("adminLoginFailIp", ip);
    return gate;
  }
  if (!isTursoConfigured()) return needDb();
  // Touch DB so migrations run before browsing
  const db = await ensureTurso();
  if (!db) return needDb();

  const { password } = adminConfig();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return { ok: true, token: signToken(expiresAt, password), expiresAt };
}

/** POST { token|password } → table names + row counts */
export async function adminOverview(body) {
  const gate = checkAuth(body);
  if (!gate.ok) return gate;
  if (!isTursoConfigured()) return needDb();

  const db = await ensureTurso();
  if (!db) return needDb();

  const names = await listUserTables(db);
  const tables = [];
  for (const name of names) {
    try {
      const { rows } = await db.execute(
        `SELECT COUNT(*) AS n FROM ${quoteIdent(name)}`,
      );
      tables.push({ name, count: Number(rows[0]?.n) || 0 });
    } catch (err) {
      tables.push({
        name,
        count: null,
        error: err instanceof Error ? err.message : "count failed",
      });
    }
  }
  return { ok: true, tables };
}

/**
 * POST { token|password, table, limit?, offset? }
 * → columns + rows (large text truncated)
 */
export async function adminTable(body) {
  const gate = checkAuth(body);
  if (!gate.ok) return gate;
  if (!isTursoConfigured()) return needDb();

  const table = str(body?.table, 64);
  if (!isSafeTableName(table)) return { ok: false, why: "table" };

  const db = await ensureTurso();
  if (!db) return needDb();

  const names = await listUserTables(db);
  if (!names.includes(table)) return { ok: false, why: "table" };

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, int(body?.limit, DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, int(body?.offset, 0) || 0);

  const qName = quoteIdent(table);
  const countRes = await db.execute(`SELECT COUNT(*) AS n FROM ${qName}`);
  const total = Number(countRes.rows[0]?.n) || 0;

  const colRes = await db.execute(`PRAGMA table_info(${qName})`);
  const columns = colRes.rows.map((r) => String(r.name));

  const { rows } = await db.execute({
    sql: `SELECT * FROM ${qName} LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });

  return {
    ok: true,
    table,
    columns,
    total,
    limit,
    offset,
    rows: rows.map((r) => rowToObject(columns, r)),
  };
}
