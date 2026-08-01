import type { Period } from "@/lib/derive";
import { financialYear, formatDate, toDate } from "@/lib/format";

/**
 * E2-S7 — the period control.
 *
 * Indian financial year, April to March, labelled "FY 2026-27" (FR-M2-12).
 * Flow metrics (revenue, conversion, SLA compliance) follow the selected
 * period. Position metrics (locked cash, order book, open commitments) are
 * stated as at `asOf`, which is the period end capped at the simulated clock —
 * a balance cannot be reported for a date that has not happened yet.
 */

export type PeriodKey = "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_FY" | "CUSTOM";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "THIS_MONTH", label: "This Month", short: "Month" },
  { key: "LAST_MONTH", label: "Last Month", short: "Last mo." },
  { key: "THIS_QUARTER", label: "This Quarter", short: "Quarter" },
  { key: "THIS_FY", label: "This FY", short: "FY" },
  { key: "CUSTOM", label: "Custom", short: "Custom" },
];

export interface ResolvedPeriod {
  key: PeriodKey;
  period: Period;
  prior: Period;
  /** "July 2026", "FY 2026-27 to date", "01 Apr 2026 – 31 Jul 2026" */
  label: string;
  priorLabel: string;
  /** Balance-sheet reference instant: min(period end, simulated clock). */
  asOf: Date;
  /** Inline validation message for an invalid custom range. Null when valid. */
  error: string | null;
  /** What the user typed, echoed back into the form so it is not lost. */
  fromInput: string;
  toInput: string;
  /** True when the requested period could not be applied and the default was used. */
  fellBack: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

/** Indian FY quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. */
export function fyQuarter(d: Date): { index: 1 | 2 | 3 | 4; from: Date; to: Date } {
  const m = d.getMonth();
  const startMonth = m >= 3 ? m - ((m - 3) % 3) : m - ((m + 9) % 3);
  const from = new Date(d.getFullYear(), startMonth, 1);
  const to = endOfDay(new Date(d.getFullYear(), startMonth + 3, 0));
  const index = (Math.floor(((startMonth + 9) % 12) / 3) + 1) as 1 | 2 | 3 | 4;
  return { index, from, to };
}

function isoDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function priorOf(period: Period): Period {
  const span = period.to.getTime() - period.from.getTime();
  return {
    from: new Date(period.from.getTime() - span - 1),
    to: new Date(period.from.getTime() - 1),
  };
}

function rangeLabel(p: Period): string {
  return `${formatDate(p.from)} – ${formatDate(p.to)}`;
}

export function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  now: Date,
): ResolvedPeriod {
  const requested = (params.period ?? "THIS_FY").toUpperCase() as PeriodKey;
  const key: PeriodKey = PERIOD_OPTIONS.some((o) => o.key === requested) ? requested : "THIS_FY";
  const fromInput = params.from ?? "";
  const toInput = params.to ?? "";

  const build = (k: PeriodKey): { period: Period; prior: Period; label: string; priorLabel: string } => {
    switch (k) {
      case "THIS_MONTH": {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const prior = {
          from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
        return {
          period: { from, to },
          prior,
          label: `${MONTH_NAMES[from.getMonth()]} ${from.getFullYear()}`,
          priorLabel: `${MONTH_NAMES[prior.from.getMonth()]} ${prior.from.getFullYear()}`,
        };
      }
      case "LAST_MONTH": {
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        const prior = {
          from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
          to: endOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 0)),
        };
        return {
          period: { from, to },
          prior,
          label: `${MONTH_NAMES[from.getMonth()]} ${from.getFullYear()}`,
          priorLabel: `${MONTH_NAMES[prior.from.getMonth()]} ${prior.from.getFullYear()}`,
        };
      }
      case "THIS_QUARTER": {
        const q = fyQuarter(now);
        const pq = fyQuarter(new Date(q.from.getTime() - 1));
        return {
          period: { from: q.from, to: q.to },
          prior: { from: pq.from, to: pq.to },
          label: `Q${q.index} ${financialYear(q.from)}`,
          priorLabel: `Q${pq.index} ${financialYear(pq.from)}`,
        };
      }
      case "CUSTOM": {
        const from = startOfDay(toDate(fromInput));
        const to = endOfDay(toDate(toInput));
        return {
          period: { from, to },
          prior: priorOf({ from, to }),
          label: rangeLabel({ from, to }),
          priorLabel: rangeLabel(priorOf({ from, to })),
        };
      }
      case "THIS_FY":
      default: {
        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const from = new Date(startYear, 3, 1);
        const to = now;
        // Like-for-like: the same elapsed span one financial year earlier.
        const prior = {
          from: new Date(startYear - 1, 3, 1),
          to: new Date(startYear - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999),
        };
        return {
          period: { from, to },
          prior,
          label: `${financialYear(from)} to date`,
          priorLabel: `${financialYear(prior.from)}, same span`,
        };
      }
    }
  };

  let error: string | null = null;
  let effective: PeriodKey = key;

  if (key === "CUSTOM") {
    const f = new Date(fromInput);
    const t = new Date(toInput);
    if (!fromInput || !toInput) {
      error = "Enter both a start date and an end date to apply a custom period.";
    } else if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) {
      error = "Dates must be real calendar dates. Use the date pickers to correct them.";
    } else if (t < f) {
      error = `End date ${formatDate(t)} falls before start date ${formatDate(f)}. Set the end date on or after the start date.`;
    } else if (f > now) {
      error = `Start date ${formatDate(f)} is after the simulated clock (${formatDate(now)}). Choose a start date on or before today.`;
    }
    if (error) effective = "THIS_FY";
  }

  const built = build(effective);
  const asOf = built.period.to < now ? built.period.to : now;

  return {
    key,
    period: built.period,
    prior: built.prior,
    label: built.label,
    priorLabel: built.priorLabel,
    asOf,
    error,
    fromInput: fromInput || isoDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    toInput: toInput || isoDateInput(now),
    fellBack: error !== null,
  };
}

/** Carries the period across a drill-through so scope is not silently lost. */
export function periodQuery(p: ResolvedPeriod, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  if (p.key !== "THIS_FY") q.set("period", p.key);
  if (p.key === "CUSTOM" && !p.error) {
    q.set("from", p.fromInput);
    q.set("to", p.toInput);
  }
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Share of a financial year covered by the period — used to pro-rate an annual
 * branch target so a four-month window is not judged against a twelve-month bar.
 */
export function fyElapsedFraction(p: Period, fyStart: Date, fyEnd: Date): number {
  const from = Math.max(p.from.getTime(), fyStart.getTime());
  const to = Math.min(p.to.getTime(), fyEnd.getTime());
  const span = to - from;
  const full = fyEnd.getTime() - fyStart.getTime();
  if (span <= 0 || full <= 0) return 0;
  return span / full;
}
