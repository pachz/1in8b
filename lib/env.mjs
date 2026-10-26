import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let loaded = false;

/** Load `.env` into process.env for local runs (Vercel injects env itself). */
export function loadEnvFile() {
  if (loaded) return;
  loaded = true;
  try {
    const text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  } catch {
    // no .env is fine
  }
}

export function umamiWebsiteId() {
  loadEnvFile();
  return (
    process.env.UMAMI_WEBSITE_ID ||
    process.env.UMAMI_ID ||
    process.env.NEXT_PUBLIC_UMAMI_ID ||
    ""
  ).trim();
}

export function tursoConfig() {
  loadEnvFile();
  const url = (
    process.env.STORAGE_TURSO_DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    ""
  ).trim();
  const authToken = (
    process.env.STORAGE_TURSO_AUTH_TOKEN ||
    process.env.TURSO_AUTH_TOKEN ||
    ""
  ).trim();
  return { url, authToken, configured: Boolean(url && authToken) };
}

/** Comma-separated hostnames; empty = do not restrict (all domains). */
export function umamiDomains() {
  loadEnvFile();
  return (process.env.UMAMI_DOMAINS || "").trim();
}

/** Admin UI password (plain string in env). Empty = admin API disabled. */
export function adminConfig() {
  loadEnvFile();
  const password = (process.env.ADMIN_PASSWORD || "").trim();
  return {
    password,
    configured: Boolean(password),
  };
}

/** Auth OTP + delivery providers (Kavenegar SMS, Resend email). */
export function authConfig() {
  loadEnvFile();
  const pepper = (process.env.AUTH_OTP_PEPPER || "").trim();
  const kavenegarToken = (process.env.KAVENEGAR_TOKEN || "").trim();
  const kavenegarTemplate = (
    process.env.KAVENEGAR_TEMPLATE ||
    "1in8b-verify"
  ).trim();
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  const emailFrom = (
    process.env.AUTH_EMAIL_FROM ||
    "1in8b <noreply@1in8b.ir>"
  ).trim();
  const devOtp = /^(1|true|yes)$/i.test(
    (process.env.AUTH_OTP_DEV || "").trim(),
  );
  return {
    pepper,
    pepperConfigured: Boolean(pepper),
    kavenegarToken,
    kavenegarTemplate,
    smsConfigured: Boolean(kavenegarToken),
    resendApiKey,
    emailFrom,
    emailConfigured: Boolean(resendApiKey),
    devOtp,
  };
}

/** JS snippet that loads Umami when an ID is configured. */
export function umamiBootScript() {
  const id = umamiWebsiteId();
  const domains = umamiDomains();
  if (!id) {
    return "/* umami: UMAMI_WEBSITE_ID not set */\n";
  }
  return `(()=>{try{const id=${JSON.stringify(id)};const domains=${JSON.stringify(domains)};if(!id||document.querySelector("script[data-website-id]"))return;const s=document.createElement("script");s.defer=!0;s.src="https://cloud.umami.is/script.js";s.setAttribute("data-website-id",id);if(domains)s.setAttribute("data-domains",domains);document.head.appendChild(s);}catch(e){}})();\n`;
}
