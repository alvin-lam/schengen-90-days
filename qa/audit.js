/*
 * Static audit: checks the files in docs/ against each other and against the
 * rules in README.md, without a browser. No dependencies.
 *
 *   node qa/audit.js           print findings, exit 1 on any error
 *   node qa/audit.js --json    machine-readable findings (used by run.js)
 *
 * Each finding is an "error" (a bug or a broken rule) or a "warn" (worth a look).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(DOCS, p));

const findings = [];
const error = (check, msg) => findings.push({ level: "error", check, msg });
const warn = (check, msg) => findings.push({ level: "warn", check, msg });

const index = read("docs/index.html");
const privacy = read("docs/privacy.html");
const sw = read("docs/sw.js");
const readme = read("README.md");
const manifest = JSON.parse(read("docs/manifest.webmanifest"));
const sitemap = read("docs/sitemap.xml");
const K = require(path.join(DOCS, "js", "countries.js"));
const JS_FILES = fs.readdirSync(path.join(DOCS, "js")).map((f) => "js/" + f);

const PAGES = { "index.html": index, "privacy.html": privacy };

/* ---------- 1. Local references point at real files ---------- */

function localRefs(html) {
  const refs = [];
  const re = /\s(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|#|data:|blob:)/.test(url)) continue;
    refs.push(url.split("#")[0].split("?")[0]);
  }
  return refs.filter(Boolean);
}

const pageAssets = new Set();
for (const [name, html] of Object.entries(PAGES)) {
  for (const ref of localRefs(html)) {
    const file = ref === "./" ? "index.html" : ref;
    if (!exists(file)) error("missing-file", `${name} links to ${ref}, which does not exist in docs/`);
    else pageAssets.add(file);
  }
}
for (const icon of manifest.icons) {
  if (!exists(icon.src)) error("missing-file", `manifest icon ${icon.src} does not exist`);
}

/* ---------- 2. Service worker cache list ---------- */

const shell = JSON.parse(sw.match(/var SHELL = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));
for (const f of shell) {
  if (f !== "./" && !exists(f)) error("sw-shell", `sw.js SHELL lists ${f}, which does not exist (install would fail offline)`);
}
for (const f of pageAssets) {
  if (!shell.includes(f) && f !== "index.html") {
    const level = /\.(js|css|woff2)$/.test(f) ? error : warn;
    level("sw-shell", `${f} is used by a page but missing from the sw.js SHELL list, so it will not be there offline until visited online`);
  }
}
for (const f of JS_FILES) {
  if (!shell.includes(f)) error("sw-shell", `${f} is not in the sw.js SHELL list`);
}

// Cache version: if any cached file changed since prod, CACHE must change too.
try {
  const base = process.env.QC_BASE || "origin/prod";
  execFileSync("git", ["rev-parse", "--verify", base], { cwd: ROOT, stdio: "ignore" });
  const changed = execFileSync("git", ["diff", "--name-only", base, "--", "docs"], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean).map((f) => f.replace(/^docs\//, ""));
  const cachedChanged = changed.filter((f) => shell.includes(f) || f === "index.html");
  const baseSw = execFileSync("git", ["show", base + ":docs/sw.js"], { cwd: ROOT, encoding: "utf8" });
  const ver = (s) => (s.match(/var CACHE = "([^"]+)"/) || [])[1];
  if (cachedChanged.length && ver(baseSw) === ver(sw)) {
    error("sw-version", `cached files changed since ${base} (${cachedChanged.join(", ")}) but CACHE is still "${ver(sw)}". Raise the version in docs/sw.js`);
  }
} catch (e) {
  warn("sw-version", "could not compare with origin/prod (no git history?), so the CACHE version check was skipped");
}

/* ---------- 3. Security rules from the README ---------- */

const csp = (html) => (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
const cspIndex = csp(index), cspPrivacy = csp(privacy);
if (!cspIndex || !cspPrivacy) error("csp", "a page is missing its Content-Security-Policy meta tag");
else if (cspIndex !== cspPrivacy) error("csp", "the CSP in index.html and privacy.html differ");
const cfHeader = (readme.match(/`Content-Security-Policy: ([^`]+)`/) || [])[1];
if (cspIndex && cfHeader) {
  const dirs = (s) => s.split(";").map((d) => d.trim()).filter(Boolean);
  const header = dirs(cfHeader);
  for (const d of dirs(cspIndex)) {
    if (!header.includes(d)) error("csp", `README Cloudflare CSP is missing or differs on "${d}"`);
  }
}

const SINKS = [
  [/\.innerHTML\s*=/, "innerHTML"], [/\.outerHTML\s*=/, "outerHTML"], [/insertAdjacentHTML/, "insertAdjacentHTML"],
  [/document\.write/, "document.write"], [/\beval\s*\(/, "eval"], [/new Function\s*\(/, "new Function"],
  [/setTimeout\(\s*["'`]/, "setTimeout with a string"], [/setInterval\(\s*["'`]/, "setInterval with a string"],
  [/\.setAttribute\(\s*["']on/, "inline event handler"], [/DOMParser/, "DOMParser"]
];
for (const f of JS_FILES.concat(["sw.js"])) {
  const src = fs.readFileSync(path.join(DOCS, f), "utf8");
  for (const [re, name] of SINKS) if (re.test(src)) error("trusted-types", `${f} uses ${name}, which the README forbids`);
  const policies = src.match(/createPolicy\(\s*"([^"]+)"/g) || [];
  for (const p of policies) if (!p.includes('"schengen-sw"')) error("trusted-types", `${f} creates an unexpected Trusted Types policy: ${p}`);
}
for (const [name, html] of Object.entries(PAGES)) {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((m) => !/application\/ld\+json/.test(m[1]));
  if (inline.length) error("csp", `${name} has an inline <script>, which the CSP blocks`);
  if (/<style[\s>]/.test(html)) error("csp", `${name} has an inline <style> block, which the CSP blocks`);
  if (/\sstyle="/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, ""))) error("csp", `${name} has a style="" attribute, which the CSP blocks`);
  if (/\son[a-z]+="/.test(html)) error("csp", `${name} has an inline on* event handler`);
  for (const m of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(m[0])) error("links", `${name}: target=_blank link without rel=noopener: ${m[0].slice(0, 90)}`);
  }
}

/* ---------- 4. Page structure ---------- */

const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) error("html", `duplicate ids in index.html: ${[...new Set(dupes)].join(", ")}`);
for (const f of JS_FILES) {
  const src = fs.readFileSync(path.join(DOCS, f), "utf8");
  for (const m of src.matchAll(/getElementById\("([^"]+)"\)/g)) {
    if (!ids.includes(m[1])) error("html", `${f} looks up #${m[1]}, which is not in index.html`);
  }
}
for (const m of index.matchAll(/aria-(?:labelledby|controls|describedby)="([^"]+)"/g)) {
  for (const id of m[1].split(/\s+/)) if (!ids.includes(id)) error("a11y", `aria reference to #${id}, which does not exist`);
}
for (const [name, html] of Object.entries(PAGES)) {
  for (const m of html.matchAll(/<img\s[^>]*>/g)) if (!/\salt="/.test(m[0])) error("a11y", `${name}: <img> without alt: ${m[0].slice(0, 80)}`);
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
  if (!title) error("seo", `${name} has no <title>`);
  else if (title.length > 60) warn("seo", `${name} title is ${title.length} characters (README asks for under about 60)`);
  if (!/<html lang="/.test(html)) error("a11y", `${name} has no lang attribute`);
}

/* ---------- 5. Map and country list ---------- */

const mapCodes = new Set([...index.matchAll(/data-country="([A-Z]{2})"/g)].map((m) => m[1]));
for (const c of K.COUNTRIES) if (!mapCodes.has(c.code)) error("map", `${c.name} (${c.code}) has no shape on the map`);
for (const code of mapCodes) if (!K.byCode(code)) error("map", `the map has a shape for ${code}, which is not in countries.js`);
const claimed = (readme.match(/all (\d+) Schengen countries/) || [])[1];
if (claimed && Number(claimed) !== K.COUNTRIES.length) error("docs", `README says ${claimed} countries but countries.js has ${K.COUNTRIES.length}`);
const pageCount = (index.match(/The Schengen Area has (\d+) member countries/) || [])[1];
if (pageCount && Number(pageCount) !== K.COUNTRIES.length) error("docs", `footer says ${pageCount} members but countries.js has ${K.COUNTRIES.length}`);
const ldCount = (index.match(/Covers all (\d+) Schengen countries/) || [])[1];
if (ldCount && Number(ldCount) !== K.COUNTRIES.length) error("seo", `structured data says ${ldCount} countries but countries.js has ${K.COUNTRIES.length}`);

/* ---------- 6. Search engine data ---------- */

const lastmod = {};
for (const m of sitemap.matchAll(/<loc>https:\/\/[^/]+\/([^<]*)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) lastmod[m[1] || "index.html"] = m[2];
for (const [name, html] of Object.entries(PAGES)) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) warn("seo", `${name} has no structured data`);
  for (const b of blocks) {
    try {
      JSON.parse(b[1]);
    } catch (e) {
      error("seo", `${name} structured data is not valid JSON: ${e.message}`);
    }
  }
  const mod = (html.match(/"dateModified":\s*"([^"]+)"/) || [])[1];
  if (!lastmod[name]) error("seo", `${name} is not in sitemap.xml`);
  else if (mod && mod !== lastmod[name]) warn("seo", `${name} dateModified ${mod} differs from sitemap lastmod ${lastmod[name]}`);
}

function pngSize(file) {
  const b = fs.readFileSync(path.join(DOCS, file));
  return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}
const og = pngSize("icons/og-image.png");
if (!og || og[0] !== 1200 || og[1] !== 630) error("seo", `og-image.png should be 1200x630, found ${og && og.join("x")}`);
for (const icon of manifest.icons) {
  const size = pngSize(icon.src);
  if (size && size.join("x") !== icon.sizes) error("manifest", `${icon.src} is ${size.join("x")} but the manifest says ${icon.sizes}`);
}
for (const m of index.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g)) {
  const href = (m[0].match(/href="([^"]+)"/) || [])[1];
  const sizes = (m[0].match(/sizes="([^"]+)"/) || [])[1];
  if (href && href.endsWith(".png") && sizes && exists(href)) {
    const s = pngSize(href);
    if (s && s.join("x") !== sizes) error("icons", `${href} is ${s.join("x")} but the page says ${sizes}`);
  }
}
const themeMeta = (index.match(/name="theme-color" content="([^"]+)"/) || [])[1];
const schemeDefault = (read("docs/js/scheme.js").match(/DEFAULT_THEME_COLOR = "([^"]+)"/) || [])[1];
if (themeMeta !== manifest.theme_color || themeMeta !== schemeDefault) {
  error("theme", `theme colors disagree: index.html ${themeMeta}, manifest ${manifest.theme_color}, scheme.js ${schemeDefault}`);
}

/* ---------- 7. Staleness ---------- */

const checked = (index.match(/Rules last checked: ([A-Z][a-z]+ \d{4})/) || [])[1];
if (checked) {
  const months = (Date.now() - new Date(checked + " 1").getTime()) / (30.44 * 864e5);
  if (months > 4) warn("rules", `"Rules last checked: ${checked}" is ${Math.floor(months)} months old. The README asks for a review every few months`);
}

/* ---------- Report ---------- */

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(findings, null, 2) + "\n");
} else {
  const errors = findings.filter((f) => f.level === "error");
  for (const f of findings) console.log(`${f.level === "error" ? "ERROR" : "warn "} [${f.check}] ${f.msg}`);
  console.log(`\nStatic audit: ${errors.length} error(s), ${findings.length - errors.length} warning(s).`);
}
process.exitCode = findings.some((f) => f.level === "error") ? 1 : 0;
