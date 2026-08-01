import { buildKpiTile, kpisForSurface } from "@/components/domain/analytics/kpiRegistry";
import { SurfaceLayout } from "@/components/domain/analytics/SurfaceLayout";
import { buildSurfaceContext, type SearchParams } from "@/components/domain/analytics/surfaceContext";
import { buildProjectCharts } from "@/components/domain/analytics/surfaces/projects";

export const dynamic = "force-dynamic";

export default async function ProjectAnalytics({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await buildSurfaceContext("Projects analytics", "analytics.projects", await searchParams);
  const kpis = kpisForSurface("projects").map((def) => buildKpiTile(def, context.kpiInput, context.comparison));
  const charts = buildProjectCharts(context);

  return (
    <SurfaceLayout
      title="Projects analytics"
      intent="Physical progress against money certified, project by project. The parts of the business that consume cash, held to the same standard as the parts that earn it."
      context={context}
      kpis={kpis}
      charts={charts}
      csvName="pravaah-projects-analytics.csv"
    />
  );
}
