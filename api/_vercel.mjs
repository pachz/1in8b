import { dispatchApi } from "../lib/game-api.mjs";

/** Shared Vercel serverless adapter → lib/game-api.mjs */
export function pathFromReq(req, fallbackPathname) {
  const rawUrl = req.url || "/";
  const url = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  let pathname = url.pathname || "/";

  const qPath = req.query?.path;
  const parts = Array.isArray(qPath)
    ? qPath
    : typeof qPath === "string" && qPath.length
      ? qPath.split("/")
      : null;

  if (parts && parts.length) {
    pathname =
      "/api/" + parts.map((p) => decodeURIComponent(String(p))).join("/");
  } else if (fallbackPathname) {
    pathname = fallbackPathname;
  } else if (!pathname.startsWith("/api")) {
    pathname = pathname === "/" ? "/api" : "/api" + pathname;
  }

  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return { pathname, searchParams: url.searchParams };
}

export function rawBody(req) {
  if (req.body == null) return "";
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

export async function runApi(req, res, fallbackPathname) {
  try {
    const { pathname, searchParams } = pathFromReq(req, fallbackPathname);
    const result = await dispatchApi({
      method: req.method,
      pathname,
      searchParams,
      body: rawBody(req),
      headers: req.headers,
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "server error" });
  }
}

export const apiConfig = {
  api: {
    bodyParser: {
      sizeLimit: "3mb",
    },
  },
};
