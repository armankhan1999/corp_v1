"use client";

import * as React from "react";
import {
  CircleCheck, Eye, Mail, MessageSquare, PhoneCall, Plus, Send, Smartphone, TriangleAlert, MapPin,
} from "lucide-react";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { EmptyState, Overline, SimulatedBadge, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { actions, UPI_FLOW, useCommercialOverlay, type UpiLink, type UpiState } from "./store";
import {
  FOLLOWUP_MODE_LABEL, PAYMENT_MODE_LABEL,
  type Actor, type FollowUpMode, type FollowUpRow, type InvoiceRow, type ReceiptRow,
} from "./types";
import {
  Button, Field, InfoNotice, Modal, Money, NumberInput, SectionPanel, Select, TextArea, TextInput,
} from "./ui";

const MODE_ICON: Record<FollowUpMode, React.ComponentType<{ className?: string }>> = {
  CALL: PhoneCall, VISIT: MapPin, EMAIL: Mail, WHATSAPP: MessageSquare,
};

/* ============================================== E8-S6 collection follow-up */

export function FollowUpLog({
  invoice, followUps, actor, todayIso, outstanding,
}: {
  invoice: InvoiceRow; followUps: FollowUpRow[]; actor: Actor; todayIso: string; outstanding: number;
}) {
  const [open, setOpen] = React.useState(false);
  const now = new Date(todayIso);

  const ordered = [...followUps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const broken = ordered.filter(
    (f) => !f.fulfilled && f.promisedDate && new Date(f.promisedDate) < now && outstanding > 0,
  );

  return (
    <SectionPanel
      title="Collection follow-up"
      sub="Every contact against this invoice, most recent first."
      right={
        <Button onClick={() => setOpen(true)} disabled={!actor.canWrite}>
          <Plus className="size-3.5" aria-hidden />
          Log a follow-up
        </Button>
      }
    >
      {broken.length ? (
        <div className="border-b border-line px-4 py-3">
          {broken.map((f) => {
            const elapsed = Math.floor((now.getTime() - new Date(f.promisedDate!).getTime()) / 86_400_000);
            return (
              <InfoNotice
                key={f.id}
                tone="warn"
                icon={TriangleAlert}
                headline="Payment promise broken"
                detail={`${f.personSpokenTo} promised ${formatINR(f.promisedAmount ?? outstanding)} by ${formatDate(f.promisedDate!)}. ${elapsed} ${elapsed === 1 ? "day" : "days"} have passed and no receipt has been allocated against this invoice. The invoice sits in the exception feed until a receipt clears it.`}
                facts={[
                  { label: "Promised amount", value: <Money value={f.promisedAmount ?? outstanding} /> },
                  { label: "Promised by", value: formatDate(f.promisedDate!) },
                  { label: "Days elapsed", value: `${elapsed}` },
                  { label: "Still outstanding", value: <Money value={outstanding} tone="danger" /> },
                ]}
              />
            );
          })}
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="No follow-up recorded"
          body="Nothing has been logged against this invoice. Record the call, visit, email or message so the next person picking it up knows exactly where the conversation stopped."
          action={<Button onClick={() => setOpen(true)} disabled={!actor.canWrite}><Plus className="size-3.5" aria-hidden />Log a follow-up</Button>}
        />
      ) : (
        <ol className="divide-y divide-line">
          {ordered.map((f) => {
            const Icon = MODE_ICON[f.mode];
            const overdue = !f.fulfilled && f.promisedDate && new Date(f.promisedDate) < now && outstanding > 0;
            return (
              <li key={f.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
                  <Icon className="size-3.5 text-text-mid" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="t-body-sm font-medium text-text-hi">{FOLLOWUP_MODE_LABEL[f.mode]}</span>
                    <span className="t-body-sm text-text-lo">{formatDate(f.date)}</span>
                    {f.fulfilled ? <StatusBadge tone="ok">Promise honoured</StatusBadge> : null}
                    {overdue ? <StatusBadge tone="warn">Promise broken</StatusBadge> : null}
                    {f.simulated ? <SimulatedBadge what="follow-up recorded in this session" /> : null}
                  </div>
                  <p className="t-body-sm mt-0.5 text-text-mid">
                    Spoke to <span className="text-text-hi">{f.personSpokenTo}</span>. {f.outcome}
                  </p>
                  {f.promisedDate ? (
                    <p className="t-body-sm text-text-lo">
                      Promised {f.promisedAmount ? formatINR(f.promisedAmount) : "payment"} by{" "}
                      <span className="text-text-mid">{formatDate(f.promisedDate)}</span>
                    </p>
                  ) : null}
                  <p className="t-body-sm text-text-lo">Recorded by {f.byName}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <FollowUpModal
        open={open} onClose={() => setOpen(false)}
        invoice={invoice} actor={actor} todayIso={todayIso} outstanding={outstanding}
      />
    </SectionPanel>
  );
}

function FollowUpModal({
  open, onClose, invoice, actor, todayIso, outstanding,
}: { open: boolean; onClose: () => void; invoice: InvoiceRow; actor: Actor; todayIso: string; outstanding: number }) {
  const overlay = useCommercialOverlay();
  const [mode, setMode] = React.useState<FollowUpMode>("CALL");
  const [date, setDate] = React.useState(todayIso.slice(0, 10));
  const [person, setPerson] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [promisedDate, setPromisedDate] = React.useState("");
  const [promisedAmount, setPromisedAmount] = React.useState(outstanding);
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    if (!person.trim()) { setError("Name the person spoken to. A follow-up without a name cannot be chased."); return; }
    if (!outcome.trim()) { setError("Record what was said. The next person picking this up depends on it."); return; }
    if (promisedDate && promisedAmount <= 0) { setError("A promised date needs a promised amount against it."); return; }
    const row: FollowUpRow = {
      id: `CFU-N${String(overlay.followUps.length + 1).padStart(3, "0")}`,
      invoiceId: invoice.id,
      date: new Date(`${date}T10:00:00`).toISOString(),
      mode, personSpokenTo: person.trim(), outcome: outcome.trim(),
      promisedDate: promisedDate ? new Date(`${promisedDate}T10:00:00`).toISOString() : null,
      promisedAmount: promisedDate ? promisedAmount : null,
      fulfilled: false, byUserId: actor.userId, byName: actor.name,
      simulated: true,
    };
    actions.addFollowUp(row, invoice.number, actor);
    setPerson(""); setOutcome(""); setPromisedDate(""); setError(null);
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Log a collection follow-up"
      sub={`Against ${invoice.number} — ${invoice.customerName}, ${formatINR(outstanding)} outstanding`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={submit} disabled={!actor.canWrite}>Record follow-up</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p className="t-body-sm rounded-md border border-danger/50 bg-danger-bg px-3 py-2 text-danger">{error}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode">
            <Select
              value={mode} onChange={(e) => setMode(e.target.value as FollowUpMode)}
              options={(Object.keys(FOLLOWUP_MODE_LABEL) as FollowUpMode[]).map((k) => ({ value: k, label: FOLLOWUP_MODE_LABEL[k] }))}
            />
          </Field>
          <Field label="Person spoken to" className="sm:col-span-2">
            <TextInput value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Name and, where useful, designation" />
          </Field>
          <Field label="Outcome" className="sm:col-span-2">
            <TextArea
              value={outcome} onChange={(e) => setOutcome(e.target.value)}
              placeholder="What was said, and what happens next."
            />
          </Field>
          <Field label="Promised payment date" hint="Leave blank if no commitment was given">
            <TextInput type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} />
          </Field>
          <Field label="Promised amount (₹)">
            <NumberInput
              value={promisedAmount || ""}
              onChange={(e) => setPromisedAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              disabled={!promisedDate}
            />
          </Field>
        </div>
        <Explainer className="text-text-lo">
          A promised date that passes without an allocated receipt raises a broken-promise exception carrying the
          promised amount and the days elapsed. Allocating a receipt against this invoice clears it.
        </Explainer>
      </div>
    </Modal>
  );
}

/* ================================================ E8-S5 UPI collection link */

const UPI_STATE_LABEL: Record<UpiState, string> = {
  GENERATED: "Generated", SENT: "Sent", VIEWED: "Viewed", PAID: "Paid",
};

const UPI_STATE_NOTE: Record<UpiState, string> = {
  GENERATED: "A collection link exists but has not been sent to the customer.",
  SENT: "Delivered to the customer's registered mobile number and email.",
  VIEWED: "The customer opened the link. No payment has been authorised yet.",
  PAID: "Payment authorised. A receipt has been created and allocated against this invoice.",
};

const UPI_STATE_ICON: Record<UpiState, React.ComponentType<{ className?: string }>> = {
  GENERATED: Smartphone, SENT: Send, VIEWED: Eye, PAID: CircleCheck,
};

export function UpiCollectionPanel({
  invoice, actor, todayIso, outstanding, seededReceiptCount, receiptSeries,
}: {
  invoice: InvoiceRow; actor: Actor; todayIso: string; outstanding: number;
  seededReceiptCount: number; receiptSeries: { prefix: string; fySegment: string; width: number; highest: number } | null;
}) {
  const overlay = useCommercialOverlay();
  const link = overlay.upiLinks[invoice.id] ?? null;

  function create() {
    const l: UpiLink = {
      invoiceId: invoice.id, invoiceNumber: invoice.number,
      linkId: `UPI-${invoice.number.replace(/\W/g, "").slice(-8)}`,
      vpa: "bhushancorp@sbi",
      amount: outstanding,
      state: "GENERATED",
      history: [{ state: "GENERATED", at: new Date().toISOString() }],
      receiptId: null,
    };
    actions.setUpiState(l, actor);
  }

  function advance() {
    if (!link) return;
    const idx = UPI_FLOW.indexOf(link.state);
    const nextState = UPI_FLOW[idx + 1];
    if (!nextState) return;
    const at = new Date().toISOString();
    if (nextState === "PAID") {
      const seq = (receiptSeries?.highest ?? seededReceiptCount) + (overlay.consumed.RECEIPT ?? 0) + 1;
      const number = receiptSeries
        ? `${receiptSeries.prefix}/${receiptSeries.fySegment}/${String(seq).padStart(receiptSeries.width, "0")}`
        : `BC/RCPT/2627/${String(seq).padStart(4, "0")}`;
      const amount = Math.min(link.amount, outstanding);
      const receipt: ReceiptRow = {
        id: `RCT-${String(seededReceiptCount + overlay.receipts.length + 1).padStart(4, "0")}`,
        number,
        customerId: invoice.customerId, customerName: invoice.customerName,
        branchId: invoice.branchId, branchCode: invoice.branchCode,
        date: todayIso, amount, mode: "UPI",
        reference: `${link.linkId} · simulated collection link`,
        simulatedUpi: true,
        byUserId: actor.userId, byName: actor.name,
        allocationsSeed: [], allocatedSeed: 0,
        simulated: true,
      };
      actions.settleUpi(
        { ...link, state: "PAID", history: [...link.history, { state: "PAID", at }] },
        receipt,
        { id: `RAL-U${String(overlay.allocations.length + 1).padStart(4, "0")}`, receiptId: receipt.id, invoiceId: invoice.id, amount, at },
        actor,
      );
      return;
    }
    actions.setUpiState({ ...link, state: nextState, history: [...link.history, { state: nextState, at }] }, actor);
  }

  const StateIcon = link ? UPI_STATE_ICON[link.state] : Smartphone;
  const nextState = link ? UPI_FLOW[UPI_FLOW.indexOf(link.state) + 1] : null;

  return (
    <SectionPanel
      title="UPI collection link"
      sub="A payment request the customer can settle from a phone."
      right={<SimulatedBadge what="UPI / payment gateway (INT-06)" />}
    >
      {!link ? (
        <div className="px-4 py-4">
          <Explainer className="text-text-mid">
            No collection link has been raised for this invoice. Generating one produces a simulated request for the
            outstanding balance of {formatINR(outstanding)}, payable to <span className="t-mono">bhushancorp@sbi</span>.
            The live gateway needs merchant onboarding, a VPA and a settlement account mapping.
          </Explainer>
          <Button
            tone="primary" className="mt-3" onClick={create}
            disabled={!actor.canWrite || outstanding <= 0}
          >
            <Smartphone className="size-3.5" aria-hidden />
            Generate collection link
          </Button>
          {outstanding <= 0 ? (
            <p className="t-body-sm mt-2 text-text-lo">
              Nothing is outstanding on this invoice, so there is nothing to collect.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StateIcon className={link.state === "PAID" ? "size-5 text-ok" : "size-5 text-sim"} aria-hidden />
              <div>
                <p className="t-body font-medium text-text-hi">{UPI_STATE_LABEL[link.state]}</p>
                <p className="t-body-sm text-text-mid">{UPI_STATE_NOTE[link.state]}</p>
              </div>
            </div>
            <div className="text-right">
              <Money value={link.amount} className="t-heading-md" />
              <p className="t-mono text-text-lo">{link.vpa}</p>
            </div>
          </div>

          <ol className="mt-3 flex flex-wrap items-center gap-1">
            {UPI_FLOW.map((s, i) => {
              const reached = UPI_FLOW.indexOf(link.state) >= i;
              return (
                <li key={s} className="flex items-center gap-1">
                  {i > 0 ? <span className="text-text-lo" aria-hidden>›</span> : null}
                  <span
                    className={
                      reached
                        ? "t-overline rounded-md border border-sim/50 bg-sim-bg px-1.5 py-0.5 text-sim"
                        : "t-overline rounded-md border border-line px-1.5 py-0.5 text-text-lo"
                    }
                  >
                    {UPI_STATE_LABEL[s]}
                  </span>
                </li>
              );
            })}
          </ol>

          <ul className="mt-3 flex flex-col gap-1">
            {link.history.map((h) => (
              <li key={`${h.state}-${h.at}`} className="t-body-sm flex justify-between text-text-lo">
                <span>{UPI_STATE_LABEL[h.state]}</span>
                <span className="t-mono">{formatDateTime(h.at)}</span>
              </li>
            ))}
          </ul>

          {nextState ? (
            <Button tone="primary" className="mt-3" onClick={advance} disabled={!actor.canWrite}>
              Advance to {UPI_STATE_LABEL[nextState]}
            </Button>
          ) : (
            <p className="t-body-sm mt-3 text-ok">
              Receipt created against this invoice and clearly marked as a simulated collection.
            </p>
          )}
          <Explainer className="mt-2 text-text-lo">
            The state progression is also driveable from Demo Controls, so the collection can be shown moving without
            leaving the invoice.
          </Explainer>
        </div>
      )}
    </SectionPanel>
  );
}

/* ------------------------------------------------------- receipts applied */

export function ReceiptsApplied({
  applied, outstanding, total,
}: {
  applied: { id: string; number: string; date: string; amount: number; mode: string; reference: string; simulated: boolean }[];
  outstanding: number; total: number;
}) {
  return (
    <SectionPanel
      title="Receipts applied"
      sub="Outstanding is invoice total, less allocated receipts, less credit notes."
    >
      {applied.length === 0 ? (
        <div className="px-4 py-4">
          <p className="t-body-sm text-text-mid">
            No receipt has been allocated against this invoice. The whole of {formatINR(total)} remains outstanding.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {applied.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="t-mono text-text-hi">{r.number}</span>
                  <span className="t-body-sm text-text-lo">{formatDate(r.date)}</span>
                  {r.simulated ? <SimulatedBadge what="receipt created in this session" /> : null}
                </div>
                <p className="t-body-sm text-text-lo">
                  {PAYMENT_MODE_LABEL[r.mode as keyof typeof PAYMENT_MODE_LABEL] ?? r.mode} · {r.reference}
                </p>
              </div>
              <Money value={r.amount} tone="ok" className="t-body font-medium" />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2">
        <Overline>Outstanding</Overline>
        <Money value={outstanding} tone={outstanding > 0 ? "danger" : "ok"} className="t-heading-md" />
      </div>
    </SectionPanel>
  );
}
