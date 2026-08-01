"use client";

import * as React from "react";
import { FileMinus2, FilePlus2, Lock, Plus } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";
import { EmptyState, Overline, SimulatedBadge } from "@/components/patterns/primitives";
import { splitTax } from "./gst";
import { actions, nextSeriesNumber, useCommercialOverlay } from "./store";
import type { Actor, InvoiceRow, NoteKind, NoteRow, SeriesRow } from "./types";
import {
  Button, Field, InfoNotice, Modal, Money, NumberInput, SectionPanel, Select, TextArea,
} from "./ui";

/**
 * X-16f / FR-M7-10 — credit and debit notes against an invoice.
 *
 * Orphaned in the source backlog although the outstanding formula subtracts
 * them, so it is built here where it belongs: an issued invoice is immutable,
 * and the only lawful way to move its value is a note that says so on its face.
 */

const CREDIT_REASONS = [
  "Rate difference agreed post-delivery",
  "Short supply adjustment",
  "Freight charged in error",
  "Discount honoured retrospectively",
  "Goods returned by the customer",
  "Deficiency in service acknowledged",
];

const DEBIT_REASONS = [
  "Rate revision agreed with the customer",
  "Freight and handling recovered separately",
  "Short billing corrected",
  "Additional scope executed at site",
];

export function NotesPanel({
  invoice, notes, actor, todayIso, series, seededNoteCount, outstanding,
}: {
  invoice: InvoiceRow;
  notes: NoteRow[];
  actor: Actor;
  todayIso: string;
  series: SeriesRow | null;
  seededNoteCount: number;
  outstanding: number;
}) {
  const overlay = useCommercialOverlay();
  const [open, setOpen] = React.useState(false);

  const credits = notes.filter((n) => n.kind === "CREDIT");
  const debits = notes.filter((n) => n.kind === "DEBIT");
  const creditValue = credits.reduce((s, n) => s + n.amount + n.gstAmount, 0);
  const debitValue = debits.reduce((s, n) => s + n.amount + n.gstAmount, 0);

  return (
    <SectionPanel
      title="Credit and debit notes"
      sub="An issued invoice cannot be edited. Value moves only through a note recorded against it."
      right={
        <Button onClick={() => setOpen(true)} disabled={!actor.canWrite}>
          <Plus className="size-3.5" aria-hidden />
          Pass a note
        </Button>
      }
    >
      <div className="border-b border-line px-4 py-3">
        <InfoNotice
          icon={Lock}
          headline="This invoice is immutable"
          detail={`Invoice ${invoice.number} was issued on ${formatDate(invoice.date)}. Its number, date, lines, tax treatment and totals are fixed from that moment. Any subsequent adjustment — a rate difference, a short supply, a freight correction — is recorded as a credit or debit note against it and shows in the outstanding balance, never as a silent edit.`}
          facts={[
            { label: "Invoice total", value: <Money value={invoice.total} /> },
            { label: "Credit notes", value: <Money value={creditValue} tone={creditValue ? "warn" : "lo"} /> },
            { label: "Debit notes", value: <Money value={debitValue} tone={debitValue ? "warn" : "lo"} /> },
            { label: "Outstanding now", value: <Money value={outstanding} tone={outstanding ? "danger" : "ok"} /> },
          ]}
        />
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={FileMinus2}
          title="No notes against this invoice"
          body="Nothing has adjusted the value of this invoice since it was issued. Pass a credit note to reduce what is owed, or a debit note to add to it — each one carries a reason and appears on the customer's ledger."
          action={<Button onClick={() => setOpen(true)} disabled={!actor.canWrite}><Plus className="size-3.5" aria-hidden />Pass a note</Button>}
        />
      ) : (
        <ul className="divide-y divide-line">
          {[...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((n) => {
            const Icon = n.kind === "CREDIT" ? FileMinus2 : FilePlus2;
            return (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                <Icon className={n.kind === "CREDIT" ? "mt-0.5 size-4 shrink-0 text-warn" : "mt-0.5 size-4 shrink-0 text-info"} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="t-mono text-text-hi">{n.number}</span>
                    <Overline>{n.kind === "CREDIT" ? "Credit note" : "Debit note"}</Overline>
                    <span className="t-body-sm text-text-lo">{formatDate(n.date)}</span>
                    {n.simulated ? <SimulatedBadge what="note passed in this session" /> : null}
                  </div>
                  <p className="t-body-sm mt-0.5 text-text-mid">{n.reason}</p>
                  <p className="t-body-sm text-text-lo">Passed by {n.byName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Money
                    value={n.amount + n.gstAmount}
                    tone={n.kind === "CREDIT" ? "warn" : "hi"}
                    className="t-body font-medium"
                  />
                  <p className="t-body-sm text-text-lo">
                    {formatINR(n.amount)} + {formatINR(n.gstAmount)} tax
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NoteModal
        open={open} onClose={() => setOpen(false)}
        invoice={invoice} actor={actor} todayIso={todayIso}
        series={series} seededNoteCount={seededNoteCount} outstanding={outstanding}
        overlayCount={overlay.notes.length}
      />
    </SectionPanel>
  );
}

function NoteModal({
  open, onClose, invoice, actor, todayIso, series, seededNoteCount, outstanding, overlayCount,
}: {
  open: boolean; onClose: () => void; invoice: InvoiceRow; actor: Actor; todayIso: string;
  series: SeriesRow | null; seededNoteCount: number; outstanding: number; overlayCount: number;
}) {
  const overlay = useCommercialOverlay();
  const [kind, setKind] = React.useState<NoteKind>("CREDIT");
  const [reason, setReason] = React.useState(CREDIT_REASONS[0]!);
  const [note, setNote] = React.useState("");
  const [taxable, setTaxable] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const gstRate = invoice.taxTreatment === "EXPORT_ZERO_RATED" ? 0 : 18;
  const gstAmount = Math.round(taxable * gstRate / 100);
  const gross = taxable + gstAmount;
  const split = splitTax(gstAmount, invoice.taxTreatment);
  const reasons = kind === "CREDIT" ? CREDIT_REASONS : DEBIT_REASONS;

  React.useEffect(() => { setReason(reasons[0]!); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = series
    ? nextSeriesNumber(overlay, "CREDIT_NOTE", series.prefix, series.fySegment, series.width, series.highest)
    : { seq: seededNoteCount + 1, number: `BC/CN/2627/${String(seededNoteCount + 1).padStart(3, "0")}` };

  function submit() {
    if (taxable <= 0) { setError("Enter the taxable value the note adjusts."); return; }
    if (kind === "CREDIT" && gross > outstanding + invoice.allocatedSeed) {
      setError(`A credit note cannot exceed the invoice value. ${formatINR(invoice.total)} was invoiced.`);
      return;
    }
    const row: NoteRow = {
      id: `CRN-${String(seededNoteCount + overlayCount + 1).padStart(3, "0")}`,
      number: next.number,
      kind, invoiceId: invoice.id, invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      date: todayIso,
      reason: note.trim() ? `${reason} — ${note.trim()}` : reason,
      amount: taxable, gstAmount,
      byUserId: actor.userId, byName: actor.name,
      simulated: true,
    };
    actions.addNote(row, actor);
    setTaxable(0); setNote(""); setError(null);
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={`Pass a ${kind === "CREDIT" ? "credit" : "debit"} note`}
      sub={`Against invoice ${invoice.number} — ${invoice.customerName}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={submit} disabled={!actor.canWrite}>Record {next.number}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="t-body-sm rounded-md border border-danger/50 bg-danger-bg px-3 py-2 text-danger">{error}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Note type" hint={kind === "CREDIT" ? "Reduces what the customer owes" : "Adds to what the customer owes"}>
            <Select
              value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}
              options={[{ value: "CREDIT", label: "Credit note" }, { value: "DEBIT", label: "Debit note" }]}
            />
          </Field>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)} options={reasons.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Taxable value (₹)">
            <NumberInput value={taxable || ""} onChange={(e) => setTaxable(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
          </Field>
          <Field
            label={`Tax at ${gstRate}%`}
            hint={
              invoice.taxTreatment === "EXPORT_ZERO_RATED"
                ? "Zero rated — the export treatment carries to the note"
                : invoice.taxTreatment === "INTER_STATE_IGST"
                  ? `IGST ${formatINR(split.igst)}`
                  : `CGST ${formatINR(split.cgst)} + SGST ${formatINR(split.sgst)}`
            }
          >
            <NumberInput value={gstAmount} readOnly />
          </Field>
          <Field label="Note (optional)" className="sm:col-span-2">
            <TextArea
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the customer or the auditor would need in order to follow the adjustment."
            />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="t-body-sm text-text-mid">Invoice outstanding before this note</span>
            <Money value={outstanding} className="t-body font-medium" />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="t-body-sm text-text-mid">
              {kind === "CREDIT" ? "Less credit note" : "Plus debit note"} (inclusive of tax)
            </span>
            <Money value={gross} tone={kind === "CREDIT" ? "warn" : "hi"} className="t-body font-medium" />
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-line pt-1">
            <span className="t-body-sm font-medium text-text-hi">Outstanding after</span>
            <Money
              value={Math.max(0, kind === "CREDIT" ? outstanding - gross : outstanding + gross)}
              className="t-body font-semibold"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
