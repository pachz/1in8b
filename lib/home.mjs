import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { findPass } from "./keep.mjs";
import { memHomes } from "./memory-store.mjs";
import { isCode9, moderateText, randCode, str } from "./util.mjs";

const NAME_MAX = 40;

export async function homeMe({ tok }) {
  const pass = await findPass(tok);
  if (!pass) return { ok: false, why: "tok" };
  const home = await getOrCreateHome(pass.tok);
  return {
    ok: true,
    nm: home.nm || "",
    pub: !!home.pub,
    hk: home.hk || "",
  };
}

export async function homeSet({ tok, nm, pub }) {
  const pass = await findPass(tok);
  if (!pass) return { ok: false, why: "tok" };
  const home = await getOrCreateHome(pass.tok);
  let name = String(nm || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
  let nmWhy = false;
  if (name) {
    const why = moderateText(name, { min: 1, max: NAME_MAX });
    if (why === "abuse" || why === "personal" || why === "link" || why === "crisis") {
      name = home.nm || "";
      nmWhy = true;
    }
  }
  const wantPub = Boolean(pub);
  let hk = home.hk || "";
  if (wantPub && !hk) hk = await allocHk();
  if (!wantPub) {
    // keep hk so reopening pub reuses same link
  }

  const now = Date.now();
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    await db.execute({
      sql: `INSERT INTO homes (tok, nm, pub, hk, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(tok) DO UPDATE SET
              nm=excluded.nm, pub=excluded.pub, hk=excluded.hk, updated_at=excluded.updated_at`,
      args: [pass.tok, name, wantPub ? 1 : 0, hk || null, now],
    });
  } else {
    const store = memHomes();
    const row = { tok: pass.tok, nm: name, pub: wantPub, hk, updated_at: now };
    store.byTok.set(pass.tok, row);
    if (hk) store.byHk.set(hk, row);
  }

  return { ok: true, nm: name, pub: wantPub, hk, nmWhy: nmWhy || undefined };
}

/** Public home page by hk. Rooms empty until memorial CMS exists. */
export async function homeGet({ hk, lang }) {
  void lang;
  const code = str(hk, 16).toLowerCase();
  if (!isCode9(code)) return { ok: false };
  const home = await findByHk(code);
  if (!home || !home.pub) return { ok: false };
  const rooms = await roomsForTok(home.tok);
  return {
    ok: true,
    nm: home.nm || "",
    hk: home.hk,
    rooms,
  };
}

/**
 * Save room décor for a memorial id.
 * Without memorial CMS this mainly stores décor for later; ownership via tok or dk.
 */
export async function homeRoom({ tok, dk, id, rm }) {
  const memId = str(id, 64);
  if (!memId) return { ok: false, why: "bad" };
  if (!rm || typeof rm !== "object") return { ok: false, why: "bad" };
  const pass = tok ? await findPass(tok) : null;
  const deviceKey = /^[0-9a-f]{24}$/.test(dk || "") ? dk : "";
  if (!pass && !deviceKey) return { ok: false, why: "tok" };

  const clean = JSON.stringify(rm).slice(0, 50_000);
  const now = Date.now();

  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { ok: false, why: "busy" };
    const { rows } = await db.execute({
      sql: "SELECT tok, dk FROM home_rooms WHERE mem_id = ?",
      args: [memId],
    });
    if (rows.length) {
      const ownerTok = rows[0].tok ? String(rows[0].tok) : "";
      const ownerDk = rows[0].dk ? String(rows[0].dk) : "";
      const okTok = pass && ownerTok && pass.tok === ownerTok;
      const okDk = deviceKey && ownerDk && deviceKey === ownerDk;
      if (!okTok && !okDk) return { ok: false, why: "mail" };
    }
    await db.execute({
      sql: `INSERT INTO home_rooms (mem_id, tok, dk, rm, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(mem_id) DO UPDATE SET
              rm=excluded.rm,
              tok=COALESCE(home_rooms.tok, excluded.tok),
              dk=COALESCE(home_rooms.dk, excluded.dk),
              updated_at=excluded.updated_at`,
      args: [memId, pass?.tok || null, deviceKey || null, clean, now],
    });
    return { ok: true, rm: JSON.parse(clean) };
  }

  const store = memHomes();
  const prev = store.rooms.get(memId);
  if (prev) {
    const okTok = pass && prev.tok && pass.tok === prev.tok;
    const okDk = deviceKey && prev.dk && deviceKey === prev.dk;
    if (!okTok && !okDk) return { ok: false, why: "mail" };
  }
  const row = {
    mem_id: memId,
    tok: prev?.tok || pass?.tok || null,
    dk: prev?.dk || deviceKey || null,
    rm: clean,
    updated_at: now,
  };
  store.rooms.set(memId, row);
  return { ok: true, rm: JSON.parse(clean) };
}

async function getOrCreateHome(tok) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { tok, nm: "", pub: false, hk: "" };
    const { rows } = await db.execute({
      sql: "SELECT nm, pub, hk FROM homes WHERE tok = ?",
      args: [tok],
    });
    if (rows.length) {
      return {
        tok,
        nm: String(rows[0].nm || ""),
        pub: Boolean(Number(rows[0].pub)),
        hk: rows[0].hk ? String(rows[0].hk) : "",
      };
    }
    const now = Date.now();
    await db.execute({
      sql: "INSERT INTO homes (tok, nm, pub, hk, updated_at) VALUES (?, '', 0, NULL, ?)",
      args: [tok, now],
    });
    return { tok, nm: "", pub: false, hk: "" };
  }

  const store = memHomes();
  let row = store.byTok.get(tok);
  if (!row) {
    row = { tok, nm: "", pub: false, hk: "", updated_at: Date.now() };
    store.byTok.set(tok, row);
  }
  return row;
}

async function findByHk(hk) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return null;
    const { rows } = await db.execute({
      sql: "SELECT tok, nm, pub, hk FROM homes WHERE hk = ?",
      args: [hk],
    });
    if (!rows.length) return null;
    return {
      tok: String(rows[0].tok),
      nm: String(rows[0].nm || ""),
      pub: Boolean(Number(rows[0].pub)),
      hk: String(rows[0].hk),
    };
  }
  return memHomes().byHk.get(hk) || null;
}

async function roomsForTok(tok) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return [];
    const { rows } = await db.execute({
      sql: `SELECT mem_id, rm, name, lang, iso, sex, born, age, rd
            FROM home_rooms WHERE tok = ? ORDER BY updated_at DESC LIMIT 40`,
      args: [tok],
    });
    return rows.map(rowToRoom);
  }
  const out = [];
  for (const row of memHomes().rooms.values()) {
    if (row.tok === tok) out.push(rowToRoom(row));
  }
  return out;
}

function rowToRoom(r) {
  let rm = {};
  try {
    rm = JSON.parse(typeof r.rm === "string" ? r.rm : r.rm || "{}");
  } catch {
    rm = {};
  }
  return {
    id: String(r.mem_id || r.id),
    name: String(r.name || ""),
    lang: String(r.lang || "en"),
    iso: String(r.iso || ""),
    sex: String(r.sex || ""),
    born: Number(r.born) || 0,
    age: Number(r.age) || 0,
    rd: String(r.rd || ""),
    rm,
    hid: false,
  };
}

async function allocHk() {
  for (let i = 0; i < 12; i++) {
    const hk = randCode(9);
    if (isTursoConfigured()) {
      const db = await ensureTurso();
      if (!db) return hk;
      const { rows } = await db.execute({
        sql: "SELECT 1 AS n FROM homes WHERE hk = ?",
        args: [hk],
      });
      if (!rows.length) return hk;
    } else if (!memHomes().byHk.has(hk)) {
      return hk;
    }
  }
  return randCode(9);
}
