function maskUrl(url) {
  return String(url).replace(
    /(api\.kavenegar\.com\/v1\/)[^/]+(\/)/g,
    "$1***$2",
  );
}

function formatLogLine(method, url, durationMs, status) {
  return `${method} ${maskUrl(url)} | ${durationMs}ms ${status}`;
}

/**
 * Logged fetch for outbound Iranian APIs (pass an already-proxied URL from getProxiedUrl).
 * Same idea as moonshot.gold convex/lib/outboundFetch.ts.
 */
export async function outboundFetch({ url, init }) {
  const method = init?.method ?? "GET";
  const startedAt = Date.now();

  try {
    const response = await fetch(url, init);
    console.log(
      formatLogLine(method, url, Date.now() - startedAt, response.status),
    );
    return response;
  } catch (error) {
    console.error(formatLogLine(method, url, Date.now() - startedAt, "ERROR"));
    throw error;
  }
}
