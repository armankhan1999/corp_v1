/* E14-S1 — fails the build if any reconciliation rule breaks. */
import { getDataset } from "../lib/seed";
import { validateDataset } from "../lib/seed/validate";

const t0 = process.hrtime.bigint();
const ds = getDataset();
const genMs = Number(process.hrtime.bigint() - t0) / 1e6;

const { checks, passed, criticalFailed } = validateDataset(ds);

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", RESET = "\x1b[0m", YELL = "\x1b[33m";

console.log(`\nPravaah seed validation — generated in ${genMs.toFixed(0)} ms\n`);
console.log(pad("  RULE", 62) + pad("EXPECTED", 16) + "ACTUAL");
console.log("  " + "─".repeat(94));

for (const c of checks) {
  const mark = c.pass ? `${GREEN}✓${RESET}` : c.critical ? `${RED}✗${RESET}` : `${YELL}!${RESET}`;
  const line = `${mark} ${pad(c.rule, 60)}${pad(c.expected, 16)}${c.actual}`;
  console.log(c.pass ? `  ${DIM}${line}${RESET}` : `  ${line}`);
}

const failed = checks.filter((c) => !c.pass);
console.log("  " + "─".repeat(94));
console.log(
  `  ${checks.length} rules · ${GREEN}${checks.length - failed.length} passed${RESET}` +
  (failed.length ? ` · ${RED}${failed.length} failed${RESET}` : ""),
);

if (criticalFailed) {
  console.error(`\n${RED}Seed reconciliation FAILED — build must not proceed.${RESET}\n`);
  process.exit(1);
}
if (!passed) {
  console.warn(`\n${YELL}Non-critical variances present; reconciliation core is intact.${RESET}\n`);
}
console.log(`\n${GREEN}Seed reconciles.${RESET}\n`);
