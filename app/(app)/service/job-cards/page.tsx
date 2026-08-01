import Link from "next/link";
import { Info } from "lucide-react";
import * as D from "@/lib/derive";
import { scopeFor } from "@/lib/rbac/matrix";
import { getDataset } from "@/lib/seed";
import { formatCount, formatPercent } from "@/lib/format";
import { Overline, Panel, PanelHeader } from "@/components/patterns/primitives";
import { requireSession } from "@/components/domain/admin/serverSession";
import { serviceCtx } from "@/components/domain/service/project";
import {
  JobCardsTable,
  type JobCardFilters,
  type JobCardRow,
} from "@/components/domain/service/JobCardsTable";

export const dynamic = "force-dynamic";

const ROW_CAP = 150;

function one(v: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

/**
 * E4-S4 — the desktop job-card register. Every visit against every ticket, with
 * the first-visit resolution flag derived rather than stored.
 */
export default async function JobCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const { ds, now } = serviceCtx();

  const filters: JobCardFilters = {
    q: one(sp.q, "").trim(),
    engineer: one(sp.engineer, "ALL"),
    outcome: one(sp.outcome, "ALL"),
    from: one(sp.from, ""),
    to: one(sp.to, ""),
  };

  const me = getDataset().users.find((u) => u.id === session.userId);
  const scope = scopeFor(session.role, "jobCards");

  const ticketById = new Map(ds.tickets.map((t) => [t.id, t]));
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const siteById = new Map(ds.sites.map((s) => [s.id, s]));
  const empById = new Map(ds.employees.map((e) => [e.id, e]));

  const partsByCard = new Map<string, number>();
  for (const p of ds.partConsumptions) {
    partsByCard.set(p.jobCardId, (partsByCard.get(p.jobCardId) ?? 0) + 1);
  }

  const inScope = (branchId: string, engineerId: string): boolean => {
    if (scope === "BRANCH") return branchId === session.branchId;
    if (scope === "OWN" || scope === "ASSIGNED") return engineerId === me?.employeeId;
    return true;
  };

  const scoped = ds.jobCards.filter((j) => {
    const t = ticketById.get(j.ticketId);
    return inScope(t?.branchId ?? "", j.engineerUserId);
  });

  const fromMs = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const toMs = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;
  const needle = filters.q.toLowerCase();

  const matched = scoped.filter((j) => {
    if (filters.engineer !== "ALL" && j.engineerUserId !== filters.engineer) return false;
    if (filters.outcome === "OPEN") {
      if (j.submittedAt) return false;
    } else if (filters.outcome !== "ALL" && j.outcome !== filters.outcome) return false;
    const visitMs = new Date(j.scheduledDate).getTime();
    if (fromMs !== null && visitMs < fromMs) return false;
    if (toMs !== null && visitMs > toMs) return false;
    if (needle) {
      const t = ticketById.get(j.ticketId);
      const asset = assetById.get(j.assetId);
      const customer = t ? customerById.get(t.customerId) : undefined;
      const hay = [j.number, t?.number, asset?.serial, asset?.model, customer?.tradeName, j.workPerformed]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sorted = [...matched].sort(
    (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
  );

  const rows: JobCardRow[] = sorted.slice(0, ROW_CAP).map((j) => {
    const t = ticketById.get(j.ticketId);
    const asset = assetById.get(j.assetId);
    const customer = t ? customerById.get(t.customerId) : undefined;
    const site = t ? siteById.get(t.siteId) : undefined;
    const eng = empById.get(j.engineerUserId);
    return {
      id: j.id,
      number: j.number,
      ticketId: j.ticketId,
      ticketNumber: t?.number ?? "—",
      customerName: customer?.tradeName ?? "—",
      siteName: site?.name ?? "—",
      siteDistrict: site?.district ?? "",
      assetSerial: asset?.serial ?? "—",
      assetModel: asset?.model ?? "—",
      engineerId: j.engineerUserId,
      engineerName: eng?.name ?? j.engineerUserId,
      visitSequence: j.visitSequence,
      visitType: j.visitType,
      outcome: j.outcome,
      partsCount: partsByCard.get(j.id) ?? 0,
      coverage: t?.coverage ?? "CHARGEABLE",
      scheduledDateMs: new Date(j.scheduledDate).getTime(),
      submittedAtMs: j.submittedAt ? new Date(j.submittedAt).getTime() : null,
    };
  });

  const engineers = [...new Set(scoped.map((j) => j.engineerUserId))]
    .map((id) => ({ id, name: empById.get(id)?.name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const submitted = scoped.filter((j) => j.submittedAt).length;
  const resolvedCards = scoped.filter((j) => j.outcome === "RESOLVED").length;
  // Same rule as `firstVisitResolved` in components/domain/service/store, which
  // is a "use client" module and so cannot be called from a server component.
  const firstVisit = scoped.filter((j) => j.outcome === "RESOLVED" && j.visitSequence === 1).length;
  const partsCards = scoped.filter((j) => (partsByCard.get(j.id) ?? 0) > 0).length;
  const ftfr = D.firstTimeFixRate(ds, D.fyToDate(now));

  const stats = [
    { label: "Job cards", value: formatCount(scoped.length), sub: `${formatCount(submitted)} submitted` },
    { label: "Resolved outcome", value: formatCount(resolvedCards), sub: "of every visit recorded" },
    {
      label: "First-visit resolved",
      value: formatCount(firstVisit),
      sub: "derived, never entered",
      tone: firstVisit ? "text-ok" : "text-text-hi",
    },
    { label: "First-time fix rate", value: formatPercent(ftfr), sub: "K-06, closed this FY", href: "/analytics/service" },
    { label: "Visits consuming parts", value: formatCount(partsCards), sub: "linked to stock issues", href: "/inventory/stock" },
    { label: "Engineers on the register", value: formatCount(engineers.length), sub: "with at least one visit" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Job cards</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
            One card per visit. A ticket may carry several, so the visit sequence is on every row and
            the first-visit resolution flag is computed from outcome and sequence rather than typed.
          </p>
        </div>
        <p className="t-body-sm text-text-lo">
          {scope === "BRANCH"
            ? "Scoped to your branch"
            : scope === "OWN" || scope === "ASSIGNED"
              ? "Scoped to your own visits"
              : "All branches"}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const body = (
            <>
              <Overline>{s.label}</Overline>
              <span className={`t-display-md tabular-nums ${s.tone ?? "text-text-hi"}`}>{s.value}</span>
              <span className="t-body-sm text-text-lo">{s.sub}</span>
            </>
          );
          return (
            <li key={s.label}>
              {s.href ? (
                <Link
                  href={s.href}
                  className="flex h-full flex-col gap-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3 transition-colors duration-150 hover:border-line-strong"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex h-full flex-col gap-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="t-body-sm flex items-start gap-1.5 text-text-lo">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        First-visit resolution is derived as{" "}
        <span className="t-mono text-text-mid">outcome = Resolved AND visit sequence = 1</span>. No
        screen offers a control that sets it, so the figure cannot drift from the visit record.
      </p>

      <Panel>
        <PanelHeader
          title="Visit register"
          sub="Filter by engineer, outcome and visit date. Rows open the full card and its service report preview."
        />
        <JobCardsTable
          rows={rows}
          filters={filters}
          engineers={engineers}
          total={matched.length}
          shown={rows.length}
        />
      </Panel>
    </div>
  );
}
