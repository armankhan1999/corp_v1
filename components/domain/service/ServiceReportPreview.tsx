import * as React from "react";
import { COMPANY } from "@/lib/seed/catalog";
import { PRODUCT_LINE_LABEL, OEM_LABEL } from "@/lib/schemas/enums";
import { formatDate, formatDateTime, formatINR, formatQty } from "@/lib/format";
import { OUTCOME_LABEL, ROOT_CAUSE_LABEL, type JobCardView, type PartLineView } from "./types";

/**
 * E4-S7 preview surface, reached from the job card (E4-S4).
 *
 * Rendered as paper in both themes so what is on screen is what prints; the
 * `@page { size: A4 }` and `.print-sheet` rules live in globals.css. The
 * coverage basis is printed explicitly, because a warranty or comprehensive-AMC
 * visit produces no billable summary and the customer is entitled to see why.
 */

const cell = "border border-[#c9d1d9] px-2 py-1 align-top";
const head = "border border-[#c9d1d9] bg-[#eef2f6] px-2 py-1 text-left font-semibold";

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className={`${head} w-[34%]`}>
        {label}
      </th>
      <td className={cell}>{value}</td>
    </tr>
  );
}

export function ServiceReportPreview({
  card,
  parts,
  siteAddress,
}: {
  card: JobCardView;
  parts: PartLineView[];
  siteAddress: string;
}) {
  const billable = parts.filter((p) => p.billable && !p.returned);
  const partsValue = billable.reduce((s, p) => s + p.qty * p.rate, 0);
  const chargeable = card.coverage === "CHARGEABLE" || card.amcCoverage === "NON_COMPREHENSIVE";
  const coverageLine =
    card.coverage === "IN_WARRANTY"
      ? "Attended under manufacturer warranty. No charge is raised for labour, travel or parts."
      : card.coverage === "UNDER_AMC"
        ? card.amcCoverage === "COMPREHENSIVE"
          ? "Attended under a comprehensive annual maintenance contract. No charge is raised; parts are recorded at cost."
          : "Attended under a non-comprehensive annual maintenance contract. Labour and travel are covered; parts are chargeable."
        : "Attended on a chargeable basis. Labour, travel and parts are billable at the rates below.";

  return (
    <div
      className="print-sheet mx-auto w-full max-w-[210mm] bg-white p-6 text-[11px] leading-snug text-[#111827]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#111827] pb-2">
        <div>
          <p className="text-[15px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {COMPANY.legalName}
          </p>
          <p>{COMPANY.address}</p>
          <p>
            GSTIN <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.gstin}</span> · CIN{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.cin}</span>
          </p>
          <p>
            {COMPANY.phone} · {COMPANY.email} · {COMPANY.website}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-bold uppercase tracking-wide">Service Report</p>
          <p style={{ fontFamily: "var(--font-mono)" }}>{card.number}</p>
          <p>Ticket {card.ticketNumber}</p>
          <p>Visit {card.visitSequence}</p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Customer and site
          </caption>
          <tbody>
            <Pair label="Customer" value={card.customerName} />
            <Pair label="Site" value={card.siteName} />
            <Pair label="Address" value={siteAddress} />
            <Pair label="Branch" value={card.branchName} />
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Machine particulars
          </caption>
          <tbody>
            <Pair
              label="Serial number"
              value={<span style={{ fontFamily: "var(--font-mono)" }}>{card.assetSerial}</span>}
            />
            <Pair label="Model" value={card.assetModel} />
            <Pair
              label="Product line"
              value={`${PRODUCT_LINE_LABEL[card.assetProductLine]} · ${OEM_LABEL[card.assetPrincipal]}`}
            />
            <Pair
              label="Running hours"
              value={
                card.runningHoursReading !== null
                  ? formatQty(card.runningHoursReading, "h")
                  : "Not read on this visit"
              }
            />
          </tbody>
        </table>
      </section>

      <section className="mt-3">
        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Visit record
          </caption>
          <tbody>
            <Pair label="Visit type" value={card.visitType} />
            <Pair label="Scheduled" value={formatDate(card.scheduledDateMs)} />
            <Pair
              label="On site"
              value={
                card.checkInAtMs
                  ? `${formatDateTime(card.checkInAtMs)} → ${
                      card.checkOutAtMs ? formatDateTime(card.checkOutAtMs) : "still on site"
                    }`
                  : "Not checked in"
              }
            />
            <Pair label="Engineer" value={card.engineerName} />
            <Pair label="Observations" value={card.observations || "—"} />
            <Pair
              label="Root cause"
              value={card.rootCause ? ROOT_CAUSE_LABEL[card.rootCause] : "Not categorised"}
            />
            <Pair label="Work performed" value={card.workPerformed || "—"} />
            <Pair label="Recommendation" value={card.nextVisitRecommendation || "None recorded"} />
            <Pair label="Outcome" value={card.outcome ? OUTCOME_LABEL[card.outcome] : "Open"} />
          </tbody>
        </table>
      </section>

      <section className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Parts used</p>
        {parts.length === 0 ? (
          <p className="border border-[#c9d1d9] px-2 py-1">No parts were consumed on this visit.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={head}>Item</th>
                <th className={head}>Description</th>
                <th className={`${head} text-right`}>Qty</th>
                <th className={`${head} text-right`}>Rate</th>
                <th className={`${head} text-right`}>Amount</th>
                <th className={head}>Basis</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id}>
                  <td className={cell} style={{ fontFamily: "var(--font-mono)" }}>
                    {p.itemCode}
                  </td>
                  <td className={cell}>{p.description}</td>
                  <td className={`${cell} text-right`}>{formatQty(p.qty, p.uom)}</td>
                  <td className={`${cell} text-right`}>{p.billable ? formatINR(p.rate) : "—"}</td>
                  <td className={`${cell} text-right`}>
                    {p.billable ? formatINR(Math.round(p.qty * p.rate)) : "Nil"}
                  </td>
                  <td className={cell}>{p.billable ? "Chargeable" : "Covered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-3 border border-[#c9d1d9] p-2">
        <p className="font-semibold">Coverage basis</p>
        <p>{coverageLine}</p>
        <p className="mt-0.5 text-[10px]">{card.coverageBasis}</p>
        {chargeable ? (
          <p className="mt-1">
            Labour {formatINR(card.labourAmount)} · travel {formatINR(card.travelAmount)} · parts{" "}
            {formatINR(partsValue)}. Applicable GST is added on the tax invoice raised against this
            report.
          </p>
        ) : null}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="border border-[#c9d1d9] p-2">
          <p className="font-semibold">Customer acknowledgement</p>
          <p className="mt-1">{card.customerAckName ?? "Not captured"}</p>
          <p className="text-[10px]">{card.customerAckDesignation ?? ""}</p>
          <div className="mt-2 h-12 border-b border-dashed border-[#c9d1d9]">
            {card.signatureRef ? (
              <span className="text-[10px]" style={{ fontFamily: "var(--font-mono)" }}>
                Signature on file — {card.signatureRef}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border border-[#c9d1d9] p-2">
          <p className="font-semibold">For {COMPANY.tradeName}</p>
          <p className="mt-1">{card.engineerName}</p>
          <p className="text-[10px]">Field Service Engineer</p>
          <div className="mt-2 h-12 border-b border-dashed border-[#c9d1d9]" />
        </div>
      </section>

      <footer className="mt-3 border-t border-[#c9d1d9] pt-1.5 text-[10px]">
        Generated from job card{" "}
        <span style={{ fontFamily: "var(--font-mono)" }}>{card.number}</span>
        {card.submittedAtMs ? ` submitted ${formatDateTime(card.submittedAtMs)}` : " (not yet submitted)"}
        . This report is the record of work carried out and is issued subject to the terms of the
        governing contract.
      </footer>
    </div>
  );
}
