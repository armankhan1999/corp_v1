import * as React from "react";
import { COMPANY } from "@/lib/seed/catalog";
import { formatDate, formatINR, formatQty, inrInWords } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QrCode } from "./QrCode";
import { deriveTax, hsnSummary, splitTax, TREATMENT_LABEL } from "./gst";
import {
  CHALLAN_SOURCE_LABEL, INVOICE_TYPE_LABEL, TRANSPORT_MODE_LABEL,
  type ChallanRow, type InvoiceRow, type LineRow,
} from "./types";

/**
 * Statutory document previews. White paper on the dark shell, A4 geometry,
 * particulars in the conventional positions a Bihar accountant expects to find
 * them, and a print stylesheet that drops everything else off the page.
 *
 * FR-M7-01, FR-M7-03, FR-M7-18.
 */

/* ------------------------------------------------------------ paper shell */

export function Sheet({
  children, breakAfter, ariaLabel,
}: { children: React.ReactNode; breakAfter?: boolean; ariaLabel: string }) {
  return (
    <section
      aria-label={ariaLabel}
      className="print-sheet mx-auto w-[210mm] min-w-[210mm] bg-white p-[12mm] text-black"
      style={{ minHeight: "297mm", breakAfter: breakAfter ? "page" : undefined }}
    >
      {children}
    </section>
  );
}

export function SheetScroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto bg-surface-0 p-4 print:overflow-visible print:bg-white print:p-0">
      <div className="flex flex-col gap-6 print:gap-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- letterhead */

function Letterhead({ branchLine }: { branchLine?: string }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-2">
      <div className="min-w-0">
        <p className="text-[15px] font-bold uppercase leading-tight tracking-wide">{COMPANY.legalName}</p>
        <p className="text-[9px] leading-snug">{COMPANY.address}</p>
        <p className="text-[9px] leading-snug">
          Tel {COMPANY.phone} · {COMPANY.altPhone} · {COMPANY.email} · {COMPANY.website}
        </p>
        {branchLine ? <p className="text-[9px] leading-snug">Branch: {branchLine}</p> : null}
      </div>
      <dl className="shrink-0 text-right text-[9px] leading-snug">
        <div><dt className="inline font-semibold">GSTIN: </dt><dd className="inline font-mono">{COMPANY.gstin}</dd></div>
        <div><dt className="inline font-semibold">PAN: </dt><dd className="inline font-mono">{COMPANY.pan}</dd></div>
        <div><dt className="inline font-semibold">CIN: </dt><dd className="inline font-mono">{COMPANY.cin}</dd></div>
        <div><dt className="inline font-semibold">State: </dt><dd className="inline">{COMPANY.stateName} ({COMPANY.stateCode})</dd></div>
      </dl>
    </header>
  );
}

function DocTitle({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="mt-2 flex items-center justify-between border border-black bg-black/[0.06] px-2 py-1">
      <span className="text-[13px] font-bold uppercase tracking-[0.14em]">{title}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide">{copy}</span>
    </div>
  );
}

function Box({
  title, children, className,
}: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border border-black", className)}>
      <p className="border-b border-black bg-black/[0.05] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em]">
        {title}
      </p>
      <div className="px-2 py-1.5 text-[9.5px] leading-snug">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-1">
      <span className="shrink-0 text-black/70">{label}:</span>
      <span className={cn("min-w-0 break-words font-medium", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function SignatureBlock({ leftLabel }: { leftLabel: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-[9px]">
      <div className="flex h-[18mm] flex-col justify-end border border-black px-2 py-1">
        <span className="text-black/70">{leftLabel}</span>
      </div>
      <div className="flex h-[18mm] flex-col justify-between border border-black px-2 py-1 text-right">
        <span className="font-semibold">For {COMPANY.legalName}</span>
        <span className="text-black/70">Authorised Signatory</span>
      </div>
    </div>
  );
}

/* ============================================================ E8-S1 challan */

/** CGST Rule 55(2) — the three copies and the words that must appear on them. */
export const CHALLAN_COPIES = [
  { key: "ORIGINAL", designation: "Original for consignee", note: "Travels to the consignee with the goods." },
  { key: "DUPLICATE", designation: "Duplicate for transporter", note: "Retained by the transporter for the journey." },
  { key: "TRIPLICATE", designation: "Triplicate for consigner", note: "Retained by Bhushancorp Private Limited." },
] as const;

export function ChallanSheet({
  challan, copy, note,
}: { challan: ChallanRow; copy: string; note?: string }) {
  const total = challan.consignmentValue;
  return (
    <Sheet ariaLabel={`Delivery challan ${challan.number} — ${copy}`} breakAfter={copy !== CHALLAN_COPIES[2].designation}>
      <Letterhead branchLine={`${challan.branchName} (${challan.branchCode})`} />
      <DocTitle title="Delivery Challan" copy={copy} />
      {note ? <p className="mt-1 text-[8.5px] italic text-black/60">{note}</p> : null}

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Box title="Challan particulars">
          <Row label="Challan No" value={challan.number} mono />
          <Row label="Date" value={formatDate(challan.date)} />
          <Row label="Reason for transportation" value={challan.reasonForTransportation} />
        </Box>
        <Box title="Source document">
          <Row label="Type" value={CHALLAN_SOURCE_LABEL[challan.sourceType]} />
          <Row label="Reference" value={challan.sourceLabel} mono />
          <Row label="Branch" value={`${challan.branchName} (${challan.branchCode})`} />
        </Box>
        <Box title="Transport">
          <Row label="Mode" value={TRANSPORT_MODE_LABEL[challan.transportMode]} />
          <Row label="Vehicle No" value={challan.vehicleNumber} mono />
          <Row label="LR / RR No" value={challan.lrNumber} mono />
          <Row label="Approx. distance" value={`${challan.approxDistanceKm} km`} />
        </Box>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Box title="Consigner">
          <p className="font-semibold">{COMPANY.legalName}</p>
          <p className="text-black/80">{COMPANY.address}</p>
          <Row label="GSTIN" value={COMPANY.gstin} mono />
          <Row label="State" value={`${COMPANY.stateName} (${COMPANY.stateCode})`} />
        </Box>
        <Box title="Consignee">
          <p className="font-semibold">{challan.customerName}</p>
          <p className="text-black/80">{challan.siteName} — {challan.siteAddress}</p>
          <Row label="GSTIN" value={challan.customerGstin ?? "Unregistered"} mono />
          <Row label="State" value={`${challan.siteState} (${challan.siteStateCode})`} />
        </Box>
      </div>

      <div className="mt-2 border border-black">
        <p className="border-b border-black bg-black/[0.05] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em]">
          Particulars of goods
        </p>
        <table className="w-full border-collapse text-[9.5px]">
          <thead>
            <tr className="border-b border-black bg-black/[0.03] text-left">
              <th className="w-[7mm] border-r border-black/30 px-1.5 py-1 font-semibold">Sl</th>
              <th className="border-r border-black/30 px-1.5 py-1 font-semibold">Description of goods</th>
              <th className="w-[18mm] border-r border-black/30 px-1.5 py-1 font-semibold">HSN / SAC</th>
              <th className="w-[14mm] border-r border-black/30 px-1.5 py-1 font-semibold">UOM</th>
              <th className="w-[16mm] border-r border-black/30 px-1.5 py-1 text-right font-semibold">Qty</th>
              <th className="w-[24mm] border-r border-black/30 px-1.5 py-1 text-right font-semibold">Rate</th>
              <th className="w-[28mm] px-1.5 py-1 text-right font-semibold">Taxable value</th>
            </tr>
          </thead>
          <tbody>
            {challan.lines.map((l, i) => (
              <tr key={`${l.itemId}-${i}`} className="border-b border-black/20 align-top">
                <td className="border-r border-black/20 px-1.5 py-1 tabular-nums">{i + 1}</td>
                <td className="border-r border-black/20 px-1.5 py-1">{l.description}</td>
                <td className="border-r border-black/20 px-1.5 py-1 font-mono">{l.hsnSac}</td>
                <td className="border-r border-black/20 px-1.5 py-1">{l.uom}</td>
                <td className="border-r border-black/20 px-1.5 py-1 text-right tabular-nums">{formatQty(l.qty)}</td>
                <td className="border-r border-black/20 px-1.5 py-1 text-right tabular-nums">{formatINR(l.taxableValue, { paise: true })}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">{formatINR(l.lineValue, { paise: true })}</td>
              </tr>
            ))}
            <tr className="border-t border-black font-semibold">
              <td colSpan={6} className="px-1.5 py-1 text-right">Total taxable value of consignment</td>
              <td className="px-1.5 py-1 text-right tabular-nums">{formatINR(total, { paise: true })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 border border-black px-2 py-1 text-[9.5px]">
        <span className="text-black/70">Amount in words: </span>
        <span className="font-semibold">{inrInWords(total)}</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Box title="Transporter">
          <Row label="Name" value={challan.transporter} />
          <Row label="GSTIN" value={challan.transporterGstin} mono />
        </Box>
        <Box title="Declaration">
          <p className="text-black/80">
            This is a delivery challan issued under Rule 55 of the Central Goods and Services Tax Rules, 2017.
            It is not a tax invoice. A tax invoice will follow against this despatch where the supply is taxable.
          </p>
        </Box>
      </div>

      <SignatureBlock leftLabel="Received the goods in good order and condition — consignee's signature, name and date" />
      <p className="mt-2 text-center text-[8px] text-black/50">
        {challan.number} · {copy} · Page 1 of 1
      </p>
    </Sheet>
  );
}

/* ============================================================ E8-S2 invoice */

export function InvoiceSheet({
  invoice, lines, irn, ackNumber, qr, copy = "Original for recipient",
}: {
  invoice: InvoiceRow;
  lines: LineRow[];
  irn: string | null;
  ackNumber: string | null;
  qr: string | null;
  copy?: string;
}) {
  const derivation = deriveTax(invoice.placeOfSupplyStateCode, invoice.placeOfSupplyName);
  const isExport = derivation.treatment === "EXPORT_ZERO_RATED";
  const isIgst = derivation.treatment === "INTER_STATE_IGST";
  const split = splitTax(invoice.tax, derivation.treatment);
  const summary = hsnSummary(lines, derivation.treatment);
  const grand = invoice.total + invoice.roundOff;

  return (
    <Sheet ariaLabel={`Tax invoice ${invoice.number}`}>
      <Letterhead branchLine={`${invoice.branchName} (${invoice.branchCode})`} />

      <div className="mt-2 flex items-stretch justify-between gap-2">
        <div className="flex-1">
          <DocTitle title={isExport ? "Tax Invoice — Export" : "Tax Invoice"} copy={copy} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Box title="Invoice particulars">
              <Row label="Invoice No" value={invoice.number} mono />
              <Row label="Invoice date" value={formatDate(invoice.date)} />
              <Row label="Due date" value={formatDate(invoice.dueDate)} />
              <Row label="Invoice type" value={INVOICE_TYPE_LABEL[invoice.type]} />
            </Box>
            <Box title="Supply particulars">
              <Row label="Place of supply" value={`${invoice.placeOfSupplyName} (${invoice.placeOfSupplyStateCode})`} />
              <Row label="State of supply" value={`${COMPANY.stateName} (${COMPANY.stateCode})`} />
              <Row label="Tax treatment" value={TREATMENT_LABEL[derivation.treatment]} />
              <Row label="Reverse charge" value="No" />
            </Box>
          </div>
        </div>

        {/* Statutory position for the IRN block and signed QR — top right. */}
        <div className="flex w-[46mm] shrink-0 flex-col border border-black">
          <p className="border-b border-black bg-black/[0.05] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em]">
            e-Invoice details
          </p>
          {irn && ackNumber && qr ? (
            <div className="flex flex-col items-center gap-1 px-1.5 py-1.5">
              <QrCode payload={qr} size={104} label={`Signed QR code for invoice ${invoice.number}`} />
              <div className="w-full text-[7.5px] leading-tight">
                <p className="font-semibold">IRN</p>
                <p className="break-all font-mono">{irn}</p>
                <p className="mt-0.5"><span className="font-semibold">Ack No: </span><span className="font-mono">{ackNumber}</span></p>
                <p><span className="font-semibold">Ack Date: </span>{invoice.ackDate ? formatDate(invoice.ackDate) : "—"}</p>
              </div>
            </div>
          ) : (
            <div className="px-1.5 py-1.5 text-[8px] leading-snug">
              <p className="font-semibold uppercase">e-Invoicing does not apply</p>
              <p className="mt-1 text-black/75">
                {invoice.eInvoiceExemptReason ?? "Transaction outside the scope of e-invoicing"}.
              </p>
              <p className="mt-1 text-black/60">
                No Invoice Reference Number is generated and none is required for this supply.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Box title="Billed to">
          <p className="font-semibold">{invoice.customerName}</p>
          <p className="text-black/80">{invoice.siteAddress}</p>
          <Row label="GSTIN" value={invoice.customerGstin ?? "Unregistered recipient"} mono />
          <Row label="State" value={`${invoice.placeOfSupplyName} (${invoice.placeOfSupplyStateCode})`} />
        </Box>
        <Box title="Shipped to">
          <p className="font-semibold">{invoice.siteName}</p>
          <p className="text-black/80">{invoice.siteAddress}</p>
          {invoice.source ? <Row label="Against" value={invoice.source.label} mono /> : null}
        </Box>
      </div>

      <div className="mt-2 border border-black">
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black bg-black/[0.05] text-left">
              <th className="w-[6mm] border-r border-black/30 px-1 py-1 font-semibold">Sl</th>
              <th className="border-r border-black/30 px-1 py-1 font-semibold">Description of goods / services</th>
              <th className="w-[14mm] border-r border-black/30 px-1 py-1 font-semibold">HSN/SAC</th>
              <th className="w-[10mm] border-r border-black/30 px-1 py-1 font-semibold">UOM</th>
              <th className="w-[13mm] border-r border-black/30 px-1 py-1 text-right font-semibold">Qty</th>
              <th className="w-[20mm] border-r border-black/30 px-1 py-1 text-right font-semibold">Rate</th>
              <th className="w-[12mm] border-r border-black/30 px-1 py-1 text-right font-semibold">Disc %</th>
              <th className="w-[22mm] border-r border-black/30 px-1 py-1 text-right font-semibold">Taxable value</th>
              {isExport ? null : (
                <th className="w-[24mm] px-1 py-1 text-right font-semibold">{isIgst ? "IGST" : "CGST + SGST"}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const ls = splitTax(l.tax, derivation.treatment);
              return (
                <tr key={l.id} className="border-b border-black/20 align-top">
                  <td className="border-r border-black/20 px-1 py-1 tabular-nums">{i + 1}</td>
                  <td className="border-r border-black/20 px-1 py-1">{l.description}</td>
                  <td className="border-r border-black/20 px-1 py-1 font-mono">{l.hsnSac}</td>
                  <td className="border-r border-black/20 px-1 py-1">{l.uom}</td>
                  <td className="border-r border-black/20 px-1 py-1 text-right tabular-nums">{formatQty(l.qty)}</td>
                  <td className="border-r border-black/20 px-1 py-1 text-right tabular-nums">{formatINR(l.rate, { paise: true })}</td>
                  <td className="border-r border-black/20 px-1 py-1 text-right tabular-nums">{l.discountPct.toFixed(2)}</td>
                  <td className="border-r border-black/20 px-1 py-1 text-right tabular-nums">{formatINR(l.taxable, { paise: true })}</td>
                  {isExport ? null : (
                    <td className="px-1 py-1 text-right tabular-nums">
                      <span className="block">{l.gstRate}%</span>
                      <span className="block">
                        {isIgst ? formatINR(ls.igst, { paise: true }) : `${formatINR(ls.cgst, { paise: true })} + ${formatINR(ls.sgst, { paise: true })}`}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_78mm] gap-2">
        <div className="flex flex-col gap-2">
          <Box title="HSN / SAC summary">
            <table className="w-full border-collapse text-[8.5px]">
              <thead>
                <tr className="border-b border-black/30 text-left">
                  <th className="py-0.5 pr-2 font-semibold">HSN/SAC</th>
                  <th className="py-0.5 pr-2 text-right font-semibold">Taxable</th>
                  <th className="py-0.5 pr-2 text-right font-semibold">Rate</th>
                  <th className="py-0.5 text-right font-semibold">Tax</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={`${s.hsnSac}-${s.gstRate}`} className="border-b border-black/10">
                    <td className="py-0.5 pr-2 font-mono">{s.hsnSac}</td>
                    <td className="py-0.5 pr-2 text-right tabular-nums">{formatINR(s.taxable)}</td>
                    <td className="py-0.5 pr-2 text-right tabular-nums">{s.gstRate}%</td>
                    <td className="py-0.5 text-right tabular-nums">{formatINR(s.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          <Box title="Amount chargeable in words">
            <p className="font-semibold">{inrInWords(grand)}</p>
          </Box>

          <Box title="Bank particulars">
            <Row label="Bank" value={COMPANY.bank.name} />
            <Row label="Branch" value={COMPANY.bank.branch} />
            <Row label="Account No" value={COMPANY.bank.account} mono />
            <Row label="IFSC" value={COMPANY.bank.ifsc} mono />
          </Box>
        </div>

        <div className="border border-black">
          <p className="border-b border-black bg-black/[0.05] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em]">
            Summary of charges
          </p>
          <table className="w-full border-collapse text-[9.5px]">
            <tbody>
              <tr className="border-b border-black/15">
                <td className="px-2 py-1">Total taxable value</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatINR(invoice.taxable, { paise: true })}</td>
              </tr>
              {isExport ? (
                <tr className="border-b border-black/15">
                  <td className="px-2 py-1">Integrated tax (zero rated under LUT)</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatINR(0, { paise: true })}</td>
                </tr>
              ) : isIgst ? (
                <tr className="border-b border-black/15">
                  <td className="px-2 py-1">IGST</td>
                  <td className="px-2 py-1 text-right tabular-nums">{formatINR(split.igst, { paise: true })}</td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-black/15">
                    <td className="px-2 py-1">CGST</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatINR(split.cgst, { paise: true })}</td>
                  </tr>
                  <tr className="border-b border-black/15">
                    <td className="px-2 py-1">SGST</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatINR(split.sgst, { paise: true })}</td>
                  </tr>
                </>
              )}
              <tr className="border-b border-black/15">
                <td className="px-2 py-1">Rounding adjustment</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatINR(invoice.roundOff, { paise: true })}</td>
              </tr>
              <tr className="border-t border-black bg-black/[0.05] text-[11px] font-bold">
                <td className="px-2 py-1.5">Invoice total</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(grand, { paise: true })}</td>
              </tr>
            </tbody>
          </table>
          <div className="border-t border-black px-2 py-1 text-[8.5px] leading-snug">
            <p className="font-semibold">Tax derivation</p>
            <p className="text-black/75">{derivation.sentence}</p>
            <p className="mt-0.5 text-black/55">{derivation.authority}</p>
          </div>
        </div>
      </div>

      <div className="mt-2 border border-black px-2 py-1 text-[8.5px] leading-snug">
        <p className="font-semibold uppercase tracking-wide">Declaration</p>
        {isExport ? (
          <p>
            Supply meant for export under a Letter of Undertaking without payment of integrated tax, in terms of
            Rule 96A of the Central Goods and Services Tax Rules, 2017. Certified that the particulars given above
            are true and correct and that the amount indicated represents the price actually charged.
          </p>
        ) : (
          <p>
            Certified that the particulars given above are true and correct and that the amount indicated represents
            the price actually charged, and that all particulars are true and correct. Goods once sold will not be
            taken back. Interest at 18% per annum is chargeable on invoices outstanding beyond the agreed credit period.
            Subject to Patna jurisdiction.
          </p>
        )}
      </div>

      <SignatureBlock leftLabel="Received the goods and services described above — recipient's signature, name and date" />
      <p className="mt-2 text-center text-[8px] text-black/50">
        {invoice.number} · {copy} · This is a computer-generated invoice.
      </p>
    </Sheet>
  );
}
