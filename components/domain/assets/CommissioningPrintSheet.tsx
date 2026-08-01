import * as React from "react";
import { COMPANY } from "@/lib/seed/catalog";
import { OEM_LABEL, PRODUCT_LINE_LABEL, type OEMPrincipal, type ProductLine } from "@/lib/schemas/enums";
import { formatDate, formatQty } from "@/lib/format";
import type { ChecklistEntry } from "./types";

/**
 * E5-S4 — the A4 document that goes to the OEM. Rendered as paper in both
 * themes so what is on screen is what prints; `@page { size: A4 }` and the
 * `.print-sheet` rules live in globals.css.
 */

export interface PrintSheetData {
  number: string;
  serial: string;
  model: string;
  principal: OEMPrincipal;
  productLine: ProductLine;
  capacityValue: number;
  capacityUnit: string;
  ratedKw: number | null;
  itemCode: string;
  customerName: string;
  siteName: string;
  siteAddress: string;
  locationInSite: string;
  installationDate: string | null;
  commissioningDate: string;
  deadline: string;
  windowDays: number;
  submittedAt: string | null;
  acknowledgementRef: string | null;
  siteConditions: string;
  supplyVoltage: string;
  supplyPhase: string;
  earthingOhms: number;
  accessoriesFitted: string;
  checklist: ChecklistEntry[];
  initialPressureBar: number | null;
  initialFadCfm: number | null;
  loadCurrentAmp: number | null;
  trainingAcknowledged: boolean;
  customerSignatory: string;
  customerDesignation: string;
  dealerAuthorisedBy: string;
  engineerName: string;
  warrantyMonths: number;
  warrantyStart: string | null;
  warrantyEnd: string | null;
}

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

export function CommissioningPrintSheet({ data }: { data: PrintSheetData }) {
  const failed = data.checklist.filter((c) => !c.pass);
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
          <p className="text-[13px] font-bold uppercase tracking-wide">
            Installation &amp; Commissioning Report
          </p>
          <p>
            Report no.{" "}
            <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
              {data.number}
            </span>
          </p>
          <p>
            OEM channel: {OEM_LABEL[data.principal]} · submission window {data.windowDays} days
          </p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Customer and site
          </caption>
          <tbody>
            <Pair label="Customer" value={data.customerName} />
            <Pair label="Site" value={data.siteName} />
            <Pair label="Address" value={data.siteAddress || "—"} />
            <Pair label="Location within site" value={data.locationInSite || "—"} />
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Machine identity
          </caption>
          <tbody>
            <Pair
              label="Serial number"
              value={
                <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                  {data.serial}
                </span>
              }
            />
            <Pair label="Model / series" value={data.model} />
            <Pair
              label="Product line"
              value={`${PRODUCT_LINE_LABEL[data.productLine]} · ${OEM_LABEL[data.principal]}`}
            />
            <Pair
              label="Rating"
              value={`${formatQty(data.capacityValue, data.capacityUnit)}${
                data.ratedKw === null ? "" : ` · ${data.ratedKw} kW`
              }`}
            />
          </tbody>
        </table>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Installation particulars
          </caption>
          <tbody>
            <Pair
              label="Installation date"
              value={data.installationDate ? formatDate(data.installationDate) : "—"}
            />
            <Pair label="Commissioning date" value={formatDate(data.commissioningDate)} />
            <Pair label="Site conditions" value={data.siteConditions || "—"} />
            <Pair label="Accessories fitted" value={data.accessoriesFitted || "—"} />
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Electrical supply particulars
          </caption>
          <tbody>
            <Pair label="Supply voltage" value={data.supplyVoltage || "—"} />
            <Pair label="Phase / wiring" value={data.supplyPhase || "—"} />
            <Pair label="Earthing resistance" value={`${data.earthingOhms} Ω`} />
            <Pair
              label="Full-load current"
              value={data.loadCurrentAmp === null ? "—" : `${data.loadCurrentAmp} A`}
            />
          </tbody>
        </table>
      </section>

      <section className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide">
          Commissioning checklist
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${head} w-8`}>#</th>
              <th className={head}>Check</th>
              <th className={`${head} w-20`}>Result</th>
              <th className={`${head} w-[38%]`}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {data.checklist.map((c, i) => (
              <tr key={c.item}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={cell}>{c.item}</td>
                <td className={`${cell} text-center font-semibold`}>{c.pass ? "Pass" : "Fail"}</td>
                <td className={cell}>{c.remark || (c.pass ? "—" : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1">
          Outcome:{" "}
          <span className="font-semibold">
            {failed.length === 0
              ? "Commissioned clean — all checks passed."
              : `Commissioned with observations — ${failed.length} check${failed.length === 1 ? "" : "s"} failed, remarks recorded above.`}
          </span>
        </p>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Initial running parameters
          </caption>
          <tbody>
            <Pair
              label="Working pressure"
              value={data.initialPressureBar === null ? "—" : `${data.initialPressureBar} bar`}
            />
            <Pair
              label="Free air delivery"
              value={data.initialFadCfm === null ? "—" : `${data.initialFadCfm} CFM`}
            />
            <Pair
              label="Load current"
              value={data.loadCurrentAmp === null ? "—" : `${data.loadCurrentAmp} A`}
            />
            <Pair label="Catalogue item" value={data.itemCode || "—"} />
          </tbody>
        </table>

        <table className="w-full border-collapse">
          <caption className="mb-1 text-left text-[11px] font-semibold uppercase tracking-wide">
            Warranty consequence
          </caption>
          <tbody>
            <Pair
              label="Warranty start"
              value={data.warrantyStart ? formatDate(data.warrantyStart) : "—"}
            />
            <Pair label="Duration" value={`${data.warrantyMonths} months`} />
            <Pair label="Warranty end" value={data.warrantyEnd ? formatDate(data.warrantyEnd) : "—"} />
            <Pair
              label="OEM submission deadline"
              value={`${formatDate(data.deadline)} (${data.windowDays} days from commissioning)`}
            />
          </tbody>
        </table>
      </section>

      <section className="mt-3">
        <table className="w-full border-collapse">
          <tbody>
            <Pair
              label="Operator training"
              value={
                data.trainingAcknowledged
                  ? "Completed. The customer acknowledges that operating and routine-maintenance training has been delivered."
                  : "Not acknowledged."
              }
            />
            <Pair
              label="OEM submission status"
              value={
                data.submittedAt
                  ? `Submitted ${formatDate(data.submittedAt)} · acknowledgement ${data.acknowledgementRef ?? "—"} (simulated channel, INT-11)`
                  : "Not yet submitted to the OEM channel."
              }
            />
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <div className="h-12 border-b border-[#111827]" />
          <p className="mt-1 font-semibold">{data.customerSignatory || "Customer signatory"}</p>
          <p>{data.customerDesignation || "Designation"}</p>
          <p>For {data.customerName}</p>
          <p className="mt-1">Date: {formatDate(data.commissioningDate)}</p>
        </div>
        <div>
          <div className="h-12 border-b border-[#111827]" />
          <p className="mt-1 font-semibold">{data.dealerAuthorisedBy || "Authorised signatory"}</p>
          <p>Commissioning engineer: {data.engineerName || "—"}</p>
          <p>For {COMPANY.tradeName}</p>
          <p className="mt-1">Date: {formatDate(data.commissioningDate)}</p>
        </div>
      </section>

      <footer className="mt-4 border-t border-[#c9d1d9] pt-1 text-[10px] text-[#4b5563]">
        This report is generated by Pravaah for {COMPANY.tradeName}. Warranty registration is subject
        to receipt of this report by the OEM within the stated submission window. Prototype document
        — the OEM channel submission is simulated (INT-11).
      </footer>
    </div>
  );
}
