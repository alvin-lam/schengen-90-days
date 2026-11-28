/*
 * Browser tests: drive the real page in headless Chromium.
 * Run: node --test qa/browser.test.js
 * Needs Playwright (npm install in qa/, then npx playwright install chromium).
 *
 * Every test fails on any console error, uncaught exception, CSP or Trusted
 * Types violation, or failed same-origin request, so a silent breakage in a
 * part of the page the test is not looking at still gets caught.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DOCS = path.join(__dirname, "..", "docs");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
  ".xml": "application/xml", ".txt": "text/plain"
};

let server, base, browser;

test.before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(DOCS, path.normalize(p));
    if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  // "localhost" (not 127.0.0.1) so the page is a secure context and the service worker runs.
  base = "http://localhost:" + server.address().port + "/";
  browser = await chromium.launch();
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

/** A fresh page that records every problem the browser reports. */
async function open(t, options = {}) {
  const { url = base, saved, ...contextOptions } = options;
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, ...contextOptions });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });
  page.on("pageerror", (e) => problems.push("exception: " + e.message));
  page.on("requestfailed", (r) => { if (r.url().startsWith(base)) problems.push("request failed: " + r.url()); });
  page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(r.status() + ": " + r.url()); });
  if (saved !== undefined) {
    await page.addInitScript((data) => {
      if (!sessionStorage.getItem("qc-seeded")) {
        localStorage.setItem("schengen-90-180-trips", data);
        sessionStorage.setItem("qc-seeded", "1");
      }
    }, typeof saved === "string" ? saved : JSON.stringify(saved));
  }
  await page.goto(url);
  t.after(async () => {
    await context.close();
    assert.deepEqual(problems, [], "the browser reported problems");
  });
  return { page, context, problems };
}

async function addTrip(page, country, entry, exit) {
  await page.click("#add-trip");
  const trip = page.locator("#trip-list > li").last();
  if (country) await trip.locator(".trip-country").selectOption(country);
  if (entry) await trip.locator(".trip-entry").fill(entry);
  if (exit) await trip.locator(".trip-exit").fill(exit);
  return trip;
}
const setCheckDate = (page, iso) => page.fill("#reference-date", iso);
const totalDays = async (page) => (await page.textContent("#total-days")).trim();
const v2 = (trips) => ({ version: 2, trips: trips.map((t, i) => ({ id: "t" + i, country: t[0], entry: t[1], exit: t[2] })) });

/* ---------- Loading ---------- */

test("page loads cleanly with the empty state", async (t) => {
  const { page } = await open(t);
  assert.equal(await totalDays(page), "0");
  assert.ok(await page.isVisible("#empty-state"));
  assert.ok(await page.isDisabled("#export-download"));
  assert.ok(await page.isHidden("#lawyer-warning"));
  assert.equal(await page.locator("#europe-map .map-country").count() >= 29, true);
});

test("privacy page loads cleanly and links back", async (t) => {
  const { page } = await open(t, { url: base + "privacy.html" });
  await page.click(".privacy-back-top a");
  await page.waitForSelector("#add-trip");
});

test("the check date defaults to today in the device's time zone", async (t) => {
  for (const timezoneId of ["Pacific/Kiritimati", "Pacific/Pago_Pago", "Europe/Berlin"]) {
    const { page } = await open(t, { timezoneId });
    const [shown, local] = await page.evaluate(() => {
      const d = new Date();
      return [document.getElementById("reference-date").value,
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")];
    });
    assert.equal(shown, local, timezoneId);
  }
});

/* ---------- Counting ---------- */

test("adding trips updates the total, status, meter, and map", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-06-30");
  await addTrip(page, "DE", "2026-03-01", "2026-03-10");
  assert.equal(await totalDays(page), "10");
  await addTrip(page, "FR", "2026-03-05", "2026-03-15");
  assert.equal(await totalDays(page), "15", "overlap is counted once");
  assert.equal(await page.getAttribute("#meter", "aria-valuenow"), "15");
  assert.ok(await page.locator('#europe-map [data-country="DE"].visited').count());
  assert.ok(await page.locator('#europe-map [data-country="FR"].visited').count());
  assert.match(await page.textContent("#map-summary"), /France, Germany/);
  assert.match(await page.getAttribute("#summary", "class"), /status-green/);
  assert.ok(await page.isEnabled("#export-download"));
});

test("status levels change at 46, 61, and 91 days", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-06-30");
  const trip = await addTrip(page, "IT", "2026-05-01", "2026-05-01");
  // Entry 2026-05-01, check date 2026-06-30: exit dates give 45/46, 60/61, 90/91.
  for (const [exit, days, status] of [["2026-06-14", "45", "green"], ["2026-06-15", "46", "yellow"], ["2026-06-29", "60", "yellow"], ["2026-06-30", "61", "red"]]) {
    await trip.locator(".trip-exit").fill(exit);
    assert.equal(await totalDays(page), days);
    assert.match(await page.getAttribute("#summary", "class"), new RegExp("status-" + status));
  }
  await trip.locator(".trip-entry").fill("2026-02-01");
  await trip.locator(".trip-exit").fill("2026-05-01");
  assert.equal(await totalDays(page), "90");
  assert.ok(await page.isHidden("#lawyer-warning"));
  await trip.locator(".trip-exit").fill("2026-05-02");
  assert.equal(await totalDays(page), "91");
  assert.match(await page.getAttribute("#summary", "class"), /status-black/);
  assert.ok(await page.isVisible("#lawyer-warning"));
  assert.match(await page.textContent("#remaining-text"), /Exceeded by 1 day\./);
});

test("a departure before entry is flagged and counts zero", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-06-30");
  const trip = await addTrip(page, "ES", "2026-03-10", "2026-03-01");
  assert.ok(await trip.locator(".trip-error").isVisible());
  assert.equal(await totalDays(page), "0");
});

test("picking an entry date fills an empty departure date", async (t) => {
  const { page } = await open(t);
  const trip = await addTrip(page, "PT", "2026-04-04");
  assert.equal(await trip.locator(".trip-exit").inputValue(), "2026-04-04");
});

/* ---------- Saved data ---------- */

test("trips survive a reload", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-06-30");
  await addTrip(page, "NL", "2026-06-01", "2026-06-05");
  await page.reload();
  assert.equal(await page.locator("#trip-list > li").count(), 1);
  assert.equal(await page.locator(".trip-country").inputValue(), "NL");
});

test("version 1 saves are upgraded", async (t) => {
  const { page } = await open(t, { saved: [{ country: "Germany", entry: "2026-01-01", exit: "2026-01-02" }, { country: "Narnia", entry: "2026-01-01", exit: "2026-01-02" }] });
  assert.equal(await page.locator(".trip-country").nth(0).inputValue(), "DE");
  assert.equal(await page.locator(".trip-country").nth(1).inputValue(), "");
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem("schengen-90-180-trips")));
  assert.equal(stored.version, 2);
  assert.equal(stored.trips[0].country, "DE");
});

test("corrupt or hostile saved data never breaks the page", async (t) => {
  for (const saved of ["{not json", "null", "42", '{"trips":"x"}', JSON.stringify([{ country: "__proto__", entry: 1 }, { country: "constructor", entry: "2026-01-01", exit: "2026-01-02" }])]) {
    const { page } = await open(t, { saved });
    await page.click("#add-trip");
    assert.ok((await page.locator("#trip-list > li").count()) >= 1, saved);
    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem("schengen-90-180-trips")));
    for (const trip of stored.trips) assert.equal(typeof trip.country, "string", "country must stay a string for " + saved);
  }
});

test("works when storage is blocked", async (t) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  await page.goto(base);
  await page.click("#add-trip");
  assert.equal(await page.locator("#trip-list > li").count(), 1);
  await context.close();
  assert.deepEqual(errors, []);
});

/* ---------- Removing ---------- */

test("Remove deletes the right trip and keeps focus on the page", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"], ["FR", "2026-02-01", "2026-02-01"], ["IT", "2026-03-01", "2026-03-01"]]) });
  await page.locator(".btn-remove").nth(1).click();
  const left = await page.locator(".trip-country").evaluateAll((els) => els.map((e) => e.value));
  assert.deepEqual(left, ["DE", "IT"]);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  assert.notEqual(focused, "BODY", "keyboard and screen reader users lose their place when focus drops to <body> after Remove");
});

test("Clear all needs a second click and resets after 4 seconds", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"]]) });
  await page.click("#clear-all");
  assert.equal(await page.locator("#trip-list > li").count(), 1);
  await page.waitForTimeout(4300);
  assert.equal((await page.textContent("#clear-all")).trim(), "Clear all trips");
  await page.click("#clear-all");
  await page.click("#clear-all");
  assert.equal(await page.locator("#trip-list > li").count(), 0);
  assert.ok(await page.isVisible("#empty-state"));
});

/* ---------- Export ---------- */

async function download(page, button, format) {
  await page.click(button);
  const menu = button.replace("-download", "-menu");
  const [file] = await Promise.all([page.waitForEvent("download"), page.click(`${menu} [data-format="${format}"]`)]);
  const p = await file.path();
  return { name: file.suggestedFilename(), body: fs.readFileSync(p) };
}

test("CSV, JSON, and TXT exports download with the right content", async (t) => {
  const { page } = await open(t, { saved: v2([["BE", "2026-03-01", "2026-03-10"]]) });
  await setCheckDate(page, "2026-06-30");
  const csv = await download(page, "#export-download", "csv");
  assert.equal(csv.name, "schengen-trips-2026-06-30.csv");
  assert.equal(csv.body.slice(0, 3).toString("hex"), "efbbbf", "CSV starts with a UTF-8 byte order mark for Excel");
  assert.match(csv.body.toString("utf8"), /Belgium,België \/ Belgique \/ Belgien,2026-03-01,2026-03-10,10,10/);
  const json = JSON.parse((await download(page, "#export-download", "json")).body.toString("utf8"));
  assert.equal(json.totalDays, 10);
  assert.equal(json.checkDate, "2026-06-30");
  const txt = (await download(page, "#export-download", "txt")).body.toString("utf8");
  assert.match(txt, /Belgium \(België/);
  assert.ok(await page.isVisible("#export-status"));
});

test("map downloads as SVG, PNG, and JPG", async (t) => {
  const { page } = await open(t, { saved: v2([["SE", "2026-03-01", "2026-03-10"]]) });
  await page.click("#map-download");
  const [svgFile] = await Promise.all([page.waitForEvent("download"), page.click('#map-menu [data-format="svg"]')]);
  const svg = fs.readFileSync(await svgFile.path(), "utf8");
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /All Trips Considered/);
  assert.match(svg, /@font-face/, "the SVG embeds its font");
  assert.doesNotMatch(svg, /https?:\/\/(?!www\.w3\.org)/, "the SVG makes no outside requests");
  for (const [format, magic] of [["png", "89504e47"], ["jpg", "ffd8ff"]]) {
    await page.click("#map-download");
    const [file] = await Promise.all([page.waitForEvent("download"), page.click(`#map-menu [data-format="${format}"]`)]);
    const body = fs.readFileSync(await file.path());
    assert.equal(body.slice(0, magic.length / 2).toString("hex"), magic, format);
    assert.ok(body.length > 20000, format + " is not blank");
  }
});

/* ---------- Menus and keyboard ---------- */

test("format menus work from the keyboard", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"]]) });
  await page.focus("#export-download");
  await page.keyboard.press("ArrowDown");
  assert.ok(await page.isVisible("#export-menu"));
  assert.equal(await page.evaluate(() => document.activeElement.dataset.format), "csv");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.format), "txt", "ArrowUp wraps to the last item");
  await page.keyboard.press("Escape");
  assert.ok(await page.isHidden("#export-menu"));
  assert.equal(await page.evaluate(() => document.activeElement.id), "export-download");
  assert.equal(await page.getAttribute("#export-download", "aria-expanded"), "false");
});

test("opening one menu closes another, and clicking outside closes it", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"]]) });
  await page.click("#map-download");
  await page.click("#export-download");
  assert.ok(await page.isHidden("#map-menu"));
  assert.ok(await page.isVisible("#export-menu"));
  await page.click("h1");
  assert.ok(await page.isHidden("#export-menu"));
});

test("the share menu has working links when the browser cannot share files", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-03-01", "2026-03-10"]]) });
  await setCheckDate(page, "2026-06-30");
  await page.click("#share-map");
  const hrefs = await page.locator("#share-menu a").evaluateAll((as) => as.map((a) => a.href));
  for (const h of hrefs) assert.match(h, /^https:\/\/[^#]+/, "share link " + h);
  const x = hrefs.find((h) => h.includes("twitter.com"));
  assert.match(decodeURIComponent(x), /1 country, 10 of 90 days/);
});

/* ---------- Appearance ---------- */

test("mode and color scheme apply and persist", async (t) => {
  const { page } = await open(t);
  await page.click("#appearance-button");
  await page.check('input[name="mode"][value="dark"]');
  assert.equal(await page.getAttribute("html", "data-theme"), "dark");
  await page.locator('input[name="scheme"][value="IT"]').check({ force: true });
  assert.equal(await page.getAttribute("html", "data-scheme"), "IT");
  assert.equal(await page.getAttribute('meta[name="theme-color"]', "content"), "#007A3D");
  await page.keyboard.press("Escape");
  assert.ok(await page.isHidden("#appearance-panel"));
  await page.reload();
  assert.equal(await page.getAttribute("html", "data-theme"), "dark");
  assert.equal(await page.getAttribute("html", "data-scheme"), "IT");
});

/* ---------- Layout ---------- */

test("no sideways scrolling on phones, tablets, or desktops, in light and dark", async (t) => {
  const saved = v2([["CH", "2026-01-01", "2026-01-31"], ["BE", "2026-02-01", "2026-02-10"], ["LI", "2026-03-01", "2026-03-02"]]);
  for (const colorScheme of ["light", "dark"]) {
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      const { page } = await open(t, { saved, colorScheme, viewport: { width, height: 800 } });
      const over = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width && r.right > W + 1 && getComputedStyle(el).position !== "fixed";
        }).map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : el.className ? "." + String(el.className).split(" ")[0] : ""));
        return { scroll: document.documentElement.scrollWidth - W, wide: wide.slice(0, 5) };
      });
      assert.ok(over.scroll <= 0, `${colorScheme} ${width}px scrolls sideways by ${over.scroll}px: ${over.wide.join(", ")}`);
    }
  }
});

test("every button and link has a name", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"]]) });
  const unnamed = await page.evaluate(() => [...document.querySelectorAll("button, a[href], select, input")]
    .filter((el) => el.offsetParent !== null || el.type === "radio")
    .filter((el) => {
      const label = el.getAttribute("aria-label") || el.textContent.trim() || el.title ||
        (el.labels && [...el.labels].map((l) => l.textContent.trim()).join("")) ||
        (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby")));
      return !label;
    }).map((el) => el.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, []);
});

test("200 trips render and recalculate quickly", async (t) => {
  const many = [];
  for (let i = 0; i < 200; i++) {
    const d = new Date(Date.UTC(2020, 0, 1) + i * 9 * 864e5).toISOString().slice(0, 10);
    many.push(["AT", d, d]);
  }
  const { page } = await open(t, { saved: v2(many) });
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    const input = document.getElementById("reference-date");
    input.value = "2024-12-31";
    input.dispatchEvent(new Event("change"));
    return performance.now() - t0;
  });
  assert.ok(ms < 250, `recalculating 200 trips took ${Math.round(ms)} ms`);
});

/* ---------- In-app browsers and offline ---------- */

test("in-app browsers explain downloads instead of failing silently", async (t) => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
  const { page } = await open(t, { userAgent, saved: v2([["DE", "2026-01-01", "2026-01-01"]]) });
  assert.ok(await page.locator(".download-note").first().isVisible());
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  await page.click("#export-download");
  await page.click('#export-menu [data-format="csv"]');
  assert.ok(await page.isVisible("#install-banner"));
  assert.match(await page.textContent("#install-hint"), /Safari or Chrome/);
  assert.equal(downloaded, false);
  await page.click("#install-dismiss");
  assert.ok(await page.isHidden("#install-banner"));
});

test("the installed app opens offline", async (t) => {
  const { page, context } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-05"]]) });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // let the worker control the page and cache what it loads
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#trip-list > li");
  assert.equal(await page.locator(".trip-country").inputValue(), "DE");
  const fontOk = await page.evaluate(() => document.fonts.load('46px "Instrument Serif"').then((f) => f.length > 0));
  assert.ok(fontOk, "the title font is available offline");
  await page.goto(base + "privacy.html");
  assert.match(await page.title(), /Privacy/i);
  await context.setOffline(false);
});
