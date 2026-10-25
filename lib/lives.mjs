import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { findPass } from "./keep.mjs";
import { memLives } from "./memory-store.mjs";
import { byteLen, int, str } from "./util.mjs";

const MAX_DEVICES = 3;
const MAX_BYTES = 1_400_000;

/**
 * Cloud life locker: act = on | off | list | put | get
 */
export async function handleLives(body) {
  const pass = await findPass(body.tok);
  if (!pass) return { ok: false, why: "tok" };
  const act = str(body.act, 8);
  const dv = /^[0-9a-f]{16}$/.test(body.dv || "") ? body.dv : "";

  if (act === "on") return setOn(pass.tok, true);
  if (act === "off") return setOn(pass.tok, false);
  if (act === "list") return listLives(pass.tok, dv);
  if (act === "put") return putBlob(pass.tok, body);
  if (act === "get") return getBlob(pass.tok, body.k);
  return { ok: false, why: "bad" };
}

async function setOn(tok, on) {
  const now = Date.now();
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    if (!on) {
      await db.batch(
        [
          {
            sql: "DELETE FROM lives_blobs WHERE tok = ?",
            args: [tok],
          },
          {
            sql: `INSERT INTO lives_state (tok, on_flag, updated_at) VALUES (?, 0, ?)
                  ON CONFLICT(tok) DO UPDATE SET on_flag = 0, updated_at = excluded.updated_at`,
            args: [tok, now],
          },
        ],
        "write",
      );
      return { ok: true, on: false, list: [] };
    }
    await db.execute({
      sql: `INSERT INTO lives_state (tok, on_flag, updated_at) VALUES (?, 1, ?)
            ON CONFLICT(tok) DO UPDATE SET on_flag = 1, updated_at = excluded.updated_at`,
      args: [tok, now],
    });
    return { ok: true, on: true };
  }

  const store = memLives();
  if (!on) {
    store.state.set(tok, { on: false, updated_at: now });
    for (const key of [...store.blobs.keys()]) {
      if (key.startsWith(tok + ":")) store.blobs.delete(key);
    }
    return { ok: true, on: false, list: [] };
  }
  store.state.set(tok, { on: true, updated_at: now });
  return { ok: true, on: true };
}

async function isOn(tok) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return false;
    const { rows } = await db.execute({
      sql: "SELECT on_flag FROM lives_state WHERE tok = ?",
      args: [tok],
    });
    return rows.length ? Boolean(Number(rows[0].on_flag)) : false;
  }
  return Boolean(memLives().state.get(tok)?.on);
}

async function listLives(tok, dv) {
  const on = await isOn(tok);
  if (!on) return { ok: true, on: false, list: [] };

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT dv, at, c, w, length(d) AS n FROM lives_blobs WHERE tok = ? ORDER BY at DESC",
      args: [tok],
    });
    const list = rows.map((r) => ({
      k: String(r.dv),
      me: dv && String(r.dv) === dv ? 1 : 0,
      at: Number(r.at) || 0,
      n: Number(r.n) || 0,
      c: Number(r.c) || 0,
      w: Number(r.w) || 0,
    }));
    return { ok: true, on: true, list };
  }

  const store = memLives();
  const list = [];
  for (const [key, row] of store.blobs) {
    if (!key.startsWith(tok + ":")) continue;
    list.push({
      k: row.dv,
      me: dv && row.dv === dv ? 1 : 0,
      at: row.at,
      n: byteLen(row.d),
      c: row.c,
      w: row.w,
    });
  }
  list.sort((a, b) => b.at - a.at);
  return { ok: true, on: true, list };
}

async function putBlob(tok, body) {
  const on = await isOn(tok);
  if (!on) return { ok: false, why: "stop" };
  const dv = /^[0-9a-f]{16}$/.test(body.dv || "") ? body.dv : "";
  if (!dv) return { ok: false, why: "bad" };
  const d = typeof body.d === "string" ? body.d : "";
  if (!d || byteLen(d) > MAX_BYTES) return { ok: false, why: "big" };
  const z = body.z ? 1 : 0;
  const c = int(body.c, 0);
  const w = int(body.w, 0);
  const now = Date.now();

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT dv FROM lives_blobs WHERE tok = ?",
      args: [tok],
    });
    const known = rows.some((r) => String(r.dv) === dv);
    if (!known && rows.length >= MAX_DEVICES) {
      return { ok: false, why: "room" };
    }
    await db.execute({
      sql: `INSERT INTO lives_blobs (tok, dv, z, d, c, w, at) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tok, dv) DO UPDATE SET
              z=excluded.z, d=excluded.d, c=excluded.c, w=excluded.w, at=excluded.at`,
      args: [tok, dv, z, d, c, w, now],
    });
    return { ok: true, at: now };
  }

  const store = memLives();
  const existing = [...store.blobs.values()].filter((r) => r.tok === tok);
  if (!existing.some((r) => r.dv === dv) && existing.length >= MAX_DEVICES) {
    return { ok: false, why: "room" };
  }
  store.blobs.set(`${tok}:${dv}`, { tok, dv, z, d, c, w, at: now });
  return { ok: true, at: now };
}

async function getBlob(tok, k) {
  const dv = /^[0-9a-f]{16}$/.test(k || "") ? k : "";
  if (!dv) return { ok: false, why: "gone" };
  const on = await isOn(tok);
  if (!on) return { ok: false, why: "stop" };

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT z, d FROM lives_blobs WHERE tok = ? AND dv = ?",
      args: [tok, dv],
    });
    if (!rows.length) return { ok: false, why: "gone" };
    return { ok: true, z: Number(rows[0].z) ? 1 : 0, d: String(rows[0].d) };
  }

  const row = memLives().blobs.get(`${tok}:${dv}`);
  if (!row) return { ok: false, why: "gone" };
  return { ok: true, z: row.z ? 1 : 0, d: row.d };
}
