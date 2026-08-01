import { COMPANY } from "@/lib/seed/catalog";
import { daysBetween, formatDate } from "@/lib/format";
import type { TaxTreatment } from "@/lib/schemas/enums";
import type { CommercialSettings, InvoiceRow, LineRow } from "./types";

/**
 * E8-S2 / FR-M7-04 — GST treatment is derived, never typed.
 * E8-S3 / FR-M7-06, FR-M7-07 — simulated IRP behaviour and window tracking.
 *
 * Pure, isomorphic, no React. The invoice screen, the print sheet, the
 * exception feed and the hand-off export all read the same functions, so the
 * derivation cannot differ between where it is shown and where it is counted.
 */

/* ============================================================ state master */

/**
 * GST state codes. The seeded world trades inside Bihar and into Nepal, but the
 * inter-state branch must exist and be exercisable, so an invoice may be raised
 * against any of these places of supply and the IGST derivation will fire.
 */
export const GST_STATES: { code: string; name: string; country: "IN" | "FOREIGN" }[] = [
  { code: "01", name: "Jammu & Kashmir", country: "IN" },
  { code: "02", name: "Himachal Pradesh", country: "IN" },
  { code: "03", name: "Punjab", country: "IN" },
  { code: "04", name: "Chandigarh", country: "IN" },
  { code: "05", name: "Uttarakhand", country: "IN" },
  { code: "06", name: "Haryana", country: "IN" },
  { code: "07", name: "Delhi", country: "IN" },
  { code: "08", name: "Rajasthan", country: "IN" },
  { code: "09", name: "Uttar Pradesh", country: "IN" },
  { code: "10", name: "Bihar", country: "IN" },
  { code: "11", name: "Sikkim", country: "IN" },
  { code: "12", name: "Arunachal Pradesh", country: "IN" },
  { code: "13", name: "Nagaland", country: "IN" },
  { code: "14", name: "Manipur", country: "IN" },
  { code: "15", name: "Mizoram", country: "IN" },
  { code: "16", name: "Tripura", country: "IN" },
  { code: "17", name: "Meghalaya", country: "IN" },
  { code: "18", name: "Assam", country: "IN" },
  { code: "19", name: "West Bengal", country: "IN" },
  { code: "20", name: "Jharkhand", country: "IN" },
  { code: "21", name: "Odisha", country: "IN" },
  { code: "22", name: "Chhattisgarh", country: "IN" },
  { code: "23", name: "Madhya Pradesh", country: "IN" },
  { code: "24", name: "Gujarat", country: "IN" },
  { code: "27", name: "Maharashtra", country: "IN" },
  { code: "29", name: "Karnataka", country: "IN" },
  { code: "30", name: "Goa", country: "IN" },
  { code: "32", name: "Kerala", country: "IN" },
  { code: "33", name: "Tamil Nadu", country: "IN" },
  { code: "34", name: "Puducherry", country: "IN" },
  { code: "36", name: "Telangana", country: "IN" },
  { code: "37", name: "Andhra Pradesh", country: "IN" },
  { code: "96", name: "Nepal (outside India)", country: "FOREIGN" },
  { code: "97", name: "Other territory outside India", country: "FOREIGN" },
];

export function stateName(code: string): string {
  return GST_STATES.find((s) => s.code === code)?.name ?? `State code ${code}`;
}

export function isForeignPlaceOfSupply(code: string): boolean {
  return GST_STATES.find((s) => s.code === code)?.country === "FOREIGN";
}

/* ====================================================== the derivation rule */

export interface TaxDerivation {
  treatment: TaxTreatment;
  /** Which of the three published branches fired. */
  branch: 1 | 2 | 3;
  supplyStateCode: string;
  supplyStateName: string;
  placeOfSupplyStateCode: string;
  placeOfSupplyName: string;
  /** One sentence, both states named. Rendered verbatim on screen and on paper. */
  sentence: string;
  /** The heads of tax that apply, in the order they print. */
  heads: ("CGST" | "SGST" | "IGST")[];
  /** True when no IRN may be generated for this treatment (C-14). */
  suppressesIrn: boolean;
  authority: string;
}

/**
 * The three branches, published so the derivation defends itself on inspection.
 * Branch 3 is PLAN.md C-14: the seeded Nepal transactions had an enum value and
 * no rule, so the export branch is stated here alongside the other two.
 */
export const DERIVATION_RULES: {
  branch: 1 | 2 | 3; treatment: TaxTreatment; when: string; then: string; authority: string;
}[] = [
  {
    branch: 1, treatment: "INTRA_STATE_CGST_SGST",
    when: `Place of supply is in ${COMPANY.stateName} (state code ${COMPANY.stateCode}) — the same state as the supplier`,
    then: "The supply is intra-state. Tax splits equally into CGST and SGST.",
    authority: "Section 8, IGST Act 2017 · Section 9, CGST Act 2017",
  },
  {
    branch: 2, treatment: "INTER_STATE_IGST",
    when: `Place of supply is in another Indian state or union territory (state code other than ${COMPANY.stateCode})`,
    then: "The supply is inter-state. The whole tax is charged as IGST.",
    authority: "Section 7 and Section 5, IGST Act 2017",
  },
  {
    branch: 3, treatment: "EXPORT_ZERO_RATED",
    when: "Place of supply is outside India",
    then: "The supply is a zero-rated export made under a Letter of Undertaking without payment of integrated tax. No IRN is generated; an e-way bill is still required up to the customs frontier.",
    authority: "Section 16, IGST Act 2017 · Rule 96A, CGST Rules 2017",
  },
];

/** FR-M7-04. The single implementation; nothing else decides tax treatment. */
export function deriveTax(placeOfSupplyStateCode: string, placeOfSupplyNameHint?: string): TaxDerivation {
  const posName = placeOfSupplyNameHint || stateName(placeOfSupplyStateCode);
  const supplyStateName = COMPANY.stateName;
  const supplyStateCode = COMPANY.stateCode;

  if (isForeignPlaceOfSupply(placeOfSupplyStateCode)) {
    return {
      treatment: "EXPORT_ZERO_RATED", branch: 3,
      supplyStateCode, supplyStateName,
      placeOfSupplyStateCode, placeOfSupplyName: posName,
      sentence: `Supplier is in ${supplyStateName} (${supplyStateCode}); the place of supply — ${posName} — is outside India. The supply is a zero-rated export under LUT, so no CGST, SGST or IGST is charged.`,
      heads: [], suppressesIrn: true,
      authority: DERIVATION_RULES[2]!.authority,
    };
  }
  if (placeOfSupplyStateCode === supplyStateCode) {
    return {
      treatment: "INTRA_STATE_CGST_SGST", branch: 1,
      supplyStateCode, supplyStateName,
      placeOfSupplyStateCode, placeOfSupplyName: posName,
      sentence: `Supplier is in ${supplyStateName} (${supplyStateCode}) and the place of supply is ${posName} (${placeOfSupplyStateCode}). Both are the same state, so the supply is intra-state and tax splits equally into CGST and SGST.`,
      heads: ["CGST", "SGST"], suppressesIrn: false,
      authority: DERIVATION_RULES[0]!.authority,
    };
  }
  return {
    treatment: "INTER_STATE_IGST", branch: 2,
    supplyStateCode, supplyStateName,
    placeOfSupplyStateCode, placeOfSupplyName: posName,
    sentence: `Supplier is in ${supplyStateName} (${supplyStateCode}) and the place of supply is ${posName} (${placeOfSupplyStateCode}). The states differ, so the supply is inter-state and the whole tax is charged as IGST.`,
    heads: ["IGST"], suppressesIrn: false,
    authority: DERIVATION_RULES[1]!.authority,
  };
}

export const TREATMENT_LABEL: Record<TaxTreatment, string> = {
  INTRA_STATE_CGST_SGST: "Intra-state — CGST + SGST",
  INTER_STATE_IGST: "Inter-state — IGST",
  EXPORT_ZERO_RATED: "Export — zero rated under LUT",
};

export const TREATMENT_SHORT: Record<TaxTreatment, string> = {
  INTRA_STATE_CGST_SGST: "CGST + SGST",
  INTER_STATE_IGST: "IGST",
  EXPORT_ZERO_RATED: "Zero rated",
};

/* ------------------------------------------------------------ tax splitting */

export interface TaxSplit {
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/** The rupee always lands somewhere: the odd rupee goes to SGST, never nowhere. */
export function splitTax(tax: number, treatment: TaxTreatment): TaxSplit {
  if (treatment === "EXPORT_ZERO_RATED") return { cgst: 0, sgst: 0, igst: 0, total: 0 };
  if (treatment === "INTER_STATE_IGST") return { cgst: 0, sgst: 0, igst: tax, total: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0, total: tax };
}

/** HSN/SAC summary block — statutorily required on a tax invoice. */
export function hsnSummary(lines: LineRow[], treatment: TaxTreatment) {
  const map = new Map<string, { hsnSac: string; gstRate: number; qty: number; uom: string; taxable: number; tax: number }>();
  for (const l of lines) {
    const key = `${l.hsnSac}|${l.gstRate}`;
    const cur = map.get(key) ?? { hsnSac: l.hsnSac, gstRate: l.gstRate, qty: 0, uom: l.uom, taxable: 0, tax: 0 };
    cur.qty += l.qty;
    cur.taxable += l.taxable;
    cur.tax += l.tax;
    map.set(key, cur);
  }
  return [...map.values()].map((r) => ({ ...r, split: splitTax(r.tax, treatment) }));
}

/* ============================================ INT-02 — simulated IRP (E8-S3) */

/**
 * The seed's `hashDigits` helper emits "NaN" wherever its internal XOR turns
 * negative, so 236 seeded EBNs and 459 acknowledgement numbers carry letters
 * where the statute requires digits. `/lib` is frozen for this wave, so the
 * defect is repaired deterministically at the point of display: the surviving
 * digits are kept in order and the shortfall is filled from a stable hash of
 * the document number. The same input always yields the same output, so a
 * screenshot taken today matches one taken next week.
 */
export function repairDigits(raw: string | null, length: number, salt: string): string {
  const kept = (raw ?? "").replace(/\D/g, "");
  if (kept.length >= length) return kept.slice(0, length);
  return (kept + stableDigits(salt, length)).slice(0, length);
}

/** FNV-flavoured, unsigned throughout — the defect the seed helper has. */
export function stableHex(input: string, length: number): string {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x01000193 >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  let out = "";
  let a = h1, b = h2;
  while (out.length < length) {
    a = Math.imul(a ^ (a >>> 13), 0x5bd1e995) >>> 0;
    b = Math.imul(b ^ (b >>> 11), 0xc2b2ae35) >>> 0;
    out += (((a ^ b) >>> 0)).toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

export function stableDigits(input: string, length: number): string {
  const hex = stableHex(input, Math.max(length * 2, 16));
  let out = "";
  for (let i = 0; i < hex.length && out.length < length; i++) {
    out += String(parseInt(hex[i]!, 16) % 10);
  }
  return out.padEnd(length, "0").slice(0, length);
}

export interface EInvoiceIdentity {
  /** 64-character hexadecimal Invoice Reference Number. */
  irn: string;
  /** 15-digit IRP acknowledgement number. */
  ackNumber: string;
  ackDate: string;
}

/** Deterministic: the same invoice number always produces the same IRN. */
export function simulateIrn(invoiceNumber: string, invoiceDate: string): EInvoiceIdentity {
  const ack = new Date(invoiceDate);
  ack.setHours(ack.getHours() + 3);
  return {
    irn: stableHex(`irn${invoiceNumber}`, 64),
    ackNumber: stableDigits(`ack${invoiceNumber}`, 15),
    ackDate: ack.toISOString(),
  };
}

export function displayIrn(inv: Pick<InvoiceRow, "irn" | "number">): string | null {
  if (!inv.irn) return null;
  const clean = inv.irn.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return clean.length >= 64 ? clean.slice(0, 64) : (clean + stableHex(`irn${inv.number}`, 64)).slice(0, 64);
}

export function displayAck(inv: Pick<InvoiceRow, "ackNumber" | "number">): string | null {
  if (!inv.ackNumber) return null;
  return repairDigits(inv.ackNumber, 15, `ack${inv.number}`);
}

/**
 * The signed-QR payload the IRP returns. The real one is a JWS whose payload
 * carries exactly these ten fields; the simulation keeps the field set and
 * the ordering so the QR encodes something a reader would recognise.
 */
export function qrPayload(inv: InvoiceRow, irn: string, ackNo: string): string {
  return JSON.stringify({
    SellerGstin: COMPANY.gstin,
    BuyerGstin: inv.customerGstin ?? "URP",
    DocNo: inv.number,
    DocTyp: "INV",
    DocDt: inv.date.slice(0, 10).split("-").reverse().join("/"),
    TotInvVal: inv.total + inv.roundOff,
    ItemCnt: undefined,
    MainHsnCode: undefined,
    Irn: irn,
    IrnDt: (inv.ackDate ?? inv.date).slice(0, 19).replace("T", " "),
    AckNo: ackNo,
  });
}

/* --------------------------------------------- reporting-window tracking */

export type EInvoiceStatus =
  | "NOT_APPLICABLE"
  | "REPORTED_IN_WINDOW"
  | "REPORTED_LATE"
  | "WINDOW_OPEN"
  | "WINDOW_CLOSING"
  | "WINDOW_MISSED";

export interface EInvoiceWindow {
  status: EInvoiceStatus;
  applicable: boolean;
  reason: string | null;
  /** Last date on which the invoice may be reported to the IRP. */
  deadline: string | null;
  daysRemaining: number | null;
  /** Days between invoice date and simulated reporting, where reported. */
  reportedLagDays: number | null;
  daysOverdue: number | null;
  windowDays: number;
  /** One sentence stating the position, for the screen and the exception feed. */
  statement: string;
}

export const EINVOICE_STATUS_LABEL: Record<EInvoiceStatus, string> = {
  NOT_APPLICABLE: "Not applicable",
  REPORTED_IN_WINDOW: "Reported",
  REPORTED_LATE: "Reported late",
  WINDOW_OPEN: "Window open",
  WINDOW_CLOSING: "Window closing",
  WINDOW_MISSED: "Window missed",
};

export const EINVOICE_STATUS_TONE: Record<EInvoiceStatus, "ok" | "warn" | "danger" | "neutral" | "info"> = {
  NOT_APPLICABLE: "neutral",
  REPORTED_IN_WINDOW: "ok",
  REPORTED_LATE: "danger",
  WINDOW_OPEN: "info",
  WINDOW_CLOSING: "warn",
  WINDOW_MISSED: "danger",
};

/**
 * FR-M7-07. Recomputed from the setting on every render — changing the window
 * in Masters reclassifies every invoice with no reissue and no stored state.
 */
export function eInvoiceWindow(
  inv: Pick<InvoiceRow, "date" | "eInvoiceApplicable" | "eInvoiceExemptReason" | "irpReportedAt" | "number">,
  settings: CommercialSettings,
  now: Date,
): EInvoiceWindow {
  const windowDays = settings.eInvoiceWindowDays;
  if (!inv.eInvoiceApplicable) {
    const reason = inv.eInvoiceExemptReason ?? "Transaction outside the scope of e-invoicing";
    return {
      status: "NOT_APPLICABLE", applicable: false, reason,
      deadline: null, daysRemaining: null, reportedLagDays: null, daysOverdue: null, windowDays,
      statement: `E-invoicing does not apply to this invoice. ${reason}. No IRN is generated and none is required.`,
    };
  }
  const invoiceDate = new Date(inv.date);
  const deadline = new Date(invoiceDate.getTime());
  deadline.setDate(deadline.getDate() + windowDays);
  const deadlineIso = deadline.toISOString();

  if (inv.irpReportedAt) {
    const lag = daysBetween(invoiceDate, new Date(inv.irpReportedAt));
    if (lag > windowDays) {
      return {
        status: "REPORTED_LATE", applicable: true, reason: null,
        deadline: deadlineIso, daysRemaining: null, reportedLagDays: lag,
        daysOverdue: lag - windowDays, windowDays,
        statement: `Reported to the IRP ${lag} days after the invoice date, which is ${lag - windowDays} ${lag - windowDays === 1 ? "day" : "days"} beyond the configured ${windowDays}-day window.`,
      };
    }
    return {
      status: "REPORTED_IN_WINDOW", applicable: true, reason: null,
      deadline: deadlineIso, daysRemaining: null, reportedLagDays: lag, daysOverdue: null, windowDays,
      statement: `Reported to the IRP ${lag === 0 ? "on the invoice date" : `${lag} ${lag === 1 ? "day" : "days"} after the invoice date`}, inside the configured ${windowDays}-day window.`,
    };
  }

  const daysRemaining = daysBetween(now, deadline);
  if (daysRemaining < 0) {
    return {
      status: "WINDOW_MISSED", applicable: true, reason: null,
      deadline: deadlineIso, daysRemaining, reportedLagDays: null, daysOverdue: -daysRemaining, windowDays,
      statement: `Not reported. The ${windowDays}-day reporting window closed ${-daysRemaining} ${daysRemaining === -1 ? "day" : "days"} ago.`,
    };
  }
  if (daysRemaining <= settings.eInvoiceWarnDays) {
    return {
      status: "WINDOW_CLOSING", applicable: true, reason: null,
      deadline: deadlineIso, daysRemaining, reportedLagDays: null, daysOverdue: null, windowDays,
      statement: `Not yet reported. ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remain in the ${windowDays}-day reporting window.`,
    };
  }
  return {
    status: "WINDOW_OPEN", applicable: true, reason: null,
    deadline: deadlineIso, daysRemaining, reportedLagDays: null, daysOverdue: null, windowDays,
    statement: `Not yet reported. ${daysRemaining} days remain in the ${windowDays}-day reporting window.`,
  };
}

/* ================================================ INT-03 — e-way bill rules */

export type EwayDecision =
  | "NOT_REQUIRED"
  | "REQUIRED"
  | "GENERATED"
  | "EXPIRED"
  | "BLOCKED_STALE_BASE";

export interface EwayEligibility {
  decision: EwayDecision;
  consignmentValue: number;
  threshold: number;
  baseDocDate: string;
  baseDocNumber: string;
  ageDays: number;
  maxAgeDays: number;
  /** How far past the limit the base document is; 0 when inside the limit. */
  overAgeDays: number;
  /** Statement of the position. Never a bare "not allowed". */
  headline: string;
  detail: string;
  /** What would make the action possible. Required whenever blocked. */
  remedy: string | null;
  validityDays: number;
}

export function ewayValidityDays(distanceKm: number, settings: CommercialSettings): number {
  return Math.max(1, Math.ceil(distanceKm / settings.ewayKmPerValidityDay));
}

/**
 * FR-M7-08 / FR-M7-09 — the whole rule in one place.
 *
 * Order matters: value is tested first, because a consignment below the
 * threshold needs no bill at all and the age of its base document is beside
 * the point. Only where a bill is required does the age limit bite.
 */
export function ewayEligibility(args: {
  consignmentValue: number;
  baseDocDate: string;
  baseDocNumber: string;
  distanceKm: number;
  existing: { validUntil: string } | null;
  settings: CommercialSettings;
  now: Date;
  sourceLabel: string;
}): EwayEligibility {
  const { consignmentValue, baseDocDate, baseDocNumber, distanceKm, existing, settings, now, sourceLabel } = args;
  const ageDays = daysBetween(new Date(baseDocDate), now);
  const overAgeDays = Math.max(0, ageDays - settings.ewayMaxBaseAgeDays);
  const validityDays = ewayValidityDays(distanceKm, settings);
  const base = {
    consignmentValue, threshold: settings.ewayThreshold, baseDocDate, baseDocNumber,
    ageDays, maxAgeDays: settings.ewayMaxBaseAgeDays, overAgeDays, validityDays,
  };

  if (consignmentValue <= settings.ewayThreshold) {
    return {
      ...base, decision: "NOT_REQUIRED",
      headline: "No e-way bill is required for this consignment.",
      detail: `The consignment value is at or below the configured threshold, so movement is authorised by the ${sourceLabel} alone.`,
      remedy: null,
    };
  }

  if (existing) {
    const expired = new Date(existing.validUntil) < now;
    if (!expired) {
      return {
        ...base, decision: "GENERATED",
        headline: "An e-way bill is in force for this consignment.",
        detail: "The bill remains valid; no further action is required while it stands.",
        remedy: null,
      };
    }
    if (overAgeDays > 0) {
      return { ...base, ...staleBlock(base, sourceLabel, true), decision: "BLOCKED_STALE_BASE" };
    }
    return {
      ...base, decision: "EXPIRED",
      headline: "The e-way bill against this consignment has expired.",
      detail: `Validity lapsed and the goods may not move under it. A fresh bill may be raised against the same ${sourceLabel}, which is ${ageDays} ${ageDays === 1 ? "day" : "days"} old and still inside the ${settings.ewayMaxBaseAgeDays}-day limit.`,
      remedy: null,
    };
  }

  if (overAgeDays > 0) {
    return { ...base, ...staleBlock(base, sourceLabel, false), decision: "BLOCKED_STALE_BASE" };
  }

  return {
    ...base, decision: "REQUIRED",
    headline: "An e-way bill is required before these goods move.",
    detail: `The consignment value exceeds the configured threshold. Part-B validity will be ${validityDays} ${validityDays === 1 ? "day" : "days"} for the ${distanceKm} km declared.`,
    remedy: null,
  };
}

/**
 * The block message. It must state four things — the base document date, its
 * age, the configured limit, and what would make the action possible — and it
 * must read like a colleague explaining the rule, not like a validator.
 */
function staleBlock(
  base: { baseDocNumber: string; baseDocDate: string; ageDays: number; maxAgeDays: number; overAgeDays: number },
  sourceLabel: string,
  afterExpiry: boolean,
): { headline: string; detail: string; remedy: string } {
  return {
    headline: afterExpiry
      ? "The earlier e-way bill has expired and a replacement cannot be raised against this base document."
      : "An e-way bill cannot be generated against this base document.",
    detail:
      `${sourceLabel} ${base.baseDocNumber} is dated ${formatDate(base.baseDocDate)} and is ${base.ageDays} days old today. ` +
      `The configured maximum base-document age is ${base.maxAgeDays} days, so this document passed the limit ` +
      `${base.overAgeDays} ${base.overAgeDays === 1 ? "day" : "days"} ago.`,
    remedy:
      `Raise a fresh ${sourceLabel.toLowerCase()} against the same order, dated today, and generate the e-way bill from that document — ` +
      `the goods, quantities and consignee carry across unchanged. ` +
      `If the original document must be used, an administrator can raise the maximum base-document age in Masters → Commercial; ` +
      `the current value of ${base.maxAgeDays} days applies to every branch.`,
  };
}

export const EWAY_DECISION_LABEL: Record<EwayDecision, string> = {
  NOT_REQUIRED: "Not required",
  REQUIRED: "Required",
  GENERATED: "Generated",
  EXPIRED: "Expired",
  BLOCKED_STALE_BASE: "Blocked",
};

export const EWAY_DECISION_TONE: Record<EwayDecision, "ok" | "warn" | "danger" | "neutral" | "info"> = {
  NOT_REQUIRED: "neutral",
  REQUIRED: "warn",
  GENERATED: "ok",
  EXPIRED: "warn",
  BLOCKED_STALE_BASE: "danger",
};

export function simulateEbn(baseDocNumber: string, at: string): string {
  return stableDigits(`ebn${baseDocNumber}${at}`, 12);
}

export function displayEbn(ebn: string, baseDocNumber: string): string {
  return repairDigits(ebn, 12, `ebn${baseDocNumber}`);
}

export const EWAY_SUB_TYPES = [
  "Supply", "Export", "Job Work", "SKD/CKD", "Recipient Not Known",
  "For Own Use", "Exhibition or Fairs", "Line Sales", "Others",
] as const;
