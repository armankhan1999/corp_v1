import * as React from "react";
import { Suspense } from "react";
import { Panel, Skeleton } from "@/components/patterns/primitives";
import type { ChartSpec } from "./chartTypes";
import type { KpiTileData } from "./kpiRegistry";
import { AnalyticsHeader } from "./AnalyticsHeader";
import { ChartPanel } from "./ChartPanel";
import { KpiTile } from "./KpiTile";
import { chartToRows } from "./exportUtils";
import type { SurfaceContext } from "./surfaceContext";

/**
 * The frame all five surfaces share. Header, dictionary tiles, then charts —
 * in that order on every surface, so a reader who learns one has learned five.
 */
export function SurfaceLayout({
  title, intent, context, kpis, charts, csvName, children, footer,
}: {
  title: string;
  intent: string;
  context: SurfaceContext;
  kpis: KpiTileData[];
  charts: ChartSpec[];
  csvName: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const csvSections = [
    {
      title: "KPI dictionary values",
      rows: [
        ["KPI", "Name", "Value", "Basis", "Records", "Formula"],
        ...kpis.map((k) => [
          k.id,
          k.name,
          k.value,
          k.delta ? `${k.delta.pctText} ${k.delta.basisInWords}` : "no comparison basis applied",
          String(k.recordCount),
          k.formula,
        ]),
      ],
    },
    ...charts.filter((s) => s.data.length > 0).map((s) => ({ title: s.title, rows: chartToRows(s).slice(1) })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<HeaderSkeleton />}>
        <AnalyticsHeader
          title={title}
          intent={intent}
          period={context.periodKey}
          basis={context.basis}
          branchId={context.scope.branchId}
          branchOptions={context.scope.selectable}
          branchLocked={context.scope.locked}
          lockReason={context.scope.lockReason}
          scopeStatement={context.scope.statement}
          periodRange={context.period.rangeLabel}
          provenance={context.provenance}
          csvSections={csvSections}
          csvName={csvName}
        />
      </Suspense>

      {kpis.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kpis.map((k) => (
            <li key={k.id} className="flex">
              <KpiTile kpi={k} className="w-full" />
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {charts.map((spec) => (
          <ChartPanel
            key={spec.id}
            spec={spec}
            provenance={context.provenance}
            className={spec.height && spec.height >= 300 ? "xl:col-span-2" : undefined}
          />
        ))}
      </div>

      {footer}

      <Panel className="px-4 py-3">
        <p className="t-body-sm text-text-mid">
          Every figure on this surface is computed from platform records by the single shared KPI implementation. No
          value here is stored or hand-entered, and the same metric read on the Command Centre or asked of the
          assistant for the same period and scope returns the same number to the last displayed digit.
        </p>
      </Panel>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
