import { ensureTurso, isTursoConfigured } from "./turso.mjs";
import { enforceRates } from "./rate-limit.mjs";
import { moderateText, str } from "./util.mjs";

const FB_MAX = 1200;
const FB_MIN = 2;
const CTX_MAX = 2000;
const NICK_MAX = 40;
const TYPE_MAX = 80;
const HOUR_CAP = 400;

/** Canonical types (Korean labels used in the original Google Form). */
export const FEEDBACK_TYPES = [
  "버그·오류",
  "통계가 이상해요",
  "너무 쉽거나 어려워요",
  "이벤트·결정 아이디어",
  "디자인·사용성",
  "기타",
];

function normalizeType(raw) {
  const t = str(raw, TYPE_MAX).trim();
  if (!t) return "기타";
  if (FEEDBACK_TYPES.includes(t)) return t;
  // Localized UI labels still accepted; store under "기타" with prefix in text? Keep as-is truncated.
  return t.slice(0, TYPE_MAX);
}

/**
 * Store feedback in Turso. Rate-limited by IP + session id.
 * @returns {Promise<{ ok: boolean, why?: string, id?: number }>}
 */
export async function submitFeedback(body, meta = {}) {
  if (!isTursoConfigured()) return { ok: false, why: "busy" };

  const ip = str(meta?.clientIp, 64) || "anon";
  const sid = str(body?.s, 24);
  const limited = await enforceRates([
    ["feedbackIp", ip],
    ["feedbackIpHour", ip],
    ["feedbackIpDay", ip],
    sid ? ["feedbackSid", sid] : null,
  ].filter(Boolean));
  if (!limited.ok) return limited;

  const text = String(body?.text || "").trim();
  const why = moderateText(text, { min: FB_MIN, max: FB_MAX });
  if (why) return { ok: false, why };

  const type = normalizeType(body?.type);
  const nick = str(body?.nick, NICK_MAX).trim();
  const ctx = str(body?.ctx, CTX_MAX);
  const lang = str(body?.lang, 16) || "en";
  const ua = str(meta?.userAgent, 180);

  const db = await ensureTurso();
  if (!db) return { ok: false, why: "busy" };

  try {
    const since = Date.now() - 60 * 60 * 1000;
    const { rows } = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM feedback WHERE at >= ?",
      args: [since],
    });
    if ((Number(rows[0]?.n) || 0) >= HOUR_CAP) {
      return { ok: false, why: "full" };
    }
  } catch (err) {
    console.error("feedback hour cap failed", err);
  }

  const at = Date.now();
  try {
    const result = await db.execute({
      sql: `INSERT INTO feedback (at, lang, type, text, nick, ctx, sid, ua, hidden)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [at, lang, type, text, nick || null, ctx || null, sid || null, ua || null],
    });
    const id = Number(result.lastInsertRowid) || at;
    return { ok: true, id };
  } catch (err) {
    console.error("feedback insert failed", err);
    return { ok: false, why: "busy" };
  }
}
