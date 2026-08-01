import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowDown, ArrowUp, ChevronsUpDown, Lock, Scale, Sprout } from "lucide-react";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { abbreviateINR, formatCount, formatDateTime, formatPercent } from "@/lib/format";
import { Panel, PanelHeader, Overline, StatusBadge, Explainer } from "@/components/patterns/primitives";
import type { Role } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { PeriodBar } from "@/components/domain/command/PeriodBar";
import { periodQuery, resolvePeriod } from "@/components/domain/command/period";
import {
  buildLeague, coachingNotes, METRIC_LABEL, NORMALISATION, sortLeague, WEIGHTS,
  type MetricKey, type SortKey,
} from "@/components/domain/command/league";

export const dynamic = "force-dynamic";

const BASE = "/command/branches";
const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "branch", label: "Branch", numeric: false },
  { key: "revenue", label: METRIC_LABEL.revenue, numeric: true },
  { key: "sla", label: METRIC_LABEL.sla, numeric: true },
  { key: "receivables", label: METRIC_LABEL.receivables, numeric: true },
  { key: "amc", label: METRIC_LABEL.amc, numeric: true },
  { key: "composite", label: "Composite", numeric: true },
];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function BranchLeaguePage({
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
  const query = periodQuery(resolved);
  const league = buildLeague(ds, resolved, query);

  const rawSort = (one(sp.sort) ?? "composite") as SortKey;
  const sort: SortKey = COLUMNS.some((c) => c.key === rawSort) ? rawSort : "composite";
  const dir = one(sp.dir) === "asc" ? "asc" : "desc";
  const ordered = sortLeague(league.rows, sort, dir);

  /** E2-S5: a branch manager compares against everyone but drills only into their own. */
  const drillLocked = role === "BRANCH_MANAGER";
  const ownBranchId = session?.branchId ?? null;
  const notes = coachingNotes(league);

  const sortHref = (key: SortKey) => {
    const q = new URLSearchParams();
    if (resolved.key !== "THIS_FY") q.set("period", resolved.key);
    if (resolved.key === "CUSTOM" && !resolved.error) {
      q.set("from", resolved.fromInput);
      q.set("to", resolved.toInput);
    }
    q.set("sort", key);
    q.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `${BASE}?${q.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Branch league table</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">Four branches, like for like. Every column is a ratio against its own base.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Four branches on a like-for-like basis. Every column is a ratio against that branch&rsquo;s
            own base, so size is neutralised before anything is compared. The method is printed
            below the table — the ranking is arithmetic you can check, not an opinion.
        </Explainer>
        </div>
        <p className="t-body-sm text-text-lo">
          Position as at <span className="t-mono text-text-mid">{formatDateTime(resolved.asOf)}</span> IST
        </p>
      </div>

      <PeriodBar
        resolved={resolved}
        basePath={BASE}
        preserve={{ sort, dir }}
        asOfNote="so receivables health reflects the ledger on that date"
      />

      <Panel>
        <PanelHeader
          title={`Standings — ${resolved.label}`}
          sub={`Targets pro-rated to ${formatPercent(league.elapsedFraction * 100, 1)} of ${league.fyLabel}. Rank shown is the position under the active sort.`}
          right={
            drillLocked ? (
              <StatusBadge tone="info">
                <Lock className="size-3" aria-hidden />
                Compare all · drill own branch
              </StatusBadge>
            ) : null
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse">
            <caption className="sr-only">
              Branch performance ranked on a normalised composite of revenue against target, SLA
              compliance, receivables health and AMC renewal rate.
            </caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="t-overline px-3 py-2 text-left font-semibold text-text-lo">
                  Rank
                </th>
                {COLUMNS.map((c) => {
                  const active = sort === c.key;
                  const Icon = active ? (dir === "desc" ? ArrowDown : ArrowUp) : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
                      className={cn(
                        "t-overline px-3 py-2 font-semibold",
                        c.numeric ? "text-right" : "text-left",
                        active ? "text-text-hi" : "text-text-lo",
                      )}
                    >
                      <Link
                        href={sortHref(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-text-hi",
                          c.numeric && "flex-row-reverse",
                        )}
                      >
                        <Icon className="size-3 shrink-0" aria-hidden />
                        {c.label}
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, i) => {
                const isOwn = row.branch.id === ownBranchId;
                return (
                  <tr
                    key={row.branch.id}
                    className={cn(
                      "border-b border-line hover:bg-surface-2",
                      isOwn && "bg-primary-100/40",
                    )}
                  >
                    <td className="px-3 py-2">
                      <span
                        className="t-mono text-text-hi"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {i + 1}
                      </span>
                      {sort !== "composite" ? (
                        <span className="t-body-sm block whitespace-nowrap text-text-lo">
                          composite #{row.rank}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className="t-body flex items-center gap-2 font-medium text-text-hi">
                        {row.branch.city}
                        {isOwn ? <StatusBadge tone="info">Your branch</StatusBadge> : null}
                      </span>
                      <span className="t-body-sm block text-text-lo">
                        {row.branch.district}, {row.branch.state} · annual target{" "}
                        {abbreviateINR(row.annualTarget)}
                      </span>
                    </td>
                    {(["revenue", "sla", "receivables", "amc"] as MetricKey[]).map((key) => {
                      const cell = row.cells[key];
                      const canDrill = !drillLocked || isOwn;
                      const body = (
                        <>
                          <span
                            className="t-body block font-medium text-text-hi"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {cell.display}
                          </span>
                          <span className="t-body-sm block text-text-lo">{cell.sub}</span>
                          {cell.excluded ? (
                            <span className="t-body-sm block text-warn">
                              Excluded from composite
                            </span>
                          ) : (
                            <span className="t-body-sm block text-text-lo">
                              score {cell.score === null ? "—" : cell.score.toFixed(1)} · weight{" "}
                              {WEIGHTS[key]}
                            </span>
                          )}
                        </>
                      );
                      return (
                        <td key={key} className="px-3 py-2 text-right">
                          {canDrill ? (
                            <Link
                              href={cell.href}
                              className="block rounded-md px-1 py-0.5 hover:bg-surface-3"
                              title={`Open the records behind ${METRIC_LABEL[key].toLowerCase()} for ${row.branch.city}`}
                            >
                              {body}
                            </Link>
                          ) : (
                            <span
                              className="block cursor-not-allowed px-1 py-0.5 opacity-80"
                              title="Comparison is visible to every branch manager; drill-down is limited to your own branch."
                            >
                              {body}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right">
                      <span
                        className="t-heading-md block text-text-hi"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {row.composite.toFixed(1)}
                      </span>
                      <span className="t-body-sm block text-text-lo">{row.weightNote}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {drillLocked ? (
          <p className="t-body-sm border-t border-line px-4 py-2 text-text-mid">
            Every branch is shown so the comparison is honest. Cells outside{" "}
            {ds.branches.find((b) => b.id === ownBranchId)?.city ?? "your branch"} do not open —
            that is the RBAC-2 exception recorded for this screen, not a data gap.
          </p>
        ) : null}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <Panel>
          <PanelHeader
            title="How the composite is built"
            sub="Stated in full so the ranking can be argued with on its arithmetic rather than its motives."
            right={<Scale className="size-4 text-text-lo" aria-hidden />}
          />
          <ol className="flex flex-col gap-px bg-line">
            {NORMALISATION.map((n) => (
              <li key={n.title} className="bg-surface-1 px-4 py-3">
                <p className="t-body font-medium text-text-hi">{n.title}</p>
                <p className="t-body-sm mt-1 text-text-mid">{n.body}</p>
              </li>
            ))}
          </ol>
          <div className="border-t border-line px-4 py-3">
            <Overline>Weights in force</Overline>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {(Object.keys(WEIGHTS) as MetricKey[]).map((k) => {
                const dropped = league.globalExclusions.some((e) => e.key === k);
                return (
                  <li
                    key={k}
                    className={cn(
                      "t-overline rounded-md border px-2 py-1",
                      dropped
                        ? "border-warn/40 bg-warn-bg text-warn"
                        : "border-line bg-surface-2 text-text-mid",
                    )}
                  >
                    {METRIC_LABEL[k]} {dropped ? "excluded" : WEIGHTS[k]}
                  </li>
                );
              })}
            </ul>
            {league.globalExclusions.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {league.globalExclusions.map((e) => (
                  <li key={e.key} className="t-body-sm text-text-mid">
                    <span className="text-warn">{METRIC_LABEL[e.key]}:</span> {e.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Panel>

        <Panel className="self-start">
          <PanelHeader
            title="Where to coach"
            sub="Comparative, not punitive — BRD R-07."
            right={<Sprout className="size-4 text-text-lo" aria-hidden />}
          />
          <ul className="flex flex-col gap-px bg-line">
            {notes.map((n) => (
              <li key={n} className="t-body-sm bg-surface-1 px-4 py-3 text-text-mid">
                {n}
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-3">
            <Overline>Company position</Overline>
            <dl className="mt-1.5 grid grid-cols-2 gap-3">
              <div>
                <dt className="t-body-sm text-text-lo">Revenue, {resolved.label}</dt>
                <dd
                  className="t-body font-medium text-text-hi"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {abbreviateINR(D.revenueInPeriod(ds, resolved.period))}
                </dd>
              </div>
              <div>
                <dt className="t-body-sm text-text-lo">Combined target, pro-rated</dt>
                <dd
                  className="t-body font-medium text-text-hi"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {abbreviateINR(league.rows.reduce((s, r) => s + r.proratedTarget, 0))}
                </dd>
              </div>
              <div>
                <dt className="t-body-sm text-text-lo">Branches ranked</dt>
                <dd className="t-body font-medium text-text-hi">{formatCount(league.rows.length)}</dd>
              </div>
              <div>
                <dt className="t-body-sm text-text-lo">Columns in the composite</dt>
                <dd className="t-body font-medium text-text-hi">
                  {formatCount(Object.keys(WEIGHTS).length - league.globalExclusions.length)} of{" "}
                  {formatCount(Object.keys(WEIGHTS).length)}
                </dd>
              </div>
            </dl>
          </div>
        </Panel>
      </div>
    </div>
  );
}
