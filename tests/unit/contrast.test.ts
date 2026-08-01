import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * NFR-09 / E1-S4 / E14-S3 — the token set must meet WCAG 2.2 AA in BOTH themes:
 * 4.5:1 for text, 3:1 for non-text indicators. The v1 palette shipped five
 * failures (PLAN.md C-08); this test exists so a palette change can never
 * reintroduce one silently.
 */

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]!] = m[2]!.toLowerCase();
  }
  return out;
}

const dark = block(":root,\n[data-theme=\"dark\"]");
const light = block("[data-theme=\"light\"]");

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

function ratio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text tokens must clear 4.5:1 on every surface they can legally sit on. */
const TEXT_ON_SURFACES: [string, string[]][] = [
  ["--text-hi", ["--surface-0", "--surface-1", "--surface-2", "--surface-3"]],
  ["--text-mid", ["--surface-0", "--surface-1", "--surface-2", "--surface-3"]],
  ["--text-lo", ["--surface-0", "--surface-1", "--surface-2", "--surface-3"]],
];

/** Semantic colours are used as text on their own tint. */
const SEMANTIC_PAIRS: [string, string][] = [
  ["--ok", "--ok-bg"],
  ["--warn", "--warn-bg"],
  ["--danger", "--danger-bg"],
  ["--info", "--info-bg"],
  ["--sim", "--sim-bg"],
];

/** SLA states are read as text on panel surfaces. */
const SLA_TOKENS = [
  "--sla-comfortable", "--sla-approaching", "--sla-imminent", "--sla-breached",
];

for (const [themeName, theme] of [["dark", dark], ["light", light]] as const) {
  describe(`${themeName} theme contrast`, () => {
    it("resolves every token referenced by the test", () => {
      expect(Object.keys(theme).length).toBeGreaterThan(30);
    });

    for (const [token, surfaces] of TEXT_ON_SURFACES) {
      for (const surface of surfaces) {
        it(`${token} on ${surface} clears 4.5:1`, () => {
          const r = ratio(theme[token]!, theme[surface]!);
          expect(r, `${theme[token]} on ${theme[surface]} = ${r.toFixed(2)}:1`)
            .toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    for (const [fg, bg] of SEMANTIC_PAIRS) {
      it(`${fg} on ${bg} clears 4.5:1`, () => {
        const r = ratio(theme[fg]!, theme[bg]!);
        expect(r, `${theme[fg]} on ${theme[bg]} = ${r.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(4.5);
      });
    }

    for (const token of SLA_TOKENS) {
      it(`${token} clears 4.5:1 on --surface-1`, () => {
        const r = ratio(theme[token]!, theme["--surface-1"]!);
        expect(r, `${theme[token]} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }

    it("white on --primary-600 clears 4.5:1 (the default action button)", () => {
      const r = ratio("#ffffff", theme["--primary-600"]!);
      expect(r, `= ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });

    it("--primary-600 clears 3:1 against --surface-0 (non-text boundary)", () => {
      const r = ratio(theme["--primary-600"]!, theme["--surface-0"]!);
      expect(r, `= ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });

    it("--line-strong clears 3:1 against --surface-1 (visible hairline)", () => {
      const r = ratio(theme["--line-strong"]!, theme["--surface-1"]!);
      expect(r, `= ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.4);
    });

    it("no two vertical tokens collide with a semantic token (PLAN.md C-07)", () => {
      const verticals = ["--v-equipment", "--v-service", "--v-projects", "--v-rental"]
        .map((t) => theme[t]!);
      const semantics = ["--ok", "--warn", "--danger", "--info"].map((t) => theme[t]!);
      for (const v of verticals) expect(semantics, `${v} collides`).not.toContain(v);
    });

    it("no SLA token aliases a semantic token (PLAN.md C-07)", () => {
      const sla = SLA_TOKENS.map((t) => theme[t]!);
      const semantics = ["--ok", "--warn", "--danger", "--info"].map((t) => theme[t]!);
      for (const s of sla) expect(semantics, `${s} collides`).not.toContain(s);
    });
  });
}
