"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft, CircleCheck, FileText, Gauge, Package, Printer, Signature, TriangleAlert,
} from "lucide-react";
import type { TicketCategory, TicketSeverity, TicketStatus } from "@/lib/schemas/enums";
import { formatDate, formatDateTime, formatDurationHM, formatINR, formatQty } from "@/lib/format";
import { Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { ServiceReportPreview } from "./ServiceReportPreview";
import { firstVisitResolved, mergeJobCard, recordExport, useOverlay } from "./store";
import { Btn, Callout, Row, Serial } from "./ui";
import {
  COVERAGE_LABEL, COVERAGE_TONE, OUTCOME_LABEL, OUTCOME_TONE, ROOT_CAUSE_LABEL,
  SEVERITY_SHORT, SEVERITY_TONE, TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL,
  type JobCardView, type PartLineView,
} from "./types";
import { VISIT_TYPE_LABEL } from "./JobCardsTable";

/**
 * E4-S4 — the completed job card, read end to end.
 *
 * Everything the visit produced is here once: the timestamps, the findings, the
 * parts, the meter reading against the previous one, and the acknowledgement
 * without which the card could not have been submitted as Resolved. The service
 * report preview (E4-S7) renders from exactly these fields — nothing is
 * re-entered to produce the customer document.
 */

export function JobCardDetail({
  card: seedCard,
  parts: seedParts,
  ticket,
  siteAddress,
  engineerCode,
  nowMs,
}: {
  card: JobCardView;
  parts: PartLineView[];
  ticket: {
    id: string;
    number: string;
    status: TicketStatus;
    severity: TicketSeverity;
    category: TicketCategory;
    problem: string;
  };
  siteAddress: string;
  engineerCode: string;
  nowMs: number;
}) {
  const overlay = useOverlay();
  const [showReport, setShowReport] = useState(false);

  const card = useMemo(
    () => mergeJobCard(seedCard, overlay.jobCards[seedCard.id]),
    [seedCard, overlay],
  );

  const parts = useMemo(() => {
    const sessionParts = overlay.parts.filter((p) => p.jobCardId === seedCard.id);
    const removed = new Set(overlay.removedParts);
    return [...seedParts, ...sessionParts].filter((p) => !removed.has(p.id));
  }, [seedParts, overlay, seedCard.id]);

  const fvr = firstVisitResolved(card);
  const onSiteMs =
    card.checkInAtMs && card.checkOutAtMs ? card.checkOutAtMs - card.checkInAtMs : null;
  const billableParts = parts.filter((p) => p.billable && !p.returned);
  const partsValue = billableParts.reduce((s, p) => s + p.qty * p.rate, 0);
  const chargeable = card.coverage === "CHARGEABLE" || card.amcCoverage === "NON_COMPREHENSIVE";

  const meterRegressed =
    card.runningHoursReading !== null &&
    card.previousReading !== null &&
    card.runningHoursReading < card.previousReading;

  const stats = [
    {
      label: "Visit",
      value: `#${card.visitSequence}`,
      sub: VISIT_TYPE_LABEL[card.visitType] ?? card.visitType,
    },
    {
      label: "Time on site",
      value: onSiteMs !== null ? formatDurationHM(onSiteMs) : "—",
      sub: card.checkInPlace ?? "no check-in recorded",
    },
    {
      label: "Parts consumed",
      value: String(parts.length),
      sub: chargeable ? `${formatINR(partsValue)} billable` : "recorded at cost",
    },
    {
      label: "Running hours",
      value: card.runningHoursReading !== null ? formatQty(card.runningHoursReading) : "—",
      sub:
        card.previousReading !== null
          ? `previous ${formatQty(card.previousReading)}`
          : "no prior reading",
      tone: meterRegressed ? "text-danger" : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/service/job-cards"
            className="t-body-sm inline-flex min-h-6 items-center gap-1.5 text-text-mid hover:text-text-hi"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Job cards
          </Link>
          <h1 className="t-display-md mt-1 text-text-hi">
            <span className="t-mono">{card.number}</span>
          </h1>
          <p className="t-body-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-text-mid">
            <Link
              href={`/service/tickets/${ticket.id}`}
              className="t-mono inline-flex min-h-6 items-center text-text-hi hover:text-primary-400"
            >
              {ticket.number}
            </Link>
            <span className="text-text-lo">·</span>
            {card.customerName}
            <span className="text-text-lo">·</span>
            <Serial>{card.assetSerial}</Serial>
            <span className="t-body-sm text-text-lo">{card.assetModel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={SEVERITY_TONE[ticket.severity]}>{SEVERITY_SHORT[ticket.severity]}</StatusBadge>
          <StatusBadge tone={COVERAGE_TONE[card.coverage]}>{COVERAGE_LABEL[card.coverage]}</StatusBadge>
          {card.outcome ? (
            <StatusBadge tone={OUTCOME_TONE[card.outcome]}>{OUTCOME_LABEL[card.outcome]}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">In progress</StatusBadge>
          )}
          <StatusBadge tone={fvr ? "ok" : "neutral"} icon={false}>
            {fvr ? "First-visit resolved" : "Not a first-visit fix"}
          </StatusBadge>
        </div>
      </div>

      <ul className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="flex flex-col gap-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
            <Overline>{s.label}</Overline>
            <span className={cn("t-display-md tabular-nums", s.tone ?? "text-text-hi")}>{s.value}</span>
            <span className="t-body-sm text-text-lo">{s.sub}</span>
          </li>
        ))}
      </ul>

      {meterRegressed ? (
        <Callout
          tone="danger"
          title="Running-hours reading is below the previous reading for this machine"
          icon={Gauge}
        >
          {formatQty(card.runningHoursReading ?? 0)} recorded against{" "}
          {formatQty(card.previousReading ?? 0)} from {card.previousReadingSource ?? "an earlier record"}
          {card.previousReadingAtMs ? ` on ${formatDate(card.previousReadingAtMs)}` : ""}. Submission
          is blocked until the reading is corrected or a meter-replacement note is recorded.
          {card.meterReplacementNote ? (
            <span className="mt-1 block text-text-hi">Note on file — {card.meterReplacementNote}</span>
          ) : null}
        </Callout>
      ) : null}

      {!card.customerAckName && card.outcome === "RESOLVED" ? (
        <Callout tone="warn" title="Resolved without a customer acknowledgement" icon={TriangleAlert}>
          A card cannot be submitted as Resolved without the contact name, designation and a drawn
          signature. This record predates that rule or was written by an import.
        </Callout>
      ) : null}

      <div className="no-print grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader
              title="Visit record"
              sub="Captured on site. Check-in and check-out are stamped by the device, not typed."
            />
            <dl className="divide-y divide-line px-4 py-1">
              <Row label="Scheduled">{formatDate(card.scheduledDateMs)}</Row>
              <Row label="Visit type">{VISIT_TYPE_LABEL[card.visitType] ?? card.visitType}</Row>
              <Row label="Visit sequence" mono>
                {card.visitSequence}
              </Row>
              <Row label="Engineer">
                {card.engineerName} <span className="t-mono text-text-lo">{engineerCode}</span>
              </Row>
              <Row label="Checked in" mono>
                {card.checkInAtMs ? formatDateTime(card.checkInAtMs) : "—"}
              </Row>
              <Row label="Checked out" mono>
                {card.checkOutAtMs ? formatDateTime(card.checkOutAtMs) : "—"}
              </Row>
              <Row label="Location">{card.checkInPlace ?? "Not captured"}</Row>
              <Row label="Submitted" mono>
                {card.submittedAtMs ? formatDateTime(card.submittedAtMs) : "Not submitted"}
              </Row>
              {card.tapCount !== null ? (
                <Row label="Taps to close" mono>
                  {card.tapCount}
                </Row>
              ) : null}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader
              title="Findings and work performed"
              sub="Root cause is a category, not free text, so repeat failures on a machine can be counted."
            />
            <div className="flex flex-col gap-3 px-4 py-3">
              <div>
                <Overline>Observations</Overline>
                <p className="t-body mt-0.5 text-text-hi">{card.observations || "None recorded"}</p>
              </div>
              <div>
                <Overline>Root-cause category</Overline>
                <p className="t-body mt-0.5 text-text-hi">
                  {card.rootCause ? ROOT_CAUSE_LABEL[card.rootCause] : "Not categorised"}
                </p>
              </div>
              <div>
                <Overline>Work performed</Overline>
                <p className="t-body mt-0.5 text-text-hi">{card.workPerformed || "—"}</p>
              </div>
              <div>
                <Overline>Next-visit recommendation</Overline>
                <p className="t-body mt-0.5 text-text-hi">
                  {card.nextVisitRecommendation || "None recorded"}
                </p>
              </div>
              <div>
                <Overline>Reported problem on the ticket</Overline>
                <p className="t-body-sm mt-0.5 text-text-mid">
                  {TICKET_CATEGORY_LABEL[ticket.category]} · {ticket.problem}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Parts consumed"
              sub="Each line wrote a stock Issue movement against this job card as its source document."
              right={
                <span className="t-overline text-text-lo">
                  {parts.length} {parts.length === 1 ? "line" : "lines"}
                </span>
              }
            />
            {parts.length === 0 ? (
              <p className="t-body-sm px-4 py-6 text-center text-text-lo">
                No part was consumed on this visit. A standard visit with no parts is the six-tap
                path the mobile card is measured against.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line">
                      {["Item", "Description", "Qty", "Rate", "Amount", "Basis", "Issued from"].map((h) => (
                        <th key={h} className="t-overline px-3 py-2 font-semibold text-text-lo">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p) => (
                      <tr key={p.id} className="border-b border-line hover:bg-surface-2">
                        <td className="t-mono px-3 py-1.5 text-text-hi">{p.itemCode}</td>
                        <td className="t-body-sm px-3 py-1.5 text-text-mid">
                          {p.description}
                          {p.returned ? (
                            <span className="t-overline ml-2 rounded bg-surface-2 px-1 text-text-lo">
                              Returned
                            </span>
                          ) : null}
                        </td>
                        <td className="t-body-sm px-3 py-1.5 text-right tabular-nums text-text-hi">
                          {formatQty(p.qty, p.uom)}
                        </td>
                        <td className="t-body-sm px-3 py-1.5 text-right tabular-nums text-text-mid">
                          {p.billable ? formatINR(p.rate) : "—"}
                        </td>
                        <td className="t-body-sm px-3 py-1.5 text-right tabular-nums text-text-hi">
                          {p.billable ? formatINR(Math.round(p.qty * p.rate)) : "Nil"}
                        </td>
                        <td className="px-3 py-1.5">
                          <StatusBadge tone={p.billable ? "warn" : "ok"}>
                            {p.billable ? "Chargeable" : "Covered"}
                          </StatusBadge>
                        </td>
                        <td className="t-body-sm px-3 py-1.5 text-text-lo">{p.locationName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Customer acknowledgement" />
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start gap-2">
                <Signature className="mt-0.5 size-4 shrink-0 text-text-lo" aria-hidden />
                <div className="min-w-0">
                  <p className="t-body text-text-hi">{card.customerAckName ?? "Not captured"}</p>
                  <p className="t-body-sm text-text-lo">{card.customerAckDesignation ?? "—"}</p>
                </div>
              </div>
              <div className="rounded-md border border-dashed border-line bg-surface-2 p-3">
                {card.signatureRef ? (
                  <p className="t-body-sm text-text-mid">
                    Signature captured on the device and held against this card.
                    <span className="t-mono mt-1 block break-all text-text-lo">{card.signatureRef}</span>
                  </p>
                ) : card.signatureStrokes?.length ? (
                  <p className="t-body-sm text-text-mid">
                    Signature drawn in this session · {card.signatureStrokes.length} strokes.
                  </p>
                ) : (
                  <p className="t-body-sm text-text-lo">No signature on file.</p>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Billing basis" sub="Derived from the ticket's coverage, never chosen here." />
            <dl className="divide-y divide-line px-4 py-1">
              <Row label="Coverage">{COVERAGE_LABEL[card.coverage]}</Row>
              <Row label="Basis">{card.coverageBasis}</Row>
              <Row label="Labour" mono>
                {formatINR(card.labourAmount)}
              </Row>
              <Row label="Travel" mono>
                {formatINR(card.travelAmount)}
              </Row>
              <Row label="Parts (billable)" mono>
                {formatINR(partsValue)}
              </Row>
            </dl>
            {!chargeable ? (
              <p className="t-body-sm border-t border-line px-4 py-2.5 text-text-mid">
                No billable summary is produced. The report states the coverage basis explicitly so
                the customer can see why nothing is charged.
              </p>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title="First-visit resolution" />
            <div className="px-4 py-3">
              <p
                className={cn(
                  "t-body flex items-center gap-2",
                  fvr ? "text-ok" : "text-text-mid",
                )}
              >
                {fvr ? (
                  <CircleCheck className="size-4 shrink-0" aria-hidden />
                ) : (
                  <Package className="size-4 shrink-0 text-text-lo" aria-hidden />
                )}
                {fvr ? "Resolved on the first visit" : "Not resolved on the first visit"}
              </p>
              <p className="t-body-sm mt-1.5 text-text-lo">
                Derived as{" "}
                <span className="t-mono text-text-mid">outcome = Resolved AND sequence = 1</span>.
                This card is visit {card.visitSequence} with outcome{" "}
                {card.outcome ? OUTCOME_LABEL[card.outcome] : "not set"}.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="no-print">
        <PanelHeader
          title="Service report preview"
          sub="The A4 document the customer receives, rendered from this card with no re-entry."
          right={
            <div className="flex flex-wrap gap-2">
              <Btn variant="secondary" onClick={() => setShowReport((v) => !v)}>
                <FileText className="size-4" aria-hidden />
                {showReport ? "Hide preview" : "Show preview"}
              </Btn>
              <Btn
                variant="primary"
                disabled={!showReport}
                onClick={() => {
                  recordExport(card.id, "SERVICE_REPORT_PRINT", nowMs);
                  window.print();
                }}
              >
                <Printer className="size-4" aria-hidden />
                Print / save as PDF
              </Btn>
            </div>
          }
        />
        {!showReport ? (
          <p className="t-body-sm px-4 py-6 text-center text-text-lo">
            The preview is held closed so the register stays fast. Opening it renders the full A4
            sheet; printing it is written to the audit log against this job card.
          </p>
        ) : null}
      </Panel>

      {showReport ? (
        <div className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] p-4">
          <ServiceReportPreview card={card} parts={parts} siteAddress={siteAddress} />
        </div>
      ) : null}

      <p className="no-print t-body-sm text-text-lo">
        Parent ticket <span className="t-mono">{ticket.number}</span> is currently{" "}
        {TICKET_STATUS_LABEL[ticket.status]}.
      </p>
    </div>
  );
}
