#!/usr/bin/env node
/**
 * Build public/a/fa.<hash>.js from the English bundle + data/i18n_fa.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const enPath = path.join(ROOT, "public/a/en.d8f5afae09.js");
const i18nPath = path.join(ROOT, "data/i18n_fa.json");

if (!fs.existsSync(i18nPath)) {
  console.error("Missing data/i18n_fa.json — run translation first");
  process.exit(1);
}

let js = fs.readFileSync(enPath, "utf8");
const i18n = JSON.parse(fs.readFileSync(i18nPath, "utf8"));
console.log("FA strings:", Object.keys(i18n).length);

// 1) Replace I18N_T object
const start = js.indexOf("I18N_T={");
if (start < 0) throw new Error("I18N_T not found");
const brace = start + "I18N_T=".length;
let depth = 0,
  inStr = false,
  esc = false,
  quote = null,
  end = -1;
for (let j = brace; j < js.length; j++) {
  const c = js[j];
  if (inStr) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === quote) inStr = false;
  } else {
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
    } else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
}
if (end < 0) throw new Error("I18N_T end not found");

function jsString(s) {
  return JSON.stringify(s);
}

const rebuilt =
  "{" +
  Object.entries(i18n)
    .map(([k, v]) => {
      const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : jsString(k);
      return `${key}:${jsString(v)}`;
    })
    .join(",") +
  "}";

js = js.slice(0, brace) + rebuilt + js.slice(end);

// 2) window.LANG + LANGS
js = js.replace('window.LANG="en"', 'window.LANG="fa"');
if (!js.includes('"fa"')) {
  js = js.replace(
    'const LANGS=["en","ko"',
    'const LANGS=["fa","en","ko"',
  );
} else {
  js = js.replace(
    /const LANGS=\[([^\]]+)\]/,
    (m, inner) => {
      if (inner.includes('"fa"')) return m;
      return `const LANGS=["fa",${inner}]`;
    },
  );
}

// 3) LANG_CFG entry (after ar entry)
if (!js.includes('fa:{loc:')) {
  js = js.replace(
    'ar:{loc:"ar-u-nu-latn",name:"العربية",brand:"1 من 8 مليارات",file:"1min8milyarat",rtl:1}',
    'ar:{loc:"ar-u-nu-latn",name:"العربية",brand:"1 من 8 مليارات",file:"1min8milyarat",rtl:1},fa:{loc:"fa-IR",name:"فارسی",brand:"۱ در ۸ میلیارد",file:"1dar8miliard",rtl:1,west:1}',
  );
} else {
  // ensure west:1 for number formatting (avoid Korean 억/만)
  js = js.replace(
    'fa:{loc:"fa-IR",name:"فارسی",brand:"۱ در ۸ میلیارد",file:"1dar8miliard",rtl:1}',
    'fa:{loc:"fa-IR",name:"فارسی",brand:"۱ در ۸ میلیارد",file:"1dar8miliard",rtl:1,west:1}',
  );
}

// 4) L0: treat fa like ar for fill (gender/bidi helpers), fall through placeholders
if (!js.includes('LANG==="fa")return curFix(faFill')) {
  js = js.replace(
    'if(LANG==="ar")return curFix(arFill(t,a));',
    'if(LANG==="ar")return curFix(arFill(t,a));if(LANG==="fa")return curFix(faFill(t,a));',
  );
}

// 4b) Persian month names in birthStory (and anywhere the ar month chain is used)
if (!js.includes("monthFa=")) {
  js = js.replace(
    "monthEn=",
    'monthFa=e=>["ژانویه","فوریه","مارس","آوریل","مه","ژوئن","ژوئیه","اوت","سپتامبر","اکتبر","نوامبر","دسامبر"][(+e||1)-1]||String(e),monthEn=',
  );
}
js = js.replace(
  'LANG==="ar"?monthAr(S.bm):S.bm}',
  'LANG==="ar"?monthAr(S.bm):LANG==="fa"?monthFa(S.bm):S.bm}',
);
// Prefer FA months over English even though west:1
js = js.replace(
  "L_WEST?monthEn(S.bm):",
  'LANG==="fa"?monthFa(S.bm):L_WEST?monthEn(S.bm):',
);

// 5) Inject fa digit helpers + faFill before arFill
// faDigs must NOT rewrite digits inside HTML/SVG tags (viewBox, x, y, …)
// or HTML entities (&#39; → otherwise becomes &#۳۹; and shows literally).
const FA_DIGS =
  'const faDigs0=e=>String(e).split(/(&(?:#(?:x[0-9a-fA-F]+|\\d+)|[a-zA-Z]+);)/).map((p,i)=>i%2?p:p.replace(/(\\d)\\.(\\d)/g,"$1٫$2").replace(/[0-9]/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d]).replace(/%/g,"٪")).join("");' +
  'const faDigs=e=>{e=String(e);return e.indexOf("<")<0&&e.indexOf("&")<0?faDigs0(e):e.replace(/(<[^>]*>)|(&(?:#(?:x[0-9a-fA-F]+|\\d+)|[a-zA-Z]+);)|([^<&]+)/g,(m,tag,ent,txt)=>tag||ent||faDigs0(txt||""))};';
// Isolate Latin runs so English leftovers / names keep LTR punctuation in RTL UI.
// CRITICAL: split HTML tags FIRST. Never split on existing LRI before tag
// protection — an LRI inside placeholder="…Rocky…" would bisect <input> and
// the browser then paints the broken tag as literal text.
// Latin runs: mid-word apostrophe/hyphen (children's, Jean-Pierre) but NOT
// wrapping quotes — otherwise ‘{0}’ becomes ‘⁦Rocky’⁩ and the closer looks missing.
// Include Latin-1/Extended-A in the letter class (é, ñ, …). Accents used to be
// only a trailing group after [A-Za-z]+, which split Béatrice → Bé|atrice and
// flipped the two LRI isolates in RTL to atriceBé.
const FA_LAT = String.raw`[A-Za-z\u00c0-\u024f]+(?:[\u0027\u2019\-][A-Za-z\u00c0-\u024f]+)*(?:[0-9]+)*(?:&(?:#(?:x[0-9a-fA-F]+|\d+)|[a-zA-Z]+);)*`;
const FA_BIDI = String.raw`function faBidi(e){if(!e||typeof e!="string")return e;if(/[A-Za-z\u00c0-\u024f]/.test(e)){const w=s=>{if(!s||!/[A-Za-z\u00c0-\u024f]/.test(s))return s;return s.split(/(\u2066[^\u2069]*\u2069)/).map((p,i)=>{if(i%2||!/[A-Za-z\u00c0-\u024f]/.test(p))return p;if(!AR_ANY.test(p))return"\u2066"+p+"\u2069";return p.replace(/${FA_LAT}(?:\s+${FA_LAT})*/g,m=>"\u2066"+m+"\u2069")}).join("")};e=e.indexOf("<")<0?w(e):e.replace(/(<[^>]*>)|([^<]+)/g,(m,tag,txt)=>tag||w(txt||""))}return typeof arBidi=="function"?arBidi(e):e}`;
if (!js.includes("function faFill")) {
  const faFill =
    FA_DIGS +
    FA_BIDI +
    'function faFill(e,a){if(!e)return e;e.indexOf("\\u2060")>=0&&(e=e.replace(/\\u2060/g,""));const t=a.length?e.replace(/\\{(\\d+)\\}/g,(n,r)=>String(a[+r])):e;return faBidi(faDigs(t))} ';
  js = js.replace("function arFill(", faFill + "function arFill(");
} else if (!js.includes("faDigs=")) {
  js = js.replace("function faFill", FA_DIGS + FA_BIDI + "function faFill");
  js = js.replace(
    "function faFill(e,a){if(!e)return e;e.indexOf(\"\\u2060\")>=0&&(e=e.replace(/\\u2060/g,\"\"));const t=a.length?e.replace(/\\{(\\d+)\\}/g,(n,r)=>String(a[+r])):e;return t}",
    'function faFill(e,a){if(!e)return e;e.indexOf("\\u2060")>=0&&(e=e.replace(/\\u2060/g,""));const t=a.length?e.replace(/\\{(\\d+)\\}/g,(n,r)=>String(a[+r])):e;return faBidi(faDigs(t))}',
  );
}

// 5b) Homepage chart: Persian "million people" + digits (west:1 otherwise keeps Latin $)
if (!js.includes('LANG==="fa")return e>=1e9?faDigs')) {
  js = js.replace(
    "function koBig(e){if(L_WEST)return",
    'function koBig(e){if(LANG==="fa")return e>=1e9?faDigs((e/1e9).toFixed(2))+" میلیارد نفر":faDigs((e/1e6).toFixed(1))+" میلیون نفر";if(L_WEST)return',
  );
}
if (!js.includes('LANG==="fa"?faDigs(a)')) {
  js = js.replace(
    'LANG==="it"?itVal(a):a}',
    'LANG==="it"?itVal(a):LANG==="fa"?faDigs(a):a}',
  );
}
if (!js.includes('LANG==="fa"?"۱ در "')) {
  js = js.replace(
    'oddsStr=e=>{const a=1/e;return L_WEST?"1 in "+enNum(a)',
    'oddsStr=e=>{const a=1/e;return LANG==="fa"?"۱ در "+faDigs(enNum(a)):L_WEST?"1 in "+enNum(a)',
  );
}

// 6) RTL helpers that special-case ar — also apply to fa where safe
js = js.replace(
  /LANG==="ar"\?arBidi/g,
  'LANG==="ar"||LANG==="fa"?arBidi',
);
// Logged/capped lines: Latin isolation (faBidi) instead of numbers-only arBidi
js = js.replace(
  'LANG==="ar"||LANG==="fa"?arBidi(arLate(e))',
  'LANG==="ar"?arBidi(arLate(e)):LANG==="fa"?faBidi(arLate(e))',
);
js = js.replace(
  /LANG==="ar"\?arAxis/g,
  'LANG==="ar"||LANG==="fa"?arAxis',
);
js = js.replace(
  /LANG==="ar"\?arSx/g,
  'LANG==="ar"||LANG==="fa"?arSx',
);
js = js.replace(
  /LANG==="ar"\?arCurFix/g,
  'LANG==="ar"?arCurFix:LANG==="fa"?faCurFix',
);

// 7) fa currency fix stub (identity) if referenced
if (js.includes("faCurFix") && !js.includes("faCurFix=")) {
  js = js.replace(
    "function faFill",
    'const faCurFix=e=>e;function faFill',
  );
}

// 8) Card canvas fonts — Vazirmatn for Persian (UI already loads it; Korean Hahmlet has no FA glyphs)
if (!js.includes('LANG==="fa"?{d:"Vazirmatn')) {
  js = js.replace(
    'CF=LANG==="ar"?',
    'CF=LANG==="fa"?{d:"Vazirmatn, \'IBM Plex Sans Arabic\', Tahoma, sans-serif",b:"Vazirmatn, \'IBM Plex Sans Arabic\', system-ui, Tahoma, sans-serif",m:"\'IBM Plex Mono\', Vazirmatn, ui-monospace, monospace"}:LANG==="ar"?',
  );
}
if (!js.includes('LANG==="fa"?["700 72px Vazirmatn"')) {
  js = js.replace(
    'L_RTL?["700 60px \'IBM Plex Sans Arabic\'","600 30px \'IBM Plex Sans Arabic\'","400 30px \'IBM Plex Sans Arabic\'"]',
    'LANG==="fa"?["700 72px Vazirmatn","600 32px Vazirmatn","400 30px Vazirmatn","500 30px Vazirmatn"]:L_RTL?["700 60px \'IBM Plex Sans Arabic\'","600 30px \'IBM Plex Sans Arabic\'","400 30px \'IBM Plex Sans Arabic\'"]',
  );
}
// Bust birth/death card cache when site URL / branding changes
if (!js.includes('CONFIG.siteUrl||"")+"|"+S.name.full')) {
  js = js.replace(
    'const a=e+"|"+S.name.full+"|"+S.born+"|"+(S.deathAt?S.deathAt.age:"")+"|"+(S.farewell||',
    'const a=e+"|"+(CONFIG.siteUrl||"")+"|"+S.name.full+"|"+S.born+"|"+(S.deathAt?S.deathAt.age:"")+"|"+(S.farewell||',
  );
}

// 9) LAB_W — reuse English lab worker for now
js = js.replace(
  /LAB_W="\/labw\.en\.[^"]+\.js"/,
  'LAB_W="/labw.en.f9c2d141a4.js"',
);

// 10) Persian country names via COUNTRY_T + apply for fa
const countryFaPath = path.join(ROOT, "data/country-fa.json");
if (fs.existsSync(countryFaPath)) {
  const countryFa = JSON.parse(fs.readFileSync(countryFaPath, "utf8"));
  const cStart = js.indexOf("COUNTRY_T=");
  if (cStart >= 0) {
    const brace = js.indexOf("{", cStart);
    let depth = 0,
      inStr = false,
      esc = false,
      quote = null,
      cEnd = -1;
    for (let j = brace; j < js.length; j++) {
      const c = js[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === quote) inStr = false;
      } else {
        if (c === '"' || c === "'") {
          inStr = true;
          quote = c;
        } else if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            cEnd = j + 1;
            break;
          }
        }
      }
    }
    const rebuiltC =
      "{" +
      Object.entries(countryFa)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(",") +
      "}";
    js = js.slice(0, brace) + rebuiltC + js.slice(cEnd);
  }
  js = js.replace(
    'LANG==="en"){for(const e of COUNTRIES)COUNTRY_T',
    'LANG==="en"||LANG==="fa"){for(const e of COUNTRIES)COUNTRY_T',
  );
}

const hash = crypto.createHash("md5").update(js).digest("hex").slice(0, 10);
const outName = `fa.${hash}.js`;
const outPath = path.join(ROOT, "public/a", outName);
fs.writeFileSync(outPath, js);
fs.writeFileSync(path.join(ROOT, "data/fa-bundle-name.txt"), outName);
console.log("Wrote", outPath, "bytes", js.length);
