import { buildKpiTile, kpisForSurface } from "@/components/domain/analytics/kpiRegistry";
import { SurfaceLayout } from "@/components/domain/analytics/SurfaceLayout";
import { buildSurfaceContext, type SearchParams } from "@/components/domain/analytics/surfaceContext";
import { buildSalesCharts } from "@/components/domain/analytics/surfaces/sales";

export const dynamic = "force-dynamic";

export default async function SalesAnalytics({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await buildSurfaceContext("Sales analytics", "analytics.sales", await searchParams);
  const kpis = kpisForSurface("sales").map((def) => buildKpiTile(def, context.kpiInput, context.comparison));
  const charts = buildSalesCharts(context);

  return (
    <SurfaceLayout
      title="Sales analytics"
      intent="The funnel, the win rate and the reasons for loss, computed from the enquiry and quotation records rather than from a pipeline anyone maintains by hand."
      context={context}
      kpis={kpis}
      charts={charts}
      csvName="pravaah-sales-analytics.csv"
    />
  );
}
