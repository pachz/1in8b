import { dispatchApi } from "../lib/game-api.mjs";

function pathFromReq(req) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  // On Vercel, req.url may be only the path after /api, or the full path.
  let pathname = url.pathname;
  if (!pathname.startsWith("/api")) {
    const parts = Array.isArray(req.query?.path)
      ? req.query.path
      : req.query?.path
        ? [req.query.path]
        : [];
    pathname = "/api/" + parts.map(decodeURIComponent).join("/");
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
