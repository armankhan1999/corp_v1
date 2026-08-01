"use client";

import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Download, Table2 } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { formatCount, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChartSpec, Datum } from "./chartTypes";
import { ChartLegend, ChartSkeleton, SeriesTable } from "./ChartPrimitives";
import { SeriesChart } from "./SeriesChart";
import { RecordSetDrawer } from "./RecordSetDrawer";
import { buildCsv, downloadCsv, chartToRows, type Provenance } from "./exportUtils";

/**
 * The frame every chart sits in. It carries the four obligations E12 places on
 * a chart that the chart itself cannot: the tabular equivalent (E12-S4), the
 * anomaly flag with its baseline and tolerance (E12-S4), the drill-through to
 * contributing records (E12-S2), and a per-chart CSV that carries provenance.
 */

export function ChartPanel({
  spec, provenance, className, defaultTable = false,
}: {
  spec: ChartSpec;
  provenance: Provenance;
  className?: string;
  defaultTable?: boolean;
}) {
  const [mode, setMode] = React.useState<"chart" | "table">(defaultTable ? "table" : "chart");
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [drill, setDrill] = React.useState<Datum | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (prev.size < spec.series.length - 1) next.add(key);
      return next;
    });

  const height = spec.height ?? 260;
  const empty = spec.data.length === 0;

  function exportChart() {
    downloadCsv(
      `pravaah-${spec.id}.csv`,
      buildCsv(provenance, [{ title: spec.title, rows: chartToRows(spec).slice(1) }]),
    );
  }

  return (
    <Panel className={cn("flex flex-col", className)}>
      <PanelHeader
        title={spec.title}
        sub={spec.caption}
        right={
          <div className="flex items-center gap-1">
            <div
              role="group"
              aria-label={`View ${spec.title} as chart or table`}
              className="flex overflow-hidden rounded-md border border-line"
            >
              <button
                type="button"
                onClick={() => setMode("chart")}
                aria-pressed={mode === "chart"}
                data-testid={`view-chart-${spec.id}`}
                className={cn(
                  "flex h-7 items-center gap-1 px-2 text-[0.75rem] transition-colors duration-150",
                  mode === "chart" ? "bg-surface-2 text-text-hi" : "text-text-lo hover:text-text-hi",
                )}
              >
                <BarChart3 className="size-3.5" aria-hidden />
                Chart
              </button>
              <button
                type="button"
                onClick={() => setMode("table")}
                aria-pressed={mode === "table"}
                data-testid={`view-table-${spec.id}`}
                className={cn(
                  "flex h-7 items-center gap-1 border-l border-line px-2 text-[0.75rem] transition-colors duration-150",
                  mode === "table" ? "bg-surface-2 text-text-hi" : "text-text-lo hover:text-text-hi",
                )}
              >
                <Table2 className="size-3.5" aria-hidden />
                Table
              </button>
            </div>
            <button
              type="button"
              onClick={exportChart}
              aria-label={`Export ${spec.title} to CSV`}
              data-testid={`export-${spec.id}`}
              className="grid size-7 place-items-center rounded-md border border-line text-text-lo hover:border-line-strong hover:text-text-hi print:hidden"
            >
              <Download className="size-3.5" aria-hidden />
            </button>
          </div>
        }
      />

      {spec.anomaly ? <AnomalyStrip flag={spec.anomaly} /> : null}
      {spec.note ? (
        <p className="t-body-sm border-b border-line bg-surface-2 px-4 py-2 text-text-mid">{spec.note}</p>
      ) : null}

      {empty ? (
        <div className="px-4 py-10 text-center">
          <p className="t-body text-text-mid">No records fall inside this period and scope.</p>
          <p className="t-body-sm mt-1 text-text-lo">
            {provenance.periodLabel} · {provenance.branchLabel}. Widen the period or clear the branch filter in the
            header above.
          </p>
        </div>
      ) : spec.insufficient ? (
        <div className="border-l-2 border-warn px-4 py-6">
          <StatusBadge tone="warn">Data sufficiency</StatusBadge>
          <p className="t-body mt-2 text-text-mid">{spec.insufficient}</p>
        </div>
      ) : mode === "table" ? (
        <SeriesTable
          id={spec.id}
          title={spec.title}
          xLabel={spec.xLabel}
          series={spec.series}
          data={spec.data}
          caption={spec.caption}
        />
      ) : (
        <>
          {/* Chart is decorative to a screen reader — the table above is the equivalent. */}
          <div aria-hidden={false} role="img" aria-label={`${spec.title}. ${spec.caption} Use the Table control for a data table of the same series.`}>
            {mounted ? (
              <SeriesChart spec={spec} hidden={hidden} onSelect={(d) => setDrill(d)} />
            ) : (
              <ChartSkeleton height={height} />
            )}
          </div>
          <ChartLegend
            series={spec.series}
            hidden={hidden}
            onToggle={toggle}
            idPrefix={spec.id}
            patterned={spec.series.length > 1}
          />
        </>
      )}

      {drill?.drill ? <RecordSetDrawer set={drill.drill} onClose={() => setDrill(null)} /> : null}
    </Panel>
  );
}

function AnomalyStrip({ flag }: { flag: NonNullable<ChartSpec["anomaly"]> }) {
  const [open, setOpen] = React.useState(false);
  const Icon = flag.direction === "ABOVE" ? ArrowUp : ArrowDown;
  const tone = flag.favourable ? "ok" : "danger";
  return (
    <div
      className={cn(
        "border-b border-line px-4 py-2",
        flag.favourable ? "bg-ok-bg" : "bg-danger-bg",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone}>
          <Icon className="size-3" aria-hidden />
          {formatPercent(Math.abs(flag.deviationPct))} {flag.direction === "ABOVE" ? "above" : "below"} baseline
        </StatusBadge>
        <p className="t-body-sm text-text-mid">
          {flag.metricName} in {flag.latestLabel} deviates beyond the {formatPercent(flag.tolerancePct)} tolerance.
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="t-body-sm ml-auto rounded-md border border-line px-2 py-0.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          {open ? "Hide basis" : "Why flagged"}
        </button>
      </div>
      {open ? (
        <div className="mt-2 border-t border-line pt-2">
          <p className="t-body-sm text-text-mid">{flag.explanation}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            <Cell label="Baseline period" value={flag.baselineLabel} />
            <Cell label="Baseline value" value={String(flag.baselineValue)} />
            <Cell label="Latest value" value={String(flag.latestValue)} />
            <Cell label="Tolerance" value={`± ${formatPercent(flag.tolerancePct)}`} />
          </dl>
          <a
            href={flag.recordSetHref}
            className="t-body-sm mt-2 inline-flex items-center gap-1 text-info underline underline-offset-2"
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            {flag.recordSetLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-overline text-text-lo">{label}</dt>
      <dd className="t-mono text-text-hi">{value}</dd>
    </div>
  );
}

export { formatCount };
