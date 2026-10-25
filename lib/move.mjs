import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { memMove } from "./memory-store.mjs";
import { byteLen, isCode9, normalizeCode, randCode } from "./util.mjs";

const MAX_BYTES = 1_400_000;
const TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_PENDING = 500;

/** Create a one-shot move code. Body is the movePack result: {z,d,...}. */
export async function moveCreate(body) {
  const z = body.z ? 1 : 0;
  const d = typeof body.d === "string" ? body.d : "";
  if (!d) return { ok: false, why: "bad" };
  if (byteLen(d) > MAX_BYTES) return { ok: false, why: "big" };
  const now = Date.now();
  const expires = now + TTL_MS;

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM move_codes WHERE used_at IS NULL AND expires_at > ?",
      args: [now],
    });
    if ((Number(rows[0]?.n) || 0) >= MAX_PENDING) {
      return { ok: false, why: "full" };
    }
    let code = randCode(9);
    for (let i = 0; i < 8; i++) {
      try {
        await db.execute({
          sql: `INSERT INTO move_codes (code, z, d, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [code, z, d, now, expires],
        });
        return { ok: true, c: code };
      } catch {
        code = randCode(9);
      }
    }
    return { ok: false, why: "busy" };
  }

  const store = memMove();
  for (const [k, v] of [...store.entries()]) {
    if (v.used_at || v.expires_at < now) store.delete(k);
  }
  if (store.size >= MAX_PENDING) return { ok: false, why: "full" };
  const code = randCode(9);
  store.set(code, { z, d, created_at: now, expires_at: expires, used_at: null });
  return { ok: true, c: code };
}

/**
 * Redeem a move code. `wantZ` = client supports DecompressionStream.
 * If client cannot decompress and payload is gzipped, return why: "old".
 */
export async function moveTake({ c, z: wantZ }) {
  const code = normalizeCode(c);
  if (!isCode9(code)) return { ok: false, why: "gone" };
  const now = Date.now();
  const canGunzip = Boolean(wantZ);

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT z, d, expires_at, used_at FROM move_codes WHERE code = ?",
      args: [code],
    });
    if (!rows.length) return { ok: false, why: "gone" };
    const row = rows[0];
    if (row.used_at || Number(row.expires_at) < now) {
      return { ok: false, why: "gone" };
    }
    const gz = Number(row.z) ? 1 : 0;
    if (gz && !canGunzip) return { ok: false, why: "old" };
    await db.execute({
      sql: "UPDATE move_codes SET used_at = ? WHERE code = ? AND used_at IS NULL",
      args: [now, code],
    });
    return { ok: true, z: gz, d: String(row.d) };
  }

  const store = memMove();
  const row = store.get(code);
  if (!row || row.used_at || row.expires_at < now) {
    return { ok: false, why: "gone" };
  }
  if (row.z && !canGunzip) return { ok: false, why: "old" };
  row.used_at = now;
  return { ok: true, z: row.z ? 1 : 0, d: row.d };
}
