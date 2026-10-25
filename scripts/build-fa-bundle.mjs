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
if (!js.includes('LANG==="fa"')) {
  js = js.replace(
    'if(LANG==="ar")return curFix(arFill(t,a));',
    'if(LANG==="ar")return curFix(arFill(t,a));if(LANG==="fa")return curFix(faFill(t,a));',
  );
}

// 5) Inject faFill before arFill (simple placeholder + light cleanup)
if (!js.includes("function faFill")) {
  const faFill = `function faFill(e,a){if(!e)return e;e.indexOf("\\u2060")>=0&&(e=e.replace(/\\u2060/g,""));const t=a.length?e.replace(/\\{(\\d+)\\}/g,(n,r)=>String(a[+r])):e;return t}function faBidi(e){return e} `;
  js = js.replace("function arFill(", faFill + "function arFill(");
}

// 6) RTL helpers that special-case ar — also apply to fa where safe
js = js.replace(
  /LANG==="ar"\?arBidi/g,
  'LANG==="ar"||LANG==="fa"?arBidi',
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

// 8) LAB_W — reuse English lab worker for now
js = js.replace(
  /LAB_W="\/labw\.en\.[^"]+\.js"/,
  'LAB_W="/labw.en.f9c2d141a4.js"',
);

// 9) Persian country names via COUNTRY_T + apply for fa
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
