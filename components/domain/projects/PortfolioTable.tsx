"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HardHat, Plus, Search, ShieldAlert } from "lucide-react";
import { abbreviateINR, formatCount, formatDate, formatPercent } from "@/lib/format";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState } from "@/components/patterns/primitives";
import type { ProjectStatus } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import type { PortfolioRow, ProjectsViewer } from "./server";
import {
  PROJECT_STATUS_LABEL, PROJECT_STATUS_ORDER, PROJECT_STATUS_TONE, CLIENT_TYPE_LABEL,
} from "./labels";
import {
  Btn, DenseTableShell, FilteredEmpty, Num, ProgressBar, Select, SortButton, StatBlock,
  TD, TDR, TextInput, TH, THR, ROW, type SortDir,
} from "./ui";
import { useProjectsOverlay } from "./store";
import { LIVE_STATE_LIST } from "./constants";

type SortKey =
  | "code" | "clientName" | "contractValue" | "physicalPct" | "financialPct"
  | "scheduleVariancePct" | "retentionOutstanding" | "status";

export function PortfolioTable({
  rows, viewer, totalProjectCount, today,
}: { rows: PortfolioRow[]; viewer: ProjectsViewer; totalProjectCount: number; today: string }) {
  const overlay = useProjectsOverlay();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | ProjectStatus>("ALL");
  const [riskOnly, setRiskOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  /* Overlay-created projects join the portfolio immediately; they carry no BOQ,
     no bills and no retention yet, so every derived column reads zero. */
  const merged: PortfolioRow[] = useMemo(() => {
    const patched = rows.map((r) => {
      const patch = overlay.projectPatches[r.id];
      if (!patch) return r;
      return {
        ...r,
        status: patch.status ?? r.status,
        revisedCompletion: patch.revisedCompletion !== undefined ? patch.revisedCompletion : r.revisedCompletion,
        actualCompletion: patch.actualCompletion !== undefined ? patch.actualCompletion : r.actualCompletion,
        dlpExpiry: patch.dlpExpiry ?? r.dlpExpiry,
      };
    });
    const created: PortfolioRow[] = overlay.projects
      .filter((p) => viewer.scope !== "ASSIGNED" || p.managerUserId === viewer.userId)
      .map((p) => ({
        id: p.id, code: p.code, name: p.name, clientName: p.customerId,
        clientType: p.clientType, siteLocation: p.siteLocation, district: p.district,
        contractValue: p.contractValue, pricedBoqValue: 0, physicalPct: 0,
        physicalBasis: "PROGRESS_ENTRIES", executedValue: 0, certifiedValue: 0,
        financialPct: 0, billingRealisationPct: 0, scheduleVariancePct: 0,
        varianceTolerancePct: p.varianceTolerancePct, atRisk: false,
        retentionOutstanding: 0, retentionEligible: 0, status: p.status,
        managerUserId: p.managerUserId, managerName: viewer.name,
        startDate: p.startDate, contractualCompletion: p.contractualCompletion,
        revisedCompletion: p.revisedCompletion, actualCompletion: p.actualCompletion,
        defectLiabilityMonths: p.defectLiabilityMonths,
        dlpExpiry: p.contractualCompletion, retentionPct: p.retentionPct,
        live: LIVE_STATE_LIST.includes(p.status), dprCount: 0, openBills: 0,
      }));
    return [...patched, ...created];
  }, [rows, overlay, viewer]);

  const filters: string[] = [];
  if (q.trim()) filters.push(`search “${q.trim()}”`);
  if (status !== "ALL") filters.push(`status ${PROJECT_STATUS_LABEL[status]}`);
  if (riskOnly) filters.push("At Risk only");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return merged.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (riskOnly && !r.atRisk) return false;
      if (!needle) return true;
      return (
        r.code.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        r.clientName.toLowerCase().includes(needle) ||
        r.district.toLowerCase().includes(needle)
      );
    });
  }, [merged, q, status, riskOnly]);

  /* E6-S1 — At Risk projects sort first, always, whatever else is selected. */
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "code" || key === "clientName" || key === "status" ? "asc" : "desc"); }
  }

  const live = merged.filter((r) => r.live);
  const atRisk = merged.filter((r) => r.atRisk);
  const inDlp = merged.filter((r) => r.status === "DLP");
  const completed = merged.filter((r) => ["COMPLETED", "DLP", "CLOSED"].includes(r.status));
  const retentionOutstanding = merged.reduce((s, r) => s + r.retentionOutstanding, 0);

  function clearFilters() { setQ(""); setStatus("ALL"); setRiskOnly(false); }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <ul className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          <li className="bg-surface-1">
            <StatBlock
              label="Live projects"
              value={formatCount(live.length)}
              sub={`${abbreviateINR(live.reduce((s, r) => s + r.contractValue, 0))} contracted`}
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Completed"
              value={formatCount(completed.length)}
              sub={`${inDlp.length} inside the defect-liability period`}
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Retention outstanding"
              value={abbreviateINR(retentionOutstanding)}
              tone="warn"
              sub={
                <Link href="/projects/retention" className="underline decoration-line underline-offset-2 hover:text-text-hi">
                  Open the retention register
                </Link>
              }
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="At Risk"
              value={formatCount(atRisk.length)}
              tone={atRisk.length ? "danger" : undefined}
              sub="Beyond the configured schedule-variance tolerance"
            />
          </li>
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          title="Project portfolio"
          sub={
            viewer.scope === "ASSIGNED"
              ? `Scoped to projects where you are the assigned manager — ${rows.length} of ${totalProjectCount} on record.`
              : `All ${totalProjectCount} projects. At Risk projects are listed first regardless of sort.`
          }
          right={
            viewer.canCreateProjects ? (
              <Link
                href="/projects/new"
                className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-primary-600 bg-primary-600 px-2.5 text-white hover:bg-primary-500"
              >
                <Plus className="size-3.5" aria-hidden /> New project
              </Link>
            ) : null
          }
        />

        <div className="flex flex-wrap items-end gap-2 border-b border-line px-3 py-2.5">
          <label className="relative">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-text-lo" aria-hidden />
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code, name, client or district"
              className="w-64 pl-7"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Filter by status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value as "ALL" | ProjectStatus)} className="w-52">
              <option value="ALL">All nine statuses</option>
              {PROJECT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </label>
          <Btn
            onClick={() => setRiskOnly((v) => !v)}
            aria-pressed={riskOnly}
            className={cn(riskOnly && "border-danger/50 bg-danger-bg text-danger")}
          >
            <ShieldAlert className="size-3.5" aria-hidden /> At Risk only
          </Btn>
          {filters.length ? (
            <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn>
          ) : null}
          <span className="t-body-sm ml-auto text-text-lo">
            {formatCount(sorted.length)} of {formatCount(merged.length)} shown · as at {formatDate(today)}
          </span>
        </div>

        {merged.length === 0 ? (
          <EmptyState
            icon={HardHat}
            title="No projects are assigned to you"
            body="Projects appear here once a work order is recorded and you are named as the project manager. Ask Director – Business to assign one, or record the project yourself if you hold the rights."
            action={
              viewer.canCreateProjects ? (
                <Link
                  href="/projects/new"
                  className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-primary-600 bg-primary-600 px-2.5 text-white hover:bg-primary-500"
                >
                  <Plus className="size-3.5" aria-hidden /> Record a project
                </Link>
              ) : null
            }
          />
        ) : sorted.length === 0 ? (
          <FilteredEmpty filters={filters} onClear={clearFilters} />
        ) : (
          <DenseTableShell minWidth={1180}>
            <caption className="sr-only">
              Project portfolio with client, contract value, physical and financial progress,
              schedule variance, retention outstanding and status. At Risk projects appear first.
            </caption>
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                <th scope="col" className={TH}><SortButton label="Project" active={sortKey === "code"} dir={sortDir} onClick={() => toggleSort("code")} /></th>
                <th scope="col" className={TH}><SortButton label="Client" active={sortKey === "clientName"} dir={sortDir} onClick={() => toggleSort("clientName")} /></th>
                <th scope="col" className={THR}><SortButton align="right" label="Contract value" active={sortKey === "contractValue"} dir={sortDir} onClick={() => toggleSort("contractValue")} /></th>
                <th scope="col" className={THR}><SortButton align="right" label="Physical" active={sortKey === "physicalPct"} dir={sortDir} onClick={() => toggleSort("physicalPct")} /></th>
                <th scope="col" className={THR}><SortButton align="right" label="Financial" active={sortKey === "financialPct"} dir={sortDir} onClick={() => toggleSort("financialPct")} /></th>
                <th scope="col" className={THR}><SortButton align="right" label="Sched. variance" active={sortKey === "scheduleVariancePct"} dir={sortDir} onClick={() => toggleSort("scheduleVariancePct")} /></th>
                <th scope="col" className={THR}><SortButton align="right" label="Retention" active={sortKey === "retentionOutstanding"} dir={sortDir} onClick={() => toggleSort("retentionOutstanding")} /></th>
                <th scope="col" className={TH}><SortButton label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className={cn(ROW, "hover:bg-surface-2", r.atRisk && "bg-danger-bg/40")}>
                  <td className={cn(TD, "min-w-64")}>
                    <Link href={`/projects/${r.id}`} className="flex items-center gap-2">
                      {r.atRisk ? (
                        <ShieldAlert className="size-3.5 shrink-0 text-danger" aria-label="At Risk" />
                      ) : (
                        <span aria-hidden className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: "var(--v-projects)" }} />
                      )}
                      <span className="min-w-0">
                        <span className="t-mono block text-text-hi">{r.code}</span>
                        <span className="block truncate text-text-mid">{r.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={cn(TD, "max-w-56")}>
                    <span className="block truncate text-text-hi">{r.clientName}</span>
                    <span className="block text-text-lo">{CLIENT_TYPE_LABEL[r.clientType] ?? r.clientType} · {r.district}</span>
                  </td>
                  <td className={TDR}>{abbreviateINR(r.contractValue)}</td>
                  <td className={TDR}>
                    <Num>{formatPercent(r.physicalPct)}</Num>
                    <ProgressBar className="mt-1" pct={r.physicalPct} label={`Physical progress ${formatPercent(r.physicalPct)}`} />
                  </td>
                  <td className={TDR}>
                    <Num>{formatPercent(r.financialPct)}</Num>
                    <ProgressBar className="mt-1" pct={r.financialPct} tone="ok" label={`Financial progress ${formatPercent(r.financialPct)}`} />
                  </td>
                  <td className={TDR}>
                    <span className={cn(r.atRisk ? "text-danger" : r.scheduleVariancePct < 0 ? "text-warn" : "text-ok")}>
                      {r.scheduleVariancePct > 0 ? "+" : ""}{formatPercent(r.scheduleVariancePct)}
                    </span>
                    <span className="block text-text-lo">tol ±{r.varianceTolerancePct}%</span>
                  </td>
                  <td className={TDR}>
                    {r.retentionOutstanding ? abbreviateINR(r.retentionOutstanding) : <span className="text-text-lo">—</span>}
                    {r.retentionEligible ? (
                      <span className="block text-warn">{abbreviateINR(r.retentionEligible)} eligible</span>
                    ) : null}
                  </td>
                  <td className={TD}>
                    <StatusBadge tone={PROJECT_STATUS_TONE[r.status as ProjectStatus] ?? "neutral"}>
                      {PROJECT_STATUS_LABEL[r.status as ProjectStatus] ?? r.status}
                    </StatusBadge>
                    {r.status === "DLP" ? (
                      <span className="block text-text-lo">DLP to {formatDate(r.dlpExpiry)}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DenseTableShell>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-3 py-2">
          <Overline>How these read</Overline>
          <span className="t-body-sm text-text-lo">
            Physical — executed value from dated progress entries against the priced BOQ; a project with a
            recorded actual completion reads 100%.
          </span>
          <span className="t-body-sm text-text-lo">
            Financial — client-certified RA-bill value against contract value.
          </span>
          <span className="t-body-sm text-text-lo">
            Schedule variance — cumulative actual against cumulative planned milestone weightage.
          </span>
        </div>
      </Panel>
    </div>
  );
}
