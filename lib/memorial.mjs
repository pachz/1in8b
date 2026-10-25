import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { findPass, adjustLeft } from "./keep.mjs";
import { memMemorials } from "./memory-store.mjs";
import { moderateText, randCode, str } from "./util.mjs";

const MAX_D_BYTES = 2_500_000;
const MS_TH = new Set(["auto", "warm", "night", "garden", "sea"]);
const MS_FR = new Set(["wood", "gold", "black", "white"]);
const MS_FL = new Set(["", "chry", "lily", "rose", "sun", "wild", "mari"]);

function cleanSt(st) {
  st = st && typeof st === "object" ? st : {};
  return {
    th: MS_TH.has(st.th) ? st.th : "auto",
    fr: MS_FR.has(st.fr) ? st.fr : "wood",
    fl: MS_FL.has(st.fl) ? st.fl : "",
    hide: [
      ...new Set(
        (Array.isArray(st.hide) ? st.hide : [])
          .map((a) => Math.floor(+a))
          .filter((a) => a >= 0),
      ),
    ],
    ln: String(st.ln || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    tt: String(st.tt || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40),
    ew: String(st.ew || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
  };
}

function moderateField(text, field) {
  if (!text) return null;
  const why = moderateText(String(text), { min: 1, max: 400 });
  if (!why || why === "len") return null;
  return { why, field };
}

function scanMemorialTexts(d, st) {
  const checks = [
    [d?.farewell, "farewell"],
    [d?.quote?.t || d?.quote, "quote"],
    [d?.notes, "notes"],
    [st?.ln, "ln"],
    [st?.tt, "tt"],
    [st?.ew, "ew"],
  ];
  if (Array.isArray(d?.frames)) {
    for (const fr of d.frames) {
      if (fr?.own || fr?.note) {
        const hit = moderateField(fr.t, "caps");
        if (hit) return hit;
      }
    }
  }
  if (d?.pet?.say) {
    const hit = moderateField(d.pet.say, "pet");
    if (hit) return hit;
  }
  for (const [text, field] of checks) {
    const hit = moderateField(text, field);
    if (hit) return hit;
  }
  return null;
}

function summarize(d, st, cv, rm, extra = {}) {
  const name = String(d?.name || "").slice(0, 80);
  const iso = String(d?.iso || "").slice(0, 8);
  const sex = String(d?.sex || "").slice(0, 4);
  const age = Number(d?.age) || 0;
  const born = Number(d?.by ?? d?.born) || 0;
  const urban = d?.urban ? 1 : 0;
  const epi = String(d?.head || d?.died || d?.epi || "").slice(0, 240);
  const rd = String(d?.road || d?.rd || "").slice(0, 160);
  const lang = String(d?.lang || "en").slice(0, 8);
  let cm = null;
  if (d?.cm && typeof d.cm === "object") cm = d.cm;
  else if (Array.isArray(d?.frames)) {
    const hide = new Set(st?.hide || []);
    let idx = Number.isFinite(cv) && cv >= 0 ? cv : -1;
    if (idx < 0 || hide.has(idx) || !d.frames[idx]?.m) {
      idx = d.frames.findIndex((f, i) => f?.m && !hide.has(i));
    }
    if (idx >= 0 && d.frames[idx]?.m) {
      // Store a tiny cover hint; full pixel scene stays in d.frames
      cm = { stage: "d", seed: name + iso, people: [{ role: "me", sex, age }] };
    }
  }
  return {
    name,
    iso,
    sex,
    age,
    born,
    urban,
    epi,
    rd,
    lang,
    cm,
    cv: Number.isFinite(cv) ? cv : -1,
    st: cleanSt(st),
    rm: rm && typeof rm === "object" ? rm : null,
    ...extra,
  };
}

function listItem(row, candles = 0) {
  let cm = null;
  try {
    cm = row.cm ? JSON.parse(row.cm) : null;
  } catch {
    cm = null;
  }
  return {
    id: row.id,
    at: Number(row.at) || 0,
    name: row.name || "",
    iso: row.iso || "",
    sex: row.sex || "",
    age: Number(row.age) || 0,
    born: Number(row.born) || 0,
    urban: Number(row.urban) || 0,
    epi: row.epi || "",
    rd: row.rd || "",
    candles: Number(candles) || 0,
    cm,
    lang: row.lang || "en",
    hid: Boolean(Number(row.hidden)),
    lk: row.lk || "",
    rm: parseJson(row.rm, null),
  };
}

function parseJson(s, fallback) {
  if (s == null || s === "") return fallback;
  if (typeof s === "object") return s;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

async function allocId() {
  for (let i = 0; i < 16; i++) {
    const id = randCode(9);
    if (isTursoConfigured()) {
      const db = await ensureTurso();
      if (!db) return id;
      const { rows } = await db.execute({
        sql: "SELECT 1 AS n FROM memorials WHERE id = ?",
        args: [id],
      });
      if (!rows.length) return id;
    } else if (!memMemorials().byId.has(id)) {
      return id;
    }
  }
  return randCode(9);
}

async function ownOk(row, tok, dk) {
  if (!row) return false;
  if (tok && row.tok && tok === row.tok) return true;
  if (dk && row.dk && dk === row.dk) return true;
  return false;
}

/** Publish a memorial hall entry. Consumes one Keep slot. */
export async function memorialCreate(body) {
  const pass = await findPass(body.tok);
  if (!pass) return { ok: false, why: "tok" };
  if (pass.left <= 0) return { ok: false, why: "used" };

  const dk = /^[0-9a-f]{24}$/.test(body.dk || "") ? body.dk : "";
  if (!dk) return { ok: false, why: "bad" };

  const d = body.d && typeof body.d === "object" ? body.d : null;
  if (!d || !d.name) return { ok: false, why: "bad" };

  const st = cleanSt(body.st);
  const mod = scanMemorialTexts(d, st);
  if (mod) return { ok: false, why: mod.why, field: mod.field };

  const dJson = JSON.stringify(d);
  if (Buffer.byteLength(dJson, "utf8") > MAX_D_BYTES) {
    return { ok: false, why: "big" };
  }

  const cv = Number.isFinite(+body.cv) ? Math.trunc(+body.cv) : -1;
  const rm = body.rm && typeof body.rm === "object" ? body.rm : null;
  const lk = str(body.lk, 40);
  const sum = summarize(d, st, cv, rm);
  const id = await allocId();
  const now = Date.now();

  // Soft-moderate line fields: still publish, flag lnWhy
  let lnWhy;
  let lnField;
  for (const [text, field] of [
    [st.ln, "ln"],
    [st.tt, "tt"],
    [st.ew, "ew"],
  ]) {
    const hit = moderateField(text, field);
    if (hit) {
      st[field] = "";
      lnWhy = hit.why;
      lnField = field;
      break;
    }
  }

  const slot = await adjustLeft(pass.tok, -1);
  if (!slot.ok) return { ok: false, why: slot.why || "used" };

  const row = {
    id,
    tok: pass.tok,
    dk,
    lk,
    at: now,
    lang: sum.lang,
    name: sum.name,
    iso: sum.iso,
    sex: sum.sex,
    age: sum.age,
    born: sum.born,
    urban: sum.urban,
    epi: sum.epi,
    rd: sum.rd,
    cm: sum.cm ? JSON.stringify(sum.cm) : null,
    d: dJson,
    cv,
    st: JSON.stringify(st),
    rm: rm ? JSON.stringify(rm) : null,
    gw: null,
    hidden: 0,
    updated_at: now,
  };

  await saveMemorial(row);
  await syncHomeRoom(row);

  return {
    ok: true,
    id,
    at: now,
    left: slot.left,
    lnWhy,
    lnField,
  };
}

export async function memorialStyle(body) {
  const id = str(body.id, 16);
  const row = await loadMemorial(id);
  if (!row || Number(row.hidden)) return { ok: false, why: "gone" };

  const pass = body.tok ? await findPass(body.tok) : null;
  const dk = /^[0-9a-f]{24}$/.test(body.dk || "") ? body.dk : "";
  if (!(await ownOk(row, pass?.tok, dk))) {
    return { ok: false, why: pass ? "mail" : "tok" };
  }

  const st = cleanSt(body.st);
  let d = parseJson(row.d, {});
  if (Array.isArray(body.frames)) {
    d = { ...d, frames: body.frames };
  }
  const mod = scanMemorialTexts(d, st);
  if (mod) return { ok: false, why: mod.why, field: mod.field };

  let lnWhy;
  let lnField;
  for (const [text, field] of [
    [st.ln, "ln"],
    [st.tt, "tt"],
    [st.ew, "ew"],
  ]) {
    const hit = moderateField(text, field);
    if (hit) {
      st[field] = "";
      lnWhy = hit.why;
      lnField = field;
      break;
    }
  }

  const cv = Number.isFinite(+body.cv) ? Math.trunc(+body.cv) : Number(row.cv);
  const sum = summarize(d, st, cv, parseJson(row.rm, null));
  const now = Date.now();
  row.d = JSON.stringify(d);
  row.st = JSON.stringify(st);
  row.cv = cv;
  row.name = sum.name;
  row.epi = sum.epi;
  row.rd = sum.rd;
  row.cm = sum.cm ? JSON.stringify(sum.cm) : row.cm;
  row.updated_at = now;
  await saveMemorial(row);

  return { ok: true, st, lnWhy, lnField };
}

export async function memorialRemove(body) {
  const id = str(body.id, 16);
  const row = await loadMemorial(id);
  if (!row) return { ok: false, why: "gone" };

  const pass = await findPass(body.tok);
  if (!pass) return { ok: false, why: "tok" };
  const dk = /^[0-9a-f]{24}$/.test(body.dk || "") ? body.dk : "";
  if (!(await ownOk(row, pass.tok, dk))) {
    return { ok: false, why: "mail" };
  }

  await deleteMemorial(id);
  const slot = await adjustLeft(pass.tok, +1);
  return { ok: true, left: slot.left ?? pass.left + 1 };
}

export async function memorialOwn(body) {
  const pass = body.tok ? await findPass(body.tok) : null;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  const wantId = body.id ? str(body.id, 16) : "";

  const byId = new Map();

  if (pass) {
    for (const row of await listByTok(pass.tok)) {
      byId.set(row.id, row);
    }
  }

  for (const pair of keys) {
    const mid = Array.isArray(pair) ? str(pair[0], 16) : "";
    const dk = Array.isArray(pair) ? String(pair[1] || "") : "";
    if (!mid) continue;
    if (byId.has(mid)) continue;
    const row = await loadMemorial(mid);
    if (row && (await ownOk(row, pass?.tok, dk))) byId.set(mid, row);
  }

  const list = [...byId.values()].map((r) => listItem(r));

  if (wantId) {
    const row = byId.get(wantId) || (await loadMemorial(wantId));
    if (row && (await ownOk(row, pass?.tok, body.dk || keys.find((k) => k[0] === wantId)?.[1]))) {
      return {
        ok: true,
        list,
        rm: parseJson(row.rm, null),
        st: parseJson(row.st, null),
        d: parseJson(row.d, null),
      };
    }
  }

  return { ok: true, list };
}

export async function memorialGift(body) {
  const id = str(body.id, 16);
  const row = await loadMemorial(id);
  if (!row || Number(row.hidden)) return { ok: false, why: "gone" };
  const pass = body.tok ? await findPass(body.tok) : null;
  const dk = /^[0-9a-f]{24}$/.test(body.dk || "") ? body.dk : "";
  if (!(await ownOk(row, pass?.tok, dk))) {
    return { ok: false, why: pass ? "mail" : "tok" };
  }
  const gw = Array.isArray(body.gw) ? body.gw.slice(0, 40) : [];
  row.gw = JSON.stringify(gw);
  let d = parseJson(row.d, {});
  d = { ...d, gw };
  row.d = JSON.stringify(d);
  row.updated_at = Date.now();
  await saveMemorial(row);
  return { ok: true };
}

export async function memorialGet(id, { full = false } = {}) {
  const row = await loadMemorial(id);
  if (!row || Number(row.hidden)) return null;

  const d = parseJson(row.d, null);
  if (!d) return null;
  if (row.gw) {
    const gw = parseJson(row.gw, null);
    if (gw) d.gw = gw;
  }

  const stats = await getStats(id);
  const st = parseJson(row.st, cleanSt(null));
  let rm = parseJson(row.rm, 0);
  // Client treats rm:0 as no room; object when present
  if (!rm || typeof rm !== "object") rm = 0;

  let hk = "";
  let hn = "";
  if (row.tok) {
    const home = await homePublicForTok(row.tok);
    if (home?.pub && home.hk) {
      hk = home.hk;
      hn = home.nm || "";
    }
  }

  return {
    ok: true,
    id: row.id,
    at: Number(row.at) || 0,
    candles: stats.candles,
    cv: Number(row.cv),
    act: stats.act,
    st: full || true ? st : st,
    words: stats.words,
    rm,
    hk,
    hn,
    d,
  };
}

export async function memorialList({ lang, before, iso, limit = 40 }) {
  const rows = await listPublic({ lang, before, iso, limit });
  const out = [];
  for (const row of rows) {
    const stats = await getStats(row.id);
    out.push(listItem(row, stats.candles));
  }
  return out;
}

export async function memorialRandom(lang) {
  const rows = await listPublic({ lang, limit: 80 });
  if (!rows.length) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)];
  return memorialGet(pick.id);
}

// —— persistence ————————————————————————————————————————

async function saveMemorial(row) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) throw new Error("no db");
    await db.execute({
      sql: `INSERT INTO memorials (
              id, tok, dk, lk, at, lang, name, iso, sex, age, born, urban,
              epi, rd, cm, d, cv, st, rm, gw, hidden, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              tok=excluded.tok, dk=excluded.dk, lk=excluded.lk, lang=excluded.lang,
              name=excluded.name, iso=excluded.iso, sex=excluded.sex, age=excluded.age,
              born=excluded.born, urban=excluded.urban, epi=excluded.epi, rd=excluded.rd,
              cm=excluded.cm, d=excluded.d, cv=excluded.cv, st=excluded.st, rm=excluded.rm,
              gw=excluded.gw, hidden=excluded.hidden, updated_at=excluded.updated_at`,
      args: [
        row.id,
        row.tok,
        row.dk,
        row.lk,
        row.at,
        row.lang,
        row.name,
        row.iso,
        row.sex,
        row.age,
        row.born,
        row.urban,
        row.epi,
        row.rd,
        row.cm,
        row.d,
        row.cv,
        row.st,
        row.rm,
        row.gw,
        row.hidden || 0,
        row.updated_at,
      ],
    });
    return;
  }
  memMemorials().byId.set(row.id, { ...row });
  const list = memMemorials().byTok.get(row.tok) || [];
  if (!list.includes(row.id)) list.push(row.id);
  memMemorials().byTok.set(row.tok, list);
}

async function deleteMemorial(id) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return;
    const { rows } = await db.execute({
      sql: "SELECT tok FROM memorials WHERE id = ?",
      args: [id],
    });
    await db.execute({ sql: "DELETE FROM memorials WHERE id = ?", args: [id] });
    await db.execute({
      sql: "DELETE FROM home_rooms WHERE mem_id = ?",
      args: [id],
    });
    void rows;
    return;
  }
  const store = memMemorials();
  const row = store.byId.get(id);
  if (row) {
    store.byId.delete(id);
    const list = (store.byTok.get(row.tok) || []).filter((x) => x !== id);
    store.byTok.set(row.tok, list);
  }
}

async function loadMemorial(id) {
  if (!id) return null;
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return null;
    const { rows } = await db.execute({
      sql: "SELECT * FROM memorials WHERE id = ?",
      args: [id],
    });
    return rows[0] || null;
  }
  return memMemorials().byId.get(id) || null;
}

async function listByTok(tok) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return [];
    const { rows } = await db.execute({
      sql: "SELECT * FROM memorials WHERE tok = ? ORDER BY at DESC LIMIT 200",
      args: [tok],
    });
    return rows;
  }
  const store = memMemorials();
  return (store.byTok.get(tok) || [])
    .map((id) => store.byId.get(id))
    .filter(Boolean)
    .sort((a, b) => b.at - a.at);
}

async function listPublic({ lang, before, iso, limit }) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return [];
    const args = [];
    let sql = `SELECT * FROM memorials WHERE IFNULL(hidden,0)=0`;
    if (lang) {
      // include all langs; client filters owned by LANG, browse uses lang param loosely
    }
    if (iso) {
      sql += " AND iso = ?";
      args.push(iso);
    }
    if (before) {
      // before is memorial id — find its at
      const prev = await loadMemorial(before);
      if (prev) {
        sql += " AND at < ?";
        args.push(Number(prev.at) || 0);
      }
    }
    sql += " ORDER BY at DESC LIMIT ?";
    args.push(limit);
    void lang;
    const { rows } = await db.execute({ sql, args });
    return rows;
  }
  let rows = [...memMemorials().byId.values()].filter((r) => !r.hidden);
  if (iso) rows = rows.filter((r) => r.iso === iso);
  if (before) {
    const prev = memMemorials().byId.get(before);
    if (prev) rows = rows.filter((r) => r.at < prev.at);
  }
  rows.sort((a, b) => b.at - a.at);
  return rows.slice(0, limit);
}

async function getStats(id) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return { candles: 0, act: 0, words: [] };
    const { rows } = await db.execute({
      sql: "SELECT candles, act, last_word, last_at FROM mem_stats WHERE id = ?",
      args: [id],
    });
    if (!rows.length) return { candles: 0, act: 0, words: [] };
    const r = rows[0];
    const words = [];
    // Client expects words array of recent word keys; we only store last_word
    if (r.last_word != null && r.last_word !== "") {
      words.push(String(r.last_word));
    }
    return {
      candles: Number(r.candles) || 0,
      act: Number(r.act) || Number(r.last_at) || 0,
      words,
    };
  }
  return { candles: 0, act: 0, words: [] };
}

async function syncHomeRoom(row) {
  const rm = row.rm || JSON.stringify({
    wp: "wp_cream",
    fl: "fl_wood",
    wv: "wv_home",
    ot: "ot_me",
    bgm: "bgm_base",
    who: "me",
    it: {},
  });
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return;
    await db.execute({
      sql: `INSERT INTO home_rooms (mem_id, tok, dk, rm, name, lang, iso, sex, born, age, rd, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mem_id) DO UPDATE SET
              tok=excluded.tok, dk=excluded.dk, rm=COALESCE(home_rooms.rm, excluded.rm),
              name=excluded.name, lang=excluded.lang, iso=excluded.iso, sex=excluded.sex,
              born=excluded.born, age=excluded.age, rd=excluded.rd, updated_at=excluded.updated_at`,
      args: [
        row.id,
        row.tok,
        row.dk,
        rm,
        row.name,
        row.lang,
        row.iso,
        row.sex,
        row.born,
        row.age,
        row.rd,
        row.updated_at,
      ],
    });
    return;
  }
  // memory home rooms live in memHomes — import lazily to avoid cycles
  const { memHomes } = await import("./memory-store.mjs");
  const prev = memHomes().rooms.get(row.id);
  memHomes().rooms.set(row.id, {
    mem_id: row.id,
    tok: row.tok,
    dk: row.dk,
    rm: prev?.rm || rm,
    name: row.name,
    lang: row.lang,
    iso: row.iso,
    sex: row.sex,
    born: row.born,
    age: row.age,
    rd: row.rd,
    updated_at: row.updated_at,
  });
}

async function homePublicForTok(tok) {
  if (isTursoConfigured()) {
    const db = await ensureTurso();
    if (!db) return null;
    const { rows } = await db.execute({
      sql: "SELECT nm, pub, hk FROM homes WHERE tok = ?",
      args: [tok],
    });
    if (!rows.length) return null;
    return {
      nm: String(rows[0].nm || ""),
      pub: Boolean(Number(rows[0].pub)),
      hk: rows[0].hk ? String(rows[0].hk) : "",
    };
  }
  const { memHomes } = await import("./memory-store.mjs");
  return memHomes().byTok.get(tok) || null;
}
