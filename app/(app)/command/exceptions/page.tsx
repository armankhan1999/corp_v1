import Link from "next/link";
import { cookies } from "next/headers";
import { AlertOctagon, BookOpen, Gauge } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { scopeFor } from "@/lib/rbac/matrix";
import { formatCount, formatDateTime, enumLabel } from "@/lib/format";
import { Panel, PanelHeader, Overline, Explainer } from "@/components/patterns/primitives";
import {
  EXCEPTION_LABEL, ROLE_LABEL,
  type ExceptionSeverity, type ExceptionType, type Role,
} from "@/lib/schemas/enums";
import {
  countBySeverity, countByType, deriveExceptions, EXCEPTION_RULE, TYPE_ORDER,
} from "@/components/domain/command/exceptions";
import { effectiveState, isOutstanding, snapshot } from "@/components/domain/command/exception-state";
import {
  ExceptionFilters, ExceptionTable, FeedPager, FilteredEmpty, NoExceptions,
  type FeedFilters, type FeedItem,
} from "@/components/domain/command/ExceptionFeed";

export const dynamic = "force-dynamic";

const BASE = "/command/exceptions";
const PAGE_SIZE = 25;

const SEVERITIES: ExceptionSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** Roles that can actually own a remedy. The Auditor is read-only (RBAC-5) and
 *  platform admin holds no business authority, so neither is an assignee. */
const NON_ASSIGNABLE: Role[] = ["AUDITOR", "SUPER_ADMIN"];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ExceptionFeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const role = (session?.role ?? "DIRECTOR_BUSINESS") as Role;
  const ds = getDataset();
  const now = new Date(ds.meta.today);

  /* ---- scope. E2-S4: a branch-scoped role sees only its own branch -------- */
  const scope = scopeFor(role, "command.exceptions");
  const all = deriveExceptions(ds, now);
  const branch = ds.branches.find((b) => b.id === session?.branchId);
  const scoped = all.filter((r) => {
    if (scope === "BRANCH") return r.branchId === null || r.branchId === session?.branchId;
    if (scope === "ASSIGNED" || scope === "OWN" || scope === "SELF") return r.ownerId === session?.userId;
    return true;
  });
  const scopeLabel =
    scope === "BRANCH"
      ? `${branch?.name ?? "Your branch"} and company-wide items`
      : scope === "ASSIGNED" || scope === "OWN" || scope === "SELF"
        ? "Items where you are the accountable owner"
        : "All four branches";

  /* ---- acknowledgement state --------------------------------------------- */
  const states = snapshot();
  const items: FeedItem[] = scoped.map((row) => {
    const entry = states.get(row.id);
    return { row, entry, lifecycle: effectiveState(entry, now) };
  });
  const outstanding = items.filter((i) => isOutstanding(i.entry, now)).length;

  /* ---- filters ------------------------------------------------------------ */
  const rawSeverity = one(sp.severity)?.toUpperCase();
  const rawType = one(sp.type)?.toUpperCase();
  const rawState = one(sp.state)?.toUpperCase();
  const filters: FeedFilters = {
    severity: SEVERITIES.includes(rawSeverity as ExceptionSeverity)
      ? (rawSeverity as ExceptionSeverity)
      : null,
    type: TYPE_ORDER.includes(rawType as ExceptionType) ? (rawType as ExceptionType) : null,
    state:
      rawState === "ALL" || rawState === "ACKNOWLEDGED" || rawState === "SNOOZED" || rawState === "ASSIGNED"
        ? rawState
        : "OUTSTANDING",
  };

  const visible = items.filter((i) => {
    if (filters.severity && i.row.severity !== filters.severity) return false;
    if (filters.type && i.row.type !== filters.type) return false;
    if (filters.state === "ALL") return true;
    if (filters.state === "OUTSTANDING") return isOutstanding(i.entry, now);
    return i.lifecycle === filters.state;
  });

  const activeFilterLabels = [
    filters.severity ? `Severity ${enumLabel(filters.severity)}` : null,
    filters.type ? `Type ${EXCEPTION_LABEL[filters.type]}` : null,
    filters.state !== "OUTSTANDING" ? `State ${enumLabel(filters.state)}` : null,
  ].filter((x): x is string => x !== null);

  const typeCounts = countByType(scoped);
  const severityCounts = countBySeverity(scoped);
  const evaluatedEmpty = TYPE_ORDER.filter((t) => typeCounts[t] === 0);
  const users = ds.users
    .filter((u) => u.active && !NON_ASSIGNABLE.includes(u.role))
    .map((u) => ({ id: u.id, name: u.name, role: ROLE_LABEL[u.role] }));

  /* ---- paging. The whole feed stays reachable; the page stays light. ------ */
  const showAll = one(sp.show) === "all";
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(one(sp.page) ?? 1) || 1), pages);
  const pageItems = showAll ? visible : visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (target: number, all?: boolean) => {
    const q = new URLSearchParams();
    if (filters.severity) q.set("severity", filters.severity);
    if (filters.type) q.set("type", filters.type);
    if (filters.state !== "OUTSTANDING") q.set("state", filters.state);
    if (all) q.set("show", "all");
    else if (target > 1) q.set("page", String(target));
    const s = q.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Exception feed</h1>
          <p className="t-body-sm mt-1 max-w-2xl text-text-mid">Sixteen rules, run on every load. Severity first, then age.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Sixteen rules run against the whole dataset on every load. Ordered by severity, then by
            age. Nothing here was typed in by a person — every row is a rule that fired.
        </Explainer>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="t-overline inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-2 py-1 text-danger"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            <AlertOctagon className="size-3.5" aria-hidden />
            {formatCount(outstanding)} unacknowledged
          </span>
          <span className="t-body-sm text-text-lo">
            Last evaluated <span className="t-mono text-text-mid">{formatDateTime(now)}</span> IST
          </span>
          <Link href="/command" className="t-body-sm inline-flex items-center gap-1 text-text-mid hover:text-text-hi">
            <Gauge className="size-3.5" aria-hidden />
            Back to Command Centre
          </Link>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Feed"
          sub={`${scopeLabel} · ${formatCount(scoped.length)} live exceptions across ${formatCount(TYPE_ORDER.length - evaluatedEmpty.length)} of 16 rules`}
        />
        <ExceptionFilters
          filters={filters}
          counts={typeCounts}
          severityCounts={severityCounts}
          total={scoped.length}
          basePath={BASE}
        />
        {scoped.length === 0 ? (
          <NoExceptions lastEvaluated={now} />
        ) : visible.length === 0 ? (
          <FilteredEmpty active={activeFilterLabels} basePath={BASE} />
        ) : (
          <>
            <ExceptionTable items={pageItems} users={users} now={now} />
            <FeedPager
              total={visible.length}
              from={showAll ? 1 : (page - 1) * PAGE_SIZE + 1}
              to={showAll ? visible.length : Math.min(page * PAGE_SIZE, visible.length)}
              page={page}
              pages={pages}
              hrefFor={(t) => pageHref(t)}
              showAllHref={pageHref(1, !showAll)}
              showingAll={showAll}
            />
          </>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="The rules, in full"
          sub="An exception you cannot argue with is an exception you cannot trust. Every threshold below is published, and every rule runs on every load."
          right={<BookOpen className="size-4 text-text-lo" aria-hidden />}
        />
        <ul className="grid grid-cols-1 gap-px bg-line lg:grid-cols-2">
          {TYPE_ORDER.map((t) => (
            <li key={t} className="flex flex-col gap-1 bg-surface-1 px-4 py-3">
              <span className="flex items-center justify-between gap-2">
                <span className="t-body font-medium text-text-hi">{EXCEPTION_LABEL[t]}</span>
                <span
                  className={`t-mono shrink-0 text-[0.6875rem] ${typeCounts[t] === 0 ? "text-text-lo" : "text-text-hi"}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {typeCounts[t] === 0 ? "0 — evaluated, no match" : `${formatCount(typeCounts[t])} live`}
                </span>
              </span>
              <span className="t-body-sm text-text-mid">{EXCEPTION_RULE[t]}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-4 py-3">
          <Overline>Reading the zeroes</Overline>
          <p className="t-body-sm mt-1 text-text-mid">
            {evaluatedEmpty.length === 0
              ? "Every rule matched at least one record in this scope."
              : `${formatCount(evaluatedEmpty.length)} rules matched nothing in this scope — ${evaluatedEmpty
                  .map((t) => EXCEPTION_LABEL[t].toLowerCase())
                  .join(", ")}. They are shown at zero rather than hidden, so an empty rule is visibly an empty rule and not a missing one.`}
          </p>
        </div>
      </Panel>
    </div>
  );
}
