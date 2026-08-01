"use client";

import * as React from "react";
import { abbreviateINR, axisINR, formatCount, formatINR, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Datum, SeriesSpec } from "./chartTypes";
import { toneColor } from "./chartTypes";

/** Axis and tooltip formatting, by unit. Indian formatting only, via @/lib/format. */
export function formatValue(v: number, unit: SeriesSpec["unit"], precise = false): string {
  switch (unit) {
    case "MONEY":
      return precise ? formatINR(v) : abbreviateINR(v);
    case "PERCENT":
      return formatPercent(v, precise ? 2 : 1);
    case "DAYS":
      return `${v.toFixed(precise ? 2 : 1)} days`;
    case "HOURS":
      return `${v.toFixed(precise ? 2 : 1)} h`;
    case "RATIO":
      return v.toFixed(precise ? 3 : 2);
    default:
      return formatCount(v);
  }
}

export function axisTickFormatter(unit: SeriesSpec["unit"]): (v: number) => string {
  if (unit === "MONEY") return (v) => axisINR(v);
  if (unit === "PERCENT") return (v) => `${Math.round(v)}%`;
  if (unit === "HOURS") return (v) => `${Math.round(v)}h`;
  if (unit === "DAYS") return (v) => `${Math.round(v)}d`;
  return (v) => formatCount(Math.round(v));
}

export const AXIS_STYLE = {
  tick: { fill: "var(--text-lo)", fontSize: 13 },
  axisLine: { stroke: "var(--line)" },
  tickLine: { stroke: "var(--line)" },
} as const;

/**
 * Pattern fills. NFR-09 / E12-S4 — a stacked or grouped bar must be readable
 * with the colour removed, so each series gets a hatch as well as a hue.
 */
const PATTERN_PATHS = [
  "M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4",
  "M0,0 l8,8 M-2,6 l4,4 M6,-2 l4,4",
  "M4,0 v8",
  "M0,4 h8",
  "M0,4 h8 M4,0 v8",
  "M2,2 l0.5,0 M6,6 l0.5,0 M2,6 l0.5,0 M6,2 l0.5,0",
  "M0,8 l8,-8",
  "M0,2 h8 M0,6 h8",
];

export function PatternDefs({ idPrefix }: { idPrefix: string }) {
  return (
    <defs>
      {PATTERN_PATHS.map((d, i) => (
        <pattern
          key={i}
          id={`${idPrefix}-pat-${i + 1}`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill={toneColor(i + 1)} />
          <path d={d} stroke="var(--surface-0)" strokeWidth="1.25" strokeOpacity="0.55" fill="none" />
        </pattern>
      ))}
    </defs>
  );
}

export function seriesFill(idPrefix: string, tone: number, patterned: boolean): string {
  return patterned ? `url(#${idPrefix}-pat-${((tone - 1) % 8) + 1})` : toneColor(tone);
}

/* ------------------------------------------------------------- tooltip */

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  payload?: { __datum?: Datum };
}

export function ChartTooltip({
  active, payload, label, series, drillHint,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  series: SeriesSpec[];
  drillHint?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload?.__datum;
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-none">
      <p className="t-overline text-text-lo">{String(label ?? "")}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {payload.map((p) => {
          const s = series.find((x) => x.key === p.dataKey);
          if (!s) return null;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-sm"
                style={{ background: toneColor(s.tone) }}
              />
              <span className="t-body-sm text-text-mid">{s.label}</span>
              <span className="t-mono ml-auto text-text-hi">
                {formatValue(Number(p.value ?? 0), s.unit, true)}
              </span>
            </li>
          );
        })}
      </ul>
      {drillHint && datum?.drill ? (
        <p className="t-body-sm mt-1.5 border-t border-line pt-1.5 text-text-lo">
          Click to open {formatCount(datum.drill.totalRecords)} contributing records
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- legend */

export function ChartLegend({
  series, hidden, onToggle, idPrefix, patterned,
}: {
  series: SeriesSpec[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  idPrefix: string;
  patterned: boolean;
}) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-3">
      {series.map((s) => {
        const off = hidden.has(s.key);
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onToggle(s.key)}
              aria-pressed={!off}
              data-testid={`legend-${idPrefix}-${s.key}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 transition-colors duration-150",
                "hover:border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-info",
                off && "opacity-45",
              )}
            >
              <svg width="14" height="10" aria-hidden className="shrink-0">
                <PatternDefs idPrefix={`${idPrefix}-lg`} />
                <rect
                  width="14"
                  height="10"
                  rx="1"
                  fill={patterned ? `url(#${idPrefix}-lg-pat-${((s.tone - 1) % 8) + 1})` : toneColor(s.tone)}
                />
              </svg>
              <span className="t-body-sm text-text-mid">{s.label}</span>
              <span className="sr-only">{off ? " — hidden, activate to show" : " — shown, activate to hide"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------ accessible data table */

export function SeriesTable({
  id, title, xLabel, series, data, caption,
}: {
  id: string;
  title: string;
  xLabel: string;
  series: SeriesSpec[];
  data: Datum[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table
        id={`${id}-table`}
        className="w-full min-w-[420px] border-collapse"
        data-testid={`table-${id}`}
      >
        <caption className="t-body-sm pb-2 text-left text-text-mid">
          {title}. {caption}
        </caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="t-overline py-1.5 pr-3 text-left text-text-lo">
              {xLabel}
            </th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="t-overline py-1.5 pl-3 text-right text-text-lo">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                className="t-body-sm py-1.5 pr-3 text-left font-normal text-text-mid"
                style={{ height: "var(--row-h, 36px)" }}
              >
                {d.label}
              </th>
              {series.map((s) => (
                <td
                  key={s.key}
                  className="t-mono py-1.5 pl-3 text-right text-text-hi"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {d.values[s.key] === undefined ? "—" : formatValue(d.values[s.key]!, s.unit, true)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton matched to the chart's final geometry, so nothing shifts on load. */
export function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="px-4 pb-4" aria-hidden>
      <div className="pv-skeleton w-full" style={{ height }} />
    </div>
  );
}
