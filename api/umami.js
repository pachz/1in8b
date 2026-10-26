import { loadEnvFile, umamiBootScript } from "../lib/env.mjs";

loadEnvFile();

export default function handler(req, res) {
  const js = umamiBootScript();
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(js);
}
