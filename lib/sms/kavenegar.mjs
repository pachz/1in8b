import { authConfig } from "../env.mjs";
import { outboundFetch } from "../outboundFetch.mjs";
import { getProxiedUrl } from "../outboundProxy.mjs";

function getKavenegarApiUrl() {
  const { kavenegarToken } = authConfig();
  if (!kavenegarToken) {
    throw new Error("KAVENEGAR_TOKEN is not configured");
  }
  return getProxiedUrl(
    `https://api.kavenegar.com/v1/${kavenegarToken}/verify/lookup.json`,
  );
}

/**
 * Kavenegar verify/lookup SMS (same API as moonshot.gold convex/sms/kavenegar.ts).
 * Uses OUTBOUND_PROXY_URL / KAVENEGAR_PROXY_URL when set.
 */
async function sendLookupSms({ phoneNumber, template, token }) {
  const response = await outboundFetch({
    url: getKavenegarApiUrl(),
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        receptor: phoneNumber,
        token,
        template,
        type: "sms",
      }).toString(),
    },
  });

  if (!response.ok) {
    throw new Error(`Kavenegar API responded with status: ${response.status}`);
  }

  const data = await response.json();
  if (data?.return?.status !== 200) {
    console.error("Kavenegar API error:", data);
    throw new Error("Kavenegar lookup request failed");
  }
}

/** Send a 5-digit OTP via Kavenegar template. */
export async function sendOtpSms(phoneNumber, code) {
  const { kavenegarTemplate, smsConfigured } = authConfig();
  if (!smsConfigured) {
    throw new Error("KAVENEGAR_TOKEN is not configured");
  }
  await sendLookupSms({
    phoneNumber,
    template: kavenegarTemplate,
    token: code,
  });
  return { success: true };
}
