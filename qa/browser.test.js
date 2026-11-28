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

test("a trip missing a departure or entry date says so", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-05-01", "2026-05-10"]]) });
  await setCheckDate(page, "2026-05-31");
  const trip = page.locator("#trip-list > li").first();
  await trip.locator(".trip-exit").fill("");
  assert.ok(await trip.locator(".trip-error").isVisible());
  assert.match(await trip.locator(".trip-error").textContent(), /Add a departure date/);
  await trip.locator(".trip-exit").fill("2026-05-10");
  assert.ok(await trip.locator(".trip-error").isHidden());
  assert.equal(await totalDays(page), "10");
});

test("the default check date moves to the new day at midnight", async (t) => {
  const context = await browser.newContext({ timezoneId: "Europe/Berlin" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-03-31T23:59:00+02:00") });
  await page.addInitScript(() => localStorage.setItem("schengen-90-180-trips",
    JSON.stringify({ version: 2, trips: [{ id: "a", country: "DE", entry: "2026-01-01", exit: "2026-04-30" }] })));
  await page.goto(base);
  assert.equal(await page.inputValue("#reference-date"), "2026-03-31");
  assert.equal(await totalDays(page), "90");
  await page.clock.fastForward("02:00");
  assert.equal(await page.inputValue("#reference-date"), "2026-04-01");
  assert.equal(await totalDays(page), "91");
  assert.ok(await page.isVisible("#lawyer-warning"));
  // A date the visitor picked stays put.
  await setCheckDate(page, "2026-02-01");
  await page.clock.fastForward("24:00:00");
  assert.equal(await page.inputValue("#reference-date"), "2026-02-01");
  await context.close();
  assert.deepEqual(errors, []);
});

test("a check date year below 100 does not break the page or Export", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-03-01", "2026-03-10"]]) });
  await setCheckDate(page, "0099-01-05");
  assert.doesNotMatch(await page.textContent("#window-range"), /Invalid/);
  const csv = await download(page, "#export-download", "csv");
  assert.match(csv.name, /^schengen-trips-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("typing an entry date on the keyboard fills the departure with the finished date", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-11-28");
  await page.click("#add-trip");
  const trip = page.locator("#trip-list > li").last();
  await trip.locator(".trip-country").selectOption("DE");
  await trip.locator(".trip-entry").click();
  await page.keyboard.type("11012026");
  await trip.locator(".trip-entry").blur();
  assert.equal(await trip.locator(".trip-entry").inputValue(), "2026-11-01");
  assert.equal(await trip.locator(".trip-exit").inputValue(), "2026-11-01", "never year 0002");
  assert.equal(await totalDays(page), "1");
});

test("a trip date with an impossible year says so", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-11-28");
  const trip = await addTrip(page, "FR", "0026-11-01", "2026-11-10");
  assert.ok(await trip.locator(".trip-error").isVisible());
  assert.match(await trip.locator(".trip-error").textContent(), /entry date can't be used/);
});

test("an impossible check date says it counts to today", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-03-01", "2026-03-10"]]) });
  await setCheckDate(page, "0099-06-30");
  assert.ok(await page.isVisible("#check-date-error"));
  await setCheckDate(page, "2026-06-30");
  assert.ok(await page.isHidden("#check-date-error"));
});

test("a check date being typed is never overwritten by today", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-02-01");
  await page.locator("#reference-date").click();
  await page.keyboard.press("Backspace"); // clears one part, so the value is empty while typing
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(await page.inputValue("#reference-date"), "");
});

test("Still in the Schengen Area counts through the check date and follows today", async (t) => {
  const context = await browser.newContext({ timezoneId: "Europe/Berlin" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-06-30T23:59:00+02:00") });
  await page.goto(base);
  const trip = await addTrip(page, "IT", "2026-06-01");
  assert.equal(await trip.locator(".trip-exit").inputValue(), "2026-06-01");
  await trip.locator(".trip-still").check();
  assert.ok(await trip.locator(".trip-exit").isDisabled());
  assert.equal(await trip.locator(".trip-exit").inputValue(), "");
  assert.ok(await trip.locator(".trip-error").isHidden(), "no 'add a departure date' message");
  assert.equal(await totalDays(page), "30");
  await page.clock.fastForward("02:00");
  assert.equal(await totalDays(page), "31", "the count grows when the day changes");
  await page.reload();
  assert.ok(await page.locator(".trip-still").isChecked(), "the choice is saved");
  await page.locator(".trip-still").uncheck();
  assert.ok(await page.locator(".trip-exit").isEnabled());
  assert.equal(await page.locator(".trip-exit").inputValue(), "2026-06-01", "unticking brings the departure date back");
  assert.ok(await page.locator(".trip-error").isHidden());
  await context.close();
  assert.deepEqual(errors, []);
});

test("a current stay that starts after the check date says so", async (t) => {
  const { page } = await open(t);
  await setCheckDate(page, "2026-11-28");
  const trip = await addTrip(page, "IT", "2026-12-20");
  await trip.locator(".trip-still").check();
  assert.match(await trip.locator(".trip-error").textContent(), /starts after the check date/);
  await setCheckDate(page, "2026-12-31");
  assert.ok(await trip.locator(".trip-error").isHidden());
  assert.equal(await totalDays(page), "12");
});

test("the checkbox follows the departure date in Tab order and names its trip", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-02"], ["IT", "2026-02-01", "2026-02-02"]]) });
  // Tab follows the order of focusable controls in the row. (Chrome's Tab
  // also steps through a date field's month, day, and year first.)
  const order = await page.locator("#trip-list > li").first().evaluate((li) =>
    [...li.querySelectorAll("select, input, button")].map((el) => el.className.split(" ").pop()));
  assert.deepEqual(order, ["trip-country", "trip-entry", "trip-exit", "trip-still", "btn-remove"]);
  // On wide screens the checkbox sits below the dates, not after Remove.
  await page.setViewportSize({ width: 1280, height: 900 });
  const box = await page.evaluate(() => {
    const li = document.querySelector("#trip-list > li");
    const r = (s) => li.querySelector(s).getBoundingClientRect();
    return { still: r(".trip-still").top, exit: r(".trip-exit").bottom, remove: r(".btn-remove").top, exitTop: r(".trip-exit").top };
  });
  assert.ok(box.still > box.exit, "checkbox below the dates");
  assert.ok(Math.abs(box.remove - box.exitTop) < 30, "Remove stays on the dates row");
  const names = await page.locator(".trip-still").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
  assert.match(names[1], /trip 2, Italy/);
  assert.equal(new Set(names).size, 2);
  assert.equal(await page.getAttribute("#trip-limit", "aria-live"), "polite");
});

test("share text calls a future check date a plan", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-03-01", "2026-03-10"]]) });
  await setCheckDate(page, "2099-12-31");
  await page.click("#share-map");
  const href = await page.locator('#share-menu [data-format="x"]').getAttribute("href");
  assert.match(decodeURIComponent(href), /My Schengen plan: 1 country, 0 of 90 days by /);
  assert.doesNotMatch(decodeURIComponent(href), /used/);
});

test("Add trip stops at 1,000 trips and says why", async (t) => {
  const many = [];
  for (let i = 0; i < 1000; i++) many.push(["AT", "2026-01-01", "2026-01-01"]);
  const { page } = await open(t, { saved: v2(many) });
  assert.ok(await page.isDisabled("#add-trip"));
  assert.ok(await page.isVisible("#trip-limit"));
  await page.locator(".btn-remove").first().click();
  assert.ok(await page.isEnabled("#add-trip"));
  assert.ok(await page.isHidden("#trip-limit"));
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
  assert.equal(stored.version, 3);
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

test("Remove buttons have names that tell trips apart", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"], ["FR", "2026-02-01", "2026-02-01"], ["", "", ""]]) });
  const names = await page.locator(".btn-remove").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
  assert.deepEqual(names, ["Remove trip 1, Germany", "Remove trip 2, France", "Remove trip 3"]);
});

test("Remove on the last trip moves focus to Add trip", async (t) => {
  const { page } = await open(t, { saved: v2([["DE", "2026-01-01", "2026-01-01"]]) });
  await page.click(".btn-remove");
  assert.equal(await page.evaluate(() => document.activeElement.id), "add-trip");
});

test("two open tabs keep each other's trips", async (t) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto(base);
  await b.goto(base);
  await addTrip(a, "DE", "2026-01-01", "2026-01-02");
  await b.waitForFunction(() => document.querySelectorAll("#trip-list > li").length === 1);
  await addTrip(b, "FR", "2026-02-01", "2026-02-02");
  await a.waitForFunction(() => document.querySelectorAll("#trip-list > li").length === 2);
  await a.reload();
  const codes = await a.locator(".trip-country").evaluateAll((els) => els.map((e) => e.value));
  await context.close();
  assert.deepEqual(codes, ["DE", "FR"]);
});

test("another tab's save waits while a date is being typed, and nothing is lost", async (t) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto(base);
  await b.goto(base);
  await setCheckDate(a, "2026-11-28");
  await a.click("#add-trip");
  const row = a.locator("#trip-list > li").last();
  await row.locator(".trip-country").selectOption("IT");
  await row.locator(".trip-entry").click();
  await a.keyboard.type("1110"); // month and day, year still to come
  await addTrip(b, "FR", "2026-02-01", "2026-02-02");
  await a.waitForTimeout(200);
  await a.keyboard.type("2026");
  await row.locator(".trip-entry").blur();
  await a.waitForFunction(() => document.querySelectorAll("#trip-list > li").length === 2);
  const stored = JSON.parse(await a.evaluate(() => localStorage.getItem("schengen-90-180-trips")));
  await context.close();
  const it = stored.trips.find((x) => x.country === "IT");
  assert.equal(it.entry, "2026-11-10", "the half-typed date is kept");
  assert.ok(stored.trips.some((x) => x.country === "FR"), "the other tab's trip is kept");
});

test("another tab's save never moves typing in a date that is valid mid-edit", async (t) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  await a.addInitScript(() => { if (!sessionStorage.getItem("s")) { localStorage.setItem("schengen-90-180-trips", JSON.stringify({ version: 3, trips: [{ id: "a", country: "DE", entry: "2026-11-01", exit: "2026-11-03", ongoing: false }] })); sessionStorage.setItem("s", "1"); } });
  await a.goto(base);
  await b.goto(base);
  const entry = a.locator(".trip-entry").first();
  await entry.click({ position: { x: 12, y: 10 } }); // the month part
  await a.keyboard.type("10"); // now 2026-10-01, a valid date
  await addTrip(b, "FR", "2026-02-01", "2026-02-02");
  await a.waitForFunction(() => document.querySelectorAll("#trip-list > li").length === 2);
  await a.keyboard.type("15"); // the day part
  await entry.blur();
  const value = await entry.inputValue();
  await context.close();
  assert.equal(value, "2026-10-15");
});

test("Clear all resets when another tab changes the trips", async (t) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  const b = await context.newPage();
  await a.addInitScript(() => { if (!sessionStorage.getItem("s")) { localStorage.setItem("schengen-90-180-trips", JSON.stringify({ version: 2, trips: [{ id: "a", country: "DE", entry: "2026-01-01", exit: "2026-01-01" }] })); sessionStorage.setItem("s", "1"); } });
  await a.goto(base);
  await b.goto(base);
  await a.click("#clear-all");
  await b.click("#clear-all");
  await b.click("#clear-all");
  await a.waitForFunction(() => document.querySelectorAll("#trip-list > li").length === 0);
  const label = (await a.textContent("#clear-all")).trim();
  await context.close();
  assert.equal(label, "Clear all trips");
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
  assert.match(csv.body.toString("utf8"), /Belgium,België \/ Belgique \/ Belgien,2026-03-01,2026-03-10,No,10,10/);
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
  // Match on the parsed host, not a substring of the whole address.
  const x = hrefs.find((h) => new URL(h).hostname === "twitter.com");
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

test("white button text passes 4.5:1 in every color scheme, in light and dark", async (t) => {
  const { page } = await open(t, { colorScheme: "dark" });
  const failing = await page.evaluate(() => {
    function lum(rgb) {
      return rgb.match(/\d+/g).slice(0, 3).map(Number).map((c) => c / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
        .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
    }
    const out = [];
    const btn = document.getElementById("add-trip");
    for (const mode of ["light", "dark"]) {
      window.SchengenTheme.set(mode);
      for (const s of window.SchengenScheme.SCHEMES) {
        window.SchengenScheme.choose(s.id);
        const cs = getComputedStyle(btn);
        const ratio = (lum(cs.color) + 0.05) / (lum(cs.backgroundColor) + 0.05);
        if (ratio < 4.5) out.push(mode + " " + s.id + " " + ratio.toFixed(2));
      }
    }
    return out;
  });
  assert.deepEqual(failing, []);
});

test("Appearance choices stay checked when storage is blocked", async (t) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  await page.goto(base);
  await page.click("#appearance-button");
  await page.check('input[name="mode"][value="dark"]');
  await page.locator('input[name="scheme"][value="IT"]').check({ force: true });
  const mode = await page.locator('input[name="mode"]:checked').getAttribute("value");
  const scheme = await page.locator('input[name="scheme"]:checked').getAttribute("value");
  await context.close();
  assert.deepEqual([mode, scheme], ["dark", "IT"]);
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
  assert.equal((await page.textContent("h1")).trim(), "Privacy");
  await context.setOffline(false);
});
