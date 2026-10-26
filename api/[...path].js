import { runApi, apiConfig } from "./_vercel.mjs";

/** Catch-all: /api/posts, /api/keep/me, /api/move/take, … */
export default async function handler(req, res) {
  return runApi(req, res);
}

export const config = apiConfig;
