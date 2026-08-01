import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Banknote, Boxes, HardHat, LayoutGrid, Wrench } from "lucide-react";
import { can, type Capability } from "@/lib/rbac/matrix";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { Overline, Panel, PanelHeader, StatusBadge, Explainer } from "@/components/patterns/primitives";
import { formatCount } from "@/lib/format";
import {
  KPI_IDS, KPI_REGISTRY, buildKpiTile, type SurfaceKey,
} from "@/components/domain/analytics/kpiRegistry";
import { KpiTile } from "@/components/domain/analytics/KpiTile";
import { AnalyticsHeader } from "@/components/domain/analytics/AnalyticsHeader";
import { buildSurfaceContext, type SearchParams } from "@/components/domain/analytics/surfaceContext";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const SURFACES: { key: SurfaceKey; label: string; href: string; cap: Capability; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { key: "sales", label: "Sales", href: "/analytics/sales", cap: "analytics.sales", icon: LayoutGrid, blurb: "Funnel, win rate, deal value, targets and the reasons for loss." },
  { key: "service", label: "Service", href: "/analytics/service", cap: "analytics.service", icon: Wrench, blurb: "Commitments, first-time-fix, coverage, commissioning and failure modes." },
  { key: "projects", label: "Projects", href: "/analytics/projects", cap: "analytics.projects", icon: HardHat, blurb: "Portfolio, S-curves, schedule variance, RA-bills and retention." },
  { key: "cash", label: "Cash", href: "/analytics/cash", cap: "analytics.cash", icon: Banknote, blurb: "Revenue, ageing, DSO, collection efficiency and locked cash." },
  { key: "inventory", label: "Inventory", href: "/analytics/inventory", cap: "analytics.inventory", icon: Boxes, blurb: "Stock value, velocity, reorder exposure and stock-out against first-time-fix." },
];

export default async function AnalyticsIndex({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const permitted = SURFACES.filter((s) => can(session.role, s.cap));
  if (permitted.length === 0) redirect("/denied?path=/analytics&cap=analytics.sales");

  const context = await buildSurfaceContext("KPI dictionary", permitted[0]!.cap, await searchParams);
  const visibleSurfaces = new Set(permitted.map((s) => s.key));
  const defs = KPI_IDS.map((id) => KPI_REGISTRY[id]).filter((d) => d.surfaces.some((s) => visibleSurfaces.has(s)));
  const tiles = defs.map((def) => buildKpiTile(def, context.kpiInput, context.comparison));
  const withCaveat = tiles.filter((t) => t.caveat).length;

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={null}>
        <AnalyticsHeader
          title="Analytics & KPI Studio"
          intent="Twenty-two published KPIs, one implementation each. The same period and scope controls sit on every surface, and every tile below will show you the formula it used and the records it used it on."
          period={context.periodKey}
          basis={context.basis}
          branchId={context.scope.branchId}
          branchOptions={context.scope.selectable}
          branchLocked={context.scope.locked}
          lockReason={context.scope.lockReason}
          scopeStatement={context.scope.statement}
          periodRange={context.period.rangeLabel}
          provenance={context.provenance}
          csvName="pravaah-kpi-dictionary.csv"
          csvSections={[
            {
              title: "KPI dictionary",
              rows: [
                ["KPI", "Name", "Value", "Records", "Owner", "Frequency", "Published formula"],
                ...tiles.map((t) => [t.id, t.name, t.value, String(t.recordCount), t.owner, t.frequency, t.formula]),
              ],
            },
          ]}
        />
      </Suspense>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {permitted.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="flex h-full flex-col gap-1.5 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3 transition-colors duration-150 hover:border-line-strong"
            >
              <span className="flex items-center gap-2">
                <s.icon className="size-4 text-text-lo" aria-hidden />
                <span className="t-heading-md text-text-hi">{s.label}</span>
                <ArrowRight className="ml-auto size-3.5 text-text-lo" aria-hidden />
              </span>
              <span className="t-body-sm text-text-mid">{s.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Panel>
        <PanelHeader
          title="The dictionary, computed"
          sub="Every KPI below is produced by the single shared implementation. None is stored, none is entered by hand, and each one will name the record set it came from."
          right={
            withCaveat > 0 ? (
              <StatusBadge tone="warn">
                {formatCount(withCaveat)} carrying a data-sufficiency caveat
              </StatusBadge>
            ) : (
              <StatusBadge tone="ok">All within sufficiency thresholds</StatusBadge>
            )
          }
        />
        <div className="p-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tiles.map((t) => (
              <li key={t.id} className="flex">
                <KpiTile kpi={t} className="w-full" />
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-line px-4 py-3">
          <Overline>Why this page exists</Overline>
          <Explainer className="mt-1 max-w-4xl text-text-mid">
            {formatCount(defs.length)} of the 22 dictionary KPIs are visible to the {context.scope.roleLabel} role;
            the remainder belong to surfaces this role cannot read, and are withheld rather than shown as blanks.
            Each tile calls the same function the Command Centre and the assistant call, so a disagreement between two
            screens is not a reconciliation exercise — it is a defect, and there is one place to fix it.
          </Explainer>
        </div>
      </Panel>
    </div>
  );
}
