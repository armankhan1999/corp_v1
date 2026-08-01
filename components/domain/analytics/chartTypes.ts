import type { AnomalyFlag } from "./anomaly";

/**
 * The wire format between a server-rendered analytics surface and the client
 * chart components. Everything here is plain JSON: the surfaces compute with
 * `/lib/derive`, the charts only draw.
 *
 * Two obligations are baked into the shape rather than left to each caller:
 *   • E12-S2 — every datum carries the record set behind it, so a click can
 *     open the contributing records and show an aggregate that equals the value
 *     that was clicked.
 *   • E12-S4 — every series is expressible as a table, so the chart is never
 *     the only way to read the data.
 */

export interface RecordRef {
  id: string;
  label: string;
  sub: string;
  value: string;
  href: string;
}

export interface DrillSet {
  /** "Quotations lost to price" */
  title: string;
  /** The number that was clicked, formatted identically to the chart. */
  aggregateLabel: string;
  aggregateValue: string;
  /** Total contributing records, even when the list below is truncated. */
  totalRecords: number;
  records: RecordRef[];
  /** Full list route, filtered to the same dimension. */
  listHref: string;
  listLabel: string;
}

export interface Datum {
  /** Category key — x-axis label for a bar, slice name for a donut. */
  key: string;
  label: string;
  /** One entry per series, keyed by series key. */
  values: Record<string, number>;
  drill?: DrillSet;
}

export interface SeriesSpec {
  key: string;
  label: string;
  /** 1-8, mapped to --dv-1 … --dv-8 in order. */
  tone: number;
  unit: "PERCENT" | "MONEY" | "DAYS" | "HOURS" | "COUNT" | "RATIO";
  /** Rendering hint for composed charts. */
  as?: "bar" | "line" | "area";
  /** Right-hand axis, for a mixed-unit chart. */
  axis?: "left" | "right";
  stackId?: string;
}

export type ChartKind =
  | "bar"
  | "groupedBar"
  | "stackedBar"
  | "horizontalBar"
  | "line"
  | "area"
  | "stackedArea"
  | "composed"
  | "scatter"
  | "donut";

export interface ChartSpec {
  id: string;
  kind: ChartKind;
  title: string;
  /** What the chart is for, in one sentence. Rendered, not a tooltip. */
  caption: string;
  series: SeriesSpec[];
  data: Datum[];
  xLabel: string;
  yLabel: string;
  /** Second axis label when a series uses axis: "right". */
  y2Label?: string;
  /** Height in px; the skeleton reserves exactly this so nothing shifts. */
  height?: number;
  /** Reference line, e.g. a target or a tolerance threshold. */
  reference?: { value: number; label: string; tone?: "ok" | "warn" | "danger" };
  anomaly?: AnomalyFlag | null;
  /** Sentence shown in place of the chart when the data cannot carry it. */
  insufficient?: string | null;
  /** Named relationship, for the stock-out ↔ FTFR view. */
  note?: string | null;
}

export const DV_TOKENS = [
  "var(--dv-1)", "var(--dv-2)", "var(--dv-3)", "var(--dv-4)",
  "var(--dv-5)", "var(--dv-6)", "var(--dv-7)", "var(--dv-8)",
] as const;

export function toneColor(tone: number): string {
  return DV_TOKENS[(tone - 1) % 8]!;
}

/** Dash signatures so a line is identifiable without colour. NFR-09. */
export const DASH_PATTERNS = ["0", "6 3", "2 3", "10 4 2 4", "1 4", "8 3 1 3", "4 2", "12 5"] as const;

export function dashFor(tone: number): string {
  return DASH_PATTERNS[(tone - 1) % 8]!;
}

/** Marker shapes, the second non-colour signal. */
export const MARKER_SHAPES = ["circle", "square", "triangle", "diamond", "cross", "star", "wye", "circle"] as const;

export function markerFor(tone: number): (typeof MARKER_SHAPES)[number] {
  return MARKER_SHAPES[(tone - 1) % 8]!;
}
