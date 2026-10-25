#!/usr/bin/env node
/**
 * Bump package.json patch version and sync it into the app:
 * - public/version.json
 * - inline APP_VERSION + #verTag + softwareVersion in language HTML
 *
 * App bundles read globalThis.APP_VERSION (set before /a/*.js loads).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkgPath = path.join(root, "package.json");

const mode = process.argv.includes("--sync-only")
  ? "sync"
  : process.argv.includes("--init")
    ? "init"
    : "bump";

function readPkg() {
  return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
}

function writePkg(pkg) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function bumpPatch(version) {
  const parts = String(version).split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid semver in package.json: ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "a" || name === "fonts" || name === "node_modules") continue;
      walkHtml(full, out);
    } else if (name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

function syncHtml(version) {
  const publicDir = path.join(root, "public");
  const tag = `v${version} beta`;
  const appVersionScript = `<script>globalThis.APP_VERSION=${JSON.stringify(version)};</script>`;
  let changed = 0;

  for (const file of walkHtml(publicDir)) {
    let html = fs.readFileSync(file, "utf8");
    const before = html;

    // Keep a single APP_VERSION bootstrap before the /a/*.js bundle.
    if (/globalThis\.APP_VERSION\s*=/.test(html)) {
      html = html.replace(
        /<script>\s*globalThis\.APP_VERSION\s*=\s*["'][^"']*["']\s*;?\s*<\/script>/,
        appVersionScript,
      );
    } else if (/<script\s+src="\/a\/[^"]+\.js"><\/script>/.test(html)) {
      html = html.replace(
        /(<script\s+src="\/a\/[^"]+\.js"><\/script>)/,
        `${appVersionScript}\n$1`,
      );
    }

    html = html.replace(
      /(<span id="verTag">)[^<]*(<\/span>)/g,
      `$1${tag}$2`,
    );
    html = html.replace(
      /("softwareVersion"\s*:\s*")[^"]*(")/g,
      `$1${version}$2`,
    );

    if (html !== before) {
      fs.writeFileSync(file, html);
      changed++;
    }
  }
  return changed;
}

function syncBundles(version) {
  // Keep fallback inside CONFIG in sync; runtime prefers APP_VERSION.
  const aDir = path.join(root, "public", "a");
  let changed = 0;
  for (const name of fs.readdirSync(aDir)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(aDir, name);
    let js = fs.readFileSync(file, "utf8");
    const before = js;

    if (/CONFIG=\{version:\(globalThis\.APP_VERSION\|\|"/.test(js)) {
      js = js.replace(
        /CONFIG=\{version:\(globalThis\.APP_VERSION\|\|"[^"]*"\)\+" 베타"/,
        `CONFIG={version:(globalThis.APP_VERSION||"${version}")+" 베타"`,
      );
    } else if (/CONFIG=\{version:"[^"]*"/.test(js)) {
      js = js.replace(
        /CONFIG=\{version:"[^"]*"/,
        `CONFIG={version:(globalThis.APP_VERSION||"${version}")+" 베타"`,
      );
    }

    if (js !== before) {
      fs.writeFileSync(file, js);
      changed++;
    }
  }
  return changed;
}

function writeVersionFiles(version) {
  const publicDir = path.join(root, "public");
  fs.writeFileSync(
    path.join(publicDir, "version.json"),
    JSON.stringify({ version, label: `${version} beta` }, null, 2) + "\n",
  );
}

const pkg = readPkg();
const prev = pkg.version;
const version = mode === "bump" ? bumpPatch(prev) : prev;

if (mode === "bump") {
  pkg.version = version;
  writePkg(pkg);
}

writeVersionFiles(version);
const htmlN = syncHtml(version);
const jsN = syncBundles(version);

console.log(
  mode === "bump"
    ? `version ${prev} → ${version} (html ${htmlN}, bundles ${jsN})`
    : `synced version ${version} (html ${htmlN}, bundles ${jsN})`,
);
