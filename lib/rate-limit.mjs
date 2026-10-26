import { ensureTurso, isTursoConfigured } from "./turso.mjs";

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Named fixed-window policies (auth + admin). */
export const RATE_POLICIES = {
  sendOtpIdent: { rate: 1, periodMs: MINUTE_MS },
  sendOtpIdentHour: { rate: 10, periodMs: HOUR_MS },
  sendOtpIdentDay: { rate: 20, periodMs: DAY_MS },
  sendOtpIp: { rate: 5, periodMs: MINUTE_MS },
  sendOtpIpHour: { rate: 30, periodMs: HOUR_MS },
  verifyOtpIp: { rate: 30, periodMs: MINUTE_MS },
  verifyOtpIdent: { rate: 20, periodMs: MINUTE_MS },
  adminLoginIp: { rate: 5, periodMs: MINUTE_MS },
  adminLoginIpHour: { rate: 20, periodMs: HOUR_MS },
  adminLoginFailIp: { rate: 10, periodMs: HOUR_MS },
};

/** Process-local fallback when Turso is offline (dev only). */
const mem = new Map();

function memTake(id, rate, expiresAt) {
  const now = Date.now();
  let row = mem.get(id);
  if (!row || row.expiresAt < now) {
    row = { count: 0, expiresAt };
    mem.set(id, row);
  }
  row.count += 1;
  if (mem.size > 5000) {
    for (const [k, v] of mem) {
      if (v.expiresAt < now) mem.delete(k);
    }
  }
  return { ok: row.count <= rate, count: row.count };
}

/**
 * Fixed-window take. Returns { ok: false } when over the limit.
 * @param {{ name: string, key: string, rate: number, periodMs: number }} opts
 */
export async function rateLimitTake({ name, key, rate, periodMs }) {
  const safeKey = String(key || "anon")
    .trim()
    .slice(0, 128) || "anon";
  const now = Date.now();
  const window = Math.floor(now / periodMs);
  const id = `${name}:${safeKey}:${window}`;
  const expiresAt = (window + 2) * periodMs;

  if (!isTursoConfigured()) {
    return memTake(id, rate, expiresAt);
  }

  const db = await ensureTurso();
  if (!db) return memTake(id, rate, expiresAt);

  await db.execute({
    sql: `INSERT INTO rate_buckets (id, count, expires_at) VALUES (?, 1, ?)
          ON CONFLICT(id) DO UPDATE SET count = count + 1`,
    args: [id, expiresAt],
  });
  const { rows } = await db.execute({
    sql: "SELECT count FROM rate_buckets WHERE id = ?",
    args: [id],
  });
  const count = Number(rows[0]?.count) || 0;

  // opportunistic cleanup (~2% of takes)
  if (Math.random() < 0.02) {
    try {
      await db.execute({
        sql: "DELETE FROM rate_buckets WHERE expires_at < ?",
        args: [now],
      });
    } catch {
      // ignore
    }
  }

  return { ok: count <= rate, count, remaining: Math.max(0, rate - count) };
}

async function readCount(id) {
  if (!isTursoConfigured()) {
    const row = mem.get(id);
    return row && row.expiresAt >= Date.now() ? row.count : 0;
  }
  const db = await ensureTurso();
  if (!db) {
    const row = mem.get(id);
    return row && row.expiresAt >= Date.now() ? row.count : 0;
  }
  const { rows } = await db.execute({
    sql: "SELECT count FROM rate_buckets WHERE id = ?",
    args: [id],
  });
  return Number(rows[0]?.count) || 0;
}

/** Read-only check (does not increment). */
export async function rateLimitCheck({ name, key, rate, periodMs }) {
  const safeKey = String(key || "anon")
    .trim()
    .slice(0, 128) || "anon";
  const window = Math.floor(Date.now() / periodMs);
  const id = `${name}:${safeKey}:${window}`;
  const count = await readCount(id);
  return { ok: count < rate, count, remaining: Math.max(0, rate - count) };
}

/** Apply a named policy; returns { ok:false, why:"rate" } when limited. */
export async function enforceRate(policyName, key) {
  const policy = RATE_POLICIES[policyName];
  if (!policy) return { ok: true };
  const hit = await rateLimitTake({
    name: policyName,
    key,
    rate: policy.rate,
    periodMs: policy.periodMs,
  });
  if (!hit.ok) return { ok: false, why: "rate" };
  return { ok: true };
}

/** Soft lockout check without consuming a slot. */
export async function checkRate(policyName, key) {
  const policy = RATE_POLICIES[policyName];
  if (!policy) return { ok: true };
  const hit = await rateLimitCheck({
    name: policyName,
    key,
    rate: policy.rate,
    periodMs: policy.periodMs,
  });
  if (!hit.ok) return { ok: false, why: "rate" };
  return { ok: true };
}

/** Run several enforceRate checks; first failure wins. */
export async function enforceRates(checks) {
  for (const [policyName, key] of checks) {
    if (!key) continue;
    const r = await enforceRate(policyName, key);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/** Best-effort client IP from Node/Vercel request headers. */
export function clientIpFromHeaders(headers) {
  if (!headers || typeof headers !== "object") return "";
  const get = (k) => {
    const v = headers[k] ?? headers[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const xf = String(get("x-forwarded-for") || "").split(",")[0].trim();
  if (xf) return xf.slice(0, 64);
  const real = String(get("x-real-ip") || "").trim();
  if (real) return real.slice(0, 64);
  const cf = String(get("cf-connecting-ip") || "").trim();
  if (cf) return cf.slice(0, 64);
  return "";
}
