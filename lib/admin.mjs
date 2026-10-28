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

// —— Moderation (user-entered public text) ————————————————

const SEED_TOK = "__seed__";
const MOD_LIMIT = 200;

function parseJsonSafe(s, fallback) {
  if (s == null || s === "") return fallback;
  if (typeof s === "object") return s;
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function quoteField(value, key, label, max = 400) {
  const v = String(value || "").trim();
  if (!v) return null;
  return { key, label, value: v.slice(0, max), len: v.length };
}

/** Pull editable user-authored strings out of a memorial row. */
function memorialUserFields(row) {
  const st = parseJsonSafe(row.st, {});
  const d = parseJsonSafe(row.d, {});
  const fields = [];
  const add = (f) => {
    if (f) fields.push(f);
  };
  add(quoteField(st.tt, "tt", "Title", 40));
  add(quoteField(st.ln, "ln", "Opening words", 80));
  add(quoteField(st.ew, "ew", "Closing words", 80));
  add(quoteField(d.farewell, "farewell", "Farewell", 400));
  const quote =
    typeof d.quote === "object" && d.quote
      ? d.quote.t || d.quote.text || ""
      : d.quote;
  add(quoteField(quote, "quote", "Quote", 400));
  add(quoteField(d.notes, "notes", "Notes", 400));
  if (d.pet?.say) add(quoteField(d.pet.say, "pet", "Pet words", 200));
  if (Array.isArray(d.frames)) {
    d.frames.forEach((fr, i) => {
      if (fr && (fr.own || fr.note) && fr.t) {
        add(quoteField(fr.t, `cap:${i}`, `Caption #${i + 1}`, 120));
      }
    });
  }
  return fields;
}

function postItem(row) {
  const text = String(row.text || "").trim();
  const story = String(row.story || "").trim();
  const fields = [];
  if (text) fields.push({ key: "text", label: "Shared words", value: text.slice(0, 300), len: text.length });
  // Story is usually the simulation blurb; include when it differs from text
  if (story && story !== text) {
    fields.push({
      key: "story",
      label: "Story line",
      value: story.slice(0, 400),
      len: story.length,
    });
  }
  if (!fields.length) return null;
  return {
    kind: "post",
    id: String(row.id),
    at: Number(row.at) || Number(row.id) || 0,
    lang: String(row.lang || ""),
    hidden: Boolean(Number(row.hidden)),
    reports: Number(row.reports) || 0,
    title: String(row.name || "Post"),
    sub: `${row.iso || "?"} · ${row.sex || "?"} · ${row.age || "?"}y`,
    fields,
    href: null,
  };
}

function memorialItem(row) {
  if (String(row.tok || "") === SEED_TOK) return null;
  const fields = memorialUserFields(row);
  const lang = String(row.lang || "en");
  return {
    kind: "memorial",
    id: String(row.id),
    at: Number(row.at) || 0,
    lang,
    hidden: Boolean(Number(row.hidden)),
    reports: 0,
    title: String(row.name || row.id),
    sub: `${row.iso || "?"} · ${row.sex || "?"} · ${row.age || "?"}y · ${row.born || "?"}`,
    fields,
    href: `/${lang}/m/${row.id}`,
    plain: fields.length === 0,
  };
}

function homeItem(row) {
  const nm = String(row.nm || "").trim();
  if (!nm) return null;
  return {
    kind: "home",
    id: String(row.tok),
    at: Number(row.updated_at) || 0,
    lang: "",
    hidden: !Number(row.pub),
    reports: 0,
    title: nm,
    sub: row.pub ? "House open" : "House closed",
    fields: [{ key: "nm", label: "House name", value: nm.slice(0, 40), len: nm.length }],
    href: row.hk ? `/en/h/${row.hk}` : null,
  };
}

/**
 * List user-entered public content for moderation.
 * POST { token, filter?: "all"|"open"|"hidden"|"flagged", limit? }
 */
export async function adminModerationList(body) {
  const gate = checkAuth(body);
  if (!gate.ok) return gate;
  if (!isTursoConfigured()) return needDb();
  const db = await ensureTurso();
  if (!db) return needDb();

  const filter = str(body?.filter, 16) || "all";
  const limit = Math.min(MOD_LIMIT, Math.max(1, int(body?.limit, MOD_LIMIT) || MOD_LIMIT));
  const items = [];

  try {
    const posts = await db.execute({
      sql: `SELECT id, lang, at, iso, sex, age, name, story, text, hidden, reports
            FROM posts
            ORDER BY at DESC
            LIMIT ?`,
      args: [limit],
    });
    for (const row of posts.rows) {
      const item = postItem(row);
      if (item) items.push(item);
    }
  } catch (err) {
    console.error("admin moderation posts", err);
  }

  try {
    const mems = await db.execute({
      sql: `SELECT id, tok, at, lang, name, iso, sex, age, born, d, st, hidden
            FROM memorials
            WHERE tok != ?
            ORDER BY at DESC
            LIMIT ?`,
      args: [SEED_TOK, limit],
    });
    for (const row of mems.rows) {
      const item = memorialItem(row);
      if (item) items.push(item);
    }
  } catch (err) {
    console.error("admin moderation memorials", err);
  }

  try {
    const homes = await db.execute({
      sql: `SELECT tok, nm, pub, hk, updated_at FROM homes
            WHERE IFNULL(nm,'') != ''
            ORDER BY updated_at DESC
            LIMIT ?`,
      args: [limit],
    });
    for (const row of homes.rows) {
      const item = homeItem(row);
      if (item) items.push(item);
    }
  } catch (err) {
    console.error("admin moderation homes", err);
  }

  items.sort((a, b) => (b.at || 0) - (a.at || 0));

  const filtered = items.filter((it) => {
    if (filter === "hidden") return it.hidden;
    if (filter === "open") return !it.hidden;
    if (filter === "flagged") return (it.reports || 0) > 0 || it.hidden;
    if (filter === "words") return (it.fields || []).length > 0;
    return true;
  });

  return {
    ok: true,
    filter,
    total: filtered.length,
    items: filtered.slice(0, limit),
  };
}

async function setPostHidden(db, id, hidden) {
  await db.execute({
    sql: "UPDATE posts SET hidden = ? WHERE id = ?",
    args: [hidden ? 1 : 0, Number(id)],
  });
}

async function setMemorialHidden(db, id, hidden) {
  await db.execute({
    sql: "UPDATE memorials SET hidden = ?, updated_at = ? WHERE id = ?",
    args: [hidden ? 1 : 0, Date.now(), String(id)],
  });
}

async function setHomeHidden(db, tok, hidden) {
  // Homes have no hidden column: close (pub=0) or reopen. Name stays editable.
  await db.execute({
    sql: "UPDATE homes SET pub = ?, updated_at = ? WHERE tok = ?",
    args: [hidden ? 0 : 1, Date.now(), String(tok)],
  });
}

async function editPost(db, id, patch) {
  const { rows } = await db.execute({
    sql: "SELECT text, story FROM posts WHERE id = ?",
    args: [Number(id)],
  });
  if (!rows.length) return { ok: false, why: "gone" };
  let text = rows[0].text;
  let story = rows[0].story;
  if (patch.text != null) text = String(patch.text).trim().slice(0, 300);
  if (patch.story != null) story = String(patch.story).trim().slice(0, 400);
  await db.execute({
    sql: "UPDATE posts SET text = ?, story = ? WHERE id = ?",
    args: [text, story, Number(id)],
  });
  return { ok: true };
}

async function editMemorial(db, id, patch) {
  const { rows } = await db.execute({
    sql: "SELECT d, st FROM memorials WHERE id = ?",
    args: [String(id)],
  });
  if (!rows.length) return { ok: false, why: "gone" };
  const d = parseJsonSafe(rows[0].d, {}) || {};
  const st = parseJsonSafe(rows[0].st, {}) || {};

  if (patch.tt != null) st.tt = String(patch.tt).replace(/\s+/g, " ").trim().slice(0, 40);
  if (patch.ln != null) st.ln = String(patch.ln).replace(/\s+/g, " ").trim().slice(0, 80);
  if (patch.ew != null) st.ew = String(patch.ew).replace(/\s+/g, " ").trim().slice(0, 80);
  if (patch.farewell != null) d.farewell = String(patch.farewell).trim().slice(0, 400);
  if (patch.notes != null) d.notes = String(patch.notes).trim().slice(0, 400);
  if (patch.quote != null) {
    const q = String(patch.quote).trim().slice(0, 400);
    if (d.quote && typeof d.quote === "object") d.quote = { ...d.quote, t: q };
    else d.quote = q;
  }
  if (patch.pet != null) {
    if (!d.pet || typeof d.pet !== "object") d.pet = {};
    d.pet.say = String(patch.pet).trim().slice(0, 200);
  }
  for (const [k, v] of Object.entries(patch)) {
    const m = /^cap:(\d+)$/.exec(k);
    if (!m) continue;
    const i = Number(m[1]);
    if (!Array.isArray(d.frames) || !d.frames[i]) continue;
    d.frames[i] = { ...d.frames[i], t: String(v).trim().slice(0, 120) };
  }

  const name = String(d.name || "").slice(0, 80);
  const epi = String(d.head || d.died || d.epi || "").slice(0, 240);
  const rd = String(d.road || d.rd || "").slice(0, 160);
  const now = Date.now();
  await db.execute({
    sql: `UPDATE memorials SET d = ?, st = ?, name = COALESCE(NULLIF(?, ''), name),
          epi = ?, rd = ?, updated_at = ? WHERE id = ?`,
    args: [
      JSON.stringify(d),
      JSON.stringify(st),
      name,
      epi,
      rd,
      now,
      String(id),
    ],
  });
  return { ok: true };
}

async function editHome(db, tok, patch) {
  const { rows } = await db.execute({
    sql: "SELECT nm FROM homes WHERE tok = ?",
    args: [String(tok)],
  });
  if (!rows.length) return { ok: false, why: "gone" };
  const nm =
    patch.nm != null
      ? String(patch.nm).replace(/\s+/g, " ").trim().slice(0, 40)
      : String(rows[0].nm || "");
  await db.execute({
    sql: "UPDATE homes SET nm = ?, updated_at = ? WHERE tok = ?",
    args: [nm, Date.now(), String(tok)],
  });
  return { ok: true };
}

/**
 * Moderate one item.
 * POST { token, kind, id, action: "hide"|"show"|"edit", patch? }
 */
export async function adminModerationAct(body) {
  const gate = checkAuth(body);
  if (!gate.ok) return gate;
  if (!isTursoConfigured()) return needDb();
  const db = await ensureTurso();
  if (!db) return needDb();

  const kind = str(body?.kind, 16);
  const id = str(body?.id, 80);
  const action = str(body?.action, 16);
  if (!kind || !id || !action) return { ok: false, why: "bad" };

  if (action === "hide" || action === "show") {
    const hidden = action === "hide";
    if (kind === "post") await setPostHidden(db, id, hidden);
    else if (kind === "memorial") await setMemorialHidden(db, id, hidden);
    else if (kind === "home") await setHomeHidden(db, id, hidden);
    else return { ok: false, why: "kind" };
    return { ok: true, kind, id, hidden };
  }

  if (action === "edit") {
    const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
    if (!patch) return { ok: false, why: "bad" };
    if (kind === "post") return editPost(db, id, patch);
    if (kind === "memorial") return editMemorial(db, id, patch);
    if (kind === "home") return editHome(db, id, patch);
    return { ok: false, why: "kind" };
  }

  return { ok: false, why: "action" };
}
