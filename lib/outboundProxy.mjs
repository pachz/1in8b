import { loadEnvFile } from "./env.mjs";

/**
 * Prefix target URL with outbound proxy when configured.
 * Same pattern as moonshot.gold convex/lib/outboundProxy.ts —
 * needed so Vercel/US hosts can reach Iranian APIs (e.g. Kavenegar).
 */
export function getProxiedUrl(targetUrl) {
  loadEnvFile();
  const proxyUrl = (
    process.env.OUTBOUND_PROXY_URL ||
    process.env.KAVENEGAR_PROXY_URL ||
    ""
  ).trim();

  if (proxyUrl) {
    return `${proxyUrl.replace(/\/$/, "")}/${targetUrl}`;
  }

  return targetUrl;
}

export function outboundProxyConfigured() {
  loadEnvFile();
  return Boolean(
    (process.env.OUTBOUND_PROXY_URL || process.env.KAVENEGAR_PROXY_URL || "").trim(),
  );
}
