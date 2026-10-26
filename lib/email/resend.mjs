import { authConfig } from "../env.mjs";

/** Send a login OTP email via Resend HTTP API. */
export async function sendOtpEmail(to, code) {
  const { resendApiKey, emailFrom, emailConfigured } = authConfig();
  if (!emailConfigured) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [to],
      subject: `${code} — 1in8b login code`,
      text: `Your 1in8b login code is ${code}.\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your 1in8b login code is <strong style="font-size:1.25em;letter-spacing:0.08em">${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Resend API error:", response.status, body);
    throw new Error(`Resend API responded with status: ${response.status}`);
  }

  return { success: true };
}
