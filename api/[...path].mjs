import { dispatchApi } from "../lib/game-api.mjs";

/**
 * Normalize Vercel / Node request path to `/api/...`.
 * Catch-all `api/[...path]` may receive:
 *   - full `/api/move` in req.url
 *   - stripped `/move` with query.path = "move" | ["move"]
 *   - `/api/move/take` → path ["move","take"]
 */
function pathFromReq(req) {
  const rawUrl = req.url || "/";
  const url = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  let pathname = url.pathname || "/";

  // Prefer explicit catch-all segments when present
  const qPath = req.query?.path;
  const parts = Array.isArray(qPath)
    ? qPath
    : typeof qPath === "string" && qPath.length
      ? qPath.split("/")
      : null;

  if (parts && parts.length) {
    pathname = "/api/" + parts.map((p) => decodeURIComponent(String(p))).join("/");
  } else if (!pathname.startsWith("/api")) {
    // url was stripped to `/move` or `/move/take`
    pathname = pathname === "/" ? "/api" : "/api" + pathname;
  }

  // Collapse duplicate slashes / trailing slash (except root)
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return { pathname, searchParams: url.searchParams };
}

function rawBody(req) {
  if (req.body == null) return "";
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

export default async function handler(req, res) {
  try {
    const { pathname, searchParams } = pathFromReq(req);
    const result = await dispatchApi({
      method: req.method,
      pathname,
      searchParams,
      body: rawBody(req),
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "server error" });
  }
}

export const config = {
  api: {
    bodyParser: {
      // lives / move / memorial frame payloads
      sizeLimit: "3mb",
    },
  },
};
