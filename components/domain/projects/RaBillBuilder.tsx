"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, FileCheck2, Lock, Printer, Receipt, Send, Snowflake,
} from "lucide-react";
import { Panel, PanelHeader, Overline, StatusBadge, SimulatedBadge, KeyValue } from "@/components/patterns/primitives";
import {
  abbreviateINR, daysBetween, formatDate, formatDateTime, formatINR, formatPercent, formatQty, inrInWords,
} from "@/lib/format";
import type { RABillStatus } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { mergeBills, type BillRow } from "./bills";
import { billFigures, CERTIFICATION_THRESHOLD_DAYS, computeBoqLine, type BoqLineSeed } from "./compute";
import { RA_BILL_STATUS_LABEL, RA_BILL_STATUS_TONE } from "./labels";
import { certifyBill, patchBill, useProjectsOverlay } from "./store";
import {
  BlockedNotice, Btn, DenseTableShell, Field, NumberInput, ROW, TD, TDR, TextInput, TH, THR, WarnNotice,
} from "./ui";

export interface BuilderProject {
  id: string;
  code: string;
  name: string;
  clientName: string;
  workOrderRef: string;
  contractValue: number;
  mobilisationAdvance: number;
  retentionPct: number;
  dlpExpiry: string;
}

/**
 * E6-S5 — the RA-bill builder.
 *
 * Cumulative to date, the previous bill's cumulative, and the current-period
 * value as the difference between them; then mobilisation recovery, retention,
 * TDS, labour cess and other deductions down to net payable. Submission freezes
 * the cumulative quantities on the bill; certification records the certified
 * value against the claim with the variance in both rupees and percent, and
 * posts retention to the register in the same step.
 */
export function RaBillBuilder({
  project, sequence, seedBills, lines, today, actor, canWrite,
}: {
  project: BuilderProject;
  sequence: number;
  seedBills: BillRow[];
  lines: BoqLineSeed[];
  today: string;
  actor: { id: string; name: string };
  canWrite: boolean;
}) {
  const overlay = useProjectsOverlay();
  const bills = useMemo(() => mergeBills(seedBills, overlay, project.id), [seedBills, overlay, project.id]);
  const bill = bills.find((b) => b.sequence === sequence);
  const prior = bills.filter((b) => b.sequence < sequence);
  const next = bills.find((b) => b.sequence === sequence + 1);
  const previous = bills.find((b) => b.sequence === sequence - 1);

  const computed = useMemo(() => lines.map((l) => computeBoqLine(l, overlay)), [lines, overlay]);
  const liveExecutedValue = useMemo(
    () => computed.reduce((s, l) => s + l.executedValue, 0),
    [computed],
  );

  const [certifiedInput, setCertifiedInput] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [mobRecovery, setMobRecovery] = useState("");
  const [certError, setCertError] = useState<string | null>(null);

  if (!bill) {
    return (
      <Panel>
        <div className="px-4 py-10 text-center">
          <p className="t-heading-md text-text-hi">RA-bill {sequence} does not exist on this project</p>
          <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">
            {bills.length
              ? `Bills 1 to ${bills.length} have been raised. Bills are sequential — the next one that can exist is ${bills.length + 1}.`
              : "No running-account bill has been raised yet."}
          </p>
          <Link
            href={`/projects/${project.id}/ra-bills`}
            className="t-body-sm mt-3 inline-flex h-8 items-center rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to the RA-bill ledger
          </Link>
        </div>
      </Panel>
    );
  }

  const isDraft = bill.status === "DRAFT";
  const frozen = bill.frozenExecution.length > 0;

  /* A draft tracks live execution; submission is the moment it stops. */
  const effectiveCumulative = isDraft
    ? Math.max(Math.round(liveExecutedValue), bill.previousCumulative)
    : bill.cumulativeValue;
  const effectiveMobRecovery = isDraft && mobRecovery !== "" ? Number(mobRecovery) : bill.mobilisationRecovery;
  const effectiveOther = isDraft && otherDeductions !== "" ? Number(otherDeductions) : bill.otherDeductions;

  const f = billFigures({
    cumulativeValue: effectiveCumulative,
    previousCumulative: bill.previousCumulative,
    mobilisationRecovery: effectiveMobRecovery,
    retentionPct: bill.retentionPct,
    tdsPct: bill.tdsPct,
    labourCessPct: bill.labourCessPct,
    otherDeductions: effectiveOther,
    certifiedValue: bill.certifiedValue,
  });

  const recoveredBefore = prior.filter((b) => b.status !== "DRAFT").reduce((s, b) => s + b.mobilisationRecovery, 0);
  const advanceOutstanding = Math.max(0, project.mobilisationAdvance - recoveredBefore - (isDraft ? 0 : bill.mobilisationRecovery));
  const daysSinceSubmission = bill.submittedAt ? daysBetween(bill.submittedAt, new Date(today)) : null;
  const overdue = bill.status === "SUBMITTED" && daysSinceSubmission !== null && daysSinceSubmission > CERTIFICATION_THRESHOLD_DAYS;

  /* Execution recorded after submission — proof the frozen claim did not move. */
  const driftLines = frozen
    ? bill.frozenExecution
      .map((fe) => {
        const live = computed.find((l) => l.id === fe.boqLineId);
        if (!live) return null;
        const drift = Math.round((live.executedQty - fe.cumulativeQty) * 100) / 100;
        return drift !== 0 ? { line: live, frozenQty: fe.cumulativeQty, drift } : null;
      })
      .filter(Boolean) as { line: (typeof computed)[number]; frozenQty: number; drift: number }[]
    : [];

  function submit() {
    const snapshot = computed.map((l) => ({ boqLineId: l.id, cumulativeQty: l.executedQty }));
    patchBill(
      bill!.id,
      {
        status: "SUBMITTED",
        submittedAt: new Date().toISOString(),
        frozenExecution: snapshot,
        mobilisationRecovery: effectiveMobRecovery,
        otherDeductions: effectiveOther,
        otherDeductionsNote: otherNote.trim(),
      },
      actor,
      `RA-bill ${bill!.number} submitted claiming ${formatINR(f.currentPeriodValue)}; cumulative quantities frozen across ${snapshot.length} BOQ lines`,
    );
  }

  function certify() {
    const value = Number(certifiedInput);
    if (!certifiedInput.trim() || Number.isNaN(value) || value < 0) {
      setCertError("Enter the value the client has certified. Zero is permitted; blank is not.");
      return;
    }
    if (value > f.currentPeriodValue * 1.5) {
      setCertError("A certified value more than 50% above the claim needs a variation order behind it. Record the variation on the BOQ first.");
      return;
    }
    const retention = Math.round((value * bill!.retentionPct) / 100);
    certifyBill(
      bill!.id,
      { status: "CERTIFIED", certifiedValue: value, certifiedAt: new Date().toISOString() },
      {
        id: `RET-L-${bill!.id}`,
        projectId: project.id,
        raBillId: bill!.id,
        raBillNumber: bill!.number,
        amount: retention,
        withheldOn: new Date().toISOString(),
        eligibleFrom: project.dlpExpiry,
      },
      actor,
      `RA-bill ${bill!.number} certified at ${formatINR(value)} against a claim of ${formatINR(f.currentPeriodValue)}; retention ${formatINR(retention)} at ${bill!.retentionPct}% posted to the register, eligible from ${formatDate(project.dlpExpiry)}`,
    );
    setCertError(null);
  }

  function generateInvoice() {
    const ref = `BC/INV/2627/RA-${String(bill!.sequence).padStart(2, "0")}-${project.code.split("/").pop()}`;
    patchBill(
      bill!.id,
      { invoiceRef: ref },
      actor,
      `Tax invoice ${ref} generated from the certified value of ${formatINR(bill!.certifiedValue ?? 0)}`,
    );
  }

  const ladder: { label: string; value: number; kind: "add" | "sub" | "total" | "sub-total"; note?: string }[] = [
    { label: "Cumulative value of work done to date", value: effectiveCumulative, kind: "add", note: frozen ? "Frozen at submission" : "Live from executed BOQ quantities" },
    { label: `Less — cumulative value of previous bill${previous ? ` (RA ${String(previous.sequence).padStart(2, "0")})` : ""}`, value: -bill.previousCumulative, kind: "sub", note: previous ? `Certified ${previous.certifiedValue !== null ? formatINR(previous.certifiedValue) : "pending"}` : "First bill on this project" },
    { label: "Value of work done in this period", value: f.currentPeriodValue, kind: "sub-total" },
  ];

  const deductions: { label: string; value: number; basis: string }[] = [
    { label: "Mobilisation advance recovery", value: f.mobilisationRecovery, basis: `${abbreviateINR(advanceOutstanding)} of the advance remains outstanding after this bill` },
    { label: `Retention at ${formatPercent(bill.retentionPct, 0)}`, value: f.retention, basis: bill.certifiedValue === null ? "On the claimed value; recomputed on the certified value at certification" : "On the certified value, posted to the retention register" },
    { label: `TDS at ${formatPercent(bill.tdsPct, 0)}`, value: f.tds, basis: "Section 194C deduction at source by the client" },
    { label: `Labour cess at ${formatPercent(bill.labourCessPct, 0)}`, value: f.labourCess, basis: "Building and Other Construction Workers cess" },
    { label: "Other deductions", value: f.otherDeductions, basis: bill.otherDeductionsNote || (isDraft ? "Add a note where anything is deducted" : "None") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ----------------------------------------------------- bill header */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-mono text-text-hi">{bill.number}</span>
              <StatusBadge tone={RA_BILL_STATUS_TONE[bill.status as RABillStatus]}>
                {RA_BILL_STATUS_LABEL[bill.status as RABillStatus]}
              </StatusBadge>
              {frozen ? (
                <StatusBadge tone="info" icon={false}>
                  <Snowflake className="size-3" aria-hidden /> Quantities frozen
                </StatusBadge>
              ) : null}
              {overdue ? <StatusBadge tone="danger">{daysSinceSubmission} days awaiting certification</StatusBadge> : null}
              {bill.source === "OVERLAY" ? <StatusBadge tone="neutral" icon={false}>Raised in this session</StatusBadge> : null}
            </div>
            <h2 className="t-heading-lg mt-1 text-text-hi">
              Running-account bill {String(bill.sequence).padStart(2, "0")} of {bills.length}
            </h2>
            <p className="t-body-sm mt-0.5 text-text-mid">
              Period {formatDate(bill.periodFrom)} – {formatDate(bill.periodTo)} · {project.clientName} ·
              work order <span className="t-mono">{project.workOrderRef}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {previous ? (
              <Link
                href={`/projects/${project.id}/ra-bills/${previous.sequence}`}
                className="t-body-sm inline-flex h-8 items-center gap-1 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <ArrowLeft className="size-3.5" aria-hidden /> RA {String(previous.sequence).padStart(2, "0")}
              </Link>
            ) : null}
            {next ? (
              <Link
                href={`/projects/${project.id}/ra-bills/${next.sequence}`}
                className="t-body-sm inline-flex h-8 items-center gap-1 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                RA {String(next.sequence).padStart(2, "0")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
            <Link
              href={`/projects/${project.id}/ra-bills/${bill.sequence}/print`}
              className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <Printer className="size-3.5" aria-hidden /> A4 print preview
            </Link>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-4">
          {/* ------------------------------------------------- value ladder */}
          <Panel>
            <PanelHeader
              title="Value of work done"
              sub="Cumulative to date, less the previous bill's cumulative, gives the value claimed for this period."
            />
            <DenseTableShell minWidth={560}>
              <caption className="sr-only">Cumulative, previous and current-period values for this running-account bill.</caption>
              <tbody>
                {ladder.map((r) => (
                  <tr key={r.label} className={cn(ROW, r.kind === "sub-total" && "border-t-2 border-line-strong bg-surface-2")}>
                    <td className={cn(TD, "whitespace-normal", r.kind === "sub-total" && "t-label text-text-hi")}>
                      {r.label}
                      {r.note ? <span className="t-body-sm block text-text-lo">{r.note}</span> : null}
                    </td>
                    <td className={cn(TDR, "w-44", r.kind === "sub-total" && "t-heading-md font-semibold")}>
                      {formatINR(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DenseTableShell>
          </Panel>

          {/* --------------------------------------------------- deductions */}
          <Panel>
            <PanelHeader
              title="Deductions schedule"
              sub={
                bill.certifiedValue === null
                  ? "Computed on the claimed value. On certification every line recomputes on the certified value."
                  : "Computed on the certified value."
              }
            />
            <DenseTableShell minWidth={620}>
              <caption className="sr-only">Deductions applied to this bill and the resulting net payable.</caption>
              <thead>
                <tr className="border-b border-line-strong bg-surface-2">
                  <th scope="col" className={TH}>Deduction</th>
                  <th scope="col" className={THR}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className={cn(ROW, "bg-surface-2/60")}>
                  <td className={cn(TD, "t-label text-text-hi")}>
                    Gross value for deduction
                    <span className="t-body-sm block text-text-lo">
                      {bill.certifiedValue === null ? "Claimed value for this period" : "Client-certified value for this period"}
                    </span>
                  </td>
                  <td className={cn(TDR, "font-medium")}>{formatINR(f.grossForDeduction)}</td>
                </tr>
                {deductions.map((dd) => (
                  <tr key={dd.label} className={ROW}>
                    <td className={cn(TD, "whitespace-normal")}>
                      {dd.label}
                      <span className="t-body-sm block text-text-lo">{dd.basis}</span>
                    </td>
                    <td className={TDR}>{dd.value ? `− ${formatINR(dd.value)}` : formatINR(0)}</td>
                  </tr>
                ))}
                <tr className={cn(ROW, "border-t border-line-strong")}>
                  <td className={cn(TD, "t-label text-text-hi")}>Total deductions</td>
                  <td className={cn(TDR, "font-medium")}>− {formatINR(f.totalDeductions)}</td>
                </tr>
                <tr className="border-t-2 border-line-strong bg-surface-2">
                  <td className={cn(TD, "t-label py-2.5 text-text-hi")}>
                    Net payable
                    <span className="t-body-sm block font-normal text-text-lo">{inrInWords(f.netPayable)}</span>
                  </td>
                  <td className={cn(TDR, "t-heading-lg py-2.5 font-semibold")}>{formatINR(f.netPayable)}</td>
                </tr>
              </tbody>
            </DenseTableShell>

            {isDraft && canWrite ? (
              <div className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-3">
                <Field
                  label="Mobilisation recovery (₹)"
                  hint={`Advance outstanding ${formatINR(Math.max(0, project.mobilisationAdvance - recoveredBefore))}`}
                >
                  <NumberInput
                    value={mobRecovery === "" ? String(bill.mobilisationRecovery) : mobRecovery}
                    min={0}
                    max={Math.max(0, project.mobilisationAdvance - recoveredBefore)}
                    step={1000}
                    onChange={(e) => setMobRecovery(e.target.value)}
                  />
                </Field>
                <Field label="Other deductions (₹)">
                  <NumberInput
                    value={otherDeductions === "" ? String(bill.otherDeductions) : otherDeductions}
                    min={0}
                    step={100}
                    onChange={(e) => setOtherDeductions(e.target.value)}
                  />
                </Field>
                <Field label="Other deductions note" hint="Required where anything is deducted.">
                  <TextInput value={otherNote} onChange={(e) => setOtherNote(e.target.value)} placeholder="Hire charges recovered" />
                </Field>
              </div>
            ) : null}
          </Panel>

          {/* --------------------------------------------- frozen quantities */}
          <Panel>
            <PanelHeader
              title="Cumulative quantities on this bill"
              sub={
                frozen
                  ? "Frozen at submission. Execution recorded afterwards cannot retrospectively alter this claim."
                  : "Live from the BOQ. They will be frozen onto the bill the moment it is submitted."
              }
              right={frozen ? <StatusBadge tone="info"><Lock className="size-3" aria-hidden /> Frozen</StatusBadge> : null}
            />
            {frozen && driftLines.length ? (
              <div className="border-b border-line p-3">
                <WarnNotice
                  title={`${driftLines.length} line(s) have moved since this bill was submitted`}
                  body="The bill still claims the frozen quantities below. The additional execution will be claimed on the next bill, which is exactly what stops the same work being billed twice."
                />
              </div>
            ) : null}
            <DenseTableShell minWidth={760}>
              <caption className="sr-only">Cumulative executed quantities carried on this bill.</caption>
              <thead>
                <tr className="border-b border-line-strong bg-surface-2">
                  <th scope="col" className={TH}>Code</th>
                  <th scope="col" className={TH}>Description</th>
                  <th scope="col" className={THR}>{frozen ? "Frozen cumulative qty" : "Cumulative qty"}</th>
                  {frozen ? <th scope="col" className={THR}>Executed since</th> : null}
                  <th scope="col" className={THR}>Rate</th>
                  <th scope="col" className={THR}>Value</th>
                </tr>
              </thead>
              <tbody>
                {(frozen
                  ? bill.frozenExecution
                    .map((fe) => ({ fe, line: computed.find((l) => l.id === fe.boqLineId) }))
                    .filter((x) => x.line)
                    .slice(0, 60)
                  : computed.filter((l) => l.executedQty > 0).slice(0, 60).map((line) => ({ fe: { boqLineId: line.id, cumulativeQty: line.executedQty }, line }))
                ).map(({ fe, line }) => {
                  const l = line!;
                  const drift = Math.round((l.executedQty - fe.cumulativeQty) * 100) / 100;
                  return (
                    <tr key={fe.boqLineId} className={cn(ROW, "hover:bg-surface-2")}>
                      <td className={cn(TD, "t-mono text-text-hi")}>{l.code}</td>
                      <td className={cn(TD, "max-w-96 truncate")}>{l.description}</td>
                      <td className={TDR}>{formatQty(fe.cumulativeQty, l.uom)}</td>
                      {frozen ? (
                        <td className={cn(TDR, drift > 0 && "text-warn")}>
                          {drift ? `+${formatQty(drift)}` : <span className="text-text-lo">—</span>}
                        </td>
                      ) : null}
                      <td className={TDR}>{formatINR(l.rate)}</td>
                      <td className={TDR}>{formatINR(Math.round(fe.cumulativeQty * l.rate))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DenseTableShell>
            {(frozen ? bill.frozenExecution.length : computed.filter((l) => l.executedQty > 0).length) > 60 ? (
              <p className="t-body-sm border-t border-line px-3 py-1.5 text-text-lo">
                First 60 lines shown. The full schedule is on the A4 print preview.
              </p>
            ) : null}
          </Panel>
        </div>

        {/* ------------------------------------------------------- actions */}
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Certification" sub="The client's certified value is recorded alongside the claim, never in place of it." />
            <div className="flex flex-col gap-3 p-4">
              <dl className="grid grid-cols-2 gap-3">
                <KeyValue label="Claimed value">{formatINR(f.currentPeriodValue)}</KeyValue>
                <KeyValue label="Certified value">
                  {bill.certifiedValue === null ? (
                    <span className="text-text-lo">Awaiting the client</span>
                  ) : (
                    formatINR(bill.certifiedValue)
                  )}
                </KeyValue>
              </dl>

              {f.varianceAmount !== null ? (
                <div
                  className={cn(
                    "rounded-md border px-3 py-2",
                    f.varianceAmount < 0 ? "border-danger/40 bg-danger-bg" : f.varianceAmount > 0 ? "border-ok/40 bg-ok-bg" : "border-line bg-surface-2",
                  )}
                >
                  <Overline>Variance against claim</Overline>
                  <p className={cn("t-heading-lg tabular-nums", f.varianceAmount < 0 ? "text-danger" : f.varianceAmount > 0 ? "text-ok" : "text-text-hi")}
                    style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatINR(f.varianceAmount)}{" "}
                    <span className="t-heading-md">({formatPercent(f.variancePct ?? 0)})</span>
                  </p>
                  <p className="t-body-sm mt-0.5 text-text-mid">
                    {f.varianceAmount === 0
                      ? "Certified in full."
                      : f.varianceAmount < 0
                        ? `The client certified ${formatINR(Math.abs(f.varianceAmount))} below the claim — ${formatPercent(Math.abs(f.variancePct ?? 0))} of the claimed value. Both figures stay on the record.`
                        : "Certified above the claim, which normally means a variation was allowed."}
                  </p>
                </div>
              ) : null}

              {bill.status === "CERTIFIED" || bill.status === "PAID" ? (
                <div className="rounded-md border border-ok/40 bg-ok-bg px-3 py-2">
                  <p className="t-body-sm text-ok">
                    Retention of {formatINR(Math.round(((bill.certifiedValue ?? 0) * bill.retentionPct) / 100))} at{" "}
                    {formatPercent(bill.retentionPct, 0)} on the certified value was posted to the retention register.
                  </p>
                  <p className="t-body-sm mt-0.5 text-text-mid">
                    Eligible for release from {formatDate(project.dlpExpiry)} — the defect-liability expiry.{" "}
                    <Link href="/projects/retention" className="underline decoration-line underline-offset-2 hover:text-text-hi">
                      Open the register
                    </Link>
                  </p>
                </div>
              ) : null}

              {canWrite && (bill.status === "SUBMITTED" || bill.status === "UNDER_CERTIFICATION") ? (
                <>
                  <Field
                    label="Certified value (₹)"
                    error={certError ?? undefined}
                    hint={`Claim is ${formatINR(f.currentPeriodValue)}. Enter what the client actually certified.`}
                  >
                    <NumberInput
                      value={certifiedInput}
                      min={0}
                      step={100}
                      placeholder={String(f.currentPeriodValue)}
                      onChange={(e) => { setCertifiedInput(e.target.value); setCertError(null); }}
                    />
                  </Field>
                  <Btn variant="primary" onClick={certify}>
                    <FileCheck2 className="size-3.5" aria-hidden /> Record certification
                  </Btn>
                </>
              ) : null}

              {bill.status === "DRAFT" ? (
                <p className="t-body-sm text-text-lo">
                  Certification opens once the bill has been submitted to the client.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Bill state" sub="Draft → Submitted → Certified → Paid. Each step is audit-logged." />
            <ul className="flex flex-col">
              {[
                { k: "Created", v: formatDateTime(bill.createdAt) },
                { k: "Submitted", v: bill.submittedAt ? formatDateTime(bill.submittedAt) : "—" },
                { k: "Certified", v: bill.certifiedAt ? formatDateTime(bill.certifiedAt) : "—" },
                { k: "Paid", v: bill.paidAt ? formatDateTime(bill.paidAt) : "—" },
              ].map((x) => (
                <li key={x.k} className="flex h-9 items-center justify-between border-b border-line px-3 last:border-b-0">
                  <span className="t-body-sm text-text-mid">{x.k}</span>
                  <span className="t-body-sm tabular-nums text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>{x.v}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 border-t border-line p-3">
              {isDraft ? (
                canWrite ? (
                  <>
                    <Btn variant="primary" onClick={submit}>
                      <Send className="size-3.5" aria-hidden /> Submit to client and freeze quantities
                    </Btn>
                    <p className="t-body-sm text-text-lo">
                      Submission snapshots the cumulative quantity on every BOQ line onto this bill. Execution
                      recorded afterwards flows to the next bill, so the same work cannot be claimed twice.
                    </p>
                  </>
                ) : (
                  <BlockedNotice
                    rule="your role cannot submit running-account bills"
                    unblock="The assigned project manager, Accounts Executive or Director – Business can submit this claim."
                  />
                )
              ) : null}

              {(bill.status === "CERTIFIED" || bill.status === "PAID") && !bill.invoiceRef && canWrite ? (
                <Btn onClick={generateInvoice}>
                  <Receipt className="size-3.5" aria-hidden /> Generate tax invoice from the certified value
                </Btn>
              ) : null}

              {bill.invoiceRef ? (
                <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-ok" aria-hidden />
                    <span className="t-body-sm text-text-hi">Invoice raised</span>
                    <SimulatedBadge what="e-invoice IRN generation" />
                  </div>
                  <p className="t-mono mt-1 text-text-mid">{bill.invoiceRef}</p>
                  <p className="t-body-sm mt-0.5 text-text-lo">
                    Raised on the certified value of {formatINR(bill.certifiedValue ?? 0)}.
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          {overdue ? (
            <WarnNotice
              title={`Awaiting certification for ${daysSinceSubmission} days`}
              body={`The configured threshold is ${CERTIFICATION_THRESHOLD_DAYS} days. This bill sits on the exception feed with the days elapsed until the client certifies it or it is withdrawn.`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
