import { runApi, apiConfig } from "../_vercel.mjs";

/** Explicit /api/move/take — nested path that was 404ing on Vercel. */
export default async function handler(req, res) {
  return runApi(req, res, "/api/move/take");
}

export const config = apiConfig;
