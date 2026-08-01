import { formatPercent } from "@/lib/format";

/**
 * E12-S4 — an anomaly flag that cannot explain itself is noise.
 *
 * Every flag produced here carries four things the reader needs in order to
 * argue with it: the magnitude, the direction, the baseline period it was
 * measured against, and the tolerance that made it a flag rather than a wobble.
 */

export interface AnomalyTolerance {
  /** Percentage deviation from the trailing baseline that raises a flag. */
  pct: number;
  /** How many trailing points form the baseline. */
  window: number;
  /** Absolute floor — a metric below this is too small to flag meaningfully. */
  floor?: number;
}

export const DEFAULT_TOLERANCE: AnomalyTolerance = { pct: 15, window: 6 };

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface AnomalyFlag {
  metricName: string;
  latestLabel: string;
  latestValue: number;
  baselineValue: number;
  deviationPct: number;
  direction: "ABOVE" | "BELOW";
  /** True when the deviation is in the direction the business wants. */
  favourable: boolean;
  tolerancePct: number;
  baselineLabel: string;
  explanation: string;
  recordSetLabel: string;
  recordSetHref: string;
}

/**
 * Compares the most recent point against the mean of the preceding `window`
 * points. The latest point is excluded from its own baseline, otherwise a large
 * movement partly cancels itself and the flag fires late.
 */
export function detectAnomaly(
  metricName: string,
  series: SeriesPoint[],
  opts: {
    higherIsBetter: boolean;
    recordSetLabel: string;
    recordSetHref: string;
    tolerance?: AnomalyTolerance;
    unit?: "PERCENT" | "MONEY" | "DAYS" | "HOURS" | "COUNT";
  },
): AnomalyFlag | null {
  const tol = opts.tolerance ?? DEFAULT_TOLERANCE;
  if (series.length < tol.window + 1) return null;

  const latest = series[series.length - 1]!;
  const trailing = series.slice(Math.max(0, series.length - 1 - tol.window), series.length - 1);
  const usable = trailing.filter((p) => Number.isFinite(p.value));
  if (usable.length < 3) return null;

  const baseline = usable.reduce((s, p) => s + p.value, 0) / usable.length;
  if (baseline === 0) return null;
  if (tol.floor !== undefined && Math.abs(baseline) < tol.floor) return null;

  const deviationPct = ((latest.value - baseline) / Math.abs(baseline)) * 100;
  if (Math.abs(deviationPct) < tol.pct) return null;

  const direction: AnomalyFlag["direction"] = deviationPct > 0 ? "ABOVE" : "BELOW";
  const favourable = (direction === "ABOVE") === opts.higherIsBetter;
  const baselineLabel = `${usable[0]!.label} to ${usable[usable.length - 1]!.label}`;

  return {
    metricName,
    latestLabel: latest.label,
    latestValue: latest.value,
    baselineValue: Number(baseline.toFixed(2)),
    deviationPct: Number(deviationPct.toFixed(1)),
    direction,
    favourable,
    tolerancePct: tol.pct,
    baselineLabel,
    explanation:
      `${latest.label} sits ${formatPercent(Math.abs(deviationPct))} ${direction === "ABOVE" ? "above" : "below"} the trailing baseline. ` +
      `The baseline is the mean of the ${usable.length} periods from ${baselineLabel}, and the configured tolerance is ` +
      `${formatPercent(tol.pct)} either side of it. A movement inside that band is not flagged.`,
    recordSetLabel: opts.recordSetLabel,
    recordSetHref: opts.recordSetHref,
  };
}
