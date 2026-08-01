"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { Panel, PanelHeader, StatusBadge, EmptyState } from "@/components/patterns/primitives";
import { abbreviateINR, daysBetween, formatDate, formatINR, formatPercent } from "@/lib/format";
import type { RABillStatus } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { mergeBills, type BillRow } from "./bills";
import { billFigures, CERTIFICATION_THRESHOLD_DAYS, computeBoqLine, type BoqLineSeed } from "./compute";
import { RA_BILL_STATUS_LABEL, RA_BILL_STATUS_TONE } from "./labels";
import { createBill, useProjectsOverlay, type OverlayBill } from "./store";
import {
  BlockedNotice, Btn, DenseTableShell, ROW, StatBlock, TD, TDR, TH, THR, WarnNotice,
} from "./ui";

/**
 * E6-S5 — the running-account ledger for a project. Bills are sequentially
 * numbered and a new one cannot be raised while a prior bill sits in Draft.
 */
export function RaBillsList({
  projectId, projectCode, contractValue, mobilisationAdvance, retentionPct,
  seedBills, lines, today, actor, canWrite,
}: {
  projectId: string;
  projectCode: string;
  contractValue: number;
  mobilisationAdvance: number;
  retentionPct: number;
  seedBills: BillRow[];
  lines: BoqLineSeed[];
  today: string;
  actor: { id: string; name: string };
  canWrite: boolean;
}) {
  const overlay = useProjectsOverlay();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  const bills = useMemo(() => mergeBills(seedBills, overlay, projectId), [seedBills, overlay, projectId]);
  const executedValue = useMemo(
    () => lines.reduce((s, l) => s + computeBoqLine(l, overlay).executedValue, 0),
    [lines, overlay],
  );

  const lastBill = bills[bills.length - 1];
  const draftBill = bills.find((b) => b.status === "DRAFT");
  const cumulativeToDate = lastBill?.cumulativeValue ?? 0;
  const certifiedTotal = bills.reduce((s, b) => s + (b.certifiedValue ?? 0), 0);
  const claimedTotal = bills.reduce((s, b) => s + b.claimedValue, 0);
  const recoveredAdvance = bills
    .filter((b) => b.status !== "DRAFT")
    .reduce((s, b) => s + b.mobilisationRecovery, 0);

  const unbilled = Math.max(0, Math.round(executedValue - cumulativeToDate));

  function raise() {
    if (draftBill) {
      setNotice(`RA-bill ${draftBill.number} is still in Draft.`);
      return;
    }
    const sequence = (lastBill?.sequence ?? 0) + 1;
    const previousCumulative = cumulativeToDate;
    const cumulative = Math.max(Math.round(executedValue), previousCumulative);
    const current = cumulative - previousCumulative;
    const remainingAdvance = Math.max(0, mobilisationAdvance - recoveredAdvance);
    const proportional = contractValue ? Math.round((current / contractValue) * mobilisationAdvance) : 0;
    const periodFrom = lastBill?.periodTo ?? today;
    const bill: OverlayBill = {
      id: `RAB-L-${Date.now().toString(36).toUpperCase()}`,
      number: `BC/RA/${projectCode.split("/").pop()}/${String(sequence).padStart(2, "0")}`,
      projectId, sequence,
      periodFrom, periodTo: today,
      cumulativeValue: cumulative,
      previousCumulative,
      frozenExecution: [],
      mobilisationRecovery: Math.min(remainingAdvance, proportional),
      retentionPct, tdsPct: 2, labourCessPct: 1,
      otherDeductions: 0, otherDeductionsNote: "",
      claimedValue: current,
      certifiedValue: null,
      status: "DRAFT",
      submittedAt: null, certifiedAt: null, paidAt: null,
      invoiceRef: null,
      createdAt: new Date().toISOString(),
    };
    createBill(bill, actor);
    router.push(`/projects/${projectId}/ra-bills/${sequence}`);
  }

  const overdue = bills.filter(
    (b) => b.status === "SUBMITTED" && b.submittedAt && daysBetween(b.submittedAt, new Date(today)) > CERTIFICATION_THRESHOLD_DAYS,
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-5">
          <li className="bg-surface-1"><StatBlock label="Cumulative claimed" value={abbreviateINR(claimedTotal)} sub={`${bills.length} bills raised`} /></li>
          <li className="bg-surface-1"><StatBlock label="Cumulative certified" value={abbreviateINR(certifiedTotal)} sub={claimedTotal ? `${formatPercent((certifiedTotal / claimedTotal) * 100)} of claim certified` : "—"} /></li>
          <li className="bg-surface-1">
            <StatBlock
              label="Executed not yet billed"
              value={abbreviateINR(unbilled)}
              tone={unbilled > 0 ? "warn" : "ok"}
              sub="Executed value beyond the last cumulative claim"
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Mobilisation advance"
              value={abbreviateINR(Math.max(0, mobilisationAdvance - recoveredAdvance))}
              sub={`${abbreviateINR(recoveredAdvance)} of ${abbreviateINR(mobilisationAdvance)} recovered`}
            />
          </li>
          <li className="bg-surface-1">
            <StatBlock
              label="Awaiting certification"
              value={String(bills.filter((b) => b.status === "SUBMITTED").length)}
              tone={overdue.length ? "danger" : undefined}
              sub={overdue.length ? `${overdue.length} beyond ${CERTIFICATION_THRESHOLD_DAYS} days` : "None overdue"}
            />
          </li>
        </ul>
      </Panel>

      {overdue.map((b) => (
        <WarnNotice
          key={b.id}
          title={`${b.number} has been with the client for ${daysBetween(b.submittedAt!, new Date(today))} days`}
          body={
            <>
              Submitted {formatDate(b.submittedAt!)} claiming {formatINR(b.claimedValue)}. The configured
              threshold is {CERTIFICATION_THRESHOLD_DAYS} days, so this sits on the exception feed with the days
              elapsed until it is certified.
            </>
          }
          action={
            <Link
              href={`/projects/${projectId}/ra-bills/${b.sequence}`}
              className="t-body-sm inline-flex h-8 items-center rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Open the bill
            </Link>
          }
        />
      ))}

      {notice ? (
        <BlockedNotice
          rule="a prior bill is still in Draft"
          unblock={`${notice} A project can only ever have one bill open for editing, so cumulative quantities cannot be claimed twice. Submit or discard it, then raise the next.`}
          onDismiss={() => setNotice(null)}
          action={
            draftBill ? (
              <Link
                href={`/projects/${projectId}/ra-bills/${draftBill.sequence}`}
                className="t-body-sm inline-flex h-8 items-center rounded-md border border-primary-600 bg-primary-600 px-2.5 text-white hover:bg-primary-500"
              >
                Open {draftBill.number}
              </Link>
            ) : null
          }
        />
      ) : null}

      <Panel>
        <PanelHeader
          title="Running-account bills"
          sub="Sequentially numbered. Each bill claims the difference between its cumulative value and the previous bill's."
          right={
            canWrite ? (
              <Btn variant="primary" onClick={raise} disabled={Boolean(draftBill)}>
                <Plus className="size-3.5" aria-hidden />
                {draftBill ? `Blocked — ${draftBill.number} is in Draft` : "Raise next RA-bill"}
              </Btn>
            ) : null
          }
        />

        {bills.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No running-account bill has been raised"
            body="Executed quantities become money only when they are claimed. Raise the first RA-bill from the cumulative BOQ execution recorded so far."
            action={canWrite ? <Btn variant="primary" onClick={raise}><Plus className="size-3.5" aria-hidden /> Raise RA-bill 01</Btn> : null}
          />
        ) : (
          <DenseTableShell minWidth={1120}>
            <caption className="sr-only">
              Running-account bills for {projectCode} with cumulative, previous and current values, certified
              value, variance and status.
            </caption>
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                <th scope="col" className={TH}>Bill</th>
                <th scope="col" className={TH}>Period</th>
                <th scope="col" className={THR}>Cumulative</th>
                <th scope="col" className={THR}>Previous</th>
                <th scope="col" className={THR}>Current period</th>
                <th scope="col" className={THR}>Certified</th>
                <th scope="col" className={THR}>Variance</th>
                <th scope="col" className={THR}>Net payable</th>
                <th scope="col" className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const f = billFigures(b);
                const days = b.status === "SUBMITTED" && b.submittedAt ? daysBetween(b.submittedAt, new Date(today)) : null;
                return (
                  <tr key={b.id} className={cn(ROW, "hover:bg-surface-2")}>
                    <td className={TD}>
                      <Link href={`/projects/${projectId}/ra-bills/${b.sequence}`} className="flex flex-col">
                        <span className="t-mono text-text-hi">RA {String(b.sequence).padStart(2, "0")}</span>
                        <span className="t-body-sm text-text-lo">{b.number}</span>
                      </Link>
                    </td>
                    <td className={TD}>
                      {formatDate(b.periodFrom)} – {formatDate(b.periodTo)}
                    </td>
                    <td className={TDR}>{formatINR(b.cumulativeValue)}</td>
                    <td className={TDR}>{formatINR(b.previousCumulative)}</td>
                    <td className={cn(TDR, "font-medium")}>{formatINR(f.currentPeriodValue)}</td>
                    <td className={TDR}>
                      {b.certifiedValue === null ? <span className="text-text-lo">Awaiting</span> : formatINR(b.certifiedValue)}
                    </td>
                    <td className={TDR}>
                      {f.varianceAmount === null || f.varianceAmount === 0 ? (
                        <span className="text-text-lo">—</span>
                      ) : (
                        <span className={f.varianceAmount < 0 ? "text-danger" : "text-ok"}>
                          {formatINR(f.varianceAmount)}
                          <span className="block">{formatPercent(f.variancePct ?? 0)}</span>
                        </span>
                      )}
                    </td>
                    <td className={TDR}>{formatINR(f.netPayable)}</td>
                    <td className={TD}>
                      <StatusBadge tone={RA_BILL_STATUS_TONE[b.status as RABillStatus]}>
                        {RA_BILL_STATUS_LABEL[b.status as RABillStatus]}
                      </StatusBadge>
                      {days !== null ? (
                        <span className={cn("block", days > CERTIFICATION_THRESHOLD_DAYS ? "text-danger" : "text-text-lo")}>
                          {days} days elapsed
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DenseTableShell>
        )}
      </Panel>
    </div>
  );
}
