"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  CalendarClock,
  FileSignature,
  Radar,
  ShieldCheck,
  ShieldOff,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { abbreviateINR, formatCount, formatDate, formatINR, formatPercent } from "@/lib/format";
import { EmptyState, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { AmcStatusBadge, PrincipalTag, RenewalStatusBadge } from "./badges";
import { ATTACH_FORMULA, attachFormulaWithNumbers, fulfilmentOf, type AttachSummary } from "./metrics";
import {
  EMPTY_RENEWALS,
  localNumber,
  useOverlay,
  type RenewalAction,
  type RenewalsOverlay,
} from "./store";
import {
  Button,
  FilteredEmpty,
  Metric,
  Modal,
  PageHeader,
  Row,
  SearchField,
  SelectField,
  Serial,
  TabBar,
  TableFrame,
  Td,
  TextArea,
  TextInput,
  Th,
  Toolbar,
} from "./ui";
import type { AmcRow, BranchOption, UncoveredRow, WarrantyOpportunityRow } from "./types";

/**
 * E5-S7 — the Renewal Radar.
 *
 * Everything that is about to stop earning, and everything that never started,
 * on one prioritised screen. Three expiry horizons, the warranty machines that
 * are an AMC conversation waiting to happen, the whole out-of-coverage
 * population, and the contracts that already lapsed.
 *
 * The attach rate is the number this screen has to defend. Per PLAN.md C-11 the
 * denominator is total assets − in-warranty − decommissioned, because a machine
 * still inside its warranty is not yet an AMC opportunity. Both the ratio and
 * the raw uncovered count are shown, and the arithmetic is printed rather than
 * asserted, so 42% cannot be mistaken for a massaged 144 / 286.
 */

const ALL = "ALL";

type TabId = "D30" | "D60" | "D90" | "WARRANTY" | "UNCOVERED" | "LAPSED";

const HORIZON: Record<"D30" | "D60" | "D90", number> = { D30: 30, D60: 60, D90: 90 };

function daysTone(days: number): { cls: string; label: string } {
  if (days <= 15) return { cls: "text-danger", label: "Critical" };
  if (days <= 30) return { cls: "text-warn", label: "Urgent" };
  if (days <= 60) return { cls: "text-sla-approaching", label: "Approaching" };
  return { cls: "text-text-hi", label: "Planned" };
}

/** Key-value line inside the pre-populated quotation. `<dl>` wraps `<div>`. */
function DraftRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="t-body-sm shrink-0 text-text-lo">{label}</dt>
      <dd className="t-body-sm min-w-0 text-right text-text-hi">{children}</dd>
    </div>
  );
}

interface RenewalDraft {
  key: string;
  sourceContractId: string | null;
  title: string;
  customerName: string;
  assets: string[];
  scope: string;
  value: string;
  owner: string;
  note: string;
}

export function RenewalRadar({
  contracts,
  lapsed,
  warrantyOps,
  uncovered,
  attach,
  branches,
  canWrite,
  branchScoped,
}: {
  contracts: AmcRow[];
  lapsed: AmcRow[];
  warrantyOps: WarrantyOpportunityRow[];
  uncovered: UncoveredRow[];
  attach: AttachSummary;
  branches: BranchOption[];
  canWrite: boolean;
  branchScoped: boolean;
}) {
  const { state: overlay, ready, update } = useOverlay<RenewalsOverlay>(
    "pravaah.v1.renewals",
    EMPTY_RENEWALS,
  );

  const [tab, setTab] = React.useState<TabId>("D60");
  const [query, setQuery] = React.useState("");
  const [branch, setBranch] = React.useState<string>(ALL);
  const [draft, setDraft] = React.useState<RenewalDraft | null>(null);

  const actionFor = (key: string): RenewalAction | undefined => overlay.actions[key];

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`Search "${query.trim()}"`);
  if (branch !== ALL)
    activeFilters.push(`Branch ${branches.find((b) => b.id === branch)?.code ?? branch}`);

  function clearFilters() {
    setQuery("");
    setBranch(ALL);
  }

  const q = query.trim().toLowerCase();

  const matchContract = React.useCallback(
    (r: AmcRow) => {
      if (branch !== ALL && r.branchId !== branch) return false;
      if (!q) return true;
      return (
        r.number.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.assetSerials.some((s) => s.toLowerCase().includes(q))
      );
    },
    [branch, q],
  );

  const expiringAll = React.useMemo(
    () => contracts.filter(matchContract).sort((a, b) => a.daysRemaining - b.daysRemaining),
    [contracts, matchContract],
  );

  const lapsedRows = React.useMemo(
    () => lapsed.filter(matchContract).sort((a, b) => b.endDate.localeCompare(a.endDate)),
    [lapsed, matchContract],
  );

  const warrantyRows = React.useMemo(
    () =>
      warrantyOps.filter((r) => {
        if (branch !== ALL && r.branchId !== branch) return false;
        if (!q) return true;
        return (
          r.customerName.toLowerCase().includes(q) ||
          r.serial.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q)
        );
      }),
    [warrantyOps, branch, q],
  );

  const uncoveredRows = React.useMemo(
    () =>
      uncovered.filter((r) => {
        if (branch !== ALL && r.branchId !== branch) return false;
        if (!q) return true;
        return (
          r.customerName.toLowerCase().includes(q) ||
          r.serial.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q)
        );
      }),
    [uncovered, branch, q],
  );

  const within = (days: number) => expiringAll.filter((r) => r.daysRemaining <= days);

  /* --------------------------------------------------------- headline sums */

  const exp60 = contracts.filter((r) => r.daysRemaining <= 60);
  const exp60Value = exp60.reduce((s, r) => s + r.contractValue, 0);
  const uncoveredValue = uncovered.reduce((s, r) => s + r.estimatedAmcValue, 0);
  const leakage = lapsed.reduce((s, r) => s + r.contractValue, 0);
  const warrantyValue = warrantyOps.reduce((s, r) => s + r.estimatedAmcValue, 0);
  const initiated = Object.values(overlay.actions).filter((a) => a.status !== "IDENTIFIED").length;
  const quotedValue = Object.values(overlay.actions).reduce((s, a) => s + (a.quotationValue ?? 0), 0);

  /* --------------------------------------------------------- renewal action */

  function openContractRenewal(r: AmcRow) {
    setDraft({
      key: r.id,
      sourceContractId: r.id,
      title: `Renewal of ${r.number}`,
      customerName: r.customerName,
      assets: r.assetSerials,
      scope: `${r.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"} · ${r.visitsPerYear} preventive visits a year · ${r.responseHours}h response · ${r.restorationHours}h restoration`,
      value: String(r.contractValue),
      owner: r.ownerName,
      note: `Pre-populated from ${r.number}, expiring ${formatDate(r.endDate)}. Same covered machines, same scope, same value carried forward for review.`,
    });
  }

  function openWarrantyConversion(r: WarrantyOpportunityRow) {
    setDraft({
      key: `asset:${r.assetId}`,
      sourceContractId: null,
      title: `AMC conversion — ${r.serial}`,
      customerName: r.customerName,
      assets: [r.serial],
      scope: "Comprehensive · 4 preventive visits a year · 8h response · 48h restoration",
      value: String(r.estimatedAmcValue),
      owner: "Service Manager",
      note: `Warranty ends ${formatDate(r.warrantyEnd)}, ${r.daysRemaining} days away. ${r.visits} visits and ${r.tickets} tickets on record; parts spend ${formatINR(r.partsSpend)} to date.`,
    });
  }

  function openUncoveredQuote(r: UncoveredRow) {
    setDraft({
      key: `asset:${r.assetId}`,
      sourceContractId: null,
      title: `New AMC — ${r.serial}`,
      customerName: r.customerName,
      assets: [r.serial],
      scope: "Comprehensive · 4 preventive visits a year · 8h response · 48h restoration",
      value: String(r.estimatedAmcValue),
      owner: "Service Manager",
      note:
        r.monthsSinceLastService === null
          ? "No service visit has ever been recorded against this machine."
          : `Last serviced ${r.monthsSinceLastService} months ago.`,
    });
  }

  function commitDraft() {
    if (!draft) return;
    const value = Number(draft.value) || 0;
    const number = localNumber("BC/QTN/2627");
    update((prev) => ({
      ...prev,
      actions: {
        ...prev.actions,
        [draft.key]: {
          status: "QUOTED",
          lastAction: `Quotation ${number} raised for ${formatINR(value)}`,
          at: new Date().toISOString(),
          quotationNumber: number,
          quotationValue: value,
          sourceContractId: draft.sourceContractId,
        },
      },
    }));
    setDraft(null);
  }

  /* ------------------------------------------------------------ rendering */

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "D30", label: "Expiring 30 days", count: within(30).length },
    { id: "D60", label: "60 days", count: within(60).length },
    { id: "D90", label: "90 days", count: within(90).length },
    { id: "WARRANTY", label: "Warranty conversions", count: warrantyRows.length },
    { id: "UNCOVERED", label: "Out of coverage", count: uncoveredRows.length },
    { id: "LAPSED", label: "Lapsed", count: lapsedRows.length },
  ];

  const skeleton = (
    <div className="flex flex-col gap-px bg-line p-px">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 bg-surface-1" />
      ))}
    </div>
  );

  function ActionCell({ actionKey, onInitiate, label }: { actionKey: string; onInitiate: () => void; label: string }) {
    const action = actionFor(actionKey);
    if (action?.quotationNumber) {
      return (
        <span className="flex flex-col items-end gap-0.5">
          <span className="t-mono text-text-hi">{action.quotationNumber}</span>
          <span className="t-body-sm text-text-lo">{formatINR(action.quotationValue ?? 0)}</span>
        </span>
      );
    }
    if (!canWrite) {
      return <span className="t-body-sm text-text-lo">Read-only role</span>;
    }
    return (
      <Button onClick={onInitiate}>
        <FileSignature className="size-3.5" aria-hidden />
        {label}
      </Button>
    );
  }

  function renderContractTable(rows: AmcRow[], mode: "EXPIRING" | "LAPSED") {
    if (!ready) return skeleton;
    if (rows.length === 0) {
      return activeFilters.length ? (
        <FilteredEmpty entity="contracts" names={activeFilters} onClear={clearFilters} />
      ) : (
        <EmptyState
          icon={mode === "LAPSED" ? ShieldCheck : CalendarClock}
          title={mode === "LAPSED" ? "Nothing lapsed in the trailing twelve months" : "Nothing expiring in this window"}
          body={
            mode === "LAPSED"
              ? "Every contract that reached its end date was renewed, terminated with a reason, or is still inside the radar's forward window."
              : "No maintenance contract reaches its end date inside this horizon. Widen the window, or work the out-of-coverage population instead."
          }
        />
      );
    }
    return (
      <TableFrame className="min-w-full">
        <thead>
          <tr>
            <Th>Contract</Th>
            <Th>Customer</Th>
            <Th>Covered machines</Th>
            <Th numeric>{mode === "LAPSED" ? "Lapsed value" : "Expiring value"}</Th>
            <Th numeric>{mode === "LAPSED" ? "Days lapsed" : "Days remaining"}</Th>
            <Th>Coverage history</Th>
            <Th>Owner</Th>
            <Th>Renewal status</Th>
            <Th>Last action</Th>
            <Th className="text-right">{mode === "LAPSED" ? "Win back" : "Initiate renewal"}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const f = fulfilmentOf({
              committed: r.committedVisits,
              completed: r.completedVisits,
              dueToDate: r.dueToDate,
            });
            const action = actionFor(r.id);
            const tone = daysTone(r.daysRemaining);
            return (
              <Row key={r.id} tone={mode === "LAPSED" ? "danger" : r.daysRemaining <= 30 ? "warn" : "none"}>
                <Td nowrap>
                  <Link
                    href={`/service/amc/${r.id}`}
                    className="t-mono inline-flex min-h-6 items-center text-text-hi hover:underline"
                  >
                    {r.number}
                  </Link>
                  <span className="t-body-sm block text-text-lo">
                    {formatDate(r.startDate)} → {formatDate(r.endDate)}
                  </span>
                </Td>
                <Td>
                  <span className="block text-text-hi">{r.customerName}</span>
                  <span className="t-body-sm block text-text-lo">{r.branchCode}</span>
                </Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {r.assetSerials.slice(0, 2).map((s) => (
                      <Link
                        key={s}
                        href={`/service/assets/${encodeURIComponent(s)}`}
                        className="inline-flex min-h-6 items-center hover:underline"
                      >
                        <Serial value={s} />
                      </Link>
                    ))}
                    {r.assetSerials.length > 2 ? (
                      <span className="t-body-sm text-text-lo">
                        +{r.assetSerials.length - 2} more
                      </span>
                    ) : null}
                  </span>
                  <span className="t-body-sm block text-text-lo">
                    {r.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"}
                  </span>
                </Td>
                <Td numeric nowrap>
                  {formatINR(r.contractValue)}
                </Td>
                <Td numeric nowrap>
                  {mode === "LAPSED" ? (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <TrendingDown className="size-3.5" aria-hidden />
                      {Math.abs(r.daysRemaining)}
                    </span>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1", tone.cls)}>
                      <AlarmClock className="size-3.5" aria-hidden />
                      {r.daysRemaining}
                      <span className="t-overline">{tone.label}</span>
                    </span>
                  )}
                </Td>
                <Td nowrap>
                  <span className="block tabular-nums text-text-hi">
                    {r.completedVisits} of {r.committedVisits} visits ({formatPercent(f.pct)})
                  </span>
                  {f.behindSchedule ? (
                    <span className="t-body-sm flex items-center gap-1 text-warn">
                      <TriangleAlert className="size-3" aria-hidden />
                      Behind by {f.behindBy}
                    </span>
                  ) : (
                    <span className="t-body-sm text-text-lo">Delivered on schedule</span>
                  )}
                </Td>
                <Td nowrap>{r.ownerName}</Td>
                <Td nowrap>
                  <span className="flex flex-wrap items-center gap-1">
                    <RenewalStatusBadge status={action?.status ?? "IDENTIFIED"} />
                    <AmcStatusBadge status={r.status} />
                  </span>
                </Td>
                <Td>
                  {action ? (
                    <>
                      <span className="block text-text-hi">{action.lastAction}</span>
                      <span className="t-body-sm block text-text-lo">{formatDate(action.at)}</span>
                    </>
                  ) : (
                    <span className="t-body-sm text-text-lo">No action recorded</span>
                  )}
                </Td>
                <Td className="text-right" nowrap>
                  <ActionCell
                    actionKey={r.id}
                    onInitiate={() => openContractRenewal(r)}
                    label={mode === "LAPSED" ? "Win back" : "Initiate renewal"}
                  />
                </Td>
              </Row>
            );
          })}
        </tbody>
      </TableFrame>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Renewal radar"
        sub="Every contract and warranty about to stop earning, and every machine that never started. Recurring revenue as a pipeline instead of a leak."
        right={
          <span className="t-body-sm inline-flex items-center gap-2 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] px-3 py-1.5">
            <Radar className="size-4 text-v-service" aria-hidden />
            <span className="t-mono tabular-nums text-text-hi">
              {formatPercent(attach.pct, 0)} attach
            </span>
            <span className="text-text-lo">·</span>
            <span className="t-mono tabular-nums text-text-hi">
              {formatCount(attach.outOfCoverage)} uncovered
            </span>
          </span>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <li>
          <Metric
            label="Expiring within 60 days"
            value={formatCount(exp60.length)}
            sub={`${abbreviateINR(exp60Value)} of contract value`}
            tone="warn"
          />
        </li>
        <li>
          <Metric
            label="Out of coverage"
            value={formatCount(uncovered.length)}
            sub={`${abbreviateINR(uncoveredValue)} estimated AMC value`}
            tone="danger"
          />
        </li>
        <li>
          <Metric
            label="AMC attach rate"
            value={formatPercent(attach.pct, 0)}
            sub={`${attach.underAmc} of ${attach.eligible} eligible machines`}
            tone="info"
          />
        </li>
        <li>
          <Metric
            label="Warranty conversions"
            value={formatCount(warrantyOps.length)}
            sub={`${abbreviateINR(warrantyValue)} within 90 days`}
          />
        </li>
        <li>
          <Metric
            label="Lapsed unrenewed"
            value={formatCount(lapsed.length)}
            sub={`${abbreviateINR(leakage)} leakage, trailing 12 months`}
            tone="danger"
          />
        </li>
        <li>
          <Metric
            label="Renewals initiated"
            value={formatCount(initiated)}
            sub={initiated ? `${abbreviateINR(quotedValue)} quoted this session` : "none this session"}
            tone={initiated ? "ok" : "default"}
          />
        </li>
      </ul>

      {/*
        C-11 disclosure. Printed in full, never behind a toggle, because the
        published 42% only reconciles on this denominator and the screen has to
        survive someone recomputing 144 / 286 in their head.
      */}
      <Panel>
        <PanelHeader
          title="How the attach rate is computed"
          sub="K-10. An in-warranty machine is not yet an AMC opportunity and a decommissioned one never will be, so neither sits in the denominator."
          right={
            <span className="t-body-sm tabular-nums text-text-hi">
              {formatPercent(attach.pct, 0)} attach · {formatCount(attach.outOfCoverage)} uncovered
            </span>
          }
        />
        <div className="px-4 py-3">
          <p className="t-mono break-words text-text-hi">{ATTACH_FORMULA}</p>
          <p className="t-mono mt-1.5 break-words tabular-nums text-info">
            {attachFormulaWithNumbers(attach)}
          </p>
          <p className="t-body-sm mt-2 text-text-mid">
            The naive reading — {formatCount(attach.outOfCoverage)} uncovered against{" "}
            {formatCount(attach.totalAssets)} total assets —{" "}
            gives {formatPercent((attach.outOfCoverage / Math.max(1, attach.totalAssets)) * 100, 0)}{" "}
            uncovered, which is a different question. Both figures are published side by side so
            neither can stand in for the other.
          </p>
        </div>
      </Panel>

      <Panel>
        <Toolbar>
          <SearchField
            label="Search"
            value={query}
            onChange={setQuery}
            placeholder="Customer, contract number, serial or owner"
          />
          {branchScoped ? (
            <div className="flex flex-col gap-1">
              <span className="t-overline text-text-lo">Branch</span>
              <span className="t-body-sm flex h-8 items-center rounded-md border border-line bg-surface-2 px-2 text-text-mid">
                Your branch only
              </span>
            </div>
          ) : (
            <SelectField
              label="Branch"
              value={branch}
              onChange={setBranch}
              className="w-44"
              options={[
                { value: ALL, label: "All branches" },
                ...branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
              ]}
            />
          )}
        </Toolbar>

        <TabBar tabs={tabs} active={tab} onChange={setTab} label="Renewal radar horizons" />

        <section aria-label={tabs.find((t) => t.id === tab)?.label ?? "Renewal radar"}>
          {tab === "D30" || tab === "D60" || tab === "D90" ? (
            <>
              <p className="t-body-sm border-b border-line px-3 py-2 text-text-lo">
                Contracts reaching their end date within {HORIZON[tab]} days, soonest first. Value
                shown is the contract value at risk if the renewal is not closed.
              </p>
              {renderContractTable(within(HORIZON[tab]), "EXPIRING")}
            </>
          ) : null}

          {tab === "LAPSED" ? (
            <>
              <p className="t-body-sm border-b border-line px-3 py-2 text-text-lo">
                Contracts that reached their end date without a renewal, retained for the trailing
                twelve months. An exception is raised for each, and the total is the visible
                leakage figure — <span className="t-mono text-danger">{formatINR(leakage)}</span>.
              </p>
              {renderContractTable(lapsedRows, "LAPSED")}
            </>
          ) : null}

          {tab === "WARRANTY" ? (
            !ready ? (
              skeleton
            ) : warrantyRows.length === 0 ? (
              activeFilters.length ? (
                <FilteredEmpty entity="machines" names={activeFilters} onClear={clearFilters} />
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="No warranty ends within 90 days"
                  body="Every machine still in warranty has more than a quarter to run. They will appear here as the cover approaches its end, with the service history that supports the conversation."
                />
              )
            ) : (
              <>
                <p className="t-body-sm border-b border-line px-3 py-2 text-text-lo">
                  Machines whose warranty ends within 90 days. Service history is summarised so the
                  AMC conversation opens with evidence rather than a price.
                </p>
                <TableFrame className="min-w-full">
                  <thead>
                    <tr>
                      <Th>Machine</Th>
                      <Th>Customer &amp; site</Th>
                      <Th>Warranty ends</Th>
                      <Th numeric>Days remaining</Th>
                      <Th>Service history</Th>
                      <Th numeric>Estimated AMC value</Th>
                      <Th>Renewal status</Th>
                      <Th className="text-right">Initiate conversion</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {warrantyRows.map((r) => {
                      const action = actionFor(`asset:${r.assetId}`);
                      const tone = daysTone(r.daysRemaining);
                      return (
                        <Row key={r.assetId} tone={r.daysRemaining <= 30 ? "warn" : "none"}>
                          <Td nowrap>
                            <Link
                              href={`/service/assets/${encodeURIComponent(r.serial)}`}
                              className="inline-flex min-h-6 items-center hover:underline"
                            >
                              <Serial value={r.serial} />
                            </Link>
                            <span className="t-body-sm mt-0.5 flex items-center gap-1.5 text-text-lo">
                              {r.model}
                              <PrincipalTag principal={r.principal} />
                            </span>
                          </Td>
                          <Td>
                            <span className="block text-text-hi">{r.customerName}</span>
                            <span className="t-body-sm block text-text-lo">
                              {r.siteName} · {r.branchCode}
                            </span>
                          </Td>
                          <Td nowrap>
                            <span className="t-mono text-text-hi">{formatDate(r.warrantyEnd)}</span>
                          </Td>
                          <Td numeric nowrap>
                            <span className={cn("inline-flex items-center gap-1", tone.cls)}>
                              <AlarmClock className="size-3.5" aria-hidden />
                              {r.daysRemaining}
                              <span className="t-overline">{tone.label}</span>
                            </span>
                          </Td>
                          <Td>
                            <span className="block tabular-nums text-text-hi">
                              {r.visits} visits · {r.tickets} tickets
                            </span>
                            <span className="t-body-sm block text-text-lo">
                              Parts {formatINR(r.partsSpend)} ·{" "}
                              {r.lastServiceAt ? `last ${formatDate(r.lastServiceAt)}` : "never serviced"}
                            </span>
                          </Td>
                          <Td numeric nowrap>
                            {formatINR(r.estimatedAmcValue)}
                          </Td>
                          <Td nowrap>
                            <RenewalStatusBadge status={action?.status ?? "IDENTIFIED"} />
                          </Td>
                          <Td className="text-right" nowrap>
                            <ActionCell
                              actionKey={`asset:${r.assetId}`}
                              onInitiate={() => openWarrantyConversion(r)}
                              label="Initiate conversion"
                            />
                          </Td>
                        </Row>
                      );
                    })}
                  </tbody>
                </TableFrame>
              </>
            )
          ) : null}

          {tab === "UNCOVERED" ? (
            !ready ? (
              skeleton
            ) : uncoveredRows.length === 0 ? (
              activeFilters.length ? (
                <FilteredEmpty entity="machines" names={activeFilters} onClear={clearFilters} />
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="Every machine on the register is covered"
                  body="No installed asset is without a live warranty or a live AMC. The attach rate is 100% and there is nothing to work here."
                />
              )
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
                  <p className="t-body-sm text-text-lo">
                    Every machine with neither a live warranty nor a live AMC. Sorted by how long it
                    has been since anyone was on site.
                  </p>
                  <p className="t-body-sm tabular-nums text-text-mid">
                    <span className="t-mono text-text-hi">{formatPercent(attach.pct, 0)}</span> attach
                    · <span className="t-mono text-text-hi">{formatCount(attach.outOfCoverage)}</span>{" "}
                    uncovered · {abbreviateINR(uncoveredValue)} estimated
                  </p>
                </div>
                <TableFrame className="min-w-full">
                  <thead>
                    <tr>
                      <Th>Machine</Th>
                      <Th>Customer &amp; site</Th>
                      <Th numeric>Months since last service</Th>
                      <Th>Last service</Th>
                      <Th numeric>Estimated AMC value</Th>
                      <Th>Renewal status</Th>
                      <Th className="text-right">Initiate quotation</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncoveredRows.map((r) => {
                      const action = actionFor(`asset:${r.assetId}`);
                      const cold = r.monthsSinceLastService === null || r.monthsSinceLastService >= 12;
                      return (
                        <Row key={r.assetId} tone={cold ? "warn" : "none"}>
                          <Td nowrap>
                            <Link
                              href={`/service/assets/${encodeURIComponent(r.serial)}`}
                              className="inline-flex min-h-6 items-center hover:underline"
                            >
                              <Serial value={r.serial} />
                            </Link>
                            <span className="t-body-sm mt-0.5 flex items-center gap-1.5 text-text-lo">
                              {r.model}
                              <PrincipalTag principal={r.principal} />
                            </span>
                          </Td>
                          <Td>
                            <span className="block text-text-hi">{r.customerName}</span>
                            <span className="t-body-sm block text-text-lo">
                              {r.siteName} · {r.branchCode}
                            </span>
                          </Td>
                          <Td numeric nowrap>
                            {r.monthsSinceLastService === null ? (
                              <span className="inline-flex items-center gap-1 text-warn">
                                <ShieldOff className="size-3.5" aria-hidden />
                                Never
                              </span>
                            ) : (
                              <span className={cold ? "text-warn" : "text-text-hi"}>
                                {r.monthsSinceLastService}
                              </span>
                            )}
                          </Td>
                          <Td nowrap>
                            {r.lastServiceAt ? (
                              <span className="t-mono text-text-mid">{formatDate(r.lastServiceAt)}</span>
                            ) : (
                              <span className="t-body-sm text-text-lo">No visit on record</span>
                            )}
                          </Td>
                          <Td numeric nowrap>
                            {formatINR(r.estimatedAmcValue)}
                          </Td>
                          <Td nowrap>
                            <StatusBadge tone={action ? "info" : "warn"} icon={false}>
                              {action ? "Quoted" : "Out of coverage"}
                            </StatusBadge>
                          </Td>
                          <Td className="text-right" nowrap>
                            <ActionCell
                              actionKey={`asset:${r.assetId}`}
                              onInitiate={() => openUncoveredQuote(r)}
                              label="Initiate quotation"
                            />
                          </Td>
                        </Row>
                      );
                    })}
                  </tbody>
                </TableFrame>
              </>
            )
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
          <p className="t-body-sm text-text-lo">
            Estimated AMC value is priced off the live book — total live contract value ÷ total
            covered rated kW, applied to the machine&apos;s rating, floored at{" "}
            <span className="t-mono">{formatINR(18000)}</span>.
          </p>
          <Link
            href="/service/amc"
            className="t-body-sm inline-flex min-h-6 items-center gap-1.5 text-text-mid hover:text-text-hi"
          >
            Open the AMC register
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </Panel>

      <Modal
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
        wide
        title={draft?.title ?? "Initiate renewal"}
        description="A quotation pre-populated from the source record — same machines, same scope, same value — and linked back to it."
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button tone="primary" onClick={commitDraft}>
              <FileSignature className="size-4" aria-hidden />
              Create quotation
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <dl className="divide-y divide-line rounded-md border border-line px-3">
              <DraftRow label="Customer">{draft.customerName}</DraftRow>
              <DraftRow label="Covered machines">
                <span className="flex flex-wrap justify-end gap-x-2 gap-y-0.5">
                  {draft.assets.map((s) => (
                    <Serial key={s} value={s} />
                  ))}
                </span>
              </DraftRow>
              <DraftRow label="Scope carried forward">{draft.scope}</DraftRow>
              <DraftRow label="Owner">{draft.owner}</DraftRow>
              <DraftRow label="Linked source">
                {draft.sourceContractId ? (
                  <span className="t-mono">{draft.sourceContractId}</span>
                ) : (
                  "New cover — no source contract"
                )}
              </DraftRow>
            </dl>

            <label className="flex flex-col gap-1">
              <span className="t-overline text-text-lo">Quotation value (₹)</span>
              <TextInput
                type="number"
                min={0}
                step={500}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
              <span className="t-body-sm text-text-lo">
                Carried forward at {formatINR(Number(draft.value) || 0)}. Edit before raising if the
                scope has changed.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="t-overline text-text-lo">Basis recorded on the quotation</span>
              <TextArea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>

            <p className="t-body-sm rounded-md border border-info/40 bg-info-bg px-2.5 py-2 text-text-mid">
              The quotation is written to this browser session under{" "}
              <span className="t-mono">pravaah.v1.renewals</span> and shown against the source
              record as its last action. Nothing on the seeded register is altered.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
