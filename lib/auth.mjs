import crypto from "node:crypto";
import { authConfig } from "./env.mjs";
import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { claimKeepForUser, findPass } from "./keep.mjs";
import { sendOtpSms } from "./sms/kavenegar.mjs";
import { sendOtpEmail } from "./email/resend.mjs";
import { enforceRates } from "./rate-limit.mjs";
import { isEmail, randHex, str } from "./util.mjs";

const OTP_LEN = 5;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function emailKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Map Persian/Arabic digits to ASCII. */
function toAsciiDigits(s) {
  return String(s || "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - "۰".charCodeAt(0)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - "٠".charCodeAt(0)));
}

/**
 * Normalize phone for storage + Kavenegar.
 * Iranian: 09… / +98… / 9… → 98XXXXXXXXXX (no +).
 */
export function normalizePhone(raw) {
  let s = toAsciiDigits(raw)
    .trim()
    .replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  if (/^09\d{9}$/.test(s)) return "98" + s.slice(1);
  if (/^9\d{9}$/.test(s)) return "98" + s;
  if (/^989\d{9}$/.test(s)) return s;
  if (/^\d{10,15}$/.test(s)) return s;
  return null;
}

function hashOtp(code, pepper) {
  return crypto
    .createHash("sha256")
    .update(`${pepper}:${code}`)
    .digest("hex");
}

function makeOtp() {
  const n = crypto.randomInt(0, 10 ** OTP_LEN);
  return String(n).padStart(OTP_LEN, "0");
}

function needDb() {
  return { ok: false, why: "busy" };
}

function clientKey(meta) {
  return str(meta?.clientIp, 64) || "anon";
}

/**
 * Start an OTP challenge.
 * Body: { channel: "email"|"phone", email?, phone? }
 * meta: { clientIp? }
 */
export async function authStart(body, meta = {}) {
  const cfg = authConfig();
  if (!cfg.pepperConfigured) return { ok: false, why: "cfg" };
  if (!isTursoConfigured()) return needDb();

  const channel = str(body?.channel, 16);
  if (channel !== "email" && channel !== "phone") {
    return { ok: false, why: "channel" };
  }

  let identifier;
  if (channel === "email") {
    const em = emailKey(body?.email);
    if (!isEmail(em)) return { ok: false, why: "email" };
    if (!cfg.emailConfigured && !cfg.devOtp) return { ok: false, why: "off" };
    identifier = em;
  } else {
    const ph = normalizePhone(body?.phone);
    if (!ph) return { ok: false, why: "phone" };
    if (!cfg.smsConfigured && !cfg.devOtp) return { ok: false, why: "off" };
    identifier = ph;
  }

  const ip = clientKey(meta);
  const limited = await enforceRates([
    ["sendOtpIdent", `${channel}:${identifier}`],
    ["sendOtpIdentHour", `${channel}:${identifier}`],
    ["sendOtpIdentDay", `${channel}:${identifier}`],
    ["sendOtpIp", ip],
    ["sendOtpIpHour", ip],
  ]);
  if (!limited.ok) return limited;

  const db = await ensureTurso();
  if (!db) return needDb();

  const now = Date.now();
  const code = makeOtp();
  const challengeId = randHex(16);
  const codeHash = hashOtp(code, cfg.pepper);
  const expiresAt = now + OTP_TTL_MS;

  await db.execute({
    sql: `INSERT INTO auth_challenges
          (id, channel, identifier, code_hash, expires_at, attempts, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)`,
    args: [challengeId, channel, identifier, codeHash, expiresAt, now],
  });

  try {
    if (cfg.devOtp) {
      console.info("[auth] AUTH_OTP_DEV code", { channel, identifier, code });
    } else if (channel === "email") {
      await sendOtpEmail(identifier, code);
    } else {
      await sendOtpSms(identifier, code);
    }
  } catch (err) {
    console.error("auth start send failed", err);
    await db.execute({
      sql: "UPDATE auth_challenges SET consumed_at = ? WHERE id = ?",
      args: [now, challengeId],
    });
    return { ok: false, why: "send" };
  }

  const out = { ok: true, challengeId, channel };
  if (cfg.devOtp) out.devCode = code;
  return out;
}

/**
 * Verify OTP and issue session + keep tok.
 * Body: { challengeId, code, dv? }
 * meta: { clientIp? }
 */
export async function authVerify(body, meta = {}) {
  const cfg = authConfig();
  if (!cfg.pepperConfigured) return { ok: false, why: "cfg" };
  if (!isTursoConfigured()) return needDb();

  const challengeId = str(body?.challengeId, 64);
  const code = toAsciiDigits(str(body?.code, 16)).replace(/\D/g, "");
  if (!challengeId || code.length !== OTP_LEN) return { ok: false, why: "code" };

  const ip = clientKey(meta);
  const ipLimited = await enforceRates([["verifyOtpIp", ip]]);
  if (!ipLimited.ok) return ipLimited;

  const db = await ensureTurso();
  if (!db) return needDb();

  const now = Date.now();
  const { rows } = await db.execute({
    sql: `SELECT id, channel, identifier, code_hash, expires_at, attempts, consumed_at
          FROM auth_challenges WHERE id = ?`,
    args: [challengeId],
  });
  if (!rows.length) return { ok: false, why: "gone" };
  const ch = rows[0];
  if (ch.consumed_at) return { ok: false, why: "gone" };
  if (Number(ch.expires_at) < now) return { ok: false, why: "expired" };
  if (Number(ch.attempts) >= MAX_ATTEMPTS) return { ok: false, why: "attempts" };

  const identLimited = await enforceRates([
    ["verifyOtpIdent", `${ch.channel}:${ch.identifier}`],
  ]);
  if (!identLimited.ok) return identLimited;

  const expected = String(ch.code_hash);
  const got = hashOtp(code, cfg.pepper);
  const match =
    expected.length === got.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));

  if (!match) {
    await db.execute({
      sql: "UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = ?",
      args: [challengeId],
    });
    return { ok: false, why: "code" };
  }

  await db.execute({
    sql: "UPDATE auth_challenges SET consumed_at = ? WHERE id = ?",
    args: [now, challengeId],
  });

  const channel = String(ch.channel);
  const identifier = String(ch.identifier);
  const email = channel === "email" ? identifier : null;
  const phone = channel === "phone" ? identifier : null;

  let userId = null;
  if (email) {
    const found = await db.execute({
      sql: "SELECT id, keep_tok FROM users WHERE email = ?",
      args: [email],
    });
    if (found.rows.length) userId = String(found.rows[0].id);
  } else if (phone) {
    const found = await db.execute({
      sql: "SELECT id, keep_tok FROM users WHERE phone = ?",
      args: [phone],
    });
    if (found.rows.length) userId = String(found.rows[0].id);
  }

  const keep = await claimKeepForUser({
    email,
    phone,
    dv: body?.dv,
  });
  if (!keep.ok) return keep;

  if (!userId) {
    userId = randHex(16);
    await db.execute({
      sql: `INSERT INTO users (id, email, phone, keep_tok, created_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, email, phone, keep.tok, now, now],
    });
  } else {
    await db.execute({
      sql: `UPDATE users SET keep_tok = ?, last_login_at = ?,
            email = COALESCE(email, ?), phone = COALESCE(phone, ?)
            WHERE id = ?`,
      args: [keep.tok, now, email, phone, userId],
    });
  }

  const session = randHex(24);
  await db.execute({
    sql: `INSERT INTO auth_sessions (token, user_id, keep_tok, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [session, userId, keep.tok, now, now + SESSION_TTL_MS],
  });

  return {
    ok: true,
    session,
    tok: keep.tok,
    left: keep.left,
    ml: 0,
    channel,
  };
}

/** Body: { session } */
export async function authMe(body) {
  if (!isTursoConfigured()) return needDb();
  const token = str(body?.session, 96);
  if (!token || token.length < 16) return { ok: false, why: "session" };

  const db = await ensureTurso();
  if (!db) return needDb();

  const now = Date.now();
  const { rows } = await db.execute({
    sql: `SELECT s.token, s.user_id, s.keep_tok, s.expires_at, s.revoked_at,
                 u.email, u.phone
          FROM auth_sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token = ?`,
    args: [token],
  });
  if (!rows.length) return { ok: false, why: "session" };
  const row = rows[0];
  if (row.revoked_at) return { ok: false, why: "session" };
  if (Number(row.expires_at) < now) return { ok: false, why: "expired" };

  const keepTok = String(row.keep_tok);
  const pass = await findPass(keepTok);

  return {
    ok: true,
    session: token,
    tok: keepTok,
    left: pass?.left ?? 0,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
  };
}

/** Body: { session } */
export async function authLogout(body) {
  if (!isTursoConfigured()) return needDb();
  const token = str(body?.session, 96);
  if (!token) return { ok: false, why: "session" };

  const db = await ensureTurso();
  if (!db) return needDb();

  await db.execute({
    sql: "UPDATE auth_sessions SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL",
    args: [Date.now(), token],
  });
  return { ok: true };
}
