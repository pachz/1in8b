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
import { handleLives } from "./lives.mjs";
import { moveCreate, moveTake } from "./move.mjs";
import { homeGet, homeMe, homeRoom, homeSet } from "./home.mjs";
import { memPostsExtra } from "./memory-store.mjs";
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

function loadSeed() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(ROOT, "data", "api-seed.json"), "utf8"),
    );
  } catch {
    return {};
  }
}

const seed = loadSeed();

const store = {
  posts: {},
  memorials: {},
};

for (const [key, value] of Object.entries(seed)) {
  if (key.startsWith("posts_")) {
    const lang = key.slice(6);
    store.posts[lang] = [...(value.posts || [])];
  }
  if (key.startsWith("memorials_")) {
    const lang = key.slice(10);
    store.memorials[lang] = [...(value.list || [])];
  }
}

let seedAttempted = false;
async function maybeSeedPosts() {
  if (seedAttempted || !isTursoConfigured()) return;
  seedAttempted = true;
  try {
    await seedPostsIfEmpty(store.posts);
  } catch (err) {
    seedAttempted = false;
    console.error("turso post seed failed", err);
  }
}

function langFrom(searchParams) {
  return searchParams.get("lang") || "en";
}

function jsonOk(body) {
  return { status: 200, body };
}

/**
 * Shared API dispatcher used by the local Node server and Vercel functions.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function dispatchApi({ method, pathname, searchParams, body }) {
  const p = pathname.replace(/\/+$/, "") || "/";
  const m = (method || "GET").toUpperCase();
  const q =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");

  await maybeSeedPosts();

  // —— Community posts ————————————————————————————————
  if (p === "/api/posts" && m === "GET") {
    const lang = langFrom(q);
    const before = q.get("before");
    if (isTursoConfigured()) {
      try {
        const posts = await listPosts(
          lang,
          40,
          before != null && before !== "" ? before : null,
        );
        if (posts && posts.length) {
          return jsonOk({ posts });
        }
        if (posts && posts.length === 0 && before) {
          return jsonOk({ posts: [] });
        }
      } catch (err) {
        console.error("turso listPosts failed", err);
      }
    }
    let posts = store.posts[lang] || store.posts.en || [];
    const extra = memPostsExtra();
    posts = posts.filter((x) => !extra.hidden.has(x.id));
    if (before) {
      const bid = Number(before);
      posts = posts.filter((x) => x.id < bid);
    }
    return jsonOk({
      posts: posts.slice(0, 40).map(({ tok: _t, sid: _s, ...pub }) => pub),
    });
  }

  if (p === "/api/post" && m === "POST") {
    const data = parseBody(body);
    const lang = data.lang || "en";
    const text = String(data.text || data.story || "").trim();
    const why = moderateText(text, { min: 4, max: 300 });
    if (why) return jsonOk({ ok: false, why });

    const sid = str(data.s, 24);
    if (isTursoConfigured()) {
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
    store.posts[lang] = [post, ...(store.posts[lang] || [])];
    memPostsExtra().toks.set(id, tok);
    if (isTursoConfigured()) {
      try {
        await insertPost(post);
      } catch (err) {
        console.error("turso insertPost failed", err);
      }
    }
    return jsonOk({ ok: true, id, tok });
  }

  if (p === "/api/unpost" && m === "POST") {
    const data = parseBody(body);
    const id = Number(data.id);
    const tok = String(data.tok || "");
    if (isTursoConfigured()) {
      try {
        const r = await deletePost(id, tok);
        if (r.ok) {
          // also drop from in-memory mirror
          for (const lang of Object.keys(store.posts)) {
            store.posts[lang] = (store.posts[lang] || []).filter(
              (x) => x.id !== id,
            );
          }
          return jsonOk({ ok: true });
        }
        return jsonOk({ ok: false });
      } catch (err) {
        console.error("unpost failed", err);
        return jsonOk({ ok: false });
      }
    }
    const extra = memPostsExtra();
    if (extra.toks.get(id) === tok) {
      extra.toks.delete(id);
      for (const lang of Object.keys(store.posts)) {
        store.posts[lang] = (store.posts[lang] || []).filter((x) => x.id !== id);
      }
      return jsonOk({ ok: true });
    }
    return jsonOk({ ok: false });
  }

  if (p === "/api/react" && m === "POST") {
    const data = parseBody(body);
    const id = Number(data.id);
    const kind = str(data.kind, 8);
    if (isTursoConfigured()) {
      try {
        await reactPost(id, kind, data.s);
      } catch (err) {
        console.error("react failed", err);
      }
    } else {
      const extra = memPostsExtra();
      if (kind === "rem") {
        extra.rem.set(id, (extra.rem.get(id) || 0) + 1);
        for (const lang of Object.keys(store.posts)) {
          for (const post of store.posts[lang] || []) {
            if (post.id === id) post.rem = (post.rem || 0) + 1;
          }
        }
      } else if (kind === "rep") {
        const n = (extra.reports.get(id) || 0) + 1;
        extra.reports.set(id, n);
        if (n >= 3) extra.hidden.add(id);
      }
    }
    return jsonOk({ ok: true });
  }

  // —— Memorial browse (seed) + light social ——————————————
  if (p === "/api/memorials" && m === "GET") {
    const lang = langFrom(q);
    const list = store.memorials[lang] || store.memorials.en || [];
    const before = q.get("before");
    let out = list;
    if (before) {
      const bid = String(before);
      const idx = out.findIndex((x) => String(x.id) === bid);
      out = idx >= 0 ? out.slice(idx + 1) : out;
    }
    return jsonOk({ list: out.slice(0, 40) });
  }

  if (p === "/api/memorial" && m === "GET") {
    if (q.get("random") === "1") {
      const lang = langFrom(q);
      const list = store.memorials[lang] || store.memorials.en || [];
      if (!list.length) return jsonOk({ ok: false });
      const pick = list[Math.floor(Math.random() * list.length)];
      return jsonOk({ ok: true, id: pick.id, ...pick });
    }
    const id = q.get("id");
    const all = Object.values(store.memorials).flat();
    const hit = all.find((item) => item.id === id);
    if (!hit) return jsonOk({ ok: false });
    return jsonOk({
      ok: true,
      id: hit.id,
      at: hit.at,
      candles: hit.candles || 0,
      cv: 0,
      act: 0,
      st: 0,
      words: [],
      rm: 0,
      hk: "",
      hn: hit.name || "",
      d: {
        v: 1,
        lang: "en",
        name: hit.name,
        sex: hit.sex,
        by: hit.born,
        age: hit.age,
        iso: hit.iso,
        urban: !!hit.urban,
        head: hit.epi || "",
        died: hit.epi || "",
        frames: [],
        rd: hit.rd || "",
      },
    });
  }

  // Memorial CMS intentionally not implemented
  if (p === "/api/memorial" && m === "POST") {
    return jsonOk({ ok: false, why: "none" });
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
    // No memorial CMS — owned list stays empty (rooms/home still work via keep)
    return jsonOk({ ok: true, list: [] });
  }

  if (p === "/api/memremove" && m === "POST") {
    return jsonOk({ ok: false, why: "none" });
  }

  if (p === "/api/memstyle" && m === "POST") {
    return jsonOk({ ok: false, why: "none" });
  }

  if (p === "/api/memgift" && m === "POST") {
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
