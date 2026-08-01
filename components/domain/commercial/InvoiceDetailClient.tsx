"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Ban, CircleCheck, Clock, ExternalLink, Link2, Printer, ScanLine, Scale,
} from "lucide-react";
import { COMPANY } from "@/lib/seed/catalog";
import { formatDate, formatINR, formatQty, inrInWords } from "@/lib/format";
import { Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { EwayPanel } from "./EwayPanel";
import { FollowUpLog, ReceiptsApplied, UpiCollectionPanel } from "./CollectionPanel";
import { NotesPanel } from "./NotesPanel";
import { QrCode } from "./QrCode";
import { InvoiceSheet, SheetScroller } from "./sheets";
import {
  DERIVATION_RULES, deriveTax, displayAck, displayIrn, eInvoiceWindow, qrPayload,
  splitTax, EINVOICE_STATUS_LABEL, EINVOICE_STATUS_TONE, TREATMENT_LABEL,
} from "./gst";
import { invoiceMoney } from "./merge";
import { actions, useCommercialOverlay } from "./store";
import {
  INVOICE_TYPE_LABEL, INVOICE_TYPE_SOURCE, SOURCE_KIND_LABEL,
  type Actor, type EwayRow, type FollowUpRow, type InvoiceRow, type LineRow,
  type NoteRow, type SeriesRow, type SourceOption,
} from "./types";
import {
  Button, DefinitionGrid, Money, PrintBar, SectionPanel, Segmented, Select,
} from "./ui";

export interface InvoiceDetailProps {
  invoice: InvoiceRow;
  lines: LineRow[];
  notesSeed: NoteRow[];
  followUpsSeed: FollowUpRow[];
  receiptsSeed: { id: string; number: string; date: string; amount: number; mode: string; reference: string; simulated: boolean }[];
  eway: EwayRow | null;
  sourceOptions: SourceOption[];
  noteSeries: SeriesRow | null;
  receiptSeries: { prefix: string; fySegment: string; width: number; highest: number } | null;
  seededNoteCount: number;
  seededReceiptCount: number;
  seededEwayCount: number;
  actor: Actor;
  todayIso: string;
}

export function InvoiceDetailClient(props: InvoiceDetailProps) {
  const {
    invoice: baseInvoice, lines, notesSeed, followUpsSeed, receiptsSeed, eway,
    sourceOptions, noteSeries, receiptSeries, seededNoteCount, seededReceiptCount,
    seededEwayCount, actor, todayIso,
  } = props;

  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const [tab, setTab] = React.useState<"record" | "print">("record");

  const invoice: InvoiceRow = React.useMemo(() => ({
    ...baseInvoice,
    irpReportedAt: overlay.irpReported[baseInvoice.id] ?? baseInvoice.irpReportedAt,
    source: overlay.sourceLinks[baseInvoice.id] ?? baseInvoice.source,
  }), [baseInvoice, overlay.irpReported, overlay.sourceLinks]);

  const money = invoiceMoney(invoice, overlay);
  const derivation = deriveTax(invoice.placeOfSupplyStateCode, invoice.placeOfSupplyName);
  const split = splitTax(invoice.tax, derivation.treatment);
  const win = eInvoiceWindow(invoice, overlay.settings, now);
  const irn = displayIrn(invoice);
  const ack = displayAck(invoice);
  const qr = irn && ack ? qrPayload(invoice, irn, ack) : null;

  const notes = [...notesSeed, ...overlay.notes.filter((n) => n.invoiceId === invoice.id)];
  const followUps = [
    ...followUpsSeed.map((f) => ({ ...f, fulfilled: f.fulfilled || overlay.promisesSettled.includes(invoice.id) })),
    ...overlay.followUps
      .filter((f) => f.invoiceId === invoice.id)
      .map((f) => ({ ...f, fulfilled: f.fulfilled || overlay.promisesSettled.includes(invoice.id) })),
  ];
  const receipts = [
    ...receiptsSeed,
    ...overlay.allocations
      .filter((a) => a.invoiceId === invoice.id)
      .map((a) => {
        const r = overlay.receipts.find((x) => x.id === a.receiptId);
        return {
          id: a.id, number: r?.number ?? a.receiptId, date: r?.date ?? a.at,
          amount: a.amount, mode: r?.mode ?? "ADJUSTMENT", reference: r?.reference ?? "—", simulated: true,
        };
      }),
  ];

  const overdue = money.outstanding > 0 && invoice.daysPastDue > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/commercial/invoices" className="t-body-sm inline-flex items-center gap-1 text-text-mid hover:text-text-hi">
            <ArrowLeft className="size-3.5" aria-hidden />
            All tax invoices
          </Link>
          <h1 className="t-display-md mt-1 flex flex-wrap items-center gap-2 text-text-hi">
            <span className="t-mono text-[1.5rem]">{invoice.number}</span>
            <StatusBadge tone={money.outstanding > 0 ? (overdue ? "danger" : "warn") : "ok"}>
              {money.outstanding > 0 ? (overdue ? `${invoice.daysPastDue} days past due` : "Open") : "Settled"}
            </StatusBadge>
            <StatusBadge tone={EINVOICE_STATUS_TONE[win.status]}>{EINVOICE_STATUS_LABEL[win.status]}</StatusBadge>
            {invoice.simulated ? <SimulatedBadge what="document created in this session" /> : null}
          </h1>
          <p className="t-body-sm mt-1 text-text-mid">
            {INVOICE_TYPE_LABEL[invoice.type]} · {invoice.customerName} · issued {formatDate(invoice.date)} ·
            due {formatDate(invoice.dueDate)} · {invoice.branchName} ({invoice.branchCode})
          </p>
        </div>
        <Segmented
          label="View"
          value={tab}
          onChange={setTab}
          options={[{ value: "record", label: "Record" }, { value: "print", label: "A4 print preview" }]}
        />
      </div>

      {tab === "print" ? (
        <Panel className="overflow-hidden">
          <PrintBar label="A4 tax invoice with every statutory particular in its conventional position. The IRN block and signed QR sit top-right, the HSN summary and bank particulars at the foot." />
          <SheetScroller>
            <InvoiceSheet invoice={invoice} lines={lines} irn={irn} ackNumber={ack} qr={qr} />
          </SheetScroller>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_26rem]">
          <div className="flex flex-col gap-4">
            <DerivationPanel invoice={invoice} split={split} />

            <SectionPanel
              title="Invoice lines"
              sub="HSN or SAC, quantity, rate, discount, taxable value and tax on every line."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse">
                  <thead>
                    <tr className="border-b border-line-strong bg-surface-2">
                      <th className="t-overline px-3 py-2 text-left text-text-lo">Description</th>
                      <th className="t-overline w-20 px-3 py-2 text-left text-text-lo">HSN/SAC</th>
                      <th className="t-overline w-16 px-3 py-2 text-left text-text-lo">UOM</th>
                      <th className="t-overline w-16 px-3 py-2 text-right text-text-lo">Qty</th>
                      <th className="t-overline w-28 px-3 py-2 text-right text-text-lo">Rate</th>
                      <th className="t-overline w-16 px-3 py-2 text-right text-text-lo">Disc %</th>
                      <th className="t-overline w-32 px-3 py-2 text-right text-text-lo">Taxable</th>
                      <th className="t-overline w-28 px-3 py-2 text-right text-text-lo">Tax</th>
                      <th className="t-overline w-32 px-3 py-2 text-right text-text-lo">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-line">
                        <td className="t-body-sm px-3 py-2 text-text-hi">{l.description}</td>
                        <td className="t-mono px-3 py-2 text-text-mid">{l.hsnSac}</td>
                        <td className="t-body-sm px-3 py-2 text-text-mid">{l.uom}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-mid tabular-nums">{formatQty(l.qty)}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-mid tabular-nums">{formatINR(l.rate, { paise: true })}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-mid tabular-nums">{l.discountPct.toFixed(2)}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-hi tabular-nums">{formatINR(l.taxable)}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-mid tabular-nums">
                          {l.gstRate}% · {formatINR(l.tax)}
                        </td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-hi tabular-nums">{formatINR(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-line px-4 py-3 sm:grid-cols-[1fr_20rem]">
                <div>
                  <Overline>Amount chargeable in words</Overline>
                  <p className="t-body mt-1 text-text-hi">{inrInWords(invoice.total + invoice.roundOff)}</p>
                  <div className="mt-3">
                    <Overline>Bank particulars</Overline>
                    <p className="t-body-sm mt-1 text-text-mid">
                      {COMPANY.bank.name}, {COMPANY.bank.branch} · A/c{" "}
                      <span className="t-mono">{COMPANY.bank.account}</span> · IFSC{" "}
                      <span className="t-mono">{COMPANY.bank.ifsc}</span>
                    </p>
                  </div>
                  <div className="mt-3">
                    <Overline>Authorised signatory</Overline>
                    <p className="t-body-sm mt-1 text-text-mid">For {COMPANY.legalName}</p>
                  </div>
                </div>
                <dl className="flex flex-col gap-1">
                  <Total label="Taxable value" value={invoice.taxable} />
                  {derivation.treatment === "EXPORT_ZERO_RATED" ? (
                    <Total label="Integrated tax — zero rated under LUT" value={0} />
                  ) : derivation.treatment === "INTER_STATE_IGST" ? (
                    <Total label="IGST" value={split.igst} />
                  ) : (
                    <>
                      <Total label="CGST" value={split.cgst} />
                      <Total label="SGST" value={split.sgst} />
                    </>
                  )}
                  <Total label="Rounding adjustment" value={invoice.roundOff} />
                  <div className="mt-1 flex items-baseline justify-between border-t border-line-strong pt-1.5">
                    <dt className="t-body font-medium text-text-hi">Invoice total</dt>
                    <dd><Money value={invoice.total + invoice.roundOff} className="t-heading-lg" /></dd>
                  </div>
                </dl>
              </div>
            </SectionPanel>

            <SourcePanel invoice={invoice} options={sourceOptions} actor={actor} />

            <NotesPanel
              invoice={invoice} notes={notes} actor={actor} todayIso={todayIso}
              series={noteSeries} seededNoteCount={seededNoteCount} outstanding={money.outstanding}
            />

            <FollowUpLog
              invoice={invoice} followUps={followUps} actor={actor}
              todayIso={todayIso} outstanding={money.outstanding}
            />
          </div>

          <div className="flex flex-col gap-4">
            <EInvoicePanel
              invoice={invoice} irn={irn} ack={ack} qr={qr} win={win} actor={actor} todayIso={todayIso}
            />

            <ReceiptsApplied applied={receipts} outstanding={money.outstanding} total={money.total} />

            <UpiCollectionPanel
              invoice={invoice} actor={actor} todayIso={todayIso} outstanding={money.outstanding}
              seededReceiptCount={seededReceiptCount} receiptSeries={receiptSeries}
            />

            <Panel>
              <PanelHeader title="E-way bill" sub="Where these goods move under this invoice as the base document." />
              <div className="p-4">
                <EwayPanel
                  base={{
                    type: "INVOICE", id: invoice.id, number: invoice.number, date: invoice.date,
                    customerName: invoice.customerName,
                    consignmentValue: invoice.total,
                    distanceKm: 120,
                    transporter: "Ganga Roadlines",
                    transporterGstin: "10AABCT4521K1Z9",
                    vehicleNumber: "BR01AB1234",
                    transportMode: "ROAD",
                    isExport: derivation.treatment === "EXPORT_ZERO_RATED",
                    replacementHref: "/commercial/challans",
                    replacementLabel: "Raise a fresh delivery challan",
                  }}
                  existing={eway}
                  actor={actor}
                  todayIso={todayIso}
                  seededCount={seededEwayCount}
                />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Customer" sub="Consignee and place of supply." />
              <div className="p-4">
                <p className="t-body font-medium text-text-hi">{invoice.customerName}</p>
                <p className="t-body-sm mt-0.5 text-text-mid">{invoice.siteName} — {invoice.siteAddress}</p>
                <div className="mt-3">
                  <DefinitionGrid
                    cols={2}
                    items={[
                      { label: "GSTIN", value: invoice.customerGstin ?? "Unregistered recipient", mono: true },
                      { label: "Customer type", value: invoice.customerType.replace(/_/g, " ").toLowerCase() },
                      { label: "Place of supply", value: `${invoice.placeOfSupplyName} (${invoice.placeOfSupplyStateCode})` },
                      { label: "Account executive", value: invoice.accountExecutiveName },
                    ]}
                  />
                </div>
                <Link
                  href={`/sales/customers/${invoice.customerId}`}
                  className="t-body-sm mt-3 inline-flex items-center gap-1 text-info hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open the customer record
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="t-body-sm text-text-mid">{label}</dt>
      <dd><Money value={value} tone="mid" className="t-body-sm" /></dd>
    </div>
  );
}

/* ------------------------------------------------ FR-M7-04 derivation panel */

function DerivationPanel({ invoice, split }: { invoice: InvoiceRow; split: { cgst: number; sgst: number; igst: number } }) {
  const derivation = deriveTax(invoice.placeOfSupplyStateCode, invoice.placeOfSupplyName);
  return (
    <SectionPanel
      title="How the tax treatment was derived"
      sub="Derived from the place of supply, never typed. The rule that fired is shown with the rules that did not."
      right={<StatusBadge tone="info">{TREATMENT_LABEL[derivation.treatment]}</StatusBadge>}
    >
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line bg-surface-2 px-2 py-1">
            <Overline>State of supply</Overline>
            <span className="t-body block text-text-hi">{COMPANY.stateName} ({COMPANY.stateCode})</span>
          </span>
          <Scale className="size-4 text-text-lo" aria-hidden />
          <span className="rounded-md border border-line bg-surface-2 px-2 py-1">
            <Overline>Place of supply</Overline>
            <span className="t-body block text-text-hi">
              {invoice.placeOfSupplyName} ({invoice.placeOfSupplyStateCode})
            </span>
          </span>
        </div>
        <p className="t-body mt-3 text-text-hi">{derivation.sentence}</p>
        <p className="t-body-sm mt-1 text-text-lo">{derivation.authority}</p>
      </div>

      <ol className="divide-y divide-line">
        {DERIVATION_RULES.map((r) => {
          const fired = r.branch === derivation.branch;
          return (
            <li
              key={r.branch}
              className={cn("flex gap-3 px-4 py-2.5", fired ? "bg-info-bg" : "")}
            >
              <span className="mt-0.5 shrink-0">
                {fired
                  ? <CircleCheck className="size-4 text-info" aria-hidden />
                  : <Ban className="size-4 text-text-lo" aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className={cn("t-body-sm", fired ? "text-text-hi" : "text-text-mid")}>
                  <span className="font-medium">If</span> {r.when.charAt(0).toLowerCase() + r.when.slice(1)} —{" "}
                  <span className="font-medium">then</span> {r.then.charAt(0).toLowerCase() + r.then.slice(1)}
                </p>
                <p className="t-body-sm mt-0.5 text-text-lo">
                  {fired ? "This branch applies to the present invoice." : "Does not apply here."} · {r.authority}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
        <Cell label="Taxable value" value={formatINR(invoice.taxable)} />
        <Cell label="CGST" value={formatINR(split.cgst)} muted={derivation.treatment !== "INTRA_STATE_CGST_SGST"} />
        <Cell label="SGST" value={formatINR(split.sgst)} muted={derivation.treatment !== "INTRA_STATE_CGST_SGST"} />
        <Cell label="IGST" value={formatINR(split.igst)} muted={derivation.treatment !== "INTER_STATE_IGST"} />
      </div>
    </SectionPanel>
  );
}

function Cell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-surface-1 px-3 py-2">
      <Overline>{label}</Overline>
      <p className={cn("t-body mt-0.5 tabular-nums", muted ? "text-text-lo" : "text-text-hi")}>{value}</p>
    </div>
  );
}

/* ----------------------------------------------------- INT-02 panel (E8-S3) */

function EInvoicePanel({
  invoice, irn, ack, qr, win, actor, todayIso,
}: {
  invoice: InvoiceRow; irn: string | null; ack: string | null; qr: string | null;
  win: ReturnType<typeof eInvoiceWindow>; actor: Actor; todayIso: string;
}) {
  return (
    <Panel>
      <PanelHeader
        title="E-invoice"
        sub="IRN, acknowledgement and signed QR, with the reporting window tracked."
        right={<SimulatedBadge what="GST e-invoice IRP (INT-02)" />}
      />
      {!win.applicable ? (
        <div className="p-4">
          <div className="flex items-start gap-2">
            <Ban className="mt-0.5 size-4 shrink-0 text-text-lo" aria-hidden />
            <div>
              <p className="t-body font-medium text-text-hi">E-invoicing does not apply to this invoice</p>
              <p className="t-body-sm mt-1 text-text-mid">{win.reason}.</p>
              <Explainer className="mt-1 text-text-lo">
                No Invoice Reference Number is generated and none is required. The invoice states this on its face, so
                a recipient or an inspector can see why no QR appears.
              </Explainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start gap-3">
            {qr ? (
              <div className="shrink-0 rounded-md border border-line bg-white p-1.5">
                <QrCode payload={qr} size={96} label={`Signed QR code for invoice ${invoice.number}`} />
              </div>
            ) : (
              <div className="grid size-[108px] shrink-0 place-items-center rounded-md border border-dashed border-line text-center">
                <span className="t-body-sm px-2 text-text-lo">QR appears once the IRN is generated</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Overline>IRN</Overline>
              <p className="t-mono break-all text-text-hi">{irn ?? "Not generated"}</p>
              <div className="mt-2">
                <DefinitionGrid
                  cols={2}
                  items={[
                    { label: "Acknowledgement No", value: ack ?? "—", mono: true },
                    { label: "Acknowledgement date", value: invoice.ackDate ? formatDate(invoice.ackDate) : "—" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div
            className={cn(
              "mt-3 rounded-md border px-3 py-2",
              win.status === "REPORTED_IN_WINDOW" ? "border-ok/40 bg-ok-bg"
                : win.status === "WINDOW_CLOSING" ? "border-warn/40 bg-warn-bg"
                  : win.status === "WINDOW_OPEN" ? "border-info/40 bg-info-bg"
                    : "border-danger/40 bg-danger-bg",
            )}
          >
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-text-mid" aria-hidden />
              <span className="t-body font-medium text-text-hi">{EINVOICE_STATUS_LABEL[win.status]}</span>
            </div>
            <p className="t-body-sm mt-1 text-text-mid">{win.statement}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <Overline>Reporting deadline</Overline>
                <dd className="t-body-sm text-text-hi">{win.deadline ? formatDate(win.deadline) : "—"}</dd>
              </div>
              <div>
                <Overline>Configured window</Overline>
                <dd className="t-body-sm text-text-hi">{win.windowDays} days from invoice date</dd>
              </div>
            </dl>
          </div>

          {win.status === "WINDOW_OPEN" || win.status === "WINDOW_CLOSING" || win.status === "WINDOW_MISSED" ? (
            <Button
              tone="primary" className="mt-3 w-full justify-center"
              disabled={!actor.canWrite}
              onClick={() => actions.reportToIrp(invoice.id, invoice.number, todayIso, actor)}
            >
              <ScanLine className="size-3.5" aria-hidden />
              Report to IRP now (simulated)
            </Button>
          ) : null}

          <Explainer className="mt-2 text-text-lo">
            The live Invoice Registration Portal needs GSP or API credentials through an authorised provider, a
            turnover-band confirmation and sandbox testing.{" "}
            <Link href="/admin/integrations" className="text-info hover:underline">Integration Readiness</Link> lists
            what Phase 2 requires.
          </Explainer>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------ E8-S2 bidirectional source-document link */

function SourcePanel({
  invoice, options, actor,
}: { invoice: InvoiceRow; options: SourceOption[]; actor: Actor }) {
  const expected = INVOICE_TYPE_SOURCE[invoice.type];
  const candidates = options.filter((o) => o.kind === expected.kind);
  const [choice, setChoice] = React.useState(candidates[0]?.id ?? "");

  return (
    <SectionPanel
      title="Source document"
      sub={`A ${INVOICE_TYPE_LABEL[invoice.type].toLowerCase()} bills against its ${expected.label.toLowerCase()}. The link resolves from either side.`}
      right={invoice.source?.linkedHere ? <SimulatedBadge what="link created in this session" /> : null}
    >
      <div className="px-4 py-3">
        {invoice.source ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <Overline>{SOURCE_KIND_LABEL[invoice.source.kind]}</Overline>
              <p className="t-mono mt-0.5 text-text-hi">{invoice.source.label}</p>
              <p className="t-body-sm mt-1 text-text-mid">
                Lines and values on this invoice came from that document with no re-entry. Opening it shows this invoice
                against it in return.
              </p>
            </div>
            {invoice.source.href ? (
              <Link
                href={invoice.source.href}
                className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi hover:border-line-strong"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Open {invoice.source.label}
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <Explainer className="text-text-mid">
              This invoice was raised directly rather than from a source document, so no reference is printed on it.
              Linking one now records the connection in both directions without altering the invoice itself.
            </Explainer>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <Overline>{expected.label}</Overline>
                <Select
                  className="mt-1"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  options={
                    candidates.length
                      ? candidates.slice(0, 60).map((c) => ({ value: c.id, label: `${c.label} — ${c.customerName} · ${formatINR(c.value)}` }))
                      : [{ value: "", label: `No ${expected.label.toLowerCase()} available to link` }]
                  }
                />
              </div>
              <Button
                disabled={!actor.canWrite || !choice}
                onClick={() => {
                  const c = candidates.find((x) => x.id === choice);
                  if (!c) return;
                  actions.linkSource(invoice.id, invoice.number, {
                    kind: c.kind, id: c.id, label: c.label,
                    href: hrefForSource(c.kind, c.id),
                  }, actor);
                }}
              >
                <Link2 className="size-3.5" aria-hidden />
                Link source document
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionPanel>
  );
}

export function hrefForSource(kind: SourceOption["kind"], id: string): string | null {
  switch (kind) {
    case "SALES_ORDER": return `/sales/orders/${id}`;
    case "JOB_CARD": return `/service/job-cards/${id}`;
    case "AMC_CONTRACT": return `/service/amc/${id}`;
    case "RA_BILL": return "/projects";
    case "RENTAL_AGREEMENT": return "/service/rental";
    case "CHALLAN": return `/commercial/challans/${id}`;
    default: return null;
  }
}

export { Printer };
