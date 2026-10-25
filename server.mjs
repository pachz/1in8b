import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3080;

const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "api-seed.json"), "utf8"),
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

const store = {
  posts: {},
  memorials: {},
  reactions: {},
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

function send(res, status, body, type = "application/json; charset=utf-8") {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
  });
  res.end(buf);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function langFrom(url) {
  return url.searchParams.get("lang") || "en";
}

function spaShell(lang) {
  const file = path.join(PUBLIC, lang, "index.html");
  if (fs.existsSync(file)) return file;
  return path.join(PUBLIC, "en", "index.html");
}

function resolveStatic(urlPath) {
  let clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.includes("\0") || clean.includes("..")) return null;
  if (clean.endsWith("/")) clean += "index.html";

  const candidate = path.join(PUBLIC, clean);
  if (!candidate.startsWith(PUBLIC)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // Language SPA routes: /en/m/:id, /en/about already on disk, etc.
  const m = clean.match(/^\/([a-z]{2}(?:-hans)?)\/(?:m\/|pass\/|keep\/)?/i);
  if (m) {
    const shell = spaShell(m[1]);
    if (fs.existsSync(shell)) return shell;
  }
  return null;
}

async function handleApi(req, res, url) {
  const p = url.pathname;

  if (p === "/api/posts" && req.method === "GET") {
    const lang = langFrom(url);
    const posts = store.posts[lang] || store.posts.en || [];
    return json(res, 200, { posts: posts.slice(0, 40) });
  }

  if (p === "/api/post" && req.method === "POST") {
    const raw = await readBody(req);
    let body;
    try {
      body = JSON.parse(raw.toString("utf8") || "{}");
    } catch {
      body = {};
    }
    const lang = body.lang || "en";
    const id = Date.now();
    const post = {
      id,
      at: Date.now(),
      iso: body.iso || "?",
      sex: body.sex || "?",
      age: body.age || 0,
      name: body.name || "Anonymous",
      story: body.story || "",
      text: body.text || body.story || "",
      rem: 0,
    };
    store.posts[lang] = [post, ...(store.posts[lang] || [])];
    return json(res, 200, { ok: true, id, tok: String(id) });
  }

  if (p === "/api/unpost" && req.method === "POST") {
    return json(res, 200, { ok: true });
  }

  if (p === "/api/react" && req.method === "POST") {
    return json(res, 200, { ok: true });
  }

  if (p === "/api/memorials" && req.method === "GET") {
    const lang = langFrom(url);
    const list = store.memorials[lang] || store.memorials.en || [];
    return json(res, 200, { list: list.slice(0, 40) });
  }

  if (p === "/api/memorial" && req.method === "GET") {
    if (url.searchParams.get("random") === "1") {
      const lang = langFrom(url);
      const list = store.memorials[lang] || store.memorials.en || [];
      if (!list.length) return json(res, 200, { ok: false });
      const pick = list[Math.floor(Math.random() * list.length)];
      return json(res, 200, { ok: true, id: pick.id, ...pick });
    }
    const id = url.searchParams.get("id");
    const all = Object.values(store.memorials).flat();
    const hit = all.find((m) => m.id === id);
    if (!hit) return json(res, 200, { ok: false });
    return json(res, 200, {
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

  if (p === "/api/memreact" && req.method === "POST") {
    return json(res, 200, { ok: true, candles: 1 });
  }

  if (p === "/api/memnews" && req.method === "GET") {
    return json(res, 200, { ok: true, news: {} });
  }

  if (p === "/api/home" && req.method === "GET") {
    return json(res, 200, { ok: false });
  }

  if (p === "/api/e" && req.method === "POST") {
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { ok: false, error: "not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }

    let filePath = resolveStatic(url.pathname);
    if (!filePath && url.pathname === "/") {
      filePath = path.join(PUBLIC, "index.html");
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return send(res, 404, "Not found", "text/plain; charset=utf-8");
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    const cache =
      ext === ".html" || ext === ".json"
        ? "no-cache"
        : "public, max-age=31536000, immutable";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": data.length,
      "Cache-Control": cache,
    });
    res.end(data);
  } catch (err) {
    console.error(err);
    send(res, 500, "Server error", "text/plain; charset=utf-8");
  }
});

server.listen(PORT, () => {
  console.log(`1 in 8 Billion → http://localhost:${PORT}/fa/`);
});
