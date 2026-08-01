"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, HandCoins, Plus, Smartphone, Wallet } from "lucide-react";
import { abbreviateINR, formatCount, formatDate, formatINR } from "@/lib/format";
import type { PaymentMode } from "@/lib/schemas/enums";
import { EmptyState, Overline, Panel, PanelHeader, SimulatedBadge } from "@/components/patterns/primitives";
import { UpiCollectionPanel } from "@/components/domain/commercial/CollectionPanel";
import {
  inPeriod, mergedInvoices, mergedReceipts, moneyIndex, periodOptions,
  receiptAllocated, receiptAllocations,
} from "@/components/domain/commercial/merge";
import {
  actions, nextEntityId, nextSeriesNumber, useCommercialOverlay,
  type OverlayAllocation,
} from "@/components/domain/commercial/store";
import {
  PAYMENT_MODE_LABEL,
  type Actor, type BranchRef, type InvoiceRow, type ReceiptRow, type SeriesRow,
} from "@/components/domain/commercial/types";
import {
  BlockedNotice, Button, Chip, DataTable, Field, FilteredEmpty, InfoNotice, Modal, Money,
  NumberInput, PageHead, SearchInput, SectionPanel, Segmented, Select, Stat, TextInput,
  useDebounced, type Column,
} from "@/components/domain/commercial/ui";

/**
 * E8-S5 — receipts and allocation.
 *
 * Money received is only useful once it is attached to the invoice it settles.
 * Everything here turns on that: an allocation may not exceed the receipt or
 * the invoice, whatever is left over stays visible as unallocated rather than
 * disappearing into a customer-level balance, and allocating discharges any
 * payment promise standing against the invoice.
 */

export interface ReceiptsClientProps {
  receipts: ReceiptRow[];
  invoices: InvoiceRow[];
  branches: BranchRef[];
  series: SeriesRow | null;
  seededReceiptCount: number;
  actor: Actor;
  todayIso: string;
}

type StateFilter = "ALL" | "FULL" | "PART" | "NONE";

const STATE_LABEL: Record<Exclude<StateFilter, "ALL">, string> = {
  FULL: "Fully allocated", PART: "Part allocated", NONE: "Unallocated",
};

function allocationState(allocated: number, amount: number): Exclude<StateFilter, "ALL"> {
  if (allocated <= 0) return "NONE";
  return allocated >= amount ? "FULL" : "PART";
}

export function ReceiptsClient(props: ReceiptsClientProps) {
  const { receipts: base, invoices: invoiceBase, branches, series, seededReceiptCount, actor, todayIso } = props;
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);

  const receipts = React.useMemo(() => mergedReceipts(base, overlay), [base, overlay]);
  const invoices = React.useMemo(() => mergedInvoices(invoiceBase, overlay, now), [invoiceBase, overlay, now]);
  const money = React.useMemo(() => moneyIndex(invoices, overlay), [invoices, overlay]);
  const invoiceNumbers = React.useMemo(
    () => new Map(invoices.map((i) => [i.id, i.number])),
    [invoices],
  );
  const periods = React.useMemo(() => periodOptions(now), [now]);

  const rows = React.useMemo(
    () => receipts.map((r) => {
      const allocated = receiptAllocated(r, overlay);
      return { receipt: r, allocated, unallocated: Math.max(0, r.amount - allocated), state: allocationState(allocated, r.amount) };
    }),
    [receipts, overlay],
  );

  const [query, setQuery] = React.useState("");
  const q = useDebounced(query);
  const [mode, setMode] = React.useState<"ALL" | PaymentMode>("ALL");
  const [branchId, setBranchId] = React.useState("ALL");
  const [state, setState] = React.useState<StateFilter>("ALL");
  const [periodKey, setPeriodKey] = React.useState("ALL");
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const period = periods.find((p) => p.key === periodKey) ?? null;

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (mode !== "ALL" && r.receipt.mode !== mode) return false;
        if (branchId !== "ALL" && r.receipt.branchId !== branchId) return false;
        if (state !== "ALL" && r.state !== state) return false;
        if (period && !inPeriod(r.receipt.date, period)) return false;
        if (!needle) return true;
        return (
          r.receipt.number.toLowerCase().includes(needle) ||
          r.receipt.customerName.toLowerCase().includes(needle) ||
          r.receipt.reference.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => new Date(b.receipt.date).getTime() - new Date(a.receipt.date).getTime());
  }, [rows, q, mode, branchId, state, period]);

  const totals = React.useMemo(() => {
    let received = 0, allocated = 0, unallocated = 0, upi = 0, part = 0, none = 0;
    for (const r of rows) {
      received += r.receipt.amount;
      allocated += Math.min(r.allocated, r.receipt.amount);
      unallocated += r.unallocated;
      if (r.receipt.simulatedUpi) upi += r.receipt.amount;
      if (r.state === "PART") part += 1;
      if (r.state === "NONE") none += 1;
    }
    return { received, allocated, unallocated, upi, part, none };
  }, [rows]);

  const shownValue = filtered.reduce((s, r) => s + r.receipt.amount, 0);
  const shownUnallocated = filtered.reduce((s, r) => s + r.unallocated, 0);

  const activeFilters = [
    mode !== "ALL" ? `mode ${PAYMENT_MODE_LABEL[mode].toLowerCase()}` : null,
    branchId !== "ALL" ? `branch ${branches.find((b) => b.id === branchId)?.name ?? branchId}` : null,
    state !== "ALL" ? `${STATE_LABEL[state].toLowerCase()} receipts` : null,
    period ? `period ${period.label}` : null,
    q.trim() ? `search “${q.trim()}”` : null,
  ].filter((x): x is string => Boolean(x));

  function clearFilters() {
    setQuery(""); setMode("ALL"); setBranchId("ALL"); setState("ALL"); setPeriodKey("ALL");
  }

  const active = rows.find((r) => r.receipt.id === activeId) ?? null;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "number", label: "Receipt No", width: "minmax(9rem,1fr)", mono: true,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate text-text-hi">{r.receipt.number}</span>
          {r.receipt.simulatedUpi || r.receipt.simulated
            ? <SimulatedBadge what="receipt created in this session" />
            : null}
        </span>
      ),
    },
    { key: "date", label: "Date", width: "6.5rem", render: (r) => formatDate(r.receipt.date) },
    {
      key: "customer", label: "Customer", width: "minmax(11rem,1.7fr)",
      render: (r) => <span className="truncate text-text-hi">{r.receipt.customerName}</span>,
    },
    { key: "mode", label: "Mode", width: "6rem", render: (r) => PAYMENT_MODE_LABEL[r.receipt.mode] },
    {
      key: "reference", label: "Reference", width: "minmax(8rem,1fr)", mono: true, hideBelow: "xl",
      render: (r) => <span className="truncate text-text-lo">{r.receipt.reference}</span>,
    },
    { key: "amount", label: "Received", width: "8rem", align: "right", render: (r) => <Money value={r.receipt.amount} abbreviate /> },
    {
      key: "allocated", label: "Allocated", width: "8rem", align: "right", hideBelow: "lg",
      render: (r) => <Money value={Math.min(r.allocated, r.receipt.amount)} abbreviate tone="mid" />,
    },
    {
      key: "unallocated", label: "Unallocated", width: "8rem", align: "right",
      render: (r) => <Money value={r.unallocated} abbreviate tone={r.unallocated > 0 ? "warn" : "lo"} />,
    },
    {
      key: "state", label: "Allocation", width: "8.5rem",
      render: (r) => (
        <Chip tone={r.state === "FULL" ? "ok" : r.state === "PART" ? "warn" : "danger"}>
          {STATE_LABEL[r.state]}
        </Chip>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Receipts"
        lede="Money received, attached to the invoices it settles. An allocation may not exceed the receipt or the invoice it is applied to, and anything left over stays on the screen as an unallocated balance rather than resting quietly in a customer-level total."
        right={
          <Button tone="primary" onClick={() => setRecordOpen(true)} disabled={!actor.canWrite}>
            <Plus className="size-3.5" aria-hidden />
            Record receipt
          </Button>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li>
          <Stat
            label="Receipts on record" value={formatCount(rows.length)}
            sub={`${abbreviateINR(totals.received)} received across the seeded history`}
          />
        </li>
        <li>
          <Stat
            label="Allocated to invoices" value={abbreviateINR(totals.allocated)} tone="ok"
            sub="Applied against a specific invoice, not a customer balance"
          />
        </li>
        <li>
          <Stat
            label="Unallocated balance" value={abbreviateINR(totals.unallocated)}
            tone={totals.unallocated > 0 ? "warn" : "default"}
            sub={
              totals.unallocated > 0
                ? `${formatCount(totals.part + totals.none)} receipt${totals.part + totals.none === 1 ? "" : "s"} carrying money not yet applied`
                : "Every rupee received is attached to an invoice"
            }
          />
        </li>
        <li>
          <Stat
            label="Collected by UPI link" value={abbreviateINR(totals.upi)} tone="info"
            sub="Simulated collection links settled in this session"
          />
        </li>
      </ul>

      <Panel>
        <PanelHeader
          title="All receipts"
          sub={`${formatCount(filtered.length)} of ${formatCount(rows.length)} shown · rows beyond the first hundred are virtualised`}
          right={
            series ? (
              <span className="t-body-sm text-text-lo">
                Next in series <span className="t-mono text-text-mid">{series.nextNumber}</span>
              </span>
            ) : null
          }
        />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          <SearchInput
            value={query} onValueChange={setQuery}
            placeholder="Search receipt number, customer or bank reference"
            className="min-w-56 flex-1"
          />
          <Field label="Payment mode" className="w-40">
            <Select
              value={mode} onChange={(e) => setMode(e.target.value as PaymentMode | "ALL")}
              options={[
                { value: "ALL", label: "Any mode" },
                ...(Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] })),
              ]}
            />
          </Field>
          <Field label="Branch" className="w-36">
            <Select
              value={branchId} onChange={(e) => setBranchId(e.target.value)}
              options={[{ value: "ALL", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
          <Field label="Period" className="w-40">
            <Select
              value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}
              options={[{ value: "ALL", label: "All periods" }, ...periods.map((p) => ({ value: p.key, label: p.label }))]}
            />
          </Field>
          <Segmented
            label="Allocation state"
            value={state}
            onChange={setState}
            options={[
              { value: "ALL", label: "All", count: rows.length },
              { value: "FULL", label: "Fully allocated", count: rows.length - totals.part - totals.none },
              { value: "PART", label: "Part", count: totals.part },
              { value: "NONE", label: "Unallocated", count: totals.none },
            ]}
          />
        </div>

        <DataTable
          caption="Receipts and their allocation state"
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.receipt.id}
          onRowClick={(r) => setActiveId(r.receipt.id)}
          empty={
            activeFilters.length
              ? <FilteredEmpty active={activeFilters} onClear={clearFilters} subject="receipts" />
              : (
                <EmptyState
                  icon={Coins}
                  title="No receipt has been recorded"
                  body="A receipt captures the amount, date, mode, bank reference and customer, and is then applied against one or more invoices. Record the first one to begin."
                  action={<Button tone="primary" onClick={() => setRecordOpen(true)} disabled={!actor.canWrite}><Plus className="size-3.5" aria-hidden />Record receipt</Button>}
                />
              )
          }
          footer={
            <>
              <span className="t-body-sm text-text-lo">
                {formatCount(filtered.length)} receipt{filtered.length === 1 ? "" : "s"} shown · open one to see or change its allocation
              </span>
              <span className="t-body-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-text-mid">
                <span>Received <Money value={shownValue} abbreviate className="font-medium" /></span>
                <span>
                  Unallocated{" "}
                  <Money value={shownUnallocated} abbreviate tone={shownUnallocated > 0 ? "warn" : "ok"} className="font-medium" />
                </span>
              </span>
            </>
          }
        />
      </Panel>

      <UpiSection
        invoices={invoices}
        money={money}
        actor={actor}
        todayIso={todayIso}
        seededReceiptCount={seededReceiptCount}
        series={series}
      />

      <RecordReceiptModal
        open={recordOpen} onClose={() => setRecordOpen(false)}
        invoices={invoices} money={money} branches={branches} series={series}
        seededReceiptCount={seededReceiptCount} actor={actor} todayIso={todayIso}
      />

      <AllocateModal
        entry={active} onClose={() => setActiveId(null)}
        invoices={invoices} money={money} invoiceNumbers={invoiceNumbers}
        actor={actor} todayIso={todayIso}
      />
    </div>
  );
}

/* ------------------------------------------------------------ UPI section */

/**
 * E8-S5, last criterion — a simulated collection link whose mock state can be
 * advanced. Reaching Paid creates a receipt against the invoice, marked as
 * simulated, and allocates it.
 */
function UpiSection({
  invoices, money, actor, todayIso, seededReceiptCount, series,
}: {
  invoices: InvoiceRow[];
  money: Map<string, { outstanding: number }>;
  actor: Actor; todayIso: string; seededReceiptCount: number; series: SeriesRow | null;
}) {
  const openInvoices = React.useMemo(
    () => invoices
      .filter((i) => (money.get(i.id)?.outstanding ?? 0) > 0)
      .sort((a, b) => (money.get(b.id)?.outstanding ?? 0) - (money.get(a.id)?.outstanding ?? 0))
      .slice(0, 60),
    [invoices, money],
  );
  const [invoiceId, setInvoiceId] = React.useState("");
  React.useEffect(() => {
    if (!openInvoices.some((i) => i.id === invoiceId)) setInvoiceId(openInvoices[0]?.id ?? "");
  }, [openInvoices, invoiceId]);

  const invoice = openInvoices.find((i) => i.id === invoiceId) ?? null;
  const outstanding = invoice ? money.get(invoice.id)?.outstanding ?? 0 : 0;

  return (
    <SectionPanel
      title="Collect by UPI"
      sub="A payment request the customer settles from a phone. The mock states run Generated → Sent → Viewed → Paid, and Paid writes a receipt."
      right={<SimulatedBadge what="UPI / payment gateway (INT-06)" />}
    >
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
        <Field
          label="Invoice to collect against"
          className="min-w-72 flex-1"
          hint={invoice ? `${invoice.customerName} · ${formatDate(invoice.date)} · ${invoice.daysOutstanding} days outstanding` : undefined}
        >
          <Select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            options={
              openInvoices.length
                ? openInvoices.map((i) => ({
                  value: i.id,
                  label: `${i.number} — ${i.customerName} · ${formatINR(money.get(i.id)?.outstanding ?? 0)} outstanding`,
                }))
                : [{ value: "", label: "Nothing is outstanding to collect" }]
            }
          />
        </Field>
        {invoice ? (
          <Link
            href={`/commercial/invoices/${invoice.id}`}
            className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi hover:border-line-strong"
          >
            Open {invoice.number}
          </Link>
        ) : null}
      </div>

      {!invoice ? (
        <EmptyState
          icon={Smartphone}
          title="Nothing is outstanding to collect"
          body="Every invoice has been settled by an allocated receipt or written down by a credit note, so there is no balance a collection link could ask for."
        />
      ) : (
        <div className="p-4">
          <UpiCollectionPanel
            invoice={invoice}
            actor={actor}
            todayIso={todayIso}
            outstanding={outstanding}
            seededReceiptCount={seededReceiptCount}
            receiptSeries={
              series
                ? { prefix: series.prefix, fySegment: series.fySegment, width: series.width, highest: series.highest }
                : null
            }
          />
        </div>
      )}
    </SectionPanel>
  );
}

/* ------------------------------------------------------- allocation editor */

interface AllocationDraft { [invoiceId: string]: number }

function AllocationEditor({
  candidates, money, amount, draft, onChange, disabled,
}: {
  candidates: InvoiceRow[];
  money: Map<string, { outstanding: number }>;
  amount: number;
  draft: AllocationDraft;
  onChange: (next: AllocationDraft) => void;
  disabled?: boolean;
}) {
  const allocated = Object.values(draft).reduce((s, v) => s + v, 0);
  const unallocated = Math.max(0, amount - allocated);

  function applyOldestFirst() {
    let left = amount;
    const next: AllocationDraft = {};
    for (const inv of [...candidates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
      if (left <= 0) break;
      const outstanding = money.get(inv.id)?.outstanding ?? 0;
      if (outstanding <= 0) continue;
      const take = Math.min(left, outstanding);
      next[inv.id] = take;
      left -= take;
    }
    onChange(next);
  }

  if (!candidates.length) {
    return (
      <InfoNotice
        tone="warn"
        headline="This customer has no open invoice"
        detail="There is nothing to apply the money against. The receipt can still be recorded — the whole amount stays visible as an unallocated balance until an invoice is raised."
      />
    );
  }

  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
        <Overline>Open invoices for this customer</Overline>
        <Button onClick={applyOldestFirst} disabled={disabled}>Apply oldest first</Button>
      </div>
      <ul className="divide-y divide-line">
        {candidates.map((inv) => {
          const outstanding = money.get(inv.id)?.outstanding ?? 0;
          const value = draft[inv.id] ?? 0;
          const over = value > outstanding;
          return (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-40 flex-1">
                <span className="t-mono text-text-hi">{inv.number}</span>
                <p className="t-body-sm text-text-lo">
                  {formatDate(inv.date)} · {inv.daysOutstanding} days · outstanding {formatINR(outstanding)}
                </p>
              </div>
              <div className="w-40">
                <NumberInput
                  aria-label={`Amount to allocate against invoice ${inv.number}`}
                  value={value || ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                    const next = { ...draft };
                    if (v === 0) delete next[inv.id]; else next[inv.id] = v;
                    onChange(next);
                  }}
                />
                {over ? (
                  <p className="t-body-sm mt-0.5 text-danger">
                    Exceeds the {formatINR(outstanding)} still owed on this invoice
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-3 py-2">
        <span className="t-body-sm text-text-mid">
          Allocated <Money value={allocated} className="font-medium" /> of <Money value={amount} className="font-medium" />
        </span>
        <span className="t-body-sm text-text-mid">
          Unallocated balance{" "}
          <Money value={unallocated} tone={unallocated > 0 ? "warn" : "ok"} className="font-medium" />
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- record a receipt */

function RecordReceiptModal({
  open, onClose, invoices, money, branches, series, seededReceiptCount, actor, todayIso,
}: {
  open: boolean; onClose: () => void;
  invoices: InvoiceRow[];
  money: Map<string, { outstanding: number }>;
  branches: BranchRef[];
  series: SeriesRow | null;
  seededReceiptCount: number;
  actor: Actor; todayIso: string;
}) {
  const overlay = useCommercialOverlay();

  const customers = React.useMemo(() => {
    const m = new Map<string, { id: string; name: string; branchId: string; outstanding: number }>();
    for (const inv of invoices) {
      const outstanding = money.get(inv.id)?.outstanding ?? 0;
      if (outstanding <= 0) continue;
      const cur = m.get(inv.customerId);
      if (cur) cur.outstanding += outstanding;
      else m.set(inv.customerId, { id: inv.customerId, name: inv.customerName, branchId: inv.branchId, outstanding });
    }
    return [...m.values()].sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices, money]);

  const [customerId, setCustomerId] = React.useState("");
  const [amount, setAmount] = React.useState(0);
  const [date, setDate] = React.useState(todayIso.slice(0, 10));
  const [mode, setMode] = React.useState<PaymentMode>("NEFT");
  const [reference, setReference] = React.useState("");
  const [draft, setDraft] = React.useState<AllocationDraft>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const first = customers[0];
    setCustomerId((cur) => (cur && customers.some((c) => c.id === cur) ? cur : first?.id ?? ""));
  }, [open, customers]);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const candidates = React.useMemo(
    () => invoices
      .filter((i) => i.customerId === customerId && (money.get(i.id)?.outstanding ?? 0) > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [invoices, customerId, money],
  );

  React.useEffect(() => { setDraft({}); }, [customerId]);

  const allocated = Object.values(draft).reduce((s, v) => s + v, 0);
  const next = series
    ? nextSeriesNumber(overlay, "RECEIPT", series.prefix, series.fySegment, series.width, series.highest)
    : { seq: seededReceiptCount + 1, number: `BC/RCPT/2627/${String(seededReceiptCount + 1).padStart(4, "0")}` };

  function submit() {
    if (!customer) { setError("Choose the customer the money came from."); return; }
    if (amount <= 0) { setError("Enter the amount received."); return; }
    if (!reference.trim()) { setError("Record the bank reference — a UTR, cheque number or transaction id."); return; }
    if (allocated > amount) {
      setError(`Allocations total ${formatINR(allocated)}, which is more than the ${formatINR(amount)} received. An allocation may never exceed the receipt.`);
      return;
    }
    for (const [invoiceId, value] of Object.entries(draft)) {
      const outstanding = money.get(invoiceId)?.outstanding ?? 0;
      if (value > outstanding) {
        const inv = invoices.find((i) => i.id === invoiceId);
        setError(`${formatINR(value)} is more than the ${formatINR(outstanding)} still owed on ${inv?.number ?? invoiceId}.`);
        return;
      }
    }
    const branch = branches.find((b) => b.id === customer.branchId) ?? branches[0]!;
    const id = nextEntityId("RCT", overlay, "RECEIPT", seededReceiptCount);
    const at = new Date(`${date}T10:00:00`).toISOString();
    const allocations: OverlayAllocation[] = Object.entries(draft)
      .filter(([, v]) => v > 0)
      .map(([invoiceId, value], i) => ({
        id: `RAL-N${String(overlay.allocations.length + i + 1).padStart(4, "0")}`,
        receiptId: id, invoiceId, amount: value, at,
      }));
    const row: ReceiptRow = {
      id, number: next.number,
      customerId: customer.id, customerName: customer.name,
      branchId: branch.id, branchCode: branch.code,
      date: at, amount, mode, reference: reference.trim(),
      simulatedUpi: false,
      byUserId: actor.userId, byName: actor.name,
      allocationsSeed: [], allocatedSeed: 0,
      simulated: true,
    };
    actions.addReceipt(row, allocations, actor);
    setAmount(0); setReference(""); setDraft({}); setError(null);
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose} wide
      title="Record a receipt"
      sub="Amount, date, mode, reference and customer are captured, then applied — in whole or in part — against the invoices the money settles."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={submit} disabled={!actor.canWrite}>
            Record {next.number}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="t-body-sm rounded-md border border-danger/50 bg-danger-bg px-3 py-2 text-danger">{error}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Customer"
            className="sm:col-span-2 lg:col-span-1"
            hint={customer ? `${formatINR(customer.outstanding)} outstanding across open invoices` : undefined}
          >
            <Select
              value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              options={
                customers.length
                  ? customers.map((c) => ({ value: c.id, label: `${c.name} — ${formatINR(c.outstanding)} owed` }))
                  : [{ value: "", label: "No customer has an open invoice" }]
              }
            />
          </Field>
          <Field label="Amount received (₹)">
            <NumberInput
              value={amount || ""}
              onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Payment mode">
            <Select
              value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}
              options={(Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))}
            />
          </Field>
          <Field label="Reference" className="sm:col-span-2" hint="UTR, cheque number or transaction id — whatever the bank statement will show">
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR2604118837" />
          </Field>
        </div>

        <AllocationEditor
          candidates={candidates} money={money} amount={amount}
          draft={draft} onChange={setDraft} disabled={!actor.canWrite}
        />

        <p className="t-body-sm text-text-lo">
          Allocating recomputes each invoice&apos;s outstanding as total less allocated receipts less credit notes, and moves
          it between ageing buckets accordingly. Where the invoice carried a payment promise, the promise is marked
          fulfilled and leaves the broken-promise list. Anything not allocated stays visible on this screen as an
          unallocated balance.
        </p>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------- allocate an existing */

function AllocateModal({
  entry, onClose, invoices, money, invoiceNumbers, actor, todayIso,
}: {
  entry: { receipt: ReceiptRow; allocated: number; unallocated: number } | null;
  onClose: () => void;
  invoices: InvoiceRow[];
  money: Map<string, { outstanding: number }>;
  invoiceNumbers: Map<string, string>;
  actor: Actor; todayIso: string;
}) {
  const overlay = useCommercialOverlay();
  const [draft, setDraft] = React.useState<AllocationDraft>({});
  const [error, setError] = React.useState<string | null>(null);

  const receiptId = entry?.receipt.id ?? null;
  React.useEffect(() => { setDraft({}); setError(null); }, [receiptId]);

  if (!entry) return null;
  const { receipt, allocated, unallocated } = entry;

  const applied = receiptAllocations(receipt, overlay, invoiceNumbers);
  const candidates = invoices
    .filter((i) => i.customerId === receipt.customerId && (money.get(i.id)?.outstanding ?? 0) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const draftTotal = Object.values(draft).reduce((s, v) => s + v, 0);

  function submit() {
    if (draftTotal <= 0) { setError("Enter the amount to apply against at least one invoice."); return; }
    if (draftTotal > unallocated) {
      setError(`${formatINR(draftTotal)} is more than the ${formatINR(unallocated)} left unallocated on this receipt.`);
      return;
    }
    const at = todayIso;
    const allocations: OverlayAllocation[] = Object.entries(draft)
      .filter(([, v]) => v > 0)
      .map(([invoiceId, value], i) => ({
        id: `RAL-N${String(overlay.allocations.length + i + 1).padStart(4, "0")}`,
        receiptId: receipt.id, invoiceId, amount: value, at,
      }));
    actions.allocate(receipt.id, receipt.number, allocations, actor);
    setDraft({}); setError(null);
    onClose();
  }

  return (
    <Modal
      open onClose={onClose} wide
      title={`Receipt ${receipt.number}`}
      sub={`${receipt.customerName} · ${formatDate(receipt.date)} · ${PAYMENT_MODE_LABEL[receipt.mode]} · ${receipt.reference}`}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {unallocated > 0 ? (
            <Button tone="primary" onClick={submit} disabled={!actor.canWrite}>
              Allocate {formatINR(draftTotal)}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="t-body-sm rounded-md border border-danger/50 bg-danger-bg px-3 py-2 text-danger">{error}</p>
        ) : null}

        <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            { label: "Received", value: formatINR(receipt.amount) },
            { label: "Allocated", value: formatINR(Math.min(allocated, receipt.amount)) },
            { label: "Unallocated", value: formatINR(unallocated) },
            { label: "Recorded by", value: receipt.byName },
          ].map((f) => (
            <div key={f.label} className="bg-surface-1 px-3 py-2">
              <dt><Overline>{f.label}</Overline></dt>
              <dd className="t-body mt-0.5 text-text-hi tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-lg border border-line">
          <div className="border-b border-line bg-surface-2 px-3 py-2">
            <Overline>Applied against</Overline>
          </div>
          {applied.length === 0 ? (
            <p className="t-body-sm px-3 py-3 text-text-mid">
              Nothing has been applied yet. The whole of {formatINR(receipt.amount)} is unallocated.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {applied.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <Link href={`/commercial/invoices/${a.invoiceId}`} className="t-mono text-text-hi hover:underline">
                    {a.invoiceNumber}
                  </Link>
                  <Money value={a.amount} tone="ok" className="t-body font-medium" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {unallocated <= 0 ? (
          <BlockedNotice
            headline="There is nothing left to allocate on this receipt"
            detail={`The whole of ${formatINR(receipt.amount)} has already been applied against ${applied.length} invoice${applied.length === 1 ? "" : "s"}. An allocation may never exceed the receipt amount, so no further application is possible.`}
            remedy="Record a fresh receipt for any further money received, or pass a credit note on the invoice if the balance is being written down rather than paid."
            facts={[
              { label: "Receipt", value: <span className="t-mono">{receipt.number}</span> },
              { label: "Received", value: formatINR(receipt.amount) },
              { label: "Allocated", value: formatINR(Math.min(allocated, receipt.amount)) },
              { label: "Unallocated", value: formatINR(0) },
            ]}
            action={
              <Link
                href={`/commercial/invoices/${applied[0]?.invoiceId ?? ""}`}
                className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi hover:border-line-strong"
              >
                <Wallet className="size-3.5" aria-hidden />
                Open the invoice it settled
              </Link>
            }
          />
        ) : (
          <AllocationEditor
            candidates={candidates} money={money} amount={unallocated}
            draft={draft} onChange={setDraft} disabled={!actor.canWrite}
          />
        )}

        <p className="t-body-sm flex items-start gap-2 text-text-lo">
          <HandCoins className="mt-0.5 size-4 shrink-0" aria-hidden />
          Allocation is recorded against this browser session and layered over the seeded ledger. The accounting package
          remains the book of record —{" "}
          <Link href="/commercial/handoff" className="text-info hover:underline">the hand-off screen says so plainly</Link>.
        </p>
      </div>
    </Modal>
  );
}
