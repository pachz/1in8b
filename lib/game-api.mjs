import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTursoConfigured } from "./turso.mjs";
import {
  deletePost,
  handleBeacon,
  hourPostCount,
  insertPost,
  listPosts,
  memNews,
  memReact,
  reactPost,
  recentPostBySid,
  seedPostsIfEmpty,
} from "./world.mjs";
import { keepCarry, keepMe, keepTake, keepUnlock, keepUse } from "./keep.mjs";
import { authLogout, authMe, authStart, authVerify } from "./auth.mjs";
import { adminLogin, adminOverview, adminTable } from "./admin.mjs";
import { clientIpFromHeaders } from "./rate-limit.mjs";
import { handleLives } from "./lives.mjs";
import { moveCreate, moveTake } from "./move.mjs";
import { homeGet, homeMe, homeRoom, homeSet } from "./home.mjs";
import {
  memorialCreate,
  memorialGet,
  memorialGift,
  memorialList,
  memorialOwn,
  memorialRandom,
  memorialRemove,
  memorialStyle,
  seedMemorialsIfEmpty,
} from "./memorial.mjs";
import { moderateText, parseBody, randHex, str } from "./util.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    );
    return String(pkg.version || "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function loadSeedFile() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(ROOT, "data", "api-seed.json"), "utf8"),
    );
  } catch {
    return {};
  }
}

/** Parse api-seed.json into { posts, memorials } keyed by lang (for one-time DB seed only). */
function seedBundles() {
  const seed = loadSeedFile();
  const posts = {};
  const memorials = {};
  for (const [key, value] of Object.entries(seed)) {
    if (key.startsWith("posts_")) {
      posts[key.slice(6)] = [...(value.posts || [])];
    }
    if (key.startsWith("memorials_")) {
      memorials[key.slice(10)] = [...(value.list || [])];
    }
  }
  return { posts, memorials };
}

let seedAttempted = false;
async function maybeSeedDb() {
  if (seedAttempted || !isTursoConfigured()) return;
  seedAttempted = true;
  try {
    const { posts, memorials } = seedBundles();
    await seedPostsIfEmpty(posts);
    await seedMemorialsIfEmpty(memorials);
  } catch (err) {
    seedAttempted = false;
    console.error("turso seed failed", err);
  }
}

function langFrom(searchParams) {
  return searchParams.get("lang") || "en";
}

function jsonOk(body) {
  return { status: 200, body };
}

function needDb() {
  return jsonOk({ ok: false, why: "busy" });
}

/**
 * Shared API dispatcher used by the local Node server and Vercel functions.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function dispatchApi({
  method,
  pathname,
  searchParams,
  body,
  headers,
  clientIp,
}) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const m = (method || "GET").toUpperCase();
  const q =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");
  const ip = str(clientIp, 64) || clientIpFromHeaders(headers) || "anon";
  const reqMeta = { clientIp: ip };

  await maybeSeedDb();

  // —— Community posts (Turso only) ——————————————————————
  if (p === "/api/posts" && m === "GET") {
    if (!isTursoConfigured()) return jsonOk({ posts: [] });
    const lang = langFrom(q);
    const before = q.get("before");
    try {
      const posts =
        (await listPosts(
          lang,
          40,
          before != null && before !== "" ? before : null,
        )) || [];
      return jsonOk({ posts });
    } catch (err) {
      console.error("turso listPosts failed", err);
      return jsonOk({ posts: [] });
    }
  }

  if (p === "/api/post" && m === "POST") {
    if (!isTursoConfigured()) return needDb();
    const data = parseBody(body);
    const lang = data.lang || "en";
    const text = String(data.text || data.story || "").trim();
    const why = moderateText(text, { min: 4, max: 300 });
    if (why) return jsonOk({ ok: false, why });

    const sid = str(data.s, 24);
    try {
      if (await recentPostBySid(sid)) {
        return jsonOk({ ok: false, why: "rate" });
      }
      if ((await hourPostCount()) >= 200) {
        return jsonOk({ ok: false, why: "full" });
      }
    } catch (err) {
      console.error("post rate check failed", err);
    }

    const id = Date.now();
    const tok = randHex(12);
    const post = {
      id,
      at: Date.now(),
      iso: data.iso || "?",
      sex: data.sex || "?",
      age: data.age || 0,
      name: String(data.name || "Anonymous").slice(0, 80),
      story: String(data.story || "").slice(0, 400),
      text,
      rem: 0,
      lang,
      tok,
      sid,
    };
    try {
      await insertPost(post);
      return jsonOk({ ok: true, id, tok });
    } catch (err) {
      console.error("turso insertPost failed", err);
      return needDb();
    }
  }

  if (p === "/api/unpost" && m === "POST") {
    if (!isTursoConfigured()) return jsonOk({ ok: false });
    const data = parseBody(body);
    try {
      return jsonOk(await deletePost(Number(data.id), String(data.tok || "")));
    } catch (err) {
      console.error("unpost failed", err);
      return jsonOk({ ok: false });
    }
  }

  if (p === "/api/react" && m === "POST") {
    if (!isTursoConfigured()) return jsonOk({ ok: true });
    const data = parseBody(body);
    try {
      await reactPost(Number(data.id), str(data.kind, 8), data.s);
    } catch (err) {
      console.error("react failed", err);
    }
    return jsonOk({ ok: true });
  }

  // —— Memorial CMS + browse (Turso only) ————————————————
  if (p === "/api/memorials" && m === "GET") {
    if (!isTursoConfigured()) return jsonOk({ list: [] });
    try {
      const list = await memorialList({
        lang: langFrom(q),
        before: q.get("before"),
        iso: q.get("iso") || null,
        limit: 40,
      });
      return jsonOk({ list });
    } catch (err) {
      console.error("memorialList failed", err);
      return jsonOk({ list: [] });
    }
  }

  if (p === "/api/memorial" && m === "GET") {
    if (!isTursoConfigured()) return jsonOk({ ok: false });
    if (q.get("random") === "1") {
      try {
        const pick = await memorialRandom(langFrom(q));
        return jsonOk(pick || { ok: false });
      } catch (err) {
        console.error("memorialRandom failed", err);
        return jsonOk({ ok: false });
      }
    }
    try {
      const hit = await memorialGet(q.get("id"), { full: q.get("f") === "1" });
      return jsonOk(hit || { ok: false });
    } catch (err) {
      console.error("memorialGet failed", err);
      return jsonOk({ ok: false });
    }
  }

  if (p === "/api/memorial" && m === "POST") {
    if (!isTursoConfigured()) return needDb();
    const data = parseBody(body);
    try {
      return jsonOk(await memorialCreate(data));
    } catch (err) {
      console.error("memorial create failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/memreact" && m === "POST") {
    const data = parseBody(body);
    try {
      const r = await memReact(data);
      return jsonOk(r);
    } catch (err) {
      console.error("memreact failed", err);
      return jsonOk({ ok: true, candles: 1 });
    }
  }

  if (p === "/api/memnews" && m === "GET") {
    const ids = (q.get("ids") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      return jsonOk(await memNews(ids));
    } catch (err) {
      console.error("memnews failed", err);
      return jsonOk({ ok: true, list: [] });
    }
  }

  if (p === "/api/memown" && m === "POST") {
    if (!isTursoConfigured()) return jsonOk({ ok: true, list: [] });
    const data = parseBody(body);
    try {
      return jsonOk(await memorialOwn(data));
    } catch (err) {
      console.error("memown failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/memremove" && m === "POST") {
    if (!isTursoConfigured()) return needDb();
    const data = parseBody(body);
    try {
      return jsonOk(await memorialRemove(data));
    } catch (err) {
      console.error("memremove failed", err);
      return jsonOk({ ok: false, why: "rmfail" });
    }
  }

  if (p === "/api/memstyle" && m === "POST") {
    if (!isTursoConfigured()) return needDb();
    const data = parseBody(body);
    try {
      return jsonOk(await memorialStyle(data));
    } catch (err) {
      console.error("memstyle failed", err);
      return jsonOk({ ok: false, why: "stfail" });
    }
  }

  if (p === "/api/memgift" && m === "POST") {
    if (!isTursoConfigured()) return needDb();
    const data = parseBody(body);
    try {
      return jsonOk(await memorialGift(data));
    } catch (err) {
      console.error("memgift failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  // —— Auth OTP (email / phone) ————————————————————————
  if (p === "/api/auth/start" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await authStart(data, reqMeta));
    } catch (err) {
      console.error("auth/start failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/auth/verify" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await authVerify(data, reqMeta));
    } catch (err) {
      console.error("auth/verify failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/auth/me" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await authMe(data));
    } catch (err) {
      console.error("auth/me failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/auth/logout" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await authLogout(data));
    } catch (err) {
      console.error("auth/logout failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p.startsWith("/api/auth/") && m === "POST") {
    return jsonOk({ ok: false, why: "none" });
  }

  // —— Admin DB browser ————————————————————————————————
  if (p === "/api/admin/login" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await adminLogin(data, reqMeta));
    } catch (err) {
      console.error("admin/login failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/admin/overview" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await adminOverview(data));
    } catch (err) {
      console.error("admin/overview failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/admin/table" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await adminTable(data));
    } catch (err) {
      console.error("admin/table failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p.startsWith("/api/admin/") && m === "POST") {
    return jsonOk({ ok: false, why: "none" });
  }

  // —— Keep (free email unlock; no Stripe) ——————————————
  if (p === "/api/keep" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await keepUnlock(data));
    } catch (err) {
      console.error("keep unlock failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/keep/me" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await keepMe(data));
    } catch (err) {
      console.error("keep/me failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/keep/use" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await keepUse(data));
    } catch (err) {
      console.error("keep/use failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/keep/carry" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await keepCarry(data));
    } catch (err) {
      console.error("keep/carry failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/keep/take" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await keepTake(data));
    } catch (err) {
      console.error("keep/take failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  // Stripe checkout session — payments not implemented
  if (p === "/api/keep/session" && m === "POST") {
    return jsonOk({ ok: false, why: "off" });
  }

  if (p.startsWith("/api/keep/") && m === "POST") {
    return jsonOk({ ok: false, why: "none" });
  }

  // —— Lives cloud locker ——————————————————————————————
  if (p === "/api/lives" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await handleLives(data));
    } catch (err) {
      console.error("lives failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  // —— Device move ————————————————————————————————————
  if (p === "/api/move" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await moveCreate(data));
    } catch (err) {
      console.error("move failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/move/take" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await moveTake(data));
    } catch (err) {
      console.error("move/take failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  // —— Past-life home —————————————————————————————————
  if (p === "/api/home" && m === "GET") {
    try {
      return jsonOk(
        await homeGet({ hk: q.get("hk"), lang: q.get("lang") }),
      );
    } catch (err) {
      console.error("home get failed", err);
      return jsonOk({ ok: false });
    }
  }

  if (p === "/api/home/me" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await homeMe(data));
    } catch (err) {
      console.error("home/me failed", err);
      return jsonOk({ ok: false, why: "busy" });
    }
  }

  if (p === "/api/home/set" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await homeSet(data));
    } catch (err) {
      console.error("home/set failed", err);
      return jsonOk({ ok: false, why: "stfail" });
    }
  }

  if (p === "/api/home/room" && m === "POST") {
    const data = parseBody(body);
    try {
      return jsonOk(await homeRoom(data));
    } catch (err) {
      console.error("home/room failed", err);
      return jsonOk({ ok: false, why: "stfail" });
    }
  }

  // —— World beacon + version ——————————————————————————
  if (p === "/api/e" && m === "POST") {
    const data = parseBody(body);
    if (isTursoConfigured()) {
      try {
        const world = await handleBeacon(data);
        return jsonOk(world);
      } catch (err) {
        console.error("turso /api/e failed", err);
      }
    }
    return jsonOk({ ok: true });
  }

  if (p === "/api/version" && m === "GET") {
    const version = readVersion();
    return jsonOk({ version, label: `${version} beta` });
  }

  return { status: 404, body: { ok: false, error: "not found" } };
}

export async function readNodeBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}
