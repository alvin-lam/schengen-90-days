const test = require("node:test");
const assert = require("node:assert");
const C = require("../calc.js");

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
  assert.strictEqual(C.statusFor(80), "green");
  assert.strictEqual(C.statusFor(81), "yellow");
  assert.strictEqual(C.statusFor(90), "yellow");
  assert.strictEqual(C.statusFor(91), "red");
});

test("invalid or reversed trips count as zero", () => {
  const r = C.daysInWindow([{ entry: "2026-03-10", exit: "2026-03-01" }, { entry: "bad", exit: "" }], "2026-04-01");
  assert.strictEqual(r.total, 0);
});

test("29 Schengen countries are listed", () => {
  assert.strictEqual(C.SCHENGEN_COUNTRIES.length, 29);
});
