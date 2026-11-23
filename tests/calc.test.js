const test = require("node:test");
const assert = require("node:assert");
const C = require("../js/calc.js");

test("entry and exit days both count", () => {
  const r = C.daysInWindow([{ entry: "2026-01-01", exit: "2026-01-10" }], "2026-02-01");
  assert.strictEqual(r.total, 10);
});

test("window is 180 days ending on the reference date", () => {
  const r = C.daysInWindow([{ entry: "2025-01-01", exit: "2026-12-31" }], "2026-06-30");
  assert.strictEqual(r.total, 180);
  assert.strictEqual(r.windowEnd, "2026-06-30");
  assert.strictEqual(r.windowStart, "2026-01-02");
});

test("days before the window are excluded", () => {
  const r = C.daysInWindow([{ entry: "2025-12-30", exit: "2026-01-05" }], "2026-06-30");
  assert.strictEqual(r.total, 4); // Jan 2 through Jan 5
});

test("overlapping trips are not double counted", () => {
  const r = C.daysInWindow(
    [{ entry: "2026-03-01", exit: "2026-03-10" }, { entry: "2026-03-05", exit: "2026-03-15" }],
    "2026-04-01"
  );
  assert.strictEqual(r.total, 15);
});

test("status thresholds", () => {
  assert.strictEqual(C.statusFor(0), "green");
  assert.strictEqual(C.statusFor(45), "green");
  assert.strictEqual(C.statusFor(46), "yellow");
  assert.strictEqual(C.statusFor(60), "yellow");
  assert.strictEqual(C.statusFor(61), "red");
  assert.strictEqual(C.statusFor(90), "red");
  assert.strictEqual(C.statusFor(91), "black");
  assert.strictEqual(C.statusFor(200), "black");
});

test("invalid or reversed trips count as zero", () => {
  const r = C.daysInWindow([{ entry: "2026-03-10", exit: "2026-03-01" }, { entry: "bad", exit: "" }], "2026-04-01");
  assert.strictEqual(r.total, 0);
});

test("29 Schengen countries are listed", () => {
  assert.strictEqual(C.SCHENGEN_COUNTRIES.length, 29);
});

test("every country has a native name and a flag", () => {
  C.COUNTRIES.forEach((c) => {
    assert.ok(c.native, c.name + " native name");
    // A flag emoji is two regional indicator symbols.
    assert.match(c.flag, /^[\u{1F1E6}-\u{1F1FF}]{2}$/u, c.name + " flag");
  });
  assert.strictEqual(C.countryLabel(C.COUNTRIES.find((c) => c.name === "Germany")), "Germany | Deutschland | 🇩🇪");
});

const X = require("../js/export.js");
const sampleTrips = [
  { country: "Germany", entry: "2026-06-01", exit: "2026-06-10" },
  { country: "Belgium", entry: "2026-07-01", exit: "2026-07-05" }
];
const sampleRecord = X.buildRecord(sampleTrips, "2026-11-16", new Date("2026-11-16T12:00:00Z"));

test("export record summarizes trips and totals", () => {
  assert.strictEqual(sampleRecord.totalDays, 15);
  assert.strictEqual(sampleRecord.daysRemaining, 75);
  assert.strictEqual(sampleRecord.status, "green");
  assert.strictEqual(sampleRecord.trips[0].nativeName, "Deutschland");
  assert.strictEqual(sampleRecord.trips[1].tripDays, 5);
});

test("CSV has a header and quotes fields with commas", () => {
  const lines = X.toCSV(sampleRecord).trim().split("\r\n");
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], "Country,Native name,Entry date,Departure date,Trip days,Days in 180-day window");
  assert.strictEqual(lines[1], "Germany,Deutschland,2026-06-01,2026-06-10,10,10");
  assert.strictEqual(lines[2], 'Belgium,België / Belgique / Belgien,2026-07-01,2026-07-05,5,5');
  const tricky = X.toCSV({ trips: [{ country: 'A, "B"', nativeName: "", entryDate: "", departureDate: "", tripDays: 0, daysInWindow: 0 }] });
  assert.ok(tricky.includes('"A, ""B"""'));
});

test("JSON round-trips", () => {
  const parsed = JSON.parse(X.toJSON(sampleRecord));
  assert.strictEqual(parsed.totalDays, 15);
  assert.strictEqual(parsed.trips.length, 2);
});

test("TXT lists the totals and each trip", () => {
  const txt = X.toTXT(sampleRecord);
  assert.ok(txt.includes("Days in the Schengen Area: 15 / 90"));
  assert.ok(txt.includes("1. Germany (Deutschland): 2026-06-01 to 2026-06-10, 10 days (10 in window)"));
});

test("file names use the check date", () => {
  assert.strictEqual(X.fileName("csv", "2026-11-16"), "schengen-trips-2026-11-16.csv");
});

test("the map has a shape for every Schengen country", () => {
  const html = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  const onMap = new Set([...html.matchAll(/class="map-country[^"]*" data-country="([^"]+)"/g)].map((m) => m[1]));
  const missing = C.SCHENGEN_COUNTRIES.filter((c) => !onMap.has(c));
  assert.deepStrictEqual(missing, []);
});
