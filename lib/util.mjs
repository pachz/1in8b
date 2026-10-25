import crypto from "node:crypto";

/** Crockford-ish alphabet matching client `/^[a-z2-9]{9}$/`. */
const CODE_ALPH = "abcdefghijkmnopqrstuvwxyz23456789";

export function str(v, max = 64) {
  if (v == null) return "";
  return String(v).slice(0, max);
}

export function int(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function parseBody(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function randHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

/** 9-char code for move / keep-carry / home hk. */
export function randCode(len = 9) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPH[bytes[i] % CODE_ALPH.length];
  return out;
}

export function normalizeCode(c) {
  return String(c || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isCode9(c) {
  return /^[a-z2-9]{9}$/.test(c);
}

export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim());
}

export function byteLen(s) {
  return Buffer.byteLength(String(s || ""), "utf8");
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromNow(n) {
  return Date.now() + n * DAY_MS;
}

/** Very light content gate for community posts / home names. */
export function moderateText(text, { max = 300, min = 4 } = {}) {
  const t = String(text || "").trim();
  if (t.length < min || t.length > max) return "len";
  if (/https?:\/\/|www\.|\.[a-z]{2,}\/[^\s]*/i.test(t)) return "link";
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(t)) return "link";
  if (/\b(\+?\d[\d\s().-]{7,}\d)\b/.test(t)) return "link";
  // Crisis / self-harm signals (EN + KO + FA common forms) — reject post, client shows calm help.
  if (
    /\b(kill\s*myself|suicide|want\s*to\s*die|end\s*my\s*life)\b/i.test(t) ||
    /자살|죽고\s*싶|살고\s*싶지/i.test(t) ||
    /خودکشی|میخوام\s*بمیرم|میخواهم\s*بمیرم/i.test(t)
  ) {
    return "crisis";
  }
  if (
    /\b(nigg|faggot|kike|retard)\b/i.test(t) ||
    /씨발|좆|병신|느금마/i.test(t)
  ) {
    return "abuse";
  }
  // School / class / address-ish personal markers
  if (
    /\b(grade\s*\d|class\s*\d|room\s*\d{2,}|apartment|apt\.?\s*\d)\b/i.test(t) ||
    /\d{1,4}\s+(street|st\.|road|rd\.|ave)/i.test(t) ||
    /\d학년|\d반|우리\s*학교/i.test(t)
  ) {
    return "personal";
  }
  return null;
}
