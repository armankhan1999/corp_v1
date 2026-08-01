import { cookies } from "next/headers";
import Link from "next/link";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canCreate as rbacCanCreate } from "@/lib/rbac/matrix";
import { formatCount, formatPercent } from "@/lib/format";
import { Panel, PanelHeader, Overline } from "@/components/patterns/primitives";
import { serviceCtx } from "@/components/domain/service/project";
import { TicketsTable, type TicketFilters, type TicketRow } from "@/components/domain/service/TicketsTable";

export const dynamic = "force-dynamic";

const ROW_CAP = 150;

function one(v: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const filters: TicketFilters = {
    q: one(sp.q, "").trim(),
    status: one(sp.status, "ALL"),
    severity: one(sp.severity, "ALL"),
    coverage: one(sp.coverage, "ALL"),
    sla: one(sp.sla, "ALL"),
    scope: one(sp.scope, "OPEN"),
  };

  const { ds, now, nowMs, holidayKeys } = serviceCtx();
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const siteById = new Map(ds.sites.map((s) => [s.id, s]));
  const empById = new Map(ds.employees.map((e) => [e.id, e]));

  const needle = filters.q.toLowerCase();
  const matched = ds.tickets.filter((t) => {
    if (filters.scope === "OPEN" && !D.isOpenTicket(t)) return false;
    if (filters.scope === "BREACHED" && !t.breachedAt) return false;
    if (filters.status !== "ALL" && t.status !== filters.status) return false;
    if (filters.severity !== "ALL" && t.severity !== filters.severity) return false;
    if (filters.coverage !== "ALL" && t.coverage !== filters.coverage) return false;
    if (filters.sla !== "ALL" && D.slaClock(t, now).state !== filters.sla) return false;
    if (needle) {
      const asset = assetById.get(t.assetId);
      const customer = customerById.get(t.customerId);
      const hay = [t.number, asset?.serial, asset?.model, customer?.tradeName, customer?.legalName, t.problem]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sorted = [...matched].sort((a, b) => {
    const openA = D.isOpenTicket(a);
    const openB = D.isOpenTicket(b);
    if (openA !== openB) return openA ? -1 : 1;
    if (openA) return D.slaClock(a, now).remainingMs - D.slaClock(b, now).remainingMs;
    return new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime();
  });

  const rows: TicketRow[] = sorted.slice(0, ROW_CAP).map((t) => {
    const asset = assetById.get(t.assetId);
    const site = siteById.get(t.siteId);
    const customer = customerById.get(t.customerId);
    const eng = t.assignedEngineerId ? empById.get(t.assignedEngineerId) : undefined;
    return {
      id: t.id,
      number: t.number,
      customerName: customer?.tradeName ?? "—",
      siteName: site?.name ?? "—",
      siteDistrict: site?.district ?? "—",
      assetSerial: asset?.serial ?? "—",
      assetModel: asset?.model ?? "—",
      severity: t.severity,
      coverage: t.coverage,
      status: t.status,
      category: t.category,
      engineerName: eng?.name ?? null,
      loggedAtMs: new Date(t.loggedAt).getTime(),
      restorationDueMs: new Date(t.restorationDue).getTime(),
      restoredAtMs: t.restoredAt ? new Date(t.restoredAt).getTime() : null,
      pausedMs: t.pausedMs,
      pauseStartedAtMs: t.pauseStartedAt ? new Date(t.pauseStartedAt).getTime() : null,
      businessHours: t.slaBusinessHours,
      breachedAtMs: t.breachedAt ? new Date(t.breachedAt).getTime() : null,
      breachReasonCode: t.breachReasonCode,
      slaRuleApplied: t.slaRuleApplied,
    };
  });

  const open = ds.tickets.filter(D.isOpenTicket);
  const states = { BREACHED: 0, IMMINENT: 0, APPROACHING: 0, COMFORTABLE: 0 };
  for (const t of open) states[D.slaClock(t, now).state] += 1;

  const fy = D.fyToDate(now);
  const compliance = D.slaCompliancePct(ds, fy);
  const ftfr = D.firstTimeFixRate(ds, fy);
  const mean = D.meanResponseRestoreHours(ds, fy);

  const stats = [
    { label: "Open commitments", value: formatCount(open.length), sub: "live clocks", href: "/service/dispatch" },
    { label: "Breached", value: formatCount(states.BREACHED), sub: "reason code stored", href: "/service/tickets?scope=BREACHED", tone: "text-sla-breached" },
    { label: "Imminent", value: formatCount(states.IMMINENT), sub: "under 10% remaining", href: "/service/tickets?sla=IMMINENT", tone: "text-sla-imminent" },
    { label: "Approaching", value: formatCount(states.APPROACHING), sub: "under 25% remaining", href: "/service/tickets?sla=APPROACHING", tone: "text-sla-approaching" },
    { label: "SLA compliance", value: formatPercent(compliance), sub: "closed this FY", href: "/analytics/service" },
    { label: "First-time fix", value: formatPercent(ftfr), sub: "derived from job cards", href: "/service/job-cards" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Service tickets</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
            Every request logged against a serial-numbered machine, with coverage derived from the
            live warranty and AMC state and a commitment clock resolved from the applicable rule.
          </p>
        </div>
        <p className="t-body-sm text-text-lo">
          Mean response <span className="t-mono text-text-mid">{mean.respond.toFixed(1)} h</span> ·
          mean restore <span className="t-mono text-text-mid">{mean.restore.toFixed(1)} h</span>
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="flex h-full flex-col gap-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3 transition-colors duration-150 hover:border-line-strong"
            >
              <Overline>{s.label}</Overline>
              <span className={`t-display-md tabular-nums ${s.tone ?? "text-text-hi"}`}>{s.value}</span>
              <span className="t-body-sm text-text-lo">{s.sub}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Panel>
        <PanelHeader
          title="Ticket register"
          sub="Open tickets sort by time-to-breach ascending; closed history sorts newest first."
        />
        <TicketsTable
          rows={rows}
          filters={filters}
          nowMs={nowMs}
          holidays={holidayKeys}
          total={matched.length}
          shown={rows.length}
          canCreate={session ? rbacCanCreate(session.role, "tickets") : false}
        />
      </Panel>
    </div>
  );
}
