import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dispatchApi, readNodeBody } from "./lib/game-api.mjs";
import { loadEnvFile, umamiBootScript } from "./lib/env.mjs";

loadEnvFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3080;

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

function spaShell(lang) {
  const file = path.join(PUBLIC, lang, "index.html");
  if (fs.existsSync(file)) return file;
  return path.join(PUBLIC, "en", "index.html");
}

function resolveStatic(urlPath) {
  let clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.includes("\0") || clean.includes("..")) return null;
  if (clean.endsWith("/")) clean += "index.html";

  const tryFile = (rel) => {
    const candidate = path.join(PUBLIC, rel);
    if (!candidate.startsWith(PUBLIC)) return null;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    return null;
  };

  let hit = tryFile(clean);
  if (hit) return hit;

  // Memorial link-preview image: /{lang}/m/{id}.png
  // Upstream serves a generated card; until we do, fall back to the site OG image
  // (must run before the SPA shell rewrite, which would return HTML).
  if (/^\/[a-z]{2}(?:-hans)?\/m\/[^/]+\.png$/i.test(clean)) {
    hit = tryFile("/og-en.png") || tryFile("/og.png");
    if (hit) return hit;
  }

  if (
    !clean.endsWith(".html") &&
    !clean.endsWith(".json") &&
    !clean.endsWith(".js")
  ) {
    hit = tryFile(clean + "/index.html") || tryFile(clean + ".html");
    if (hit) return hit;
  }

  if (/^\/[a-z]{2}(?:-hans)?\/c(?:\/|$)/i.test(clean)) {
    return null;
  }

  const m = clean.match(/^\/([a-z]{2}(?:-hans)?)\/(?:m\/|pass\/|keep\/|s\/|h\/)?/i);
  if (m) {
    const shell = spaShell(m[1]);
    if (fs.existsSync(shell)) return shell;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/umami.js") {
      const js = umamiBootScript();
      return send(res, 200, js, "application/javascript; charset=utf-8");
    }

    if (url.pathname.startsWith("/api/")) {
      const body =
        req.method === "GET" || req.method === "HEAD"
          ? ""
          : await readNodeBody(req);
      const result = await dispatchApi({
        method: req.method,
        pathname: url.pathname,
        searchParams: url.searchParams,
        body,
        headers: req.headers,
        clientIp: req.socket?.remoteAddress || "",
      });
      return json(res, result.status, result.body);
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
