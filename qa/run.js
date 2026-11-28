/*
 * QC runner: every check in one command, with one summary at the end.
 *
 *   node qa/run.js            all checks
 *   node qa/run.js --quick    skip the browser tests (no Playwright needed)
 *
 * Writes the full output to qa/report.txt (ignored by git) and exits 1 if
 * any check failed.
 */
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const QA = __dirname;
const quick = process.argv.includes("--quick");
// Day counting must not depend on the device zone: the far ends of the
// date line, a DST zone in Europe, and one in the Americas.
const ZONES = ["UTC", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Europe/Berlin", "America/Los_Angeles"];

const steps = ZONES.map((tz) => ({ name: "Logic tests (TZ=" + tz + ")", cmd: [process.execPath, "--test", "unit.test.js"], env: { TZ: tz } }));
steps.push({ name: "Static audit", cmd: [process.execPath, "audit.js"] });

let hasPlaywright = true;
try { require.resolve("playwright"); } catch (e) { hasPlaywright = false; }
if (!quick && hasPlaywright) steps.push({ name: "Browser tests", cmd: [process.execPath, "--test", "browser.test.js"] });

const log = [];
const results = [];
for (const step of steps) {
  process.stdout.write("Running " + step.name + "... ");
  const r = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: QA, encoding: "utf8", env: { ...process.env, ...(step.env || {}) }, timeout: 600000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const ok = r.status === 0;
  const pass = (out.match(/^# pass (\d+)/m) || [])[1];
  const fail = (out.match(/^# fail (\d+)/m) || [])[1];
  const failed = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
  const auditErrors = [...out.matchAll(/^(ERROR|warn ) (.+)$/gm)].map((m) => m[1].trim() + " " + m[2]);
  console.log(ok ? "ok" : "FAILED");
  results.push({ step: step.name, ok, pass, fail, failed, auditErrors });
  log.push("=".repeat(70), step.name, "=".repeat(70), out);
}

console.log("\nQC summary");
console.log("----------");
for (const r of results) {
  const counts = r.pass !== undefined ? ` (${r.pass} passed, ${r.fail} failed)` : "";
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.step}${counts}`);
  r.failed.forEach((f) => console.log("        - " + f));
  r.auditErrors.forEach((f) => console.log("        - " + f));
}
if (quick) console.log("SKIP  Browser tests (--quick)");
else if (!hasPlaywright) console.log("SKIP  Browser tests (Playwright is not installed: cd qa && npm install && npx playwright install chromium)");

fs.writeFileSync(path.join(QA, "report.txt"), log.join("\n"));
console.log("\nFull output: qa/report.txt");
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
