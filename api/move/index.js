import { runApi, apiConfig } from "../_vercel.mjs";

/** Explicit /api/move */
export default async function handler(req, res) {
  return runApi(req, res, "/api/move");
}

export const config = apiConfig;
