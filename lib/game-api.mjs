import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTursoConfigured } from "./turso.mjs";
import {
  handleBeacon,
  insertPost,
  listPosts,
  seedPostsIfEmpty,
} from "./world.mjs";

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

function parseBody(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function langFrom(searchParams) {
  return searchParams.get("lang") || "en";
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

  if (p === "/api/posts" && m === "GET") {
    const lang = langFrom(q);
    if (isTursoConfigured()) {
      try {
        const posts = await listPosts(lang, 40);
        if (posts && posts.length) {
          return { status: 200, body: { posts } };
        }
      } catch (err) {
        console.error("turso listPosts failed", err);
      }
    }
    const posts = store.posts[lang] || store.posts.en || [];
    return { status: 200, body: { posts: posts.slice(0, 40) } };
  }

  if (p === "/api/post" && m === "POST") {
    const data = parseBody(body);
    const lang = data.lang || "en";
    const id = Date.now();
    const post = {
      id,
      at: Date.now(),
      iso: data.iso || "?",
      sex: data.sex || "?",
      age: data.age || 0,
      name: data.name || "Anonymous",
      story: data.story || "",
      text: data.text || data.story || "",
      rem: 0,
      lang,
    };
    store.posts[lang] = [post, ...(store.posts[lang] || [])];
    if (isTursoConfigured()) {
      try {
        await insertPost(post);
      } catch (err) {
        console.error("turso insertPost failed", err);
      }
    }
    return { status: 200, body: { ok: true, id, tok: String(id) } };
  }

  if (p === "/api/unpost" && m === "POST") {
    return { status: 200, body: { ok: true } };
  }

  if (p === "/api/react" && m === "POST") {
    return { status: 200, body: { ok: true } };
  }

  if (p === "/api/memorials" && m === "GET") {
    const lang = langFrom(q);
    const list = store.memorials[lang] || store.memorials.en || [];
    return { status: 200, body: { list: list.slice(0, 40) } };
  }

  if (p === "/api/memorial" && m === "GET") {
    if (q.get("random") === "1") {
      const lang = langFrom(q);
      const list = store.memorials[lang] || store.memorials.en || [];
      if (!list.length) return { status: 200, body: { ok: false } };
      const pick = list[Math.floor(Math.random() * list.length)];
      return { status: 200, body: { ok: true, id: pick.id, ...pick } };
    }
    const id = q.get("id");
    const all = Object.values(store.memorials).flat();
    const hit = all.find((item) => item.id === id);
    if (!hit) return { status: 200, body: { ok: false } };
    return {
      status: 200,
      body: {
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
      },
    };
  }

  if (p === "/api/memreact" && m === "POST") {
    return { status: 200, body: { ok: true, candles: 1 } };
  }

  if (p === "/api/memnews" && m === "GET") {
    return { status: 200, body: { ok: true, news: {} } };
  }

  if (p === "/api/memown" && m === "POST") {
    return { status: 200, body: { ok: true, list: [] } };
  }

  if (p === "/api/memremove" && m === "POST") {
    return { status: 200, body: { ok: false, why: "none" } };
  }

  if (p === "/api/memstyle" && m === "POST") {
    return { status: 200, body: { ok: false, why: "none" } };
  }

  if ((p === "/api/keep" || p.startsWith("/api/keep/")) && m === "POST") {
    return { status: 200, body: { ok: false, why: "none" } };
  }

  if (p === "/api/lives" && m === "POST") {
    return { status: 200, body: { ok: true, on: false, list: [] } };
  }

  if (p === "/api/move" && m === "POST") {
    return { status: 200, body: { ok: false, why: "none" } };
  }

  if (p === "/api/home" && m === "GET") {
    return { status: 200, body: { ok: false } };
  }

  if (p === "/api/e" && m === "POST") {
    const data = parseBody(body);
    if (isTursoConfigured()) {
      try {
        const world = await handleBeacon(data);
        return { status: 200, body: world };
      } catch (err) {
        console.error("turso /api/e failed", err);
      }
    }
    return { status: 200, body: { ok: true } };
  }

  if (p === "/api/version" && m === "GET") {
    const version = readVersion();
    return { status: 200, body: { version, label: `${version} beta` } };
  }

  return { status: 404, body: { ok: false, error: "not found" } };
}

export async function readNodeBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}
