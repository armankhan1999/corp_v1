"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Plus, ReceiptText, Scale } from "lucide-react";
import { abbreviateINR, addDays, formatCount, formatDate, formatINR, formatQty } from "@/lib/format";
import { ageingBucket } from "@/lib/derive";
import type { TaxTreatment } from "@/lib/schemas/enums";
import { EmptyState, Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge } from "@/components/patterns/primitives";
import {
  deriveTax, eInvoiceWindow, simulateIrn, EINVOICE_STATUS_LABEL, EINVOICE_STATUS_TONE,
  TREATMENT_LABEL, TREATMENT_SHORT,
} from "@/components/domain/commercial/gst";
import { inPeriod, mergedInvoices, moneyIndex, periodOptions } from "@/components/domain/commercial/merge";
import {
  actions, nextEntityId, nextSeriesNumber, useCommercialOverlay,
} from "@/components/domain/commercial/store";
import {
  INVOICE_TYPE_LABEL, INVOICE_TYPE_SOURCE,
  type Actor, type BranchRef, type CustomerRef, type InvoiceRow, type LineRow,
  type SeriesRow, type SourceOption, type UserRef,
} from "@/components/domain/commercial/types";
import type { InvoiceType } from "@/lib/schemas/enums";
import {
  Button, Chip, DataTable, Field, FilteredEmpty, Modal, Money, NumberInput, PageHead,
  SearchInput, Select, SettingsBar, Stat, useDebounced, type Column,
} from "@/components/domain/commercial/ui";

/**
 * E8-S2 / E8-S3 — the tax-invoice register.
 *
 * Everything on this screen is derived: the treatment from the place of supply,
 * the outstanding from receipts and notes, the reporting-window status from the
 * configured window. Nothing is stored twice, so nothing can disagree.
 */

export interface InvoicesClientProps {
  rows: InvoiceRow[];
  branches: BranchRef[];
  customers: CustomerRef[];
  executives: UserRef[];
  /** Trimmed per kind — enough to raise an invoice from any source type. */
  sources: SourceOption[];
  series: SeriesRow | null;
  seededCount: number;
  actor: Actor;
  todayIso: string;
}

const TREATMENTS: TaxTreatment[] = ["INTRA_STATE_CGST_SGST", "INTER_STATE_IGST", "EXPORT_ZERO_RATED"];

export function InvoicesClient(props: InvoicesClientProps) {
  const { rows: base, branches, customers, series, seededCount, actor, todayIso } = props;
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const settings = overlay.settings;

  const rows = React.useMemo(() => mergedInvoices(base, overlay, now), [base, overlay, now]);
  const money = React.useMemo(() => moneyIndex(rows, overlay), [rows, overlay]);
  const windows = React.useMemo(() => {
    const m = new Map<string, ReturnType<typeof eInvoiceWindow>>();
    for (const r of rows) m.set(r.id, eInvoiceWindow(r, settings, now));
    return m;
  }, [rows, settings, now]);

  const periods = React.useMemo(() => periodOptions(now), [now]);

  const [query, setQuery] = React.useState("");
  const q = useDebounced(query);
  const [type, setType] = React.useState<"ALL" | InvoiceType>("ALL");
  const [customerId, setCustomerId] = React.useState("ALL");
  const [branchId, setBranchId] = React.useState("ALL");
  const [treatment, setTreatment] = React.useState<"ALL" | TaxTreatment>("ALL");
  const [periodKey, setPeriodKey] = React.useState("ALL");
  const [open, setOpen] = React.useState(false);

  const period = periods.find((p) => p.key === periodKey) ?? null;

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (type !== "ALL" && r.type !== type) return false;
        if (customerId !== "ALL" && r.customerId !== customerId) return false;
        if (branchId !== "ALL" && r.branchId !== branchId) return false;
        if (treatment !== "ALL" && r.taxTreatment !== treatment) return false;
        if (period && !inPeriod(r.date, period)) return false;
        if (!needle) return true;
        return (
          r.number.toLowerCase().includes(needle) ||
          r.customerName.toLowerCase().includes(needle) ||
          (r.irn ?? "").toLowerCase().includes(needle) ||
          (r.customerGstin ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rows, q, type, customerId, branchId, treatment, period]);

  const totals = React.useMemo(() => {
    let invoiced = 0, outstanding = 0, openCount = 0, reported = 0, late = 0, notApplicable = 0, missed = 0;
    for (const r of rows) {
      invoiced += r.total;
      const o = money.get(r.id)?.outstanding ?? 0;
      outstanding += o;
      if (o > 0) openCount += 1;
      const s = windows.get(r.id)?.status;
      if (s === "REPORTED_IN_WINDOW") reported += 1;
      else if (s === "REPORTED_LATE") late += 1;
      else if (s === "NOT_APPLICABLE") notApplicable += 1;
      else if (s === "WINDOW_MISSED") missed += 1;
    }
    return { invoiced, outstanding, openCount, reported, late, notApplicable, missed };
  }, [rows, money, windows]);

  const shown = React.useMemo(() => {
    let taxable = 0, tax = 0, total = 0, outstanding = 0;
    for (const r of filtered) {
      taxable += r.taxable; tax += r.tax; total += r.total;
      outstanding += money.get(r.id)?.outstanding ?? 0;
    }
    return { taxable, tax, total, outstanding };
  }, [filtered, money]);

  const activeFilters = [
    type !== "ALL" ? `type ${INVOICE_TYPE_LABEL[type].toLowerCase()}` : null,
    customerId !== "ALL" ? `customer ${customers.find((c) => c.id === customerId)?.name ?? customerId}` : null,
    branchId !== "ALL" ? `branch ${branches.find((b) => b.id === branchId)?.name ?? branchId}` : null,
    treatment !== "ALL" ? `treatment ${TREATMENT_LABEL[treatment].toLowerCase()}` : null,
    period ? `period ${period.label}` : null,
    q.trim() ? `search “${q.trim()}”` : null,
  ].filter((x): x is string => Boolean(x));

  function clearFilters() {
    setQuery(""); setType("ALL"); setCustomerId("ALL"); setBranchId("ALL");
    setTreatment("ALL"); setPeriodKey("ALL");
  }

  const columns: Column<InvoiceRow>[] = [
    {
      key: "number", label: "Invoice No", width: "minmax(9.5rem,1.1fr)", mono: true,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate text-text-hi">{r.number}</span>
          {r.simulated ? <SimulatedBadge what="invoice issued in this session" /> : null}
        </span>
      ),
    },
    { key: "date", label: "Date", width: "6.5rem", render: (r) => formatDate(r.date) },
    {
      key: "customer", label: "Customer", width: "minmax(11rem,1.7fr)",
      render: (r) => <span className="truncate text-text-hi">{r.customerName}</span>,
    },
    {
      key: "type", label: "Type", width: "8.5rem", hideBelow: "lg",
      render: (r) => INVOICE_TYPE_LABEL[r.type],
    },
    { key: "taxable", label: "Taxable", width: "7.5rem", align: "right", render: (r) => <Money value={r.taxable} abbreviate /> },
    {
      key: "gst", label: "GST", width: "7.5rem", align: "right", hideBelow: "xl",
      render: (r) => (
        <span className="flex items-center justify-end gap-1.5">
          <Money value={r.tax} abbreviate tone={r.tax === 0 ? "lo" : "mid"} />
          <span className="t-overline text-text-lo">{TREATMENT_SHORT[r.taxTreatment]}</span>
        </span>
      ),
    },
    { key: "total", label: "Total", width: "8rem", align: "right", render: (r) => <Money value={r.total + r.roundOff} abbreviate /> },
    {
      key: "outstanding", label: "Outstanding", width: "8rem", align: "right",
      render: (r) => {
        const o = money.get(r.id)?.outstanding ?? 0;
        return <Money value={o} abbreviate tone={o === 0 ? "lo" : r.daysPastDue > 0 ? "danger" : "warn"} />;
      },
    },
    {
      key: "irn", label: "IRN state", width: "9rem",
      render: (r) => {
        const w = windows.get(r.id);
        if (!w) return null;
        return <Chip tone={EINVOICE_STATUS_TONE[w.status]}>{EINVOICE_STATUS_LABEL[w.status]}</Chip>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Tax invoices"
        lede="Tax treatment is derived from the place of supply rather than typed, an IRN and signed QR are generated on issue, and the reporting window is tracked from the date on the document. An issued invoice is immutable — value moves only through a credit or debit note."
        right={
          <Button onClick={() => setOpen(true)} tone="primary" disabled={!actor.canWrite}>
            <Plus className="size-3.5" aria-hidden />
            Raise invoice
          </Button>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li>
          <Stat
            label="Invoices on record" value={formatCount(rows.length)}
            sub={`${abbreviateINR(totals.invoiced)} invoiced across the seeded history`}
          />
        </li>
        <li>
          <Stat
            label="Outstanding" value={abbreviateINR(totals.outstanding)} tone="danger" count={totals.openCount}
            sub={<Link href="/commercial/receivables" className="text-info hover:underline">Aged in Receivables</Link>}
          />
        </li>
        <li>
          <Stat
            label="Reported to the IRP" value={formatCount(totals.reported)} tone="ok"
            sub={
              totals.late || totals.missed
                ? `${formatCount(totals.late)} reported late · ${formatCount(totals.missed)} window missed`
                : `Every reportable invoice inside the ${settings.eInvoiceWindowDays}-day window`
            }
          />
        </li>
        <li>
          <Stat
            label="Outside e-invoicing scope" value={formatCount(totals.notApplicable)}
            sub="Zero-rated exports under LUT — no IRN is generated and none is required"
          />
        </li>
      </ul>

      <SettingsBar note="The reporting window belongs in Masters. Changing it here reclassifies every invoice on this screen immediately — nothing is reissued and no status is stored against the individual documents.">
        <Field label="E-invoice reporting window (days)" className="w-56">
          <NumberInput
            value={settings.eInvoiceWindowDays}
            onChange={(e) => actions.updateSettings({ eInvoiceWindowDays: Math.max(1, Number(e.target.value) || 1) }, actor)}
            disabled={!actor.canWrite}
          />
        </Field>
        <Field label="Flag when this many days remain" className="w-56">
          <NumberInput
            value={settings.eInvoiceWarnDays}
            onChange={(e) => actions.updateSettings({ eInvoiceWarnDays: Math.max(0, Number(e.target.value) || 0) }, actor)}
            disabled={!actor.canWrite}
          />
        </Field>
        <p className="t-body-sm max-w-md text-text-lo">
          At {settings.eInvoiceWindowDays} days, {formatCount(totals.reported)} invoices were reported inside the window
          and {formatCount(totals.late)} outside it. Lower the figure and the classification moves with it.
        </p>
      </SettingsBar>

      <Panel>
        <PanelHeader
          title="All tax invoices"
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
            placeholder="Search invoice number, customer, GSTIN or IRN"
            className="min-w-56 flex-1"
          />
          <Field label="Type" className="w-40">
            <Select
              value={type} onChange={(e) => setType(e.target.value as InvoiceType | "ALL")}
              options={[
                { value: "ALL", label: "Any type" },
                ...(Object.keys(INVOICE_TYPE_LABEL) as InvoiceType[]).map((k) => ({ value: k, label: INVOICE_TYPE_LABEL[k] })),
              ]}
            />
          </Field>
          <Field label="Customer" className="w-52">
            <Select
              value={customerId} onChange={(e) => setCustomerId(e.target.value)}
              options={[{ value: "ALL", label: "All customers" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <Field label="Branch" className="w-36">
            <Select
              value={branchId} onChange={(e) => setBranchId(e.target.value)}
              options={[{ value: "ALL", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
          <Field label="Tax treatment" className="w-48">
            <Select
              value={treatment} onChange={(e) => setTreatment(e.target.value as TaxTreatment | "ALL")}
              options={[
                { value: "ALL", label: "Any treatment" },
                ...TREATMENTS.map((t) => ({ value: t, label: TREATMENT_LABEL[t] })),
              ]}
            />
          </Field>
          <Field label="Period" className="w-40">
            <Select
              value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}
              options={[{ value: "ALL", label: "All periods" }, ...periods.map((p) => ({ value: p.key, label: p.label }))]}
            />
          </Field>
        </div>

        <DataTable
          caption="Tax invoices"
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          rowHref={(r) => `/commercial/invoices/${r.id}`}
          empty={
            activeFilters.length
              ? <FilteredEmpty active={activeFilters} onClear={clearFilters} subject="invoices" />
              : (
                <EmptyState
                  icon={ReceiptText}
                  title="No tax invoices yet"
                  body="An invoice is raised against a sales order, a service billing summary, an AMC schedule, a certified RA-bill or a rental agreement, and takes its lines from that document without re-entry."
                  action={<Button tone="primary" onClick={() => setOpen(true)} disabled={!actor.canWrite}><Plus className="size-3.5" aria-hidden />Raise invoice</Button>}
                />
              )
          }
          footer={
            <>
              <span className="t-body-sm text-text-lo">
                {formatCount(filtered.length)} invoice{filtered.length === 1 ? "" : "s"} shown
              </span>
              <span className="t-body-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-text-mid">
                <span>Taxable <Money value={shown.taxable} abbreviate className="font-medium" /></span>
                <span>GST <Money value={shown.tax} abbreviate className="font-medium" /></span>
                <span>Total <Money value={shown.total} abbreviate className="font-medium" /></span>
                <span>Outstanding <Money value={shown.outstanding} abbreviate tone={shown.outstanding ? "danger" : "ok"} className="font-medium" /></span>
              </span>
            </>
          }
        />
      </Panel>

      <NewInvoiceModal
        open={open} onClose={() => setOpen(false)} props={props}
        seededHighest={series?.highest ?? 0} seededCount={seededCount}
      />
    </div>
  );
}

/* --------------------------------------------------------------- new invoice */

/**
 * E8-S2 — an invoice raised from a source document takes every line and value
 * from it with no re-entry, and the tax treatment is shown being derived before
 * the document is issued rather than reported after.
 */
function NewInvoiceModal({
  open, onClose, props, seededHighest, seededCount,
}: {
  open: boolean; onClose: () => void; props: InvoicesClientProps;
  seededHighest: number; seededCount: number;
}) {
  const { sources, customers, branches, executives, series, actor, todayIso } = props;
  const overlay = useCommercialOverlay();
  const [type, setType] = React.useState<InvoiceType>("EQUIPMENT");
  const expected = INVOICE_TYPE_SOURCE[type];
  const candidates = React.useMemo(
    () => sources.filter((s) => s.kind === expected.kind),
    [sources, expected.kind],
  );
  const [sourceId, setSourceId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { setSourceId(candidates[0]?.id ?? ""); }, [candidates]);

  const source = candidates.find((s) => s.id === sourceId) ?? null;
  const customer = source ? customers.find((c) => c.id === source.customerId) ?? null : null;
  const derivation = customer ? deriveTax(customer.stateCode, customer.stateName) : null;

  const lines: LineRow[] = React.useMemo(() => {
    if (!source) return [];
    return source.lines.map((l, i) => {
      const taxable = Math.round(l.qty * l.rate);
      const total = Math.round(l.qty * l.rate * (1 + l.gstRate / 100));
      return {
        id: `NL-${i + 1}`, itemId: null, description: l.description, hsnSac: l.hsnSac,
        uom: l.uom, qty: l.qty, rate: l.rate, discountPct: 0, gstRate: l.gstRate,
        taxable, tax: total - taxable, total,
      } satisfies LineRow;
    });
  }, [source]);

  const zeroRated = derivation?.treatment === "EXPORT_ZERO_RATED";
  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const total = zeroRated ? taxable : lines.reduce((s, l) => s + l.total, 0);
  const tax = total - taxable;

  const next = series
    ? nextSeriesNumber(overlay, "INVOICE", series.prefix, series.fySegment, series.width, seededHighest)
    : { seq: seededHighest + 1, number: `BC/INV/2627/${String(seededHighest + 1).padStart(4, "0")}` };

  function submit() {
    if (!source || !customer || !derivation) {
      setError("Select the source document this invoice bills against.");
      return;
    }
    if (!lines.length) {
      setError("The selected source document carries no billable line.");
      return;
    }
    const id = nextEntityId("INV", overlay, "INVOICE", seededCount);
    const branch = branches.find((b) => b.id === customer.branchId) ?? branches[0]!;
    const applicable = !zeroRated && Boolean(customer.gstin);
    const identity = applicable ? simulateIrn(next.number, todayIso) : null;
    const ae = executives.find((u) => u.id === customer.accountExecutiveId);
    const row: InvoiceRow = {
      id, number: next.number, type, date: todayIso,
      dueDate: addDays(todayIso, customer.creditTermDays).toISOString(),
      customerId: customer.id, customerName: customer.name, customerType: customer.type,
      customerGstin: customer.gstin, customerCountry: customer.country,
      siteId: customer.siteId, siteName: customer.siteName, siteAddress: customer.siteAddress,
      branchId: branch.id, branchCode: branch.code, branchName: branch.name,
      placeOfSupplyStateCode: customer.stateCode, placeOfSupplyName: customer.stateName,
      taxTreatment: derivation.treatment,
      taxable, tax, total, roundOff: 0,
      allocatedSeed: 0, creditedSeed: 0, debitedSeed: 0, outstandingSeed: total,
      daysOutstanding: 0, daysPastDue: 0, bucket: ageingBucket(todayIso, new Date(todayIso)),
      irn: identity?.irn ?? null,
      ackNumber: identity?.ackNumber ?? null,
      ackDate: identity?.ackDate ?? null,
      irpReportedAt: identity ? todayIso : null,
      eInvoiceApplicable: applicable,
      eInvoiceExemptReason: applicable
        ? null
        : zeroRated
          ? "Export supply — e-invoicing not applicable under LUT"
          : "Recipient is unregistered, so the supply is outside the e-invoicing scope",
      ownerUserId: actor.userId, ownerName: actor.name,
      accountExecutiveId: customer.accountExecutiveId,
      accountExecutiveName: ae?.name ?? actor.name,
      source: { kind: source.kind, id: source.id, label: source.label, href: null, linkedHere: true },
      simulated: true,
    };
    const rowLines = zeroRated
      ? lines.map((l) => ({ ...l, gstRate: 0, tax: 0, total: l.taxable }))
      : lines;
    actions.addInvoice({ row, lines: rowLines }, actor);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose} wide
      title="Raise a tax invoice"
      sub="Lines, quantities, rates and the customer come from the source document. The tax treatment is derived from the place of supply before the invoice is issued."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={submit} disabled={!actor.canWrite || !source}>
            Issue invoice {next.number}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="t-body-sm rounded-md border border-danger/50 bg-danger-bg px-3 py-2 text-danger">{error}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Invoice type" hint={`Bills against a ${expected.label.toLowerCase()}`}>
            <Select
              value={type} onChange={(e) => setType(e.target.value as InvoiceType)}
              options={(Object.keys(INVOICE_TYPE_LABEL) as InvoiceType[]).map((k) => ({ value: k, label: INVOICE_TYPE_LABEL[k] }))}
            />
          </Field>
          <Field
            label={expected.label}
            hint={source ? `${source.customerName} · ${formatDate(source.date)} · ${source.detail}` : undefined}
          >
            <Select
              value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              options={
                candidates.length
                  ? candidates.map((s) => ({ value: s.id, label: `${s.label} — ${s.customerName} · ${formatINR(s.value)}` }))
                  : [{ value: "", label: `No ${expected.label.toLowerCase()} is awaiting invoice` }]
              }
            />
          </Field>
        </div>

        {!source ? (
          <EmptyState
            icon={FileText}
            title={`No ${expected.label.toLowerCase()} is awaiting invoice`}
            body="An invoice must bill against something. Choose another invoice type, or raise the source document first so its lines and values can carry across."
          />
        ) : (
          <>
            <div className="rounded-lg border border-info/40 bg-info-bg px-3 py-2">
              <div className="flex items-center gap-2">
                <Scale className="size-4 text-info" aria-hidden />
                <Overline>Derived tax treatment</Overline>
                <StatusBadge tone="info">{derivation ? TREATMENT_LABEL[derivation.treatment] : "—"}</StatusBadge>
              </div>
              <p className="t-body-sm mt-1 text-text-mid">{derivation?.sentence}</p>
            </div>

            <div className="rounded-lg border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
                <Overline>Lines carried from {source.label} — nothing is re-entered</Overline>
                <span className="t-body-sm text-text-mid">
                  {customer?.gstin
                    ? <>Recipient GSTIN <span className="t-mono">{customer.gstin}</span></>
                    : "Unregistered recipient — no IRN will be generated"}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="t-body-sm min-w-0 flex-1 truncate text-text-hi">{l.description}</span>
                    <span className="t-mono text-text-lo">{l.hsnSac}</span>
                    <span className="t-body-sm w-20 text-right text-text-mid tabular-nums">{formatQty(l.qty, l.uom)}</span>
                    <span className="t-body-sm w-24 text-right text-text-mid tabular-nums">{formatINR(l.rate)}</span>
                    <span className="t-body-sm w-28 text-right text-text-hi tabular-nums">{formatINR(l.taxable)}</span>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
                <div className="bg-surface-1 px-3 py-2">
                  <dt><Overline>Taxable value</Overline></dt>
                  <dd className="t-body mt-0.5 text-text-hi tabular-nums">{formatINR(taxable)}</dd>
                </div>
                <div className="bg-surface-1 px-3 py-2">
                  <dt><Overline>{zeroRated ? "Tax — zero rated" : derivation?.treatment === "INTER_STATE_IGST" ? "IGST" : "CGST + SGST"}</Overline></dt>
                  <dd className="t-body mt-0.5 text-text-hi tabular-nums">{formatINR(tax)}</dd>
                </div>
                <div className="bg-surface-1 px-3 py-2">
                  <dt><Overline>Invoice total</Overline></dt>
                  <dd className="t-body mt-0.5 text-text-hi tabular-nums">{formatINR(total)}</dd>
                </div>
                <div className="bg-surface-1 px-3 py-2">
                  <dt><Overline>Payment due</Overline></dt>
                  <dd className="t-body mt-0.5 text-text-hi">
                    {customer ? formatDate(addDays(todayIso, customer.creditTermDays)) : "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="t-body-sm text-text-lo">
              Issuing consumes <span className="t-mono text-text-mid">{next.number}</span> from the invoice series,
              generates a simulated IRN and signed QR where e-invoicing applies, and writes an audit entry naming you as
              the actor. From that moment the invoice is immutable —{" "}
              <Link href="/commercial/handoff" className="text-info hover:underline">the series state is visible to Accounts</Link>.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
