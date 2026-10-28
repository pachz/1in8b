import { runApi, apiConfig } from "../_vercel.mjs";

export default async function handler(req, res) {
  return runApi(req, res, "/api/admin/modact");
}

export const config = apiConfig;
