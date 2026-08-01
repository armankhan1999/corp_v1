"use client";

import * as React from "react";
import type * as T from "@/lib/schemas/entities";
import { COMPANY } from "@/lib/seed/catalog";
import { formatDate, formatINR, formatPhone, inrInWords } from "@/lib/format";
import {
  derivePlaceOfSupply, lineAmounts, quotationTotals, validityEnd, type PlaceOfSupply,
} from "./calc";
import type { SalesWorld } from "./store";

/**
 * E3-S4 AC-5 / FR-M3-21 — the A4 document. Letterhead, statutory particulars,
 * itemised lines, tax summary, terms and an authorised signatory block. The
 * sheet is white-on-black-ink by construction so a browser "Save as PDF" is a
 * faithful export.
 */
export function QuotationPrintSheet({
  world, quotation, lines,
}: {
  world: SalesWorld;
  quotation: T.Quotation;
  lines: T.QuotationLine[];
}) {
  const customer = world.customerById.get(quotation.customerId);
  const site = quotation.siteId ? world.siteById.get(quotation.siteId) : undefined;
  const pos: PlaceOfSupply = derivePlaceOfSupply(customer, site);
  const totals = quotationTotals(lines, pos.treatment);
  const owner = world.userById.get(quotation.ownerUserId);
  const branch = world.branchById.get(quotation.branchId);
  const contact = (world.contactsByCustomer.get(quotation.customerId) ?? []).find((c) => c.isPrimary);

  return (
    <div
      id="pv-print-root"
      className="print-sheet mx-auto w-full max-w-[210mm] bg-white p-8 text-[11px] leading-[1.45] text-black"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "20px", letterSpacing: "-0.01em" }}>
            {COMPANY.tradeName}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider">{COMPANY.legalName}</p>
          <p className="mt-1 max-w-[92mm] text-[10px]">{COMPANY.address}</p>
          <p className="text-[10px]">
            {COMPANY.phone} · {COMPANY.altPhone} · {COMPANY.email} · {COMPANY.website}
          </p>
        </div>
        <div className="text-right text-[10px]">
          <p><span className="font-semibold">GSTIN</span> <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.gstin}</span></p>
          <p><span className="font-semibold">PAN</span> <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.pan}</span></p>
          <p><span className="font-semibold">CIN</span> <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.cin}</span></p>
          <p className="mt-1">{COMPANY.lineage}</p>
        </div>
      </header>

      <h1 className="mt-4 text-center text-[15px] font-bold uppercase tracking-[0.18em]">Quotation</h1>

      {/* Particulars */}
      <section className="mt-3 grid grid-cols-2 gap-4">
        <div className="border border-black p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider">Quotation to</p>
          <p className="mt-1 text-[12px] font-semibold">{customer?.legalName ?? "—"}</p>
          {site ? <p>{site.address}</p> : null}
          {site ? <p>{site.district}, {site.state} {site.pincode}</p> : null}
          <p className="mt-1">
            <span className="font-semibold">GSTIN </span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{customer?.gstin ?? "Unregistered / export"}</span>
          </p>
          {contact ? <p>Kind attention: {contact.name}, {contact.designation} · {formatPhone(contact.mobile)}</p> : null}
        </div>
        <div className="border border-black p-2">
          <table className="w-full text-[10px]">
            <tbody>
              <tr>
                <td className="py-0.5 pr-2 font-semibold">Quotation no.</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{quotation.number}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 font-semibold">Revision</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>v{quotation.version}</td>
              </tr>
              <tr><td className="py-0.5 pr-2 font-semibold">Date</td><td>{formatDate(quotation.quotationDate)}</td></tr>
              <tr><td className="py-0.5 pr-2 font-semibold">Valid until</td><td>{formatDate(validityEnd(quotation))} ({quotation.validityDays} days)</td></tr>
              <tr><td className="py-0.5 pr-2 font-semibold">Place of supply</td><td>{pos.stateName} ({pos.stateCode})</td></tr>
              <tr><td className="py-0.5 pr-2 font-semibold">Tax treatment</td><td>{treatmentWords(pos)}</td></tr>
              <tr><td className="py-0.5 pr-2 font-semibold">Issuing branch</td><td>{branch?.name ?? "—"}</td></tr>
              <tr><td className="py-0.5 pr-2 font-semibold">Prepared by</td><td>{owner?.name ?? "—"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Lines */}
      <table className="mt-3 w-full border-collapse border border-black text-[10px]">
        <thead>
          <tr className="bg-[#eee]">
            <th className="border border-black px-1 py-1 text-left">#</th>
            <th className="border border-black px-1 py-1 text-left">Description of goods / services</th>
            <th className="border border-black px-1 py-1 text-left">HSN/SAC</th>
            <th className="border border-black px-1 py-1 text-right">Qty</th>
            <th className="border border-black px-1 py-1 text-left">UOM</th>
            <th className="border border-black px-1 py-1 text-right">Rate</th>
            <th className="border border-black px-1 py-1 text-right">Disc %</th>
            <th className="border border-black px-1 py-1 text-right">Taxable</th>
            <th className="border border-black px-1 py-1 text-right">GST %</th>
            <th className="border border-black px-1 py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const a = lineAmounts(l, pos.treatment);
            return (
              <tr key={l.id}>
                <td className="border border-black px-1 py-0.5">{i + 1}</td>
                <td className="border border-black px-1 py-0.5">{l.description}</td>
                <td className="border border-black px-1 py-0.5" style={{ fontFamily: "var(--font-mono)" }}>{l.hsnSac}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{l.qty}</td>
                <td className="border border-black px-1 py-0.5">{l.uom}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(l.rate, { paise: true })}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{l.discountPct.toFixed(2)}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(a.taxable, { paise: true })}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{l.gstRate}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(a.total, { paise: true })}</td>
              </tr>
            );
          })}
          {lines.length === 0 ? (
            <tr><td colSpan={10} className="border border-black px-2 py-3 text-center">No lines on this version.</td></tr>
          ) : null}
        </tbody>
      </table>

      {/* Tax summary + totals */}
      <section className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider">Tax summary</p>
          <table className="mt-1 w-full border-collapse border border-black text-[10px]">
            <thead>
              <tr className="bg-[#eee]">
                <th className="border border-black px-1 py-0.5 text-left">HSN/SAC</th>
                <th className="border border-black px-1 py-0.5 text-right">Taxable</th>
                {pos.heads === "CGST_SGST" ? (
                  <>
                    <th className="border border-black px-1 py-0.5 text-right">CGST</th>
                    <th className="border border-black px-1 py-0.5 text-right">SGST</th>
                  </>
                ) : pos.heads === "IGST" ? (
                  <th className="border border-black px-1 py-0.5 text-right">IGST</th>
                ) : (
                  <th className="border border-black px-1 py-0.5 text-right">Tax</th>
                )}
              </tr>
            </thead>
            <tbody>
              {totals.byRate.map((r) => (
                <tr key={`${r.hsnSac}-${r.gstRate}`}>
                  <td className="border border-black px-1 py-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                    {r.hsnSac} @ {r.gstRate}%
                  </td>
                  <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(r.taxable, { paise: true })}</td>
                  {pos.heads === "CGST_SGST" ? (
                    <>
                      <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(r.cgst, { paise: true })}</td>
                      <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(r.sgst, { paise: true })}</td>
                    </>
                  ) : pos.heads === "IGST" ? (
                    <td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(r.igst, { paise: true })}</td>
                  ) : (
                    <td className="border border-black px-1 py-0.5 text-right tabular-nums">Nil — zero-rated</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {pos.treatment === "EXPORT_ZERO_RATED" ? (
            <p className="mt-1 text-[9px]">
              Supply meant for export under Letter of Undertaking without payment of integrated tax.
            </p>
          ) : null}
        </div>

        <div>
          <table className="w-full border-collapse border border-black text-[10px]">
            <tbody>
              <tr><td className="border border-black px-1 py-0.5">Gross value</td><td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(totals.gross, { paise: true })}</td></tr>
              <tr><td className="border border-black px-1 py-0.5">Less discount ({totals.effectiveDiscountPct.toFixed(2)}%)</td><td className="border border-black px-1 py-0.5 text-right tabular-nums">−{formatINR(totals.discount, { paise: true })}</td></tr>
              <tr><td className="border border-black px-1 py-0.5 font-semibold">Taxable value</td><td className="border border-black px-1 py-0.5 text-right font-semibold tabular-nums">{formatINR(totals.taxable, { paise: true })}</td></tr>
              {pos.heads === "CGST_SGST" ? (
                <>
                  <tr><td className="border border-black px-1 py-0.5">CGST</td><td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(totals.cgst, { paise: true })}</td></tr>
                  <tr><td className="border border-black px-1 py-0.5">SGST</td><td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(totals.sgst, { paise: true })}</td></tr>
                </>
              ) : pos.heads === "IGST" ? (
                <tr><td className="border border-black px-1 py-0.5">IGST</td><td className="border border-black px-1 py-0.5 text-right tabular-nums">{formatINR(totals.igst, { paise: true })}</td></tr>
              ) : (
                <tr><td className="border border-black px-1 py-0.5">Integrated tax</td><td className="border border-black px-1 py-0.5 text-right">Nil — zero-rated export</td></tr>
              )}
              <tr><td className="border border-black px-1 py-0.5">Rounding</td><td className="border border-black px-1 py-0.5 text-right tabular-nums">{totals.roundOff >= 0 ? "+" : "−"}{formatINR(Math.abs(totals.roundOff), { paise: true })}</td></tr>
              <tr className="bg-[#eee]">
                <td className="border border-black px-1 py-1 font-bold">Total</td>
                <td className="border border-black px-1 py-1 text-right font-bold tabular-nums">{formatINR(totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[10px]"><span className="font-semibold">Amount in words: </span>{inrInWords(totals.grandTotal)}</p>
        </div>
      </section>

      {/* Terms */}
      <section className="mt-3 border border-black p-2 text-[10px]">
        <p className="text-[9px] font-bold uppercase tracking-wider">Commercial terms</p>
        <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
          <div><dt className="inline font-semibold">Payment: </dt><dd className="inline">{quotation.paymentTerms}</dd></div>
          <div><dt className="inline font-semibold">Delivery: </dt><dd className="inline">{quotation.deliveryTerms}</dd></div>
          <div><dt className="inline font-semibold">Warranty: </dt><dd className="inline">{quotation.warrantyTerms}</dd></div>
          <div><dt className="inline font-semibold">Validity: </dt><dd className="inline">{quotation.validityDays} days from the date of this offer</dd></div>
        </dl>
        <p className="mt-2"><span className="font-semibold">Scope included: </span>{quotation.inclusions}</p>
        <p><span className="font-semibold">Scope excluded: </span>{quotation.exclusions}</p>
        {quotation.technicalNotes ? <p className="mt-1"><span className="font-semibold">Technical notes: </span>{quotation.technicalNotes}</p> : null}
        {quotation.approvedByUserId && quotation.approvedAt ? (
          <p className="mt-2">
            <span className="font-semibold">Discount approval: </span>
            {world.userById.get(quotation.approvedByUserId)?.name ?? quotation.approvedByUserId} on {formatDate(quotation.approvedAt)}
            {quotation.approvalRequestId ? (
              <> · reference <span style={{ fontFamily: "var(--font-mono)" }}>{world.approvals.find((a) => a.id === quotation.approvalRequestId)?.number ?? quotation.approvalRequestId}</span></>
            ) : null}
          </p>
        ) : null}
      </section>

      {/* Bank + signatory */}
      <section className="mt-3 grid grid-cols-2 gap-4 text-[10px]">
        <div className="border border-black p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider">Bank particulars</p>
          <p className="mt-1">{COMPANY.bank.name}, {COMPANY.bank.branch}</p>
          <p>A/c <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.bank.account}</span> · IFSC <span style={{ fontFamily: "var(--font-mono)" }}>{COMPANY.bank.ifsc}</span></p>
          <p className="mt-2 text-[9px]">
            This is a quotation and not a tax invoice. Goods and services described above will be supplied against a
            confirmed purchase order, subject to the terms stated.
          </p>
        </div>
        <div className="flex flex-col justify-between border border-black p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider">For {COMPANY.legalName}</p>
          <div className="mt-10 border-t border-black pt-1">
            <p className="font-semibold">Authorised Signatory</p>
            <p>{owner?.name ?? "—"} · {owner?.designation ?? ""}</p>
          </div>
        </div>
      </section>

      <p className="mt-3 text-center text-[9px]">
        {COMPANY.legalName} · {COMPANY.address} · Subject to Patna jurisdiction · Page 1 of 1
      </p>
    </div>
  );
}

function treatmentWords(pos: PlaceOfSupply): string {
  if (pos.treatment === "EXPORT_ZERO_RATED") return "Zero-rated export under LUT";
  if (pos.treatment === "INTER_STATE_IGST") return "Inter-state — IGST";
  return "Intra-state — CGST + SGST";
}
