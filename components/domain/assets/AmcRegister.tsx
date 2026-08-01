"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileCheck, Plus, TriangleAlert } from "lucide-react";
import type { AMCStatus } from "@/lib/schemas/enums";
import { abbreviateINR, formatCount, formatDate, formatINR, formatPercent } from "@/lib/format";
import { EmptyState, Panel } from "@/components/patterns/primitives";
import { AmcStatusBadge } from "./badges";
import { AmcForm, emptyAmcDraft, validateAmcDraft, type AmcDraft } from "./AmcForm";
import { fulfilmentOf } from "./metrics";
import {
  EMPTY_AMC,
  applyAmcOverlay,
  generateVisitSchedule,
  localId,
  useOverlay,
  type AmcOverlay,
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
  TableFrame,
  Td,
  Th,
  Toolbar,
} from "./ui";
import type { AmcAssetOption, AmcRow, BranchOption, CustomerOption } from "./types";

const ALL = "ALL";

const STATUS_ORDER: Record<AMCStatus, number> = {
  EXPIRING: 0,
  ACTIVE: 1,
  DRAFT: 2,
  EXPIRED: 3,
  RENEWED: 4,
  TERMINATED: 5,
};

export function AmcRegister({
  rows: seedRows,
  customers,
  assets,
  branches,
  owners,
  todayIso,
  canCreate,
  defaultOwnerId,
}: {
  rows: AmcRow[];
  customers: CustomerOption[];
  assets: AmcAssetOption[];
  branches: BranchOption[];
  owners: { id: string; name: string }[];
  todayIso: string;
  canCreate: boolean;
  defaultOwnerId: string;
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const { state: overlay, ready, update } = useOverlay<AmcOverlay>("pravaah.v1.amc", EMPTY_AMC);
  const rows = React.useMemo(() => applyAmcOverlay(seedRows, overlay), [seedRows, overlay]);

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>(ALL);
  const [coverage, setCoverage] = React.useState<string>(ALL);
  const [branch, setBranch] = React.useState<string>(ALL);
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<AmcDraft>(() => emptyAmcDraft(todayIso, defaultOwnerId));
  const [attempted, setAttempted] = React.useState(false);

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`Search "${query.trim()}"`);
  if (status !== ALL) activeFilters.push(`Status ${status.toLowerCase()}`);
  if (coverage !== ALL) activeFilters.push(`Coverage ${coverage.replace(/_/g, " ").toLowerCase()}`);
  if (branch !== ALL)
    activeFilters.push(`Branch ${branches.find((b) => b.id === branch)?.code ?? branch}`);

  function clearFilters() {
    setQuery("");
    setStatus(ALL);
    setCoverage(ALL);
    setBranch(ALL);
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (status !== ALL && r.status !== status) return false;
        if (coverage !== ALL && r.coverage !== coverage) return false;
        if (branch !== ALL && r.branchId !== branch) return false;
        if (!q) return true;
        return (
          r.number.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.assetSerials.some((s) => s.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (s !== 0) return s;
        return a.endDate.localeCompare(b.endDate);
      });
  }, [rows, query, status, coverage, branch]);

  const live = rows.filter((r) => r.status === "ACTIVE" || r.status === "EXPIRING");
  const expiring = rows.filter((r) => r.status === "EXPIRING");
  const expired = rows.filter((r) => r.status === "EXPIRED");
  const bookValue = live.reduce((s, r) => s + r.contractValue, 0);
  const behind = live.filter(
    (r) => fulfilmentOf({ committed: r.committedVisits, completed: r.completedVisits, dueToDate: r.dueToDate }).behindSchedule,
  );

  const errors = validateAmcDraft(draft);
  const hasErrors = Object.keys(errors).length > 0;

  function openCreate() {
    setDraft(emptyAmcDraft(todayIso, defaultOwnerId));
    setAttempted(false);
    setFormOpen(true);
  }

  function commit() {
    setAttempted(true);
    if (hasErrors) return;
    const customer = customers.find((c) => c.id === draft.customerId);
    const selected = assets.filter((a) => draft.assetIds.includes(a.id));
    const id = localId("AMC");
    const branchId = customer?.branchId ?? selected[0]?.branchId ?? branches[0]?.id ?? "BR-01";
    const start = new Date(draft.startDate).toISOString();
    const end = new Date(draft.endDate).toISOString();
    const status: AMCStatus =
      new Date(start) > now
        ? "DRAFT"
        : new Date(end) < now
          ? "EXPIRED"
          : Math.floor((new Date(end).getTime() - now.getTime()) / 86_400_000) <= 60
            ? "EXPIRING"
            : "ACTIVE";

    const row: AmcRow = {
      id,
      number: draft.number.trim() || `BC/AMC/26/L${id.slice(-4)}`,
      customerId: draft.customerId,
      customerName: customer?.name ?? draft.customerId,
      branchId,
      branchCode: branches.find((b) => b.id === branchId)?.code ?? branchId,
      assetIds: selected.map((a) => a.id),
      assetSerials: selected.map((a) => a.serial),
      coverage: draft.coverage,
      startDate: start,
      endDate: end,
      contractValue: Number(draft.contractValue) || 0,
      billingSchedule: draft.billingSchedule,
      visitsPerYear: Number(draft.visitsPerYear) || 4,
      responseHours: Number(draft.responseHours) || 8,
      restorationHours: Number(draft.restorationHours) || 48,
      inclusions: draft.inclusions,
      exclusions: draft.exclusions,
      ownerUserId: draft.ownerUserId,
      ownerName: owners.find((o) => o.id === draft.ownerUserId)?.name ?? draft.ownerUserId,
      terminated: false,
      terminationReason: null,
      renewedIntoId: null,
      renewalQuotationId: null,
      status,
      committedVisits: 0,
      completedVisits: 0,
      dueToDate: 0,
      daysRemaining: Math.floor((new Date(end).getTime() - now.getTime()) / 86_400_000),
      local: true,
    };

    const visits = generateVisitSchedule(row);
    row.committedVisits = visits.length;
    row.dueToDate = visits.filter((v) => new Date(v.dueDate) <= now).length;

    update((prev) => ({
      ...prev,
      created: [...prev.created, row],
      visits: { ...prev.visits, [row.id]: visits },
    }));
    setFormOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="AMC contracts"
        sub="Maintenance contracts with their promised visits generated as work, so what was sold can be proved delivered. Status derives from the dates."
        right={
          canCreate ? (
            <Button tone="primary" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New contract
            </Button>
          ) : null
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <li>
          <Metric label="Contracts" value={formatCount(rows.length)} sub={`${live.length} live`} />
        </li>
        <li>
          <Metric label="Value under management" value={abbreviateINR(bookValue)} sub="live contracts" tone="info" />
        </li>
        <li>
          <Metric
            label="Expiring within 60 days"
            value={formatCount(expiring.length)}
            sub={abbreviateINR(expiring.reduce((s, r) => s + r.contractValue, 0))}
            tone="warn"
          />
        </li>
        <li>
          <Metric
            label="Expired"
            value={formatCount(expired.length)}
            sub={abbreviateINR(expired.reduce((s, r) => s + r.contractValue, 0))}
            tone="danger"
          />
        </li>
        <li>
          <Metric
            label="Behind on visits"
            value={formatCount(behind.length)}
            sub="of live contracts"
            tone={behind.length ? "warn" : "ok"}
          />
        </li>
      </ul>

      <Panel>
        <Toolbar>
          <SearchField
            label="Search"
            value={query}
            onChange={setQuery}
            placeholder="Contract number, customer or covered serial"
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            className="w-44"
            options={[
              { value: ALL, label: "All statuses" },
              { value: "EXPIRING", label: "Expiring (60 days)" },
              { value: "ACTIVE", label: "Active" },
              { value: "DRAFT", label: "Draft" },
              { value: "EXPIRED", label: "Expired" },
              { value: "RENEWED", label: "Renewed" },
              { value: "TERMINATED", label: "Terminated" },
            ]}
          />
          <SelectField
            label="Coverage"
            value={coverage}
            onChange={setCoverage}
            className="w-52"
            options={[
              { value: ALL, label: "All coverage types" },
              { value: "COMPREHENSIVE", label: "Comprehensive" },
              { value: "NON_COMPREHENSIVE", label: "Non-comprehensive" },
            ]}
          />
          <SelectField
            label="Branch"
            value={branch}
            onChange={setBranch}
            className="w-40"
            options={[
              { value: ALL, label: "All branches" },
              ...branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
            ]}
          />
        </Toolbar>

        {!ready ? (
          <div className="flex flex-col gap-px bg-line p-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 bg-surface-1" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="No maintenance contract on the book"
            body="An AMC records what was sold — covered machines, committed visits, response and restoration promises — and generates the visits as real work."
            action={canCreate ? <Button tone="primary" onClick={openCreate}>Write the first contract</Button> : undefined}
          />
        ) : filtered.length === 0 ? (
          <FilteredEmpty entity="contracts" names={activeFilters} onClear={clearFilters} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Contract</Th>
                <Th>Customer</Th>
                <Th>Covered machines</Th>
                <Th>Coverage</Th>
                <Th>Period</Th>
                <Th numeric>Value</Th>
                <Th>Fulfilment</Th>
                <Th>Status</Th>
                <Th className="text-right">Open</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const f = fulfilmentOf({
                  committed: r.committedVisits,
                  completed: r.completedVisits,
                  dueToDate: r.dueToDate,
                });
                return (
                  <Row key={r.id} tone={r.status === "EXPIRING" ? "warn" : "none"}>
                    <Td nowrap>
                      <Link href={`/service/amc/${r.id}`} className="t-mono inline-flex min-h-6 items-center text-text-hi hover:underline">
                        {r.number}
                      </Link>
                      {r.local ? (
                        <span className="t-overline ml-2 rounded bg-surface-2 px-1 text-text-lo">
                          Local
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="block text-text-hi">{r.customerName}</span>
                      <span className="t-body-sm block text-text-lo">
                        {r.branchCode} · owner {r.ownerName}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {r.assetSerials.slice(0, 2).map((s) => (
                          <Link key={s} href={`/service/assets/${encodeURIComponent(s)}`} className="inline-flex min-h-6 items-center hover:underline">
                            <Serial value={s} />
                          </Link>
                        ))}
                        {r.assetSerials.length > 2 ? (
                          <span className="t-body-sm text-text-lo">
                            +{r.assetSerials.length - 2} more
                          </span>
                        ) : null}
                      </span>
                    </Td>
                    <Td nowrap>
                      {r.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"}
                      <span className="t-body-sm block text-text-lo">
                        {r.responseHours}h response · {r.restorationHours}h restore
                      </span>
                    </Td>
                    <Td nowrap>
                      <span className="block text-text-mid">
                        {formatDate(r.startDate)} → {formatDate(r.endDate)}
                      </span>
                      <span className="t-body-sm block text-text-lo">
                        {r.daysRemaining >= 0
                          ? `${r.daysRemaining} days remaining`
                          : `ended ${Math.abs(r.daysRemaining)} days ago`}
                      </span>
                    </Td>
                    <Td numeric nowrap>
                      {formatINR(r.contractValue)}
                    </Td>
                    <Td nowrap>
                      <span className="block tabular-nums text-text-hi">
                        {r.completedVisits} / {r.committedVisits} ({formatPercent(f.pct)})
                      </span>
                      {f.behindSchedule ? (
                        <span className="t-body-sm flex items-center gap-1 text-warn">
                          <TriangleAlert className="size-3" aria-hidden />
                          Behind by {f.behindBy}
                        </span>
                      ) : (
                        <span className="t-body-sm text-text-lo">On schedule</span>
                      )}
                    </Td>
                    <Td nowrap>
                      <AmcStatusBadge status={r.status} />
                    </Td>
                    <Td className="text-right" nowrap>
                      <Link
                        href={`/service/amc/${r.id}`}
                        className="t-body-sm inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
                      >
                        Detail
                        <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </TableFrame>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
          <p className="t-body-sm text-text-lo">
            {formatCount(filtered.length)} of {formatCount(rows.length)} contracts
          </p>
          <Link
            href="/service/renewals"
            className="t-body-sm inline-flex items-center gap-1.5 text-text-mid hover:text-text-hi"
          >
            Open the renewal radar
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </Panel>

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        wide
        title="New AMC contract"
        description="Activation generates the committed preventive visits across the period at even intervals."
        footer={
          <>
            {attempted && hasErrors ? (
              <p className="t-body-sm mr-auto text-danger">
                <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />
                Correct the highlighted fields before saving.
              </p>
            ) : null}
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button tone="primary" onClick={commit}>
              Create and activate
            </Button>
          </>
        }
      >
        <AmcForm
          draft={draft}
          setDraft={setDraft}
          errors={attempted ? errors : {}}
          customers={customers}
          assets={assets}
          owners={owners}
        />
      </Modal>
    </div>
  );
}
