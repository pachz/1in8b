import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { memKeep } from "./memory-store.mjs";
import {
  isCode9,
  isEmail,
  normalizeCode,
  randCode,
  randHex,
  str,
} from "./util.mjs";

const DEVICE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DEVICES = 5;
const CARRY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const FREE_LEFT = 99;

function emailKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/** Free email unlock (no Stripe). Issues a durable Keep token. */
export async function keepUnlock({ email, dv }) {
  if (!isEmail(email)) return { ok: false, why: "email" };
  const em = emailKey(email);
  const device = /^[0-9a-f]{16}$/.test(dv || "") ? dv : "";
  const now = Date.now();

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    let { rows } = await db.execute({
      sql: "SELECT tok, left_n FROM keep_passes WHERE email = ?",
      args: [em],
    });
    let tok;
    let left;
    if (rows.length) {
      tok = String(rows[0].tok);
      left = Number(rows[0].left_n) || 0;
    } else {
      tok = randHex(16);
      left = FREE_LEFT;
      await db.execute({
        sql: "INSERT INTO keep_passes (tok, email, left_n, created_at) VALUES (?, ?, ?, ?)",
        args: [tok, em, left, now],
      });
    }
    if (device) {
      const gate = await registerDevice(db, tok, device, now);
      if (!gate.ok) return gate;
    }
    return { ok: true, tok, left, ml: 0 };
  }

  const store = memKeep();
  let pass = store.byEmail.get(em);
  if (!pass) {
    pass = { tok: randHex(16), email: em, left: FREE_LEFT, created_at: now };
    store.byEmail.set(em, pass);
    store.byTok.set(pass.tok, pass);
  }
  if (device) {
    const gate = registerDeviceMem(pass.tok, device, now);
    if (!gate.ok) return gate;
  }
  return { ok: true, tok: pass.tok, left: pass.left, ml: 0 };
}

export async function keepMe({ tok }) {
  const pass = await findPass(tok);
  if (!pass) return { ok: false, why: "tok" };
  return { ok: true, left: pass.left, ml: 0 };
}

export async function keepUse({ tok }) {
  const pass = await findPass(tok);
  if (!pass) return { ok: false, why: "tok" };
  const now = Date.now();
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (db) {
      await db.execute({
        sql: "UPDATE keep_passes SET used_at = ? WHERE tok = ?",
        args: [now, pass.tok],
      });
    }
  }
  return { ok: true };
}

/** Park a life JSON blob under a one-shot 9-char code. */
export async function keepCarry({ tok, s }) {
  const pass = await findPass(tok);
  if (!pass) return { ok: false, why: "tok" };
  const payload = str(s, 1_400_000);
  if (!payload || payload.length < 8) return { ok: false, why: "bad" };
  const now = Date.now();
  let code = randCode(9);
  const expires = now + CARRY_TTL_MS;

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    for (let i = 0; i < 6; i++) {
      try {
        await db.execute({
          sql: `INSERT INTO keep_carry (code, tok, payload, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [code, pass.tok, payload, now, expires],
        });
        return { ok: true, c: code };
      } catch {
        code = randCode(9);
      }
    }
    return { ok: false, why: "busy" };
  }

  const store = memKeep();
  store.carry.set(code, {
    tok: pass.tok,
    payload,
    expires_at: expires,
    used_at: null,
  });
  return { ok: true, c: code };
}

export async function keepTake({ tok, c, dv }) {
  const code = normalizeCode(c);
  if (!isCode9(code)) return { ok: false, why: "gone" };
  const now = Date.now();

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT tok, payload, expires_at, used_at FROM keep_carry WHERE code = ?",
      args: [code],
    });
    if (!rows.length) return { ok: false, why: "gone" };
    const row = rows[0];
    if (row.used_at || Number(row.expires_at) < now) {
      return { ok: false, why: "gone" };
    }
    if (tok && tok !== row.tok) {
      // Allow take without matching tok (in-app handoff); reject wrong paid tok
      const other = await findPass(tok);
      if (other && other.tok !== String(row.tok)) {
        return { ok: false, why: "other" };
      }
    }
    await db.execute({
      sql: "UPDATE keep_carry SET used_at = ? WHERE code = ? AND used_at IS NULL",
      args: [now, code],
    });
    const device = /^[0-9a-f]{16}$/.test(dv || "") ? dv : "";
    if (device) await registerDevice(db, String(row.tok), device, now);
    return {
      ok: true,
      tok: String(row.tok),
      ml: 0,
      d: String(row.payload),
    };
  }

  const store = memKeep();
  const row = store.carry.get(code);
  if (!row || row.used_at || row.expires_at < now) {
    return { ok: false, why: "gone" };
  }
  if (tok && tok !== row.tok) {
    const other = store.byTok.get(tok);
    if (other && other.tok !== row.tok) return { ok: false, why: "other" };
  }
  row.used_at = now;
  return { ok: true, tok: row.tok, ml: 0, d: row.payload };
}

export async function findPass(tok) {
  const t = str(tok, 64);
  if (!t || t.length < 16) return null;

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return null;
    const { rows } = await db.execute({
      sql: "SELECT tok, email, left_n FROM keep_passes WHERE tok = ?",
      args: [t],
    });
    if (!rows.length) return null;
    return {
      tok: String(rows[0].tok),
      email: String(rows[0].email),
      left: Number(rows[0].left_n) || 0,
    };
  }

  return memKeep().byTok.get(t) || null;
}

/** Adjust remaining memorial slots. delta = -1 on publish, +1 on remove. */
export async function adjustLeft(tok, delta) {
  const pass = await findPass(tok);
  if (!pass) return { ok: false, why: "tok" };

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    if (delta < 0) {
      if (pass.left <= 0) return { ok: false, why: "used" };
      await db.execute({
        sql: "UPDATE keep_passes SET left_n = left_n - 1 WHERE tok = ? AND left_n > 0",
        args: [pass.tok],
      });
      const after = await findPass(tok);
      if (!after || after.left >= pass.left) return { ok: false, why: "used" };
      return { ok: true, left: after.left };
    }
    await db.execute({
      sql: "UPDATE keep_passes SET left_n = left_n + ? WHERE tok = ?",
      args: [delta, pass.tok],
    });
    const after = await findPass(tok);
    return { ok: true, left: after?.left ?? pass.left + delta };
  }

  if (delta < 0 && pass.left <= 0) return { ok: false, why: "used" };
  pass.left = Math.max(0, pass.left + delta);
  return { ok: true, left: pass.left };
}

async function registerDevice(db, tok, dv, now) {
  const { rows } = await db.execute({
    sql: `SELECT dv, last_at FROM keep_devices
          WHERE tok = ? AND last_at >= ? ORDER BY last_at DESC`,
    args: [tok, now - DEVICE_WINDOW_MS],
  });
  const known = rows.find((r) => String(r.dv) === dv);
  if (!known && rows.length >= MAX_DEVICES) {
    return { ok: false, why: "devices" };
  }
  await db.execute({
    sql: `INSERT INTO keep_devices (tok, dv, ml, last_at) VALUES (?, ?, 0, ?)
          ON CONFLICT(tok, dv) DO UPDATE SET last_at = excluded.last_at, ml = 0`,
    args: [tok, dv, now],
  });
  return { ok: true };
}

function registerDeviceMem(tok, dv, now) {
  const store = memKeep();
  if (!store.devices.has(tok)) store.devices.set(tok, new Map());
  const map = store.devices.get(tok);
  const cutoff = now - DEVICE_WINDOW_MS;
  for (const [k, v] of [...map.entries()]) {
    if (v.last_at < cutoff) map.delete(k);
  }
  if (!map.has(dv) && map.size >= MAX_DEVICES) {
    return { ok: false, why: "devices" };
  }
  map.set(dv, { ml: 0, last_at: now });
  return { ok: true };
}
