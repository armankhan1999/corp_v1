"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeIndianRupee, Check, Landmark, Search } from "lucide-react";
import { retentionStateOf } from "@/lib/derive";
import type { RetentionState } from "@/lib/schemas/enums";
import {
  abbreviateINR, daysBetween, formatCount, formatDate, formatINR, formatPercent,
} from "@/lib/format";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { RETENTION_STATE_LABEL, RETENTION_STATE_TONE } from "./labels";
import { raiseClaim, recordRelease, useProjectsOverlay } from "./store";
import {
  BlockedNotice, Btn, DenseTableShell, Field, FilteredEmpty, NumberInput, ROW, Select,
  SortButton, StatBlock, TD, TDR, TextInput, TH, THR, type SortDir,
} from "./ui";

export interface RetentionRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  managerName: string;
  projectStatus: string;
  raBillId: string;
  raBillNumber: string;
  raBillSequence: number;
  amount: number;
  withheldOn: string;
  eligibleFrom: string;
  claimRaisedAt: string | null;
  releasedAt: string | null;
  releasedAmount: number | null;
  releaseRef: string | null;
  dlpExpiry: string;
  retentionPct: number;
  source: "SEED" | "OVERLAY";
}

type SortKey = "projectCode" | "amount" | "eligibleFrom" | "withheldOn" | "state";

/**
 * E6-S6 — the retention register.
 *
 * Every rupee withheld across the portfolio, with the defect-liability expiry
 * that governs it and the eligibility state that follows from that expiry
 * against the simulated date. The outstanding total is the retention component
 * of the Command Centre locked-cash panel, so it must reconcile exactly to the
 * sum of the individual entries below — and the reconciliation is shown, not
 * asserted.
 */
export function RetentionRegister({
  rows, today, actor, canWrite, scopeNote,
}: {
  rows: RetentionRow[];
  today: string;
  actor: { id: string; name: string };
  canWrite: boolean;
  scopeNote: string;
}) {
  const overlay = useProjectsOverlay();
  const now = new Date(today);
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<"ALL" | RetentionState>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("projectCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [releaseFor, setReleaseFor] = useState<string | null>(null);

  /* Seed entries plus anything posted by a certification in this session, with
     releases and claims captured here layered on top. */
  const merged = useMemo(() => {
    const projectMeta = new Map(
      rows.map((r) => [r.projectId, {
        projectCode: r.projectCode, projectName: r.projectName, clientName: r.clientName,
        managerName: r.managerName, projectStatus: r.projectStatus, dlpExpiry: r.dlpExpiry,
        retentionPct: r.retentionPct,
      }]),
    );
    const fromOverlay: RetentionRow[] = overlay.retentionEntries
      .filter((e) => projectMeta.has(e.projectId))
      .map((e) => {
        const meta = projectMeta.get(e.projectId)!;
        return {
          id: e.id, projectId: e.projectId, ...meta,
          raBillId: e.raBillId, raBillNumber: e.raBillNumber, raBillSequence: 0,
          amount: e.amount, withheldOn: e.withheldOn, eligibleFrom: e.eligibleFrom,
          claimRaisedAt: null, releasedAt: null, releasedAmount: null, releaseRef: null,
          source: "OVERLAY" as const,
        };
      });
    return [...rows, ...fromOverlay].map((r) => {
      const rel = overlay.releases[r.id];
      const claim = overlay.claims[r.id];
      return {
        ...r,
        claimRaisedAt: rel ? (r.claimRaisedAt ?? claim ?? null) : (claim ?? r.claimRaisedAt),
        releasedAt: rel ? rel.date : r.releasedAt,
        releasedAmount: rel ? rel.amount : r.releasedAmount,
        releaseRef: rel ? rel.reference : r.releaseRef,
      };
    });
  }, [rows, overlay]);

  const withState = useMemo(
    () => merged.map((r) => ({
      ...r,
      state: retentionStateOf(
        {
          id: r.id, projectId: r.projectId, raBillId: r.raBillId, amount: r.amount,
          withheldOn: r.withheldOn, eligibleFrom: r.eligibleFrom,
          claimRaisedAt: r.claimRaisedAt, releasedAt: r.releasedAt,
          releasedAmount: r.releasedAmount, releaseRef: r.releaseRef,
        },
        now,
      ),
    })),
    [merged, today], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* Totals — the reconciliation the acceptance criteria demand. */
  const withheldTotal = withState.reduce((s, r) => s + r.amount, 0);
  const releasedTotal = withState.filter((r) => r.state === "RELEASED").reduce((s, r) => s + (r.releasedAmount ?? r.amount), 0);
  const outstandingRows = withState.filter((r) => r.state !== "RELEASED");
  const outstandingTotal = outstandingRows.reduce((s, r) => s + r.amount, 0);
  const eligibleRows = withState.filter((r) => r.state === "ELIGIBLE" || r.state === "CLAIM_RAISED");
  const eligibleTotal = eligibleRows.reduce((s, r) => s + r.amount, 0);
  const projectsHolding = new Set(outstandingRows.map((r) => r.projectId));
  const eligibleProjects = new Set(eligibleRows.map((r) => r.projectId));

  const byProject = useMemo(() => {
    const map = new Map<string, {
      projectId: string; projectCode: string; projectName: string; clientName: string;
      managerName: string; dlpExpiry: string; retentionPct: number;
      withheld: number; released: number; outstanding: number; eligible: number;
      earliestEligible: string; states: Set<RetentionState>;
    }>();
    for (const r of withState) {
      const cur = map.get(r.projectId) ?? {
        projectId: r.projectId, projectCode: r.projectCode, projectName: r.projectName,
        clientName: r.clientName, managerName: r.managerName, dlpExpiry: r.dlpExpiry,
        retentionPct: r.retentionPct,
        withheld: 0, released: 0, outstanding: 0, eligible: 0,
        earliestEligible: r.eligibleFrom, states: new Set<RetentionState>(),
      };
      cur.withheld += r.amount;
      cur.states.add(r.state);
      if (r.state === "RELEASED") cur.released += r.releasedAmount ?? r.amount;
      else {
        cur.outstanding += r.amount;
        if (r.state === "ELIGIBLE" || r.state === "CLAIM_RAISED") cur.eligible += r.amount;
        if (r.eligibleFrom < cur.earliestEligible) cur.earliestEligible = r.eligibleFrom;
      }
      map.set(r.projectId, cur);
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
  }, [withState]);

  const filters: string[] = [];
  if (q.trim()) filters.push(`search “${q.trim()}”`);
  if (stateFilter !== "ALL") filters.push(`state ${RETENTION_STATE_LABEL[stateFilter]}`);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withState.filter((r) => {
      if (stateFilter !== "ALL" && r.state !== stateFilter) return false;
      if (!needle) return true;
      return (
        r.projectCode.toLowerCase().includes(needle) ||
        r.projectName.toLowerCase().includes(needle) ||
        r.clientName.toLowerCase().includes(needle) ||
        r.raBillNumber.toLowerCase().includes(needle)
      );
    });
  }, [withState, q, stateFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      if (sortKey === "amount") return (a.amount - b.amount) * dir;
      if (sortKey === "eligibleFrom") return a.eligibleFrom.localeCompare(b.eligibleFrom) * dir;
      if (sortKey === "withheldOn") return a.withheldOn.localeCompare(b.withheldOn) * dir;
      if (sortKey === "state") return a.state.localeCompare(b.state) * dir;
      return (a.projectCode.localeCompare(b.projectCode) || a.raBillNumber.localeCompare(b.raBillNumber)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "amount" ? "desc" : "asc"); }
  }
  function clearFilters() { setQ(""); setStateFilter("ALL"); }

  if (!rows.length) {
    return (
      <Panel>
        <EmptyState
          icon={Landmark}
          title="No retention has been withheld"
          body="Retention is posted here automatically when a running-account bill is certified, at the project's retention percentage on the certified value. Nothing has been certified yet."
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------- aggregate */}
      <Panel>
        <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          <li className="bg-surface-1">
            <StatBlock label="Retention withheld — all time" value={abbreviateINR(withheldTotal)} sub={`${formatCount(withState.length)} entries across ${formatCount(new Set(withState.map((r) => r.projectId)).size)} projects`} />
          </li>
          <li className="bg-surface-1">
            <StatBlock label="Released" value={abbreviateINR(releasedTotal)} tone="ok" sub={`${formatCount(withState.filter((r) => r.state === "RELEASED").length)} entries closed out`} />
          </li>
          <li className="bg-surface-1">
            <StatBlock label="Outstanding" value={abbreviateINR(outstandingTotal)} tone="warn" sub={`Held across ${formatCount(projectsHolding.size)} projects`} />
          </li>
          <li className="bg-surface-1">
            <StatBlock label="Claimable now" value={abbreviateINR(eligibleTotal)} tone={eligibleTotal ? "danger" : undefined} sub={`${formatCount(eligibleProjects.size)} projects past defect-liability expiry`} />
          </li>
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
          <p className="t-body-sm text-text-mid">
            <span className="text-text-hi">Reconciliation.</span> Withheld {formatINR(withheldTotal)} less released{" "}
            {formatINR(releasedTotal)} equals outstanding{" "}
            <span className="t-mono text-text-hi">{formatINR(outstandingTotal)}</span> — the exact sum of the{" "}
            {formatCount(outstandingRows.length)} unreleased entries listed below.
          </p>
          <StatusBadge tone={withheldTotal - releasedTotal === outstandingTotal ? "ok" : "danger"}>
            {withheldTotal - releasedTotal === outstandingTotal ? "Ties to the rupee" : "Does not tie"}
          </StatusBadge>
        </div>
        <p className="t-body-sm border-t border-line px-3 py-2 text-text-lo">
          This outstanding total is the retention component of the Command Centre locked-cash panel. The two
          figures are the same number read from the same register — if this moves, the headline moves with it.{" "}
          <Link href="/command" className="underline decoration-line underline-offset-2 hover:text-text-hi">
            Open the Command Centre
          </Link>
        </p>
      </Panel>

      {/* ------------------------------------------------------- exceptions */}
      {eligibleRows.filter((r) => r.state === "ELIGIBLE").length ? (
        <Panel>
          <PanelHeader
            title="Retention now claimable"
            sub="Raised as an exception the moment the defect-liability period expires, naming the project, the amount and the days since eligibility."
          />
          <ul className="flex flex-col">
            {eligibleRows
              .filter((r) => r.state === "ELIGIBLE")
              .sort((a, b) => a.eligibleFrom.localeCompare(b.eligibleFrom))
              .map((r) => {
                const days = daysBetween(r.eligibleFrom, now);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="t-body-sm text-text-hi">
                        <span className="t-mono">{r.projectCode}</span> — {r.projectName}
                      </p>
                      <p className="t-body-sm text-text-lo">
                        {formatINR(r.amount)} claimable · eligible since {formatDate(r.eligibleFrom)}, {days} days ago ·
                        manager {r.managerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={days > 45 ? "danger" : "warn"}>{days} days</StatusBadge>
                      {canWrite ? (
                        <>
                          <Btn onClick={() => raiseClaim(r.id, new Date().toISOString(), actor)}>Raise claim</Btn>
                          <Btn variant="primary" onClick={() => setReleaseFor(r.id)}>Record release</Btn>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
          </ul>
        </Panel>
      ) : null}

      {/* ------------------------------------------------- project rollup */}
      <Panel>
        <PanelHeader title="By project" sub="Withheld, released and outstanding per project with the defect-liability expiry that governs release." />
        <DenseTableShell minWidth={980}>
          <caption className="sr-only">Retention by project with defect-liability expiry and eligibility.</caption>
          <thead>
            <tr className="border-b border-line-strong bg-surface-2">
              <th scope="col" className={TH}>Project</th>
              <th scope="col" className={TH}>Client</th>
              <th scope="col" className={THR}>Rate</th>
              <th scope="col" className={THR}>Withheld</th>
              <th scope="col" className={THR}>Released</th>
              <th scope="col" className={THR}>Outstanding</th>
              <th scope="col" className={THR}>Claimable</th>
              <th scope="col" className={TH}>DLP expiry</th>
            </tr>
          </thead>
          <tbody>
            {byProject.map((p) => (
              <tr key={p.projectId} className={cn(ROW, "hover:bg-surface-2", p.eligible > 0 && "bg-warn-bg/40")}>
                <td className={TD}>
                  <Link href={`/projects/${p.projectId}/retention`} className="flex flex-col">
                    <span className="t-mono text-text-hi">{p.projectCode}</span>
                    <span className="truncate text-text-mid">{p.projectName}</span>
                  </Link>
                </td>
                <td className={cn(TD, "max-w-56 truncate")}>{p.clientName}</td>
                <td className={TDR}>{formatPercent(p.retentionPct, 0)}</td>
                <td className={TDR}>{formatINR(p.withheld)}</td>
                <td className={cn(TDR, p.released ? "text-ok" : "text-text-lo")}>{p.released ? formatINR(p.released) : "—"}</td>
                <td className={cn(TDR, "font-medium")}>{p.outstanding ? formatINR(p.outstanding) : <span className="text-text-lo">Nil</span>}</td>
                <td className={cn(TDR, p.eligible ? "text-warn" : "text-text-lo")}>{p.eligible ? formatINR(p.eligible) : "—"}</td>
                <td className={TD}>
                  {formatDate(p.dlpExpiry)}
                  <span className="block text-text-lo">
                    {daysBetween(now, p.dlpExpiry) >= 0
                      ? `${daysBetween(now, p.dlpExpiry)} days to run`
                      : `expired ${Math.abs(daysBetween(now, p.dlpExpiry))} days ago`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong bg-surface-2">
              <td colSpan={3} className={cn(TD, "t-label py-2 text-text-hi")}>Portfolio total</td>
              <td className={cn(TDR, "font-semibold")}>{formatINR(withheldTotal)}</td>
              <td className={cn(TDR, "font-semibold")}>{formatINR(releasedTotal)}</td>
              <td className={cn(TDR, "t-heading-md font-semibold")}>{formatINR(outstandingTotal)}</td>
              <td className={cn(TDR, "font-semibold text-warn")}>{formatINR(eligibleTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </DenseTableShell>
      </Panel>

      {/* --------------------------------------------------- entry ledger */}
      <Panel>
        <PanelHeader
          title="Retention entries"
          sub={`Every entry, one per certified RA-bill. ${scopeNote}`}
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <label className="relative">
            <span className="sr-only">Search retention entries</span>
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-text-lo" aria-hidden />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Project, client or bill number" className="w-64 pl-7" />
          </label>
          <label>
            <span className="sr-only">Filter by eligibility state</span>
            <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as "ALL" | RetentionState)} className="w-44">
              <option value="ALL">Any state</option>
              {(["NOT_ELIGIBLE", "ELIGIBLE", "CLAIM_RAISED", "RELEASED"] as RetentionState[]).map((s) => (
                <option key={s} value={s}>{RETENTION_STATE_LABEL[s]}</option>
              ))}
            </Select>
          </label>
          {filters.length ? <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn> : null}
          <span className="t-body-sm ml-auto text-text-lo">
            {formatCount(sorted.length)} of {formatCount(withState.length)} entries ·{" "}
            {formatINR(sorted.filter((r) => r.state !== "RELEASED").reduce((s, r) => s + r.amount, 0))} outstanding in view
          </span>
        </div>

        {sorted.length === 0 ? (
          <FilteredEmpty filters={filters} onClear={clearFilters} />
        ) : (
          <DenseTableShell minWidth={1080}>
            <caption className="sr-only">
              Individual retention entries with the bill that generated them, amount, withholding date,
              eligibility date and state.
            </caption>
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                <th scope="col" className={TH}><SortButton label="Project" active={sortKey === "projectCode"} dir={sortDir} onClick={() => toggleSort("projectCode")} /></th>
                <th scope="col" className={TH}>Source bill</th>
                <th scope="col" className={THR}><SortButton align="right" label="Amount" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")} /></th>
                <th scope="col" className={TH}><SortButton label="Withheld on" active={sortKey === "withheldOn"} dir={sortDir} onClick={() => toggleSort("withheldOn")} /></th>
                <th scope="col" className={TH}><SortButton label="Eligible from" active={sortKey === "eligibleFrom"} dir={sortDir} onClick={() => toggleSort("eligibleFrom")} /></th>
                <th scope="col" className={TH}><SortButton label="State" active={sortKey === "state"} dir={sortDir} onClick={() => toggleSort("state")} /></th>
                <th scope="col" className={TH}>Release reference</th>
                <th scope="col" className={TH} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const days = daysBetween(r.eligibleFrom, now);
                return (
                  <tr key={r.id} className={cn(ROW, "hover:bg-surface-2", r.state === "ELIGIBLE" && "bg-warn-bg/40")}>
                    <td className={TD}>
                      <Link href={`/projects/${r.projectId}/retention`} className="t-mono text-text-hi">{r.projectCode}</Link>
                      <span className="block max-w-56 truncate text-text-lo">{r.clientName}</span>
                    </td>
                    <td className={TD}>
                      <Link href={`/projects/${r.projectId}/ra-bills/${r.raBillSequence || 1}`} className="t-mono text-text-mid hover:text-text-hi">
                        {r.raBillNumber}
                      </Link>
                      {r.source === "OVERLAY" ? <span className="block text-info">Posted in this session</span> : null}
                    </td>
                    <td className={cn(TDR, "font-medium")}>{formatINR(r.amount)}</td>
                    <td className={TD}>{formatDate(r.withheldOn)}</td>
                    <td className={TD}>
                      {formatDate(r.eligibleFrom)}
                      <span className="block text-text-lo">
                        {days >= 0 ? `${days} days ago` : `in ${Math.abs(days)} days`}
                      </span>
                    </td>
                    <td className={TD}>
                      <StatusBadge tone={RETENTION_STATE_TONE[r.state]}>{RETENTION_STATE_LABEL[r.state]}</StatusBadge>
                    </td>
                    <td className={TD}>
                      {r.releaseRef ? (
                        <>
                          <span className="t-mono text-text-hi">{r.releaseRef}</span>
                          <span className="block text-text-lo">
                            {formatINR(r.releasedAmount ?? 0)} on {r.releasedAt ? formatDate(r.releasedAt) : "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-text-lo">—</span>
                      )}
                    </td>
                    <td className={cn(TD, "text-right")}>
                      {canWrite && r.state !== "RELEASED" ? (
                        r.state === "NOT_ELIGIBLE" ? (
                          <span className="t-body-sm text-text-lo" title={`Eligible from ${formatDate(r.eligibleFrom)}`}>
                            Locked until DLP expiry
                          </span>
                        ) : (
                          <Btn onClick={() => setReleaseFor(releaseFor === r.id ? null : r.id)}>
                            <BadgeIndianRupee className="size-3.5" aria-hidden /> Release
                          </Btn>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DenseTableShell>
        )}

        {releaseFor ? (
          <div className="border-t border-line p-3">
            {(() => {
              const entry = withState.find((r) => r.id === releaseFor);
              if (!entry) return null;
              if (entry.state === "NOT_ELIGIBLE") {
                return (
                  <BlockedNotice
                    rule="this retention is not yet eligible for release"
                    unblock={`The defect-liability period runs to ${formatDate(entry.eligibleFrom)}. Release can only be captured once that date has passed, or once the client agrees an early release in writing against a bank guarantee.`}
                    onDismiss={() => setReleaseFor(null)}
                  />
                );
              }
              return <ReleaseForm entry={entry} actor={actor} onDone={() => setReleaseFor(null)} />;
            })()}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function ReleaseForm({
  entry, actor, onDone,
}: {
  entry: RetentionRow & { state: RetentionState };
  actor: { id: string; name: string };
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function save() {
    const value = Number(amount);
    if (!value || value <= 0) { setError("Enter the amount actually released."); return; }
    if (value > entry.amount) { setError(`Cannot release more than the ${formatINR(entry.amount)} withheld on this entry.`); return; }
    if (!reference.trim()) { setError("A release reference is required — the client's release letter or the receipt number."); return; }
    recordRelease(
      { entryId: entry.id, amount: value, date: new Date(date).toISOString(), reference: reference.trim(), recordedAt: new Date().toISOString() },
      actor,
    );
    setDone(true);
    onDone();
  }

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <Overline>Record a retention release — {entry.projectCode} · {entry.raBillNumber}</Overline>
      <p className="t-body-sm mt-0.5 text-text-mid">
        {formatINR(entry.amount)} withheld on {formatDate(entry.withheldOn)}, eligible from{" "}
        {formatDate(entry.eligibleFrom)}. Capturing the release reduces outstanding immediately and is written to
        the audit trail.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label="Amount released (₹)" required>
          <NumberInput value={amount} min={0} max={entry.amount} step={100} onChange={(e) => { setAmount(e.target.value); setError(null); }} />
        </Field>
        <Field label="Release date" required>
          <TextInput type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(null); }} />
        </Field>
        <Field label="Reference" required hint="Client release letter or receipt">
          <TextInput value={reference} onChange={(e) => { setReference(e.target.value); setError(null); }} placeholder="REL/26/00418" />
        </Field>
        <div className="flex items-end gap-2">
          <Btn variant="primary" onClick={save}>
            {done ? <Check className="size-3.5" aria-hidden /> : null} Record release
          </Btn>
          <Btn onClick={onDone}>Cancel</Btn>
        </div>
      </div>
      {error ? <p className="t-body-sm mt-1 text-danger">{error}</p> : null}
    </div>
  );
}
