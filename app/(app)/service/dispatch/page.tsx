import Link from "next/link";
import * as D from "@/lib/derive";
import { canWrite, scopeFor } from "@/lib/rbac/matrix";
import { formatCount, formatDate } from "@/lib/format";
import { getDataset } from "@/lib/seed";
import { Overline } from "@/components/patterns/primitives";
import { requireSession } from "@/components/domain/admin/serverSession";
import {
  projectEngineers,
  projectPlannedVisits,
  serviceCtx,
} from "@/components/domain/service/project";
import { DispatchBoard, type DispatchCard } from "@/components/domain/service/DispatchBoard";
import { BlockedNotice } from "@/components/domain/service/ui";

export const dynamic = "force-dynamic";

/** E4-S3 — every open commitment and every engineer's load on one screen. */
const PLANNED_HORIZON_DAYS = 7;

export default async function DispatchPage() {
  const session = await requireSession();
  const { ds, now, nowMs, holidayKeys } = serviceCtx();

  const users = getDataset().users;
  const me = users.find((u) => u.id === session.userId);
  const scope = scopeFor(session.role, "dispatch");
  const writable = canWrite(session.role, "dispatch");

  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const siteById = new Map(ds.sites.map((s) => [s.id, s]));
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const empById = new Map(ds.employees.map((e) => [e.id, e]));

  /**
   * RBAC-2 scoping. A branch manager sees their branch, a field engineer sees
   * their own work; everyone else sees the whole desk.
   */
  const inScope = (branchId: string, engineerId: string | null): boolean => {
    if (scope === "BRANCH") return branchId === session.branchId;
    if (scope === "OWN" || scope === "ASSIGNED") return engineerId !== null && engineerId === me?.employeeId;
    return true;
  };

  /**
   * The lanes named by E4-S3 run Logged → Resolved, so the board carries every
   * ticket that is still open plus anything resolved but not yet closed.
   */
  const boardTickets = ds.tickets.filter(
    (t) => (D.isOpenTicket(t) || t.status === "RESOLVED") && inScope(t.branchId, t.assignedEngineerId),
  );

  const cards: DispatchCard[] = boardTickets.map((t) => {
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
      assetPrincipal: asset?.principal ?? "ELGI",
      severity: t.severity,
      coverage: t.coverage,
      status: t.status,
      branchId: t.branchId,
      engineerId: t.assignedEngineerId,
      engineerName: eng?.name ?? null,
      problem: t.problem,
      loggedAtMs: new Date(t.loggedAt).getTime(),
      restorationDueMs: new Date(t.restorationDue).getTime(),
      restoredAtMs: t.restoredAt ? new Date(t.restoredAt).getTime() : null,
      pausedMs: t.pausedMs,
      pauseStartedAtMs: t.pauseStartedAt ? new Date(t.pauseStartedAt).getTime() : null,
      businessHours: t.slaBusinessHours,
      breachedAtMs: t.breachedAt ? new Date(t.breachedAt).getTime() : null,
      breachReasonCode: t.breachReasonCode,
    };
  });

  const allEngineers = projectEngineers(ds, now);
  const engineers =
    scope === "BRANCH"
      ? allEngineers.filter((e) => e.branchId === session.branchId)
      : scope === "OWN" || scope === "ASSIGNED"
        ? allEngineers.filter((e) => e.id === me?.employeeId)
        : allEngineers;

  const planned = projectPlannedVisits(ds, now, PLANNED_HORIZON_DAYS).filter((v) =>
    scope === "BRANCH" ? v.branchId === session.branchId : true,
  );

  const open = boardTickets.filter(D.isOpenTicket);
  const states = { BREACHED: 0, IMMINENT: 0, APPROACHING: 0, COMFORTABLE: 0 };
  for (const t of open) states[D.slaClock(t, now).state] += 1;
  const unassigned = open.filter((t) => !t.assignedEngineerId).length;
  const capacity = engineers.reduce((s, e) => s + e.dailyCapacity, 0);
  const load = engineers.reduce((s, e) => s + e.loadToday, 0);

  const stats = [
    { label: "Open commitments", value: formatCount(open.length), sub: "on a live clock", href: "/service/tickets" },
    { label: "Unassigned", value: formatCount(unassigned), sub: "waiting for an engineer", tone: unassigned ? "text-warn" : "text-text-hi", href: "/service/tickets?status=LOGGED" },
    { label: "Breached", value: formatCount(states.BREACHED), sub: "reason code stored", tone: "text-sla-breached", href: "/service/tickets?scope=BREACHED" },
    { label: "Imminent", value: formatCount(states.IMMINENT), sub: "under 10% remaining", tone: "text-sla-imminent", href: "/service/tickets?sla=IMMINENT" },
    { label: "Load against capacity", value: `${load} / ${capacity}`, sub: `${engineers.length} field engineers`, href: "/people/employees" },
    { label: "Preventive due", value: formatCount(planned.length), sub: `within ${PLANNED_HORIZON_DAYS} days`, tone: "text-v-service", href: "/service/amc" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Dispatch board</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
            Every open ticket in a status lane, sorted by time to breach ascending, against every
            engineer&apos;s load for today. Assignment is either a drag or the Assign dialog — the
            dialog is the keyboard path and enforces the capacity and certification gates.
          </p>
        </div>
        <p className="t-body-sm text-text-lo">
          Simulated today <span className="t-mono text-text-mid">{formatDate(now)}</span>
          {scope === "BRANCH" ? " · scoped to your branch" : scope === "OWN" || scope === "ASSIGNED" ? " · scoped to your own work" : ""}
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

      {!writable ? (
        <BlockedNotice
          rule="Your role can read the dispatch board but cannot assign work."
          unblock={
            <>
              Assignment is held by the Service Manager and Super Admin. Ask the Service Manager to
              assign, or sign in with that role from the{" "}
              <Link href="/login" className="text-text-hi underline">
                demo persona switcher
              </Link>
              .
            </>
          }
        />
      ) : null}

      <DispatchBoard
        cards={cards}
        engineers={engineers}
        planned={planned}
        nowMs={nowMs}
        holidays={holidayKeys}
        canWrite={writable}
        actorName={session.name}
      />
    </div>
  );
}
