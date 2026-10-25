import { umamiBootScript } from "../lib/env.mjs";

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.status(200).send(umamiBootScript());
}
