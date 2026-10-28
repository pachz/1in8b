#!/usr/bin/env node
/**
 * One-shot: elevate .opts birth-settings UI across language homepages.
 * Safe to re-run: skips files already wrapped with .opts-main + optsIn keyframes.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");

const OLD_OPTS_CSS = `.opts { margin-top: 36px; display: flex; flex-wrap: wrap; gap: 28px 40px; align-items: flex-end; }
.seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; background: var(--card); }
.seg button { flex: 1 1 auto; border: 0; background: none; padding: 9px 14px; font-size: 14px; color: var(--ink2); }
.seg button + button { border-left: 1px solid var(--rule); }
:where(html[dir="rtl"]) .seg button + button { border-right: 1px solid var(--rule); border-left: 0; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.optgroup { display: flex; flex-direction: column; gap: 8px; }
.optgroup .hint { font-size: 12.5px; color: var(--ink3); max-width: 24em; }`;

const NEW_OPTS_CSS = `.opts {
  margin-top: 36px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding: 28px 28px 0;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--stamp-soft) 72%, transparent) 0%, transparent 58%),
    var(--card);
  box-shadow: var(--shadow);
  overflow: clip;
}
.opts-main {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px 32px;
  align-items: start;
}
.opts-home {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--rule2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.opts-home > .optgroup { max-width: 32em; }
.opts-home .optgroup .hint { max-width: none; }
.opts .optgroup .lbl { letter-spacing: .05em; }
.opts .optgroup .seg { width: 100%; }
.seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--card) 70%, var(--paper)); }
.seg button { flex: 1 1 auto; border: 0; background: none; padding: 11px 14px; font-size: 14px; color: var(--ink2); transition: background .15s ease, color .15s ease; }
.seg button + button { border-left: 1px solid var(--rule); }
:where(html[dir="rtl"]) .seg button + button { border-right: 1px solid var(--rule); border-left: 0; }
.seg button:hover { color: var(--ink); background: color-mix(in srgb, var(--card2) 80%, transparent); }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.seg button[aria-pressed="true"]:hover { background: var(--ink); color: var(--paper); }
.optgroup { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.optgroup .hint { font-size: 12.5px; color: var(--ink3); max-width: 24em; line-height: 1.55; }
@keyframes optsIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.opts-main > .optgroup { animation: optsIn .48s ease both; }
.opts-main > .optgroup:nth-child(1) { animation-delay: .03s; }
.opts-main > .optgroup:nth-child(2) { animation-delay: .1s; }
.opts-main > .optgroup:nth-child(3) { animation-delay: .17s; }
.opts .ctarow #startBtn { transition: transform .15s ease, filter .15s ease; }
.opts .ctarow #startBtn:hover { filter: brightness(1.06); transform: translateY(-1px); }
.opts .ctarow #startBtn:active { transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .opts-main > .optgroup { animation: none; }
  .seg button { transition: none; }
  .opts .ctarow #startBtn { transition: none; }
  .opts .ctarow #startBtn:hover { transform: none; }
}`;

const OLD_CTAROW = `.ctarow { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.opts .ctarow { align-items: stretch; }`;

const NEW_CTAROW = `.ctarow { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.opts .ctarow {
  align-items: center;
  gap: 14px;
  margin-top: 28px;
  margin-inline: -28px;
  padding: 18px 28px 22px;
  border-top: 1px solid var(--rule2);
  background: color-mix(in srgb, var(--accent-soft) 45%, var(--card));
}
.opts .ctarow .ghost { align-self: center; }
.opts .unl-back { margin-top: 18px; }`;

const OLD_MOBILE_OPTS = `  .opts { gap: 24px; }
  .optgroup { flex: 1 1 100%; min-width: 0; }
  .optgroup .hint { max-width: none; }
  .seg { display: flex; }
  .seg button { flex: 1 1 0; padding-inline: 8px; }`;

const NEW_MOBILE_OPTS = `  .opts { padding: 20px 16px 0; border-radius: 8px; }
  .opts-main { grid-template-columns: 1fr; gap: 22px; }
  .opts-home { margin-top: 22px; padding-top: 20px; }
  .opts-home > .optgroup { max-width: none; }
  .optgroup { flex: 1 1 100%; min-width: 0; }
  .optgroup .hint { max-width: none; }
  .seg { display: flex; width: 100%; }
  .seg button { flex: 1 1 0; padding-inline: 8px; }
  .opts .ctarow { margin-inline: -16px; padding: 16px 16px 18px; }`;

const OLD_CTAHINT_MQ = `.ctahint { font-size: 13px; color: var(--ink3); }
@media (min-width: 801px) {
  .opts .ctarow { flex-basis: 100%; align-items: center; gap: 16px; padding-top: 24px; border-top: 1px solid var(--rule2); }
  .opts .ctarow #startBtn { font-size: 20px; padding: 16px 52px; }
}
@media (max-width: 800px) { .ctahint { flex-basis: 100%; } }`;

const NEW_CTAHINT_MQ = `.ctahint { font-size: 13px; color: var(--ink3); max-width: 22em; line-height: 1.45; }
.opts .ctarow #startBtn { font-size: 20px; padding: 16px 48px; }
@media (max-width: 900px) {
  .opts-main { grid-template-columns: 1fr; gap: 22px; }
}
@media (max-width: 800px) {
  .ctahint { flex-basis: 100%; max-width: none; }
  .opts .ctarow #startBtn { width: 100%; justify-content: center; }
}`;

function findMatchingCloseDiv(html, openIdx) {
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openIdx;
  let depth = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth++;
    else if (/^<\/div/i.test(m[0])) {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    }
  }
  throw new Error("unclosed div");
}

function normalizeOptgroupIndent(block, base) {
  const lines = block.split("\n");
  const first = lines.find((l) => l.trim());
  const lead = first ? first.match(/^\s*/)[0].length : 0;
  return lines
    .map((line) => {
      if (!line.trim()) return "";
      const stripped = line.slice(Math.min(lead, line.match(/^\s*/)[0].length));
      return base + stripped;
    })
    .join("\n");
}

function wrapOptsHtml(html) {
  if (html.includes('class="opts-main"')) return { html, skipped: true };

  const start = html.indexOf('<div class="opts">');
  if (start < 0) throw new Error("missing .opts");

  let i = start + '<div class="opts">'.length;
  const groups = [];
  for (let n = 0; n < 4; n++) {
    const gStart = html.indexOf('<div class="optgroup">', i);
    if (gStart < 0) throw new Error(`optgroup ${n} not found`);
    const gEnd = findMatchingCloseDiv(html, gStart);
    groups.push(html.slice(gStart, gEnd));
    i = gEnd;
  }

  const before = html.slice(0, start);
  const after = html.slice(i);
  const main = groups.slice(0, 3).map((g) => normalizeOptgroupIndent(g, "        ")).join("\n");
  const home = normalizeOptgroupIndent(groups[3], "        ");

  return {
    html:
      before +
      `<div class="opts">\n` +
      `      <div class="opts-main">\n` +
      main +
      `\n      </div>\n` +
      `      <div class="opts-home">\n` +
      home +
      `\n      </div>` +
      after,
    skipped: false,
  };
}

function patchCss(html) {
  let out = html;
  for (const [old, neu] of [
    [OLD_OPTS_CSS, NEW_OPTS_CSS],
    [OLD_CTAROW, NEW_CTAROW],
    [OLD_MOBILE_OPTS, NEW_MOBILE_OPTS],
    [OLD_CTAHINT_MQ, NEW_CTAHINT_MQ],
  ]) {
    if (!out.includes(old)) {
      if (out.includes("opts-main") && out.includes("optsIn")) continue;
      throw new Error(`CSS block not found:\n${old.slice(0, 80)}…`);
    }
    out = out.replace(old, neu);
  }
  return out;
}

const langs = readdirSync(PUBLIC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => {
    try {
      return readFileSync(join(PUBLIC, name, "index.html"), "utf8").includes('<div class="opts">');
    } catch {
      return false;
    }
  });

let ok = 0;
for (const lang of langs) {
  const path = join(PUBLIC, lang, "index.html");
  let html = readFileSync(path, "utf8");
  if (html.includes('class="opts-main"') && html.includes("@keyframes optsIn")) {
    console.log(`skip ${lang} (already patched)`);
    continue;
  }
  try {
    if (!html.includes("@keyframes optsIn")) html = patchCss(html);
    const { html: next, skipped } = wrapOptsHtml(html);
    writeFileSync(path, next);
    console.log(`ok ${lang}${skipped ? " (html already)" : ""}`);
    ok++;
  } catch (e) {
    console.error(`FAIL ${lang}:`, e.message);
    process.exitCode = 1;
  }
}
console.log(`done: ${ok}/${langs.length}`);
