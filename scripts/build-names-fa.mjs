#!/usr/bin/env node
/**
 * Build data/names-fa.json from English NAMES / NAMES_T via Persian transliteration.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translateName } from "./fa-translit.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const enPath = path.join(ROOT, "public/a/en.d8f5afae09.js");
const outPath = path.join(ROOT, "data/names-fa.json");

function extractAssign(src, name) {
  const start = src.indexOf(name + "=");
  if (start < 0) throw new Error("missing " + name);
  const brace = src.indexOf("{", start);
  let depth = 0,
    inStr = false,
    esc = false,
    quote = null;
  for (let j = brace; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
    } else {
      if (c === '"' || c === "'" || c === "`") {
        inStr = true;
        quote = c;
      } else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return src.slice(brace, j + 1);
      }
    }
  }
  throw new Error("end " + name);
}

const js = fs.readFileSync(enPath, "utf8");
const NAMES = eval("(" + extractAssign(js, "NAMES") + ")");
const NAMES_T = eval("(" + extractAssign(js, "NAMES_T") + ")");
for (const k of Object.keys(NAMES_T)) {
  for (const f of Object.keys(NAMES_T[k])) {
    if (Array.isArray(NAMES_T[k][f])) NAMES[k][f] = NAMES_T[k][f];
  }
}

const out = {};
let n = 0;
for (const [culture, pool] of Object.entries(NAMES)) {
  const o = {};
  for (const [field, val] of Object.entries(pool)) {
    if (!Array.isArray(val)) continue;
    o[field] = val.map((name) => {
      n++;
      return translateName(name, culture);
    });
  }
  out[culture] = o;
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 0) + "\n");
console.log("Wrote", outPath, "cultures", Object.keys(out).length, "names", n);
