"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { COMPANY } from "@/lib/seed/catalog";
import { formatDate, formatINR, formatPercent, formatQty, inrInWords } from "@/lib/format";
import { mergeBills, type BillRow } from "./bills";
import { billFigures, computeBoqLine, type BoqLineSeed } from "./compute";
import { RA_BILL_STATUS_LABEL } from "./labels";
import { useProjectsOverlay } from "./store";
import { Btn } from "./ui";
import type { BuilderProject } from "./RaBillBuilder";

/**
 * E6-S5 — the A4 running-account document. Cumulative, previous and current
 * columns per BOQ line, the deductions schedule and the net payable, laid out
 * for the client's certifying engineer rather than for the screen.
 */
export function RaBillPrint({
  project, sequence, seedBills, lines,
}: {
  project: BuilderProject;
  sequence: number;
  seedBills: BillRow[];
  lines: BoqLineSeed[];
}) {
  const overlay = useProjectsOverlay();
  const bills = useMemo(() => mergeBills(seedBills, overlay, project.id), [seedBills, overlay, project.id]);
  const bill = bills.find((b) => b.sequence === sequence);
  const previous = bills.find((b) => b.sequence === sequence - 1);
  const computed = useMemo(() => lines.map((l) => computeBoqLine(l, overlay)), [lines, overlay]);

  if (!bill) {
    return <p className="t-body text-text-mid">RA-bill {sequence} does not exist on this project.</p>;
  }

  const prevQty = new Map(previous?.frozenExecution.map((f) => [f.boqLineId, f.cumulativeQty]) ?? []);
  const cumQty = new Map(
    (bill.frozenExecution.length
      ? bill.frozenExecution
      : computed.map((l) => ({ boqLineId: l.id, cumulativeQty: l.executedQty }))
    ).map((f) => [f.boqLineId, f.cumulativeQty]),
  );

  const rows = computed
    .map((l) => {
      const cum = cumQty.get(l.id) ?? 0;
      const prev = prevQty.get(l.id) ?? 0;
      return {
        line: l,
        cumQty: cum,
        prevQty: prev,
        currQty: Math.round((cum - prev) * 100) / 100,
        cumValue: Math.round(cum * l.rate),
        prevValue: Math.round(prev * l.rate),
        currValue: Math.round((cum - prev) * l.rate),
      };
    })
    .filter((r) => r.cumQty > 0 || r.prevQty > 0);

  const totals = rows.reduce(
    (a, r) => ({
      cum: a.cum + r.cumValue,
      prev: a.prev + r.prevValue,
      curr: a.curr + r.currValue,
    }),
    { cum: 0, prev: 0, curr: 0 },
  );

  const f = billFigures(bill);

  return (
    <div className="flex flex-col gap-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link
          href={`/projects/${project.id}/ra-bills/${sequence}`}
          className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to the bill
        </Link>
        <Btn variant="primary" onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden /> Print or export to PDF
        </Btn>
        <span className="t-body-sm text-text-lo">
          A4 portrait, 14 mm margins. Use the browser print dialogue&rsquo;s &ldquo;Save as PDF&rdquo; destination.
        </span>
      </div>

      {/* The sheet renders on white in both themes — it is a document, not a screen. */}
      <div
        className="print-sheet mx-auto w-full max-w-[210mm] border border-line bg-white p-8 text-[11px] leading-snug text-black"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <header className="flex items-start justify-between border-b-2 border-black pb-2">
          <div>
            <p className="text-[15px] font-bold uppercase tracking-wide">{COMPANY.legalName}</p>
            <p>{COMPANY.address}</p>
            <p>
              GSTIN {COMPANY.gstin} · PAN {COMPANY.pan} · {COMPANY.phone}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold uppercase">Running Account Bill</p>
            <p>
              No. <span className="font-semibold">{bill.number}</span>
            </p>
            <p>RA {String(bill.sequence).padStart(2, "0")} · {RA_BILL_STATUS_LABEL[bill.status]}</p>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-b border-black pb-2">
          <p><span className="font-semibold">Project:</span> {project.name}</p>
          <p><span className="font-semibold">Project code:</span> {project.code}</p>
          <p><span className="font-semibold">Employer:</span> {project.clientName}</p>
          <p><span className="font-semibold">Work order:</span> {project.workOrderRef}</p>
          <p><span className="font-semibold">Contract value:</span> {formatINR(project.contractValue)}</p>
          <p><span className="font-semibold">Bill period:</span> {formatDate(bill.periodFrom)} to {formatDate(bill.periodTo)}</p>
        </section>

        <table className="mt-3 w-full border-collapse text-[10px]">
          <caption className="sr-only">
            Measurement schedule with cumulative, previous and current values by BOQ line.
          </caption>
          <thead>
            <tr className="border-y border-black">
              <th className="border-r border-black px-1 py-1 text-left" rowSpan={2}>Item</th>
              <th className="border-r border-black px-1 py-1 text-left" rowSpan={2}>Description of work</th>
              <th className="border-r border-black px-1 py-1 text-center" rowSpan={2}>Unit</th>
              <th className="border-r border-black px-1 py-1 text-right" rowSpan={2}>Rate</th>
              <th className="border-r border-black px-1 py-1 text-center" colSpan={2}>Up to date</th>
              <th className="border-r border-black px-1 py-1 text-center" colSpan={2}>Up to previous</th>
              <th className="px-1 py-1 text-center" colSpan={2}>This period</th>
            </tr>
            <tr className="border-b border-black">
              <th className="border-r border-black px-1 py-0.5 text-right">Qty</th>
              <th className="border-r border-black px-1 py-0.5 text-right">Value</th>
              <th className="border-r border-black px-1 py-0.5 text-right">Qty</th>
              <th className="border-r border-black px-1 py-0.5 text-right">Value</th>
              <th className="border-r border-black px-1 py-0.5 text-right">Qty</th>
              <th className="px-1 py-0.5 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line.id} className="border-b border-neutral-300">
                <td className="border-r border-neutral-300 px-1 py-0.5 font-mono">{r.line.code}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5">{r.line.description}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-center">{r.line.uom}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-right">{formatINR(r.line.rate)}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-right">{formatQty(r.cumQty)}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-right">{formatINR(r.cumValue)}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-right">{formatQty(r.prevQty)}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-right">{formatINR(r.prevValue)}</td>
                <td className="border-r border-neutral-300 px-1 py-0.5 text-right">{formatQty(r.currQty)}</td>
                <td className="px-1 py-0.5 text-right">{formatINR(r.currValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-semibold">
              <td className="px-1 py-1" colSpan={5}>Total value of work done</td>
              <td className="border-r border-black px-1 py-1 text-right">{formatINR(totals.cum)}</td>
              <td className="border-r border-black px-1 py-1 text-right" />
              <td className="border-r border-black px-1 py-1 text-right">{formatINR(totals.prev)}</td>
              <td className="border-r border-black px-1 py-1 text-right" />
              <td className="px-1 py-1 text-right">{formatINR(totals.curr)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <p className="border-b border-black pb-0.5 text-[11px] font-bold uppercase">Summary of claim</p>
            <table className="mt-1 w-full text-[10px]">
              <tbody>
                <tr><td className="py-0.5">Cumulative value of work done to date</td><td className="py-0.5 text-right">{formatINR(bill.cumulativeValue)}</td></tr>
                <tr><td className="py-0.5">Less cumulative value of previous bill</td><td className="py-0.5 text-right">{formatINR(bill.previousCumulative)}</td></tr>
                <tr className="border-t border-black font-semibold"><td className="py-0.5">Value of work done this period</td><td className="py-0.5 text-right">{formatINR(f.currentPeriodValue)}</td></tr>
                {bill.certifiedValue !== null ? (
                  <>
                    <tr><td className="py-0.5">Value certified by the Engineer</td><td className="py-0.5 text-right">{formatINR(bill.certifiedValue)}</td></tr>
                    <tr>
                      <td className="py-0.5">Variance against claim</td>
                      <td className="py-0.5 text-right">
                        {formatINR(f.varianceAmount ?? 0)} ({formatPercent(f.variancePct ?? 0)})
                      </td>
                    </tr>
                  </>
                ) : null}
              </tbody>
            </table>
          </div>
          <div>
            <p className="border-b border-black pb-0.5 text-[11px] font-bold uppercase">Deductions schedule</p>
            <table className="mt-1 w-full text-[10px]">
              <tbody>
                <tr><td className="py-0.5">Gross value for deduction</td><td className="py-0.5 text-right">{formatINR(f.grossForDeduction)}</td></tr>
                <tr><td className="py-0.5">Mobilisation advance recovery</td><td className="py-0.5 text-right">{formatINR(f.mobilisationRecovery)}</td></tr>
                <tr><td className="py-0.5">Retention at {formatPercent(bill.retentionPct, 0)}</td><td className="py-0.5 text-right">{formatINR(f.retention)}</td></tr>
                <tr><td className="py-0.5">TDS at {formatPercent(bill.tdsPct, 0)}</td><td className="py-0.5 text-right">{formatINR(f.tds)}</td></tr>
                <tr><td className="py-0.5">Labour cess at {formatPercent(bill.labourCessPct, 0)}</td><td className="py-0.5 text-right">{formatINR(f.labourCess)}</td></tr>
                <tr><td className="py-0.5">Other deductions{bill.otherDeductionsNote ? ` — ${bill.otherDeductionsNote}` : ""}</td><td className="py-0.5 text-right">{formatINR(f.otherDeductions)}</td></tr>
                <tr className="border-t border-black"><td className="py-0.5">Total deductions</td><td className="py-0.5 text-right">{formatINR(f.totalDeductions)}</td></tr>
                <tr className="border-t-2 border-black text-[12px] font-bold"><td className="py-1">Net payable</td><td className="py-1 text-right">{formatINR(f.netPayable)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-2 text-[10px]"><span className="font-semibold">Net payable in words:</span> {inrInWords(f.netPayable)}</p>

        <section className="mt-4 text-[10px]">
          <p className="font-semibold">Bank details for payment</p>
          <p>
            {COMPANY.bank.name}, {COMPANY.bank.branch} · A/c {COMPANY.bank.account} · IFSC {COMPANY.bank.ifsc}
          </p>
        </section>

        <section className="mt-8 grid grid-cols-3 gap-6 text-[10px]">
          {["Prepared by — Bhushan Corp", "Checked by — Engineer in charge", "Certified by — Employer"].map((s) => (
            <div key={s} className="border-t border-black pt-1">{s}</div>
          ))}
        </section>

        <p className="mt-4 border-t border-neutral-300 pt-1 text-[9px] text-neutral-600">
          Quantities in this bill are the cumulative measured quantities frozen at submission on{" "}
          {bill.submittedAt ? formatDate(bill.submittedAt) : "—"}. Execution recorded after that date is carried
          to the next running-account bill.
        </p>
      </div>
    </div>
  );
}
