import { buildKpiTile, kpisForSurface } from "@/components/domain/analytics/kpiRegistry";
import { SurfaceLayout } from "@/components/domain/analytics/SurfaceLayout";
import { buildSurfaceContext, type SearchParams } from "@/components/domain/analytics/surfaceContext";
import { buildServiceCharts } from "@/components/domain/analytics/surfaces/service";

export const dynamic = "force-dynamic";

export default async function ServiceAnalytics({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await buildSurfaceContext("Service analytics", "analytics.service", await searchParams);
  const kpis = kpisForSurface("service").map((def) => buildKpiTile(def, context.kpiInput, context.comparison));
  const charts = buildServiceCharts(context);

  return (
    <SurfaceLayout
      title="Service analytics"
      intent="Commitments kept, machines covered and the failures that keep recurring — read from tickets, job cards and coverage state, not from a monthly return."
      context={context}
      kpis={kpis}
      charts={charts}
      csvName="pravaah-service-analytics.csv"
    />
  );
}
