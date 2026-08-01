import { buildKpiTile, kpisForSurface } from "@/components/domain/analytics/kpiRegistry";
import { SurfaceLayout } from "@/components/domain/analytics/SurfaceLayout";
import { buildSurfaceContext, type SearchParams } from "@/components/domain/analytics/surfaceContext";
import { buildInventoryCharts } from "@/components/domain/analytics/surfaces/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryAnalytics({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await buildSurfaceContext("Inventory analytics", "analytics.inventory", await searchParams);
  const kpis = kpisForSurface("inventory").map((def) => buildKpiTile(def, context.kpiInput, context.comparison));
  const charts = buildInventoryCharts(context);

  return (
    <SurfaceLayout
      title="Inventory analytics"
      intent="What is on the shelf, what is moving, and what an empty shelf costs in second visits. Stock health read as a service problem, not only a working-capital one."
      context={context}
      kpis={kpis}
      charts={charts}
      csvName="pravaah-inventory-analytics.csv"
    />
  );
}
