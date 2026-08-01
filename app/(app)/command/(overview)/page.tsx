import Link from "next/link";
import { cookies } from "next/headers";
import { AlertOctagon, LayoutGrid, Maximize2 } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { can, scopeFor } from "@/lib/rbac/matrix";
import { formatCount, formatDateTime } from "@/lib/format";
import type { Role } from "@/lib/schemas/enums";
import { deriveExceptions } from "@/components/domain/command/exceptions";
import { effectiveState, isOutstanding, snapshot } from "@/components/domain/command/exception-state";
import { buildBriefing } from "@/components/domain/command/briefing";
import { buildMetrics } from "@/components/domain/command/metrics";
import { periodQuery, resolvePeriod } from "@/components/domain/command/period";
import { PeriodBar } from "@/components/domain/command/PeriodBar";
import { DailyBriefing } from "@/components/domain/command/DailyBriefing";
import {
  ExecutiveFigures, KpiRow, LockedCashPanel, VerticalTiles,
} from "@/components/domain/command/CommandPanels";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CommandCentre({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const role = (session?.role ?? "DIRECTOR_BUSINESS") as Role;
  const ds = getDataset();
  const now = new Date(ds.meta.today);

  const resolved = resolvePeriod(
    { period: one(sp.period), from: one(sp.from), to: one(sp.to) },
    now,
  );
  const executive = one(sp.view) === "executive";
  const nonce = one(sp.brief) ?? "1";
  const query = periodQuery(resolved);

  const metrics = buildMetrics(ds, resolved);

  /* E2-S4 — the unacknowledged count belongs on this header. */
  const scope = scopeFor(role, "command.exceptions");
  const branch = ds.branches.find((b) => b.id === session?.branchId);
  const exceptions = deriveExceptions(ds, now).filter((r) => {
    if (scope === "BRANCH") return r.branchId === null || r.branchId === session?.branchId;
    if (scope === "ASSIGNED" || scope === "OWN" || scope === "SELF") return r.ownerId === session?.userId;
    return true;
  });
  const states = snapshot();
  const outstanding = exceptions.filter((r) => isOutstanding(states.get(r.id), now)).length;
  const critical = exceptions.filter(
    (r) => r.severity === "CRITICAL" && effectiveState(states.get(r.id), now) !== "SNOOZED",
  ).length;
  const canSeeExceptions = can(role, "command.exceptions");

  const scopeLabel =
    scope === "BRANCH" ? `${branch?.name ?? "Branch"} scope` : "All four branches";
  const briefing = buildBriefing(ds, resolved, exceptions, scopeLabel);

  const exceptionStrip = canSeeExceptions ? (
    <Link
      href="/command/exceptions"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 transition-colors duration-150 hover:border-danger"
    >
      <AlertOctagon className="size-4 shrink-0 text-danger" aria-hidden />
      <span className="t-body font-medium text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatCount(outstanding)} exceptions need attention
      </span>
      <span className="t-body-sm text-text-mid">
        {formatCount(critical)} critical · {scopeLabel.toLowerCase()} · evaluated {formatDateTime(now)} IST
      </span>
      <span className="t-overline ml-auto text-danger">Open the feed</span>
    </Link>
  ) : null;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="t-display-md text-text-hi">Command Centre</h1>
        <p className="t-body-sm mt-1 text-text-mid">
          {executive
            ? "Six figures. Every one opens its records."
            : "All four verticals. Every figure opens its records."}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Link
          href={
            executive
              ? `/command${query}`
              : `/command${query ? `${query}&` : "?"}view=executive`
          }
          className="t-overline inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          {executive ? <LayoutGrid className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
          {executive ? "Full command view" : "Executive view"}
        </Link>
        <p className="t-body-sm text-text-lo">
          Data as of <span className="t-mono text-text-mid">{formatDateTime(now)}</span> IST
        </p>
      </div>
    </div>
  );

  if (executive) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {header}
        <PeriodBar resolved={resolved} basePath="/command" preserve={{ view: "executive" }} />
        {exceptionStrip}
        <ExecutiveFigures kpis={metrics.kpis} />
        <p className="t-body-sm text-text-lo">
          {resolved.label} · compared with {resolved.priorLabel}. Position figures are stated as at{" "}
          <span className="t-mono text-text-mid">{formatDateTime(resolved.asOf)}</span> IST.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <PeriodBar resolved={resolved} basePath="/command" />
      {exceptionStrip}

      {/* E2-S1 */}
      <KpiRow kpis={metrics.kpis} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* E2-S2 */}
          <VerticalTiles tiles={metrics.tiles} />
          {/* E2-S6 */}
          <DailyBriefing
            briefing={briefing}
            nonce={nonce}
            regenerateHref={`/command${query ? `${query}&` : "?"}brief=${Number(nonce) + 1}`}
          />
        </div>

        {/* E2-S3 */}
        <LockedCashPanel
          locked={metrics.locked}
          rec={metrics.receivables}
          ret={metrics.retention}
          asOf={resolved.asOf}
        />
      </div>
    </div>
  );
}
