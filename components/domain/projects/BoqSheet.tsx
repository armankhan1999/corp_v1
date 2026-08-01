"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, Info, Lock, Plus, Search } from "lucide-react";
import { BOQ_SECTIONS } from "@/lib/seed/catalog";
import { abbreviateINR, formatCount, formatINR, formatPercent, formatQty } from "@/lib/format";
import { Panel, PanelHeader, Overline, EmptyState, StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import {
  boqTotals, computeBoqLine, groupBoq, type BoqLineSeed,
} from "./compute";
import { recordVariation, useProjectsOverlay } from "./store";
import {
  BlockedNotice, Btn, DenseTableShell, Field, FilteredEmpty, NumberInput, ProgressBar,
  Select, StatBlock, TD, TDR, TextInput, TH, THR, WarnNotice,
} from "./ui";

/**
 * E6-S2 — the BOQ sheet. The densest surface in the product: 36px rows, mono
 * item codes, every quantity and every rupee right-aligned on tabular figures.
 *
 * Two blocks live here and they are the point of the screen:
 *   • cumulative executed quantity cannot be typed into — it is the sum of
 *     dated progress entries and nothing else;
 *   • an executed quantity beyond the contracted quantity is refused until an
 *     approved variation with a reference and a value is on record.
 */
export function BoqSheet({
  projectId, projectCode, contractValue, lines, canWrite, actor,
}: {
  projectId: string;
  projectCode: string;
  contractValue: number;
  lines: BoqLineSeed[];
  canWrite: boolean;
  actor: { id: string; name: string };
}) {
  const overlay = useProjectsOverlay();
  const [q, setQ] = useState("");
  const [sectionFilter, setSectionFilter] = useState<"ALL" | string>("ALL");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editAttempt, setEditAttempt] = useState<string | null>(null);
  const [variationFor, setVariationFor] = useState<string | null>(null);

  const computed = useMemo(
    () => lines.map((l) => computeBoqLine(l, overlay)),
    [lines, overlay],
  );

  const filters: string[] = [];
  if (q.trim()) filters.push(`search “${q.trim()}”`);
  if (sectionFilter !== "ALL") filters.push(`section ${sectionFilter}`);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return computed.filter((l) => {
      if (sectionFilter !== "ALL" && l.section !== sectionFilter) return false;
      if (!needle) return true;
      return l.code.toLowerCase().includes(needle) || l.description.toLowerCase().includes(needle);
    });
  }, [computed, q, sectionFilter]);

  const sections = useMemo(() => groupBoq(visible, BOQ_SECTIONS), [visible]);
  const totals = useMemo(() => boqTotals(groupBoq(computed, BOQ_SECTIONS)), [computed]);
  const shownTotals = useMemo(() => boqTotals(sections), [sections]);

  const reconciliationDelta = totals.pricedValue - contractValue;
  const reconciles = Math.abs(reconciliationDelta) <= Math.max(1, Math.round(contractValue * 0.0005));
  const overrunLines = computed.filter((l) => l.executedQty > l.effectiveQty + 0.0001);

  function clearFilters() { setQ(""); setSectionFilter("ALL"); }

  if (lines.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={FileSpreadsheet}
          title="No bill of quantities has been entered"
          body="A BOQ is the spine of the project — executed quantities, RA-bills and retention all hang from it. Import the priced schedule from the work order, or enter the sections line by line."
          action={<Btn variant="primary"><Plus className="size-3.5" aria-hidden /> Enter the first section</Btn>}
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------- reconciliation */}
      <Panel>
        <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-5">
          <li className="bg-surface-1">
            <StatBlock label="Contracted BOQ value" value={abbreviateINR(totals.contractedAmount)} sub={`${formatCount(lines.length)} priced lines`} />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Recorded variations"
              value={abbreviateINR(totals.variationValue)}
              tone={totals.variationValue ? "info" : undefined}
              sub={totals.variationValue ? `${computed.filter((l) => l.variationQtyTotal !== 0).length} lines carry a variation` : "None on record"}
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock label="Executed value" value={abbreviateINR(totals.executedValue)} sub={`${formatPercent(totals.pct)} of priced value`} />
          </li>
          <li className="bg-surface-1">
            <StatBlock label="Balance value" value={abbreviateINR(totals.balanceValue)} sub="Priced value less executed" />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Priced value vs contract"
              value={reconciles ? "Reconciles" : abbreviateINR(reconciliationDelta)}
              tone={reconciles ? "ok" : "warn"}
              sub={
                reconciles
                  ? "BOQ plus variations equals the work order value"
                  : `Priced BOQ ${abbreviateINR(totals.pricedValue)} against work order ${abbreviateINR(contractValue)}`
              }
            />
          </li>
        </ul>
        <div className="border-t border-line px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <Overline>Project progress — executed value against priced BOQ</Overline>
            <span className="t-body-sm tabular-nums text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatINR(totals.executedValue)} / {formatINR(totals.pricedValue)} · {formatPercent(totals.pct)}
            </span>
          </div>
          <ProgressBar className="mt-1.5 h-2" pct={totals.pct} label={`Project executed ${formatPercent(totals.pct)}`} />
        </div>
        {!reconciles ? (
          <div className="border-t border-line p-3">
            <WarnNotice
              title="Priced BOQ does not tie to the work order value"
              body={
                <>
                  The sum of contracted amounts plus recorded variations is {formatINR(totals.pricedValue)}; the
                  work order carries {formatINR(contractValue)}. The difference of {formatINR(Math.abs(reconciliationDelta))}
                  {" "}must be resolved by a variation order or a corrected rate before the final bill is raised — it is
                  shown rather than absorbed so that nothing is claimed that the contract does not cover.
                </>
              }
            />
          </div>
        ) : null}
      </Panel>

      {overrunLines.length ? (
        <BlockedNotice
          rule={`${overrunLines.length} line${overrunLines.length === 1 ? "" : "s"} carry executed quantity beyond the contracted quantity`}
          unblock="Each needs an approved variation with a reference and an approved value before it can be claimed. Open the line below and record the variation."
        />
      ) : null}

      {/* ------------------------------------------------------ the sheet */}
      <Panel>
        <PanelHeader
          title="Bill of quantities"
          sub="Grouped into contract sections with subtotals. Executed value, balance quantity and balance value are computed per line and totalled."
          right={
            <Link
              href={`/projects/${projectId}/dpr`}
              className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <Plus className="size-3.5" aria-hidden /> Record a progress entry
            </Link>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <label className="relative">
            <span className="sr-only">Search BOQ lines</span>
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-text-lo" aria-hidden />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item code or description" className="w-64 pl-7" />
          </label>
          <label>
            <span className="sr-only">Filter by section</span>
            <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="w-60">
              <option value="ALL">All sections</option>
              {BOQ_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
          {filters.length ? <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn> : null}
          <span className="t-body-sm ml-auto text-text-lo">
            {formatCount(visible.length)} of {formatCount(lines.length)} lines · {abbreviateINR(shownTotals.executedValue)} executed in view
          </span>
        </div>

        {editAttempt ? (
          <div className="border-b border-line p-3">
            <BlockedNotice
              rule="cumulative executed quantity cannot be edited directly"
              unblock="Executed quantity is the sum of dated progress entries against this line and cannot be typed over. Record a dated DPR with the quantity done on site; the cumulative figure will move by itself and stay traceable to the day it was earned."
              onDismiss={() => setEditAttempt(null)}
              action={
                <Link
                  href={`/projects/${projectId}/dpr?line=${editAttempt}`}
                  className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-primary-600 bg-primary-600 px-2.5 text-white hover:bg-primary-500"
                >
                  Record a dated progress entry
                </Link>
              }
            />
          </div>
        ) : null}

        {visible.length === 0 ? (
          <FilteredEmpty filters={filters} onClear={clearFilters} />
        ) : (
          <DenseTableShell minWidth={1440}>
            <caption className="sr-only">
              Bill of quantities for {projectCode}: item code, description, unit, contracted quantity, rate,
              amount, variation, cumulative executed quantity and value, and balance quantity and value,
              subtotalled by section.
            </caption>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line-strong bg-surface-2">
                <th scope="col" className={cn(TH, "w-24")}>Code</th>
                <th scope="col" className={TH}>Description</th>
                <th scope="col" className={cn(TH, "w-16")}>Unit</th>
                <th scope="col" className={THR}>Contracted qty</th>
                <th scope="col" className={THR}>Rate</th>
                <th scope="col" className={THR}>Amount</th>
                <th scope="col" className={THR}>Variation</th>
                <th scope="col" className={THR}>Executed qty</th>
                <th scope="col" className={THR}>Executed value</th>
                <th scope="col" className={THR}>Balance qty</th>
                <th scope="col" className={THR}>Balance value</th>
                <th scope="col" className={cn(THR, "w-28")}>Progress</th>
              </tr>
            </thead>
            {sections.map((sec) => {
              const isCollapsed = collapsed[sec.section];
              return (
                <tbody key={sec.section}>
                  <tr className="border-b border-line bg-surface-2/70">
                    <td colSpan={3} className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [sec.section]: !c[sec.section] }))}
                        aria-expanded={!isCollapsed}
                        className="t-label flex items-center gap-1 text-text-hi"
                      >
                        {isCollapsed ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
                        {sec.section}
                        <span className="t-body-sm text-text-lo">({sec.lines.length})</span>
                      </button>
                    </td>
                    <td colSpan={2} />
                    <td className={cn(TDR, "font-medium")}>{formatINR(sec.contractedAmount)}</td>
                    <td className={TDR}>{sec.variationValue ? formatINR(sec.variationValue) : <span className="text-text-lo">—</span>}</td>
                    <td />
                    <td className={cn(TDR, "font-medium")}>{formatINR(sec.executedValue)}</td>
                    <td />
                    <td className={cn(TDR, "font-medium")}>{formatINR(sec.balanceValue)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="t-body-sm tabular-nums text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatPercent(sec.pct)}
                        </span>
                      </div>
                      <ProgressBar className="mt-1" pct={sec.pct} label={`${sec.section} ${formatPercent(sec.pct)}`} />
                    </td>
                  </tr>

                  {isCollapsed ? null : sec.lines.map((l) => {
                    const over = l.executedQty > l.effectiveQty + 0.0001;
                    return (
                      <tr key={l.id} className={cn("h-9 border-b border-line hover:bg-surface-2", over && "bg-danger-bg/40")}>
                        <td className={cn(TD, "t-mono text-text-hi")}>{l.code}</td>
                        <td className={cn(TD, "max-w-[28rem] whitespace-normal")}>
                          <span className="text-text-hi">{l.description}</span>
                          {l.variationRefAll ? (
                            <span className="t-body-sm ml-2 text-info">
                              Variation {l.variationRefAll}
                              {l.variationFromOverlay ? " · recorded here" : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className={TD}>{l.uom}</td>
                        <td className={TDR}>{formatQty(l.contractedQty)}</td>
                        <td className={TDR}>{formatINR(l.rate)}</td>
                        <td className={TDR}>{formatINR(l.contractedAmount)}</td>
                        <td className={TDR}>
                          {l.variationQtyTotal ? (
                            <span className="text-info">
                              {l.variationQtyTotal > 0 ? "+" : ""}{formatQty(l.variationQtyTotal)}
                            </span>
                          ) : canWrite ? (
                            <button
                              type="button"
                              onClick={() => setVariationFor(variationFor === l.id ? null : l.id)}
                              className="t-body-sm text-text-lo underline decoration-line underline-offset-2 hover:text-text-hi"
                            >
                              Record
                            </button>
                          ) : (
                            <span className="text-text-lo">—</span>
                          )}
                        </td>
                        <td className={cn(TDR, "p-0")}>
                          {/* The block that matters: this cell looks editable and refuses to be. */}
                          <button
                            type="button"
                            onClick={() => setEditAttempt(l.id)}
                            aria-describedby="boq-executed-rule"
                            title="Cumulative executed quantity is derived from dated progress entries"
                            className={cn(
                              "flex h-9 w-full items-center justify-end gap-1 px-2 tabular-nums hover:bg-surface-3",
                              editAttempt === l.id && "bg-danger-bg text-danger",
                            )}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            <Lock className="size-3 shrink-0 text-text-lo" aria-hidden />
                            {formatQty(l.executedQty)}
                          </button>
                        </td>
                        <td className={TDR}>{formatINR(l.executedValue)}</td>
                        <td className={cn(TDR, l.balanceQty < 0 && "text-danger")}>{formatQty(l.balanceQty)}</td>
                        <td className={cn(TDR, l.balanceValue < 0 && "text-danger")}>{formatINR(l.balanceValue)}</td>
                        <td className="px-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {over ? <StatusBadge tone="danger" icon={false}>Over</StatusBadge> : null}
                            <span className="t-body-sm tabular-nums text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {formatPercent(l.executedPct)}
                            </span>
                          </div>
                          <ProgressBar
                            className="mt-1"
                            pct={l.executedPct}
                            tone={over ? "danger" : "projects"}
                            label={`${l.code} ${formatPercent(l.executedPct)}`}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {variationFor && sec.lines.some((l) => l.id === variationFor) ? (
                    <tr className="border-b border-line bg-surface-2">
                      <td colSpan={12} className="p-3">
                        <VariationForm
                          line={sec.lines.find((l) => l.id === variationFor)!}
                          projectId={projectId}
                          actor={actor}
                          onDone={() => setVariationFor(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              );
            })}
            <tfoot>
              <tr className="border-t-2 border-line-strong bg-surface-2">
                <td colSpan={5} className={cn(TD, "t-label py-2 text-text-hi")}>
                  Project total {sectionFilter !== "ALL" || q.trim() ? "(filtered view)" : ""}
                </td>
                <td className={cn(TDR, "font-semibold")}>{formatINR(shownTotals.contractedAmount)}</td>
                <td className={cn(TDR, "font-semibold")}>{shownTotals.variationValue ? formatINR(shownTotals.variationValue) : "—"}</td>
                <td />
                <td className={cn(TDR, "font-semibold")}>{formatINR(shownTotals.executedValue)}</td>
                <td />
                <td className={cn(TDR, "font-semibold")}>{formatINR(shownTotals.balanceValue)}</td>
                <td className={cn(TDR, "font-semibold")}>{formatPercent(shownTotals.pct)}</td>
              </tr>
            </tfoot>
          </DenseTableShell>
        )}

        <p id="boq-executed-rule" className="t-body-sm flex items-start gap-2 border-t border-line px-3 py-2 text-text-lo">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Cumulative executed quantity is derived, never entered. It is the sum of every dated progress entry
          filed against the line, so each rupee of executed value can be walked back to the day it was earned.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------- variation */

function VariationForm({
  line, projectId, actor, onDone,
}: {
  line: { id: string; code: string; description: string; uom: string; rate: number; contractedQty: number };
  projectId: string;
  actor: { id: string; name: string };
  onDone: () => void;
}) {
  const [qty, setQty] = useState("");
  const [ref, setRef] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const derivedValue = Number(qty) * line.rate;

  function save() {
    if (!ref.trim()) { setError("A variation reference is required — the client's approval letter or VO number."); return; }
    if (!Number(qty)) { setError("Enter the additional quantity the variation approves."); return; }
    if (!Number(value)) { setError("Enter the approved value. Without it the variation cannot be claimed."); return; }
    recordVariation(
      {
        boqLineId: line.id, projectId,
        variationQty: Number(qty), variationRef: ref.trim(),
        approvedValue: Number(value), recordedAt: new Date().toISOString(),
      },
      actor,
    );
    onDone();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Overline>Record an approved variation</Overline>
        <p className="t-body-sm mt-0.5 text-text-mid">
          <span className="t-mono text-text-hi">{line.code}</span> — {line.description}. Contracted{" "}
          {formatQty(line.contractedQty, line.uom)} at {formatINR(line.rate)}.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label={`Additional quantity (${line.uom})`} required>
          <NumberInput value={qty} onChange={(e) => { setQty(e.target.value); setError(null); }} step="0.01" min={0} />
        </Field>
        <Field label="Variation reference" required hint="Client approval or VO number">
          <TextInput value={ref} onChange={(e) => { setRef(e.target.value); setError(null); }} placeholder="VO/26/003" />
        </Field>
        <Field
          label="Approved value (₹)"
          required
          hint={qty ? `At contracted rate this would be ${formatINR(derivedValue)}` : undefined}
        >
          <NumberInput value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} step={100} min={0} />
        </Field>
        <div className="flex items-end gap-2">
          <Btn variant="primary" onClick={save}>Record variation</Btn>
          <Btn onClick={onDone}>Cancel</Btn>
        </div>
      </div>
      {error ? <p className="t-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
