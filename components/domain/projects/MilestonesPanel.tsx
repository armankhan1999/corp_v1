"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CheckCircle2, Flag, ShieldAlert } from "lucide-react";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState , Explainer } from "@/components/patterns/primitives";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sCurve, type MilestonePoint } from "./compute";
import {
  BlockedNotice, ChartTableToggle, DenseTableShell, ROW, StatBlock, TD, TDR, TH, THR, WarnNotice,
} from "./ui";

const MILESTONE_TONE: Record<string, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  COMPLETE: "ok", IN_PROGRESS: "info", SLIPPED: "danger", PENDING: "neutral",
};

const MILESTONE_LABEL: Record<string, string> = {
  COMPLETE: "Complete", IN_PROGRESS: "In progress", SLIPPED: "Slipped", PENDING: "Pending",
};

/**
 * E6-S4 — milestones, the S-curve and schedule variance.
 *
 * Total weightage must equal 100; anything else is surfaced as a blocked state
 * because a weightage set that does not close makes the variance meaningless.
 * The chart always carries an equivalent data table behind a visible control.
 */
export function MilestonesPanel({
  projectCode, milestones, variancePct, tolerancePct, atRisk, managerName, today,
  contractualCompletion, revisedCompletion,
}: {
  projectCode: string;
  milestones: MilestonePoint[];
  variancePct: number;
  tolerancePct: number;
  atRisk: boolean;
  managerName: string;
  today: string;
  contractualCompletion: string;
  revisedCompletion: string | null;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const now = new Date(today);

  const totalWeight = milestones.reduce((s, m) => s + m.weightage, 0);
  const weightValid = Math.abs(totalWeight - 100) < 0.001;

  const curve = useMemo(() => sCurve(milestones, now), [milestones, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const plannedToDate = milestones
    .filter((m) => new Date(m.plannedDate) <= now)
    .reduce((s, m) => s + m.weightage, 0);
  const actualToDate = milestones
    .filter((m) => m.actualDate && new Date(m.actualDate) <= now)
    .reduce((s, m) => s + m.weightage, 0);

  const todayLabel = curve.find((p) => new Date(p.date).getTime() === now.getTime())?.label ?? "";

  if (milestones.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Flag}
          title="No milestones are defined"
          body="Without a weighted milestone set there is no planned curve to compare actual progress against, and schedule variance cannot be computed. Define the milestones from the contract programme — their weightages must total 100."
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          <li className="bg-surface-1">
            <StatBlock label="Cumulative planned" value={formatPercent(plannedToDate, 0)} sub="Weightage of milestones due by today" />
          </li>
          <li className="bg-surface-1">
            <StatBlock label="Cumulative actual" value={formatPercent(actualToDate, 0)} sub="Weightage of milestones achieved" />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Schedule variance"
              value={`${variancePct > 0 ? "+" : ""}${formatPercent(variancePct)}`}
              tone={atRisk ? "danger" : variancePct < 0 ? "warn" : "ok"}
              sub={`Tolerance ±${tolerancePct}% — (actual − planned) ÷ planned`}
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Total weightage"
              value={formatPercent(totalWeight, 0)}
              tone={weightValid ? "ok" : "danger"}
              sub={weightValid ? "Closes at 100 as required" : "Must total exactly 100"}
            />
          </li>
        </ul>
      </Panel>

      {!weightValid ? (
        <BlockedNotice
          rule={`milestone weightages total ${formatPercent(totalWeight, 0)}, not 100`}
          unblock="Adjust the weightages so they close at exactly 100. Until they do, cumulative planned progress is not a percentage of anything and the variance below cannot be trusted."
        />
      ) : null}

      {atRisk ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="t-body-sm font-medium text-danger">
              {projectCode} flagged At Risk — schedule variance {formatPercent(variancePct)} against a tolerance of ±{tolerancePct}%
            </p>
            <p className="t-body-sm mt-0.5 text-text-mid">
              Cumulative actual weightage of {formatPercent(actualToDate, 0)} sits behind the{" "}
              {formatPercent(plannedToDate, 0)} planned by today. Responsible manager — {managerName}. This is
              carried on the exception feed with the same magnitude.
            </p>
          </div>
        </div>
      ) : (
        <Explainer className="text-text-lo">
          Inside tolerance — variance {formatPercent(variancePct)} against ±{tolerancePct}%. The project is not
          flagged At Risk and does not appear on the exception feed.
        </Explainer>
      )}

      {/* --------------------------------------------------------- S-curve */}
      <Panel>
        <PanelHeader
          title="S-curve — cumulative planned against cumulative actual"
          sub="Weightage-based progress on a date axis, with today marked. Actual stops at today; it is not projected forward."
          right={<ChartTableToggle view={view} onChange={setView} id="scurve-region" />}
        />
        <div id="scurve-region" className="p-4">
          {view === "chart" ? (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--text-lo)", fontSize: 11 }}
                      stroke="var(--line-strong)"
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fill: "var(--text-lo)", fontSize: 11 }}
                      stroke="var(--line-strong)"
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--line-strong)",
                        borderRadius: 3,
                        fontSize: 12,
                        color: "var(--text-hi)",
                      }}
                      labelStyle={{ color: "var(--text-mid)" }}
                      formatter={((value: unknown, name: unknown) =>
                        [`${String(value)}%`, String(name)]) as never}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-mid)" }} />
                    {todayLabel ? (
                      <ReferenceLine
                        x={todayLabel}
                        stroke="var(--warn)"
                        strokeDasharray="4 3"
                        label={{ value: "Today", fill: "var(--warn)", fontSize: 11, position: "insideTopRight" }}
                      />
                    ) : null}
                    <Line
                      type="monotone" dataKey="planned" name="Cumulative planned"
                      stroke="var(--dv-1)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} isAnimationActive={false}
                    />
                    <Line
                      type="monotone" dataKey="actual" name="Cumulative actual"
                      stroke="var(--dv-6)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }}
                      connectNulls={false} isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Explainer className="mt-2 text-text-lo">
                Same series, tabular — switch to the data table above. Contractual completion{" "}
                {formatDate(contractualCompletion)}
                {revisedCompletion ? `, revised to ${formatDate(revisedCompletion)}` : ""}.
              </Explainer>
            </>
          ) : (
            <DenseTableShell minWidth={520}>
              <caption className="sr-only">
                Cumulative planned and cumulative actual progress by date — the same series plotted on the S-curve.
              </caption>
              <thead>
                <tr className="border-b border-line-strong bg-surface-2">
                  <th scope="col" className={TH}>Date</th>
                  <th scope="col" className={THR}>Cumulative planned</th>
                  <th scope="col" className={THR}>Cumulative actual</th>
                  <th scope="col" className={THR}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {curve.map((p) => {
                  const isToday = new Date(p.date).getTime() === now.getTime();
                  return (
                    <tr key={p.date} className={cn(ROW, isToday && "bg-warn-bg")}>
                      <td className={TD}>
                        {formatDate(p.date)}
                        {isToday ? <span className="t-overline ml-2 text-warn">Today</span> : null}
                      </td>
                      <td className={TDR}>{formatPercent(p.planned ?? 0, 0)}</td>
                      <td className={TDR}>{p.actual === null ? <span className="text-text-lo">—</span> : formatPercent(p.actual, 0)}</td>
                      <td className={cn(TDR, p.actual !== null && p.actual < (p.planned ?? 0) && "text-warn")}>
                        {p.actual === null ? "—" : formatPercent(p.actual - (p.planned ?? 0), 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DenseTableShell>
          )}
        </div>
      </Panel>

      {/* ------------------------------------------------------ milestones */}
      <Panel>
        <PanelHeader
          title="Milestones"
          sub="Name, planned date, actual date, weightage and status. Weightages must total 100."
        />
        <DenseTableShell minWidth={760}>
          <caption className="sr-only">Contract milestones with planned and actual dates, weightage and status.</caption>
          <thead>
            <tr className="border-b border-line-strong bg-surface-2">
              <th scope="col" className={TH}>Milestone</th>
              <th scope="col" className={TH}>Planned</th>
              <th scope="col" className={TH}>Actual</th>
              <th scope="col" className={THR}>Weightage</th>
              <th scope="col" className={THR}>Slip (days)</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => {
              const slip = m.actualDate
                ? Math.round((new Date(m.actualDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000)
                : new Date(m.plannedDate) < now
                  ? Math.round((now.getTime() - new Date(m.plannedDate).getTime()) / 86_400_000)
                  : null;
              return (
                <tr key={m.name} className={cn(ROW, "hover:bg-surface-2")}>
                  <td className={cn(TD, "text-text-hi")}>
                    <span className="flex items-center gap-1.5">
                      {m.status === "COMPLETE" ? (
                        <CheckCircle2 className="size-3.5 text-ok" aria-hidden />
                      ) : (
                        <Flag className="size-3.5 text-text-lo" aria-hidden />
                      )}
                      {m.name}
                    </span>
                  </td>
                  <td className={TD}>{formatDate(m.plannedDate)}</td>
                  <td className={TD}>
                    {m.actualDate ? formatDate(m.actualDate) : <span className="text-text-lo">Not achieved</span>}
                  </td>
                  <td className={TDR}>{formatPercent(m.weightage, 0)}</td>
                  <td className={cn(TDR, slip !== null && slip > 0 && "text-warn")}>
                    {slip === null ? "—" : slip > 0 ? `+${slip}` : slip}
                  </td>
                  <td className={TD}>
                    <StatusBadge tone={MILESTONE_TONE[m.status] ?? "neutral"}>
                      {MILESTONE_LABEL[m.status] ?? m.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong bg-surface-2">
              <td colSpan={3} className={cn(TD, "t-label py-2 text-text-hi")}>Total weightage</td>
              <td className={cn(TDR, "font-semibold", weightValid ? "text-ok" : "text-danger")}>
                {formatPercent(totalWeight, 0)}
              </td>
              <td colSpan={2} className={TD}>
                {weightValid ? (
                  <span className="t-body-sm text-ok">Closes at 100</span>
                ) : (
                  <span className="t-body-sm text-danger">Must equal 100</span>
                )}
              </td>
            </tr>
          </tfoot>
        </DenseTableShell>
      </Panel>

      {milestones.some((m) => m.status === "SLIPPED") ? (
        <WarnNotice
          title={`${milestones.filter((m) => m.status === "SLIPPED").length} milestone(s) past their planned date without an actual date`}
          body="Each of these is dragging the cumulative actual curve below plan. Recovering one closes the variance faster than any other action available on this screen."
        />
      ) : null}

      <div>
        <Overline>How the variance is computed</Overline>
        <Explainer className="mt-1 max-w-3xl text-text-mid">
          Cumulative planned is the sum of weightages for milestones whose planned date has passed. Cumulative
          actual is the sum of weightages for milestones with an actual date on or before today. Variance is
          (actual − planned) ÷ planned, expressed as a percentage. Beyond ±{tolerancePct}% the project is flagged
          At Risk and carried to the exception feed with the magnitude and the responsible manager.
        </Explainer>
      </div>
    </div>
  );
}
