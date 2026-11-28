/*
 * Logic tests for the pure modules: countries.js, calc.js, export.js.
 * Run: node --test qa/unit.test.js   (no dependencies)
 * run.js also repeats this file under several time zones, because day
 * counting must never depend on the device's zone or daylight saving.
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const JS = path.join(__dirname, "..", "docs", "js");
const K = require(path.join(JS, "countries.js"));
const C = require(path.join(JS, "calc.js"));
const X = require(path.join(JS, "export.js"));

const trip = (entry, exit, country = "DE") => ({ id: "t", country, entry, exit });
const total = (trips, ref) => C.daysInWindow(trips, ref).total;

/* ---------- Country list ---------- */

test("country list has 29 members with unique codes and names", () => {
  assert.equal(K.COUNTRIES.length, 29);
  assert.equal(new Set(K.COUNTRIES.map((c) => c.code)).size, 29);
  assert.equal(new Set(K.COUNTRIES.map((c) => c.name.toLowerCase())).size, 29);
});

test("every country has a valid code, flag, and hex colors", () => {
  const hex = /^#[0-9A-Fa-f]{6}$/;
  for (const c of K.COUNTRIES) {
    assert.match(c.code, /^[A-Z]{2}$/, c.name);
    assert.ok(c.native && c.name, c.code);
    // The flag emoji is built from the two regional indicator letters of the code.
    const expected = String.fromCodePoint(...[...c.code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
    assert.equal(c.flag, expected, c.code + " flag does not match its code");
    assert.match(c.colors.primary, hex, c.code);
    assert.match(c.colors.map, hex, c.code);
    assert.equal(c.colors.stripe.length, 3, c.code);
    c.colors.stripe.forEach((s) => assert.match(s, hex, c.code));
  }
});

test("non-members are not in the list", () => {
  for (const code of ["CY", "IE", "AD", "MC", "SM", "VA", "GB"]) assert.equal(K.byCode(code), null, code);
});

test("byName and byCode lookups", () => {
  assert.equal(K.byName("GERMANY").code, "DE");
  assert.equal(K.byName(undefined), null);
  assert.equal(K.byCode("de"), null, "codes are case sensitive");
  assert.equal(K.byCode("__proto__"), null, "prototype keys must not resolve to a country");
  assert.equal(K.byName("constructor"), null, "prototype keys must not resolve to a country");
});

/* ---------- Primary colors carry white text ---------- */

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("every scheme's primary color passes WCAG AA (4.5:1) with white button text", () => {
  const failing = K.COUNTRIES.filter((c) => contrast(c.colors.primary, "#FFFFFF") < 4.5)
    .map((c) => c.code + " " + c.colors.primary + " " + contrast(c.colors.primary, "#FFFFFF").toFixed(2));
  assert.deepEqual(failing, []);
});

/* ---------- Date parsing ---------- */

test("toDayNumber round trips and rejects bad dates", () => {
  assert.equal(C.toDayNumber("1970-01-01"), 0);
  assert.equal(C.toIsoDate(C.toDayNumber("2024-02-29")), "2024-02-29");
  for (const bad of ["2023-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "", "abc", "2026-1", null, undefined, "2026-01-01T00:00"]) {
    assert.ok(Number.isNaN(C.toDayNumber(bad)), "should reject " + bad);
  }
});

test("toDayNumber rejects two-digit years that Date.UTC would shift to 19xx", () => {
  assert.ok(Number.isNaN(C.toDayNumber("0099-05-01")));
});

test("toDayNumber accepts only the YYYY-MM-DD form a date field produces", () => {
  for (const bad of ["2026-5-1", "1e3-01-01", "0x7EA-05-01", " 2026-05-01", "2026-05-01 ", "+2026-05-01"]) {
    assert.ok(Number.isNaN(C.toDayNumber(bad)), "should reject " + JSON.stringify(bad));
  }
});

test("only years 1900 to 2999 count, so half-typed years never do", () => {
  for (const bad of ["0002-11-01", "0020-11-01", "0202-11-01", "1899-12-31", "3000-01-01", "9999-12-31"]) {
    assert.ok(!C.isUsableDate(bad), bad);
  }
  for (const ok of ["1900-01-01", "2026-11-01", "2999-12-31"]) assert.ok(C.isUsableDate(ok), ok);
});

test("todayIso is YYYY-MM-DD", () => {
  assert.match(C.todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});

/* ---------- Day counting ---------- */

test("entry and exit days both count", () => {
  assert.equal(total([trip("2026-06-01", "2026-06-01")], "2026-06-30"), 1);
  assert.equal(total([trip("2026-06-01", "2026-06-10")], "2026-06-30"), 10);
});

test("window is exactly 180 days ending on the check date", () => {
  const r = C.daysInWindow([], "2026-06-30");
  assert.equal(C.toDayNumber(r.windowEnd) - C.toDayNumber(r.windowStart) + 1, 180);
  assert.equal(r.windowEnd, "2026-06-30");
  assert.equal(r.windowStart, "2026-01-02");
  // A day on the window's first day counts; the day before does not.
  assert.equal(total([trip("2026-01-02", "2026-01-02")], "2026-06-30"), 1);
  assert.equal(total([trip("2026-01-01", "2026-01-01")], "2026-06-30"), 0);
});

test("trips after the check date do not count", () => {
  assert.equal(total([trip("2026-07-01", "2026-07-10")], "2026-06-30"), 0);
  assert.equal(total([trip("2026-06-25", "2026-07-10")], "2026-06-30"), 6);
});

test("overlapping and duplicate trips are counted once", () => {
  const t = [trip("2026-03-01", "2026-03-10"), trip("2026-03-05", "2026-03-15", "FR"), trip("2026-03-01", "2026-03-10", "IT")];
  const r = C.daysInWindow(t, "2026-06-30");
  assert.equal(r.total, 15);
  assert.deepEqual(r.perTrip, [10, 11, 10]);
});

test("same-day border crossing counts once", () => {
  assert.equal(total([trip("2026-03-01", "2026-03-10"), trip("2026-03-10", "2026-03-20", "AT")], "2026-06-30"), 20);
});

test("invalid and incomplete trips count zero and keep perTrip aligned", () => {
  const t = [trip("2026-03-10", "2026-03-01"), trip("", ""), trip("2026-03-01", ""), trip("2026-02-30", "2026-03-02"), trip("2026-03-01", "2026-03-02")];
  const r = C.daysInWindow(t, "2026-06-30");
  assert.deepEqual(r.perTrip, [0, 0, 0, 0, 2]);
  assert.equal(r.total, 2);
});

test("a trip the traveler is still on counts through the check date", () => {
  const still = { id: "s", country: "DE", entry: "2026-06-01", exit: "", ongoing: true };
  assert.equal(total([still], "2026-06-30"), 30);
  assert.equal(total([still], "2026-07-15"), 45, "a later check date counts as staying until then");
  assert.equal(total([still], "2026-05-31"), 0, "a check date before entry counts nothing");
  assert.equal(C.tripLength(still, "2026-06-30"), 30);
  assert.equal(total([still, trip("2026-06-20", "2026-07-10", "FR")], "2026-06-30"), 30, "overlap still counts once");
});

test("a leap day inside the window is a real day", () => {
  assert.equal(total([trip("2028-02-27", "2028-03-01")], "2028-03-01"), 4);
});

test("a full 180 day stay counts 180, never more", () => {
  assert.equal(total([trip("2020-01-01", "2030-01-01")], "2026-06-30"), 180);
});

test("daylight saving weeks do not shift a day", () => {
  // EU clocks change on the last Sundays of March and October.
  assert.equal(total([trip("2026-03-28", "2026-03-30")], "2026-04-30"), 3);
  assert.equal(total([trip("2026-10-24", "2026-10-26")], "2026-11-30"), 3);
});

test("classic rolling-window example: 90 days, then the earliest days roll off", () => {
  const t = [trip("2026-01-01", "2026-03-31")]; // 90 days
  assert.equal(total(t, "2026-03-31"), 90);
  assert.equal(total(t, "2026-06-29"), 90); // window 2026-01-01..2026-06-29
  assert.equal(total(t, "2026-06-30"), 89); // Jan 1 rolls off
  assert.equal(total(t, "2026-09-27"), 0);
});

test("an invalid check date counts nothing and never throws", () => {
  for (const bad of ["", "0099-01-05", "garbage"]) {
    const r = C.daysInWindow([trip("2026-03-01", "2026-03-02")], bad);
    assert.equal(r.total, 0);
    assert.deepEqual(r.perTrip, [0]);
  }
  assert.doesNotThrow(() => X.buildRecord([trip("2026-03-01", "2026-03-02")], "0099-01-05", new Date()));
});

/* ---------- Status levels ---------- */

test("status boundaries match the README table", () => {
  const cases = { 0: "green", 45: "green", 46: "yellow", 60: "yellow", 61: "red", 90: "red", 91: "black", 180: "black" };
  for (const [n, s] of Object.entries(cases)) assert.equal(C.statusFor(Number(n)), s, "total " + n);
  for (const s of ["green", "yellow", "red", "black"]) assert.ok(C.STATUS_LABELS[s]);
});

test("tripLength", () => {
  assert.equal(C.tripLength(trip("2026-01-01", "2026-01-01")), 1);
  assert.equal(C.tripLength(trip("2026-01-01", "2025-12-31")), 0);
  assert.equal(C.tripLength(trip("2025-12-31", "2026-01-01")), 2);
});

/* ---------- Saved data upgrades ---------- */

test("version 1 saves (English names) upgrade to codes", () => {
  const out = C.upgradeSaved([{ country: "Germany", entry: "2026-01-01", exit: "2026-01-05" }, { country: "Atlantis", entry: "x", exit: 5 }]);
  assert.equal(out.version, C.DATA_VERSION);
  assert.equal(out.trips[0].country, "DE");
  assert.equal(out.trips[1].country, "");
  assert.equal(out.trips[1].exit, "", "non-string dates are cleared");
  assert.ok(out.trips[0].id);
});

test("saved dates a date field cannot show are cleared", () => {
  const t = C.upgradeSaved([{ country: "DE", entry: "2026-5-1", exit: "1e3-01-01" }, { country: "FR", entry: "2026-02-30", exit: "2026-03-01" }]).trips;
  assert.deepEqual([t[0].entry, t[0].exit, t[1].entry, t[1].exit], ["", "", "", "2026-03-01"]);
});

test("prototype names and non-string countries become an empty choice", () => {
  const t = C.upgradeSaved([{ country: "__proto__" }, { country: "constructor" }, { country: "toString" }, { country: ["DE"] }, { country: 7 }]).trips;
  assert.deepEqual(t.map((x) => x.country), ["", "", "", "", ""]);
});

test("version 2 saves upgrade to version 3 unchanged apart from ongoing", () => {
  const v2 = { version: 2, trips: [{ id: "t1", country: "FR", entry: "2026-01-01", exit: "2026-01-02" }] };
  assert.deepEqual(C.upgradeSaved(v2), { version: 3, trips: [{ id: "t1", country: "FR", entry: "2026-01-01", exit: "2026-01-02", ongoing: false }] });
});

test("version 3 saves pass through unchanged", () => {
  const v3 = { version: 3, trips: [{ id: "t1", country: "FR", entry: "2026-01-01", exit: "", ongoing: true }] };
  assert.deepEqual(C.upgradeSaved(v3), v3);
});

test("ongoing must be exactly true, and an ongoing trip has no departure date", () => {
  const t = C.upgradeSaved([{ entry: "2026-01-01", exit: "2026-01-05", ongoing: true }, { ongoing: "yes" }, { ongoing: 1 }]).trips;
  assert.deepEqual(t.map((x) => [x.ongoing, x.exit]), [[true, ""], [false, ""], [false, ""]]);
});

test("saves keep at most 1,000 trips", () => {
  const many = Array.from({ length: 1500 }, (_, i) => ({ id: "t" + i, entry: "2026-01-01", exit: "2026-01-01" }));
  const t = C.upgradeSaved(many).trips;
  assert.equal(C.MAX_TRIPS, 1000);
  assert.equal(t.length, 1000);
  assert.equal(t[0].id, "t0");
});

test("junk saves never throw", () => {
  for (const junk of [null, undefined, 42, "str", {}, { trips: "x" }, [null, 1, "a", []], { trips: [{ country: {} }] }]) {
    assert.doesNotThrow(() => C.upgradeSaved(junk), JSON.stringify(junk));
    assert.ok(Array.isArray(C.upgradeSaved(junk).trips));
  }
});

test("duplicate saved ids are replaced, so every trip has its own", () => {
  const t = C.upgradeSaved([{ id: "same", country: "DE" }, { id: "same", country: "FR" }, { id: "x" }]).trips;
  assert.equal(new Set(t.map((x) => x.id)).size, 3);
  assert.equal(t[0].id, "same");
  assert.equal(t[2].id, "x");
});

test("trip ids are unique", () => {
  const ids = new Set(Array.from({ length: 2000 }, () => C.newTripId()));
  assert.equal(ids.size, 2000);
});

/* ---------- Export ---------- */

const NOW = new Date("2026-06-30T12:34:56Z");
const sample = [trip("2026-03-01", "2026-03-10", "DE"), trip("2026-03-05", "2026-03-15", "BE"), trip("", "", "")];

test("buildRecord totals and per-trip numbers", () => {
  const r = X.buildRecord(sample, "2026-06-30", NOW);
  assert.equal(r.totalDays, 15);
  assert.equal(r.daysRemaining, 75);
  assert.equal(r.daysOver, 0);
  assert.equal(r.status, "green");
  assert.equal(r.exportedAt, "2026-06-30T12:34:56.000Z");
  assert.equal(r.trips[2].country, "");
  assert.equal(r.trips[1].nativeName, "België / Belgique / Belgien");
});

test("over the limit reports days over and zero remaining", () => {
  const r = X.buildRecord([trip("2026-01-01", "2026-04-30")], "2026-04-30", NOW);
  assert.equal(r.totalDays, 120);
  assert.equal(r.daysOver, 30);
  assert.equal(r.daysRemaining, 0);
  assert.equal(r.status, "black");
});

/** Minimal RFC 4180 parser, to prove the CSV reads back to the same cells. */
function parseCSV(text) {
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += ch;
  }
  return rows;
}

test("CSV has a header, one row per trip, CRLF endings, and parses back", () => {
  const csv = X.toCSV(X.buildRecord(sample, "2026-06-30", NOW));
  const rows = parseCSV(csv);
  assert.equal(rows.length, 4);
  assert.equal(rows[0][0], "Country");
  assert.deepEqual(rows[1], ["Germany", "Deutschland", "2026-03-01", "2026-03-10", "No", "10", "10"]);
  assert.ok(csv.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(csv), "every line break is CRLF");
});

test("CSV escapes commas, quotes, and line breaks", () => {
  const record = { trips: [{ country: 'A, "B"', nativeName: "x\ny", entryDate: "", departureDate: "", tripDays: 0, daysInWindow: 0 }] };
  const rows = parseCSV(X.toCSV(record));
  assert.equal(rows[1][0], 'A, "B"');
  assert.equal(rows[1][1], "x\ny");
});

test("JSON export parses and contains every field", () => {
  const parsed = JSON.parse(X.toJSON(X.buildRecord(sample, "2026-06-30", NOW)));
  for (const k of ["app", "source", "exportedAt", "checkDate", "window", "limitDays", "totalDays", "daysRemaining", "daysOver", "status", "statusLabel", "trips"]) {
    assert.ok(k in parsed, k);
  }
  assert.equal(parsed.trips.length, 3);
});

test("TXT export uses singular and plural correctly", () => {
  const one = X.toTXT(X.buildRecord([trip("2026-06-30", "2026-06-30")], "2026-06-30", NOW));
  assert.match(one, /1\. Germany \(Deutschland\): 2026-06-30 to 2026-06-30, 1 day \(1 in window\)/);
  assert.match(one, /Days remaining: 89/);
  const over = X.toTXT(X.buildRecord([trip("2026-01-01", "2026-04-01")], "2026-04-01", NOW));
  assert.match(over, /Exceeded by: 1 day\n/);
  const blank = X.toTXT(X.buildRecord([trip("", "", "")], "2026-06-30", NOW));
  assert.match(blank, /Country not selected: \? to \?, 0 days/);
});

test("exports mark a trip the traveler is still on", () => {
  const r = X.buildRecord([{ id: "s", country: "IT", entry: "2026-06-01", exit: "", ongoing: true }], "2026-06-30", NOW);
  assert.equal(r.trips[0].stillInSchengen, true);
  assert.equal(r.trips[0].departureDate, "");
  assert.equal(r.trips[0].tripDays, 30);
  assert.equal(parseCSV(X.toCSV(r))[1][4], "Yes");
  assert.match(X.toTXT(r), /2026-06-01 to 2026-06-30 \(still in the Schengen Area\), 30 days/);
});

test("file names use the check date", () => {
  assert.equal(X.fileName("csv", "2026-06-30"), "schengen-trips-2026-06-30.csv");
  assert.equal(X.fileName("json", "2026-06-30"), "schengen-trips-2026-06-30.json");
  assert.equal(X.fileName("txt", "2026-06-30"), "schengen-trips-2026-06-30.txt");
});
