import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import type { QuotationStatus, Role, TaxTreatment, Vertical } from "@/lib/schemas/enums";
import { COMPANY } from "@/lib/seed/catalog";
import * as D from "@/lib/derive";
import { daysBetween, formatDate, gstinStateCode } from "@/lib/format";

/**
 * E3 sales derivations. Everything the CRM screens compute lives here so the
 * same number cannot differ between the pipeline board, the builder, the desk
 * and the print sheet. Nothing here mutates the seed.
 */

export const DAY_MS = 86_400_000;
export const HOME_STATE_CODE = COMPANY.stateCode;

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------ place of supply */

/** GST state codes — enough of the register to name any code the seed can produce. */
export const STATE_BY_CODE: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
  "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
  "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
  "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export interface PlaceOfSupply {
  treatment: TaxTreatment;
  stateCode: string;
  stateName: string;
  country: string;
  /** Where the code was read from, shown to the user rather than assumed. */
  source: string;
  /** The rule that produced the treatment, in words. */
  rule: string;
  heads: "CGST_SGST" | "IGST" | "NONE";
}

/**
 * E3-S4 AC-3 and PLAN.md C-14. Three branches, never silently applied — the
 * builder renders this object so the user can verify the derivation.
 */
export function derivePlaceOfSupply(
  customer: T.Customer | undefined,
  site: T.Site | undefined,
): PlaceOfSupply {
  if (!customer) {
    return {
      treatment: "INTRA_STATE_CGST_SGST", stateCode: HOME_STATE_CODE,
      stateName: STATE_BY_CODE[HOME_STATE_CODE] ?? "Bihar", country: "IN",
      source: "No customer selected — defaulted to the supplier state",
      rule: `Supplier and place of supply both ${HOME_STATE_CODE} · intra-state`,
      heads: "CGST_SGST",
    };
  }

  if (customer.country !== "IN") {
    return {
      treatment: "EXPORT_ZERO_RATED", stateCode: "96", stateName: "Other Country",
      country: customer.country,
      source: `Customer country on the master record — ${customer.country}`,
      rule: "Place of supply outside India · zero-rated export under LUT · no IRN · e-way bill required to the border",
      heads: "NONE",
    };
  }

  const fromSite = site?.stateCode;
  const fromGstin = customer.gstin ? gstinStateCode(customer.gstin) : null;
  const stateCode = fromSite ?? fromGstin ?? HOME_STATE_CODE;
  const source = fromSite
    ? `Delivery site — ${site?.name}, ${site?.district} (state code ${fromSite})`
    : fromGstin
      ? `First two digits of the customer GSTIN ${customer.gstin}`
      : "No site or GSTIN on record — defaulted to the supplier state";

  const intra = stateCode === HOME_STATE_CODE;
  return {
    treatment: intra ? "INTRA_STATE_CGST_SGST" : "INTER_STATE_IGST",
    stateCode,
    stateName: STATE_BY_CODE[stateCode] ?? site?.state ?? "Unknown",
    country: "IN",
    source,
    rule: intra
      ? `Supplier state ${HOME_STATE_CODE} equals place of supply ${stateCode} · intra-state · CGST + SGST`
      : `Supplier state ${HOME_STATE_CODE} differs from place of supply ${stateCode} · inter-state · IGST`,
    heads: intra ? "CGST_SGST" : "IGST",
  };
}

/* ------------------------------------------------------------- line maths */

export interface LineInput {
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
}

export interface LineAmounts {
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function lineAmounts(l: LineInput, treatment: TaxTreatment): LineAmounts {
  const gross = round2(l.qty * l.rate);
  const discount = round2((gross * l.discountPct) / 100);
  const taxable = round2(gross - discount);
  const tax = treatment === "EXPORT_ZERO_RATED" ? 0 : round2((taxable * l.gstRate) / 100);
  const half = round2(tax / 2);
  return {
    gross, discount, taxable, tax,
    cgst: treatment === "INTRA_STATE_CGST_SGST" ? half : 0,
    sgst: treatment === "INTRA_STATE_CGST_SGST" ? round2(tax - half) : 0,
    igst: treatment === "INTER_STATE_IGST" ? tax : 0,
    total: round2(taxable + tax),
  };
}

export interface TaxSummaryRow {
  hsnSac: string;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface QuotationTotals {
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  beforeRounding: number;
  roundOff: number;
  grandTotal: number;
  /** Weighted across the whole quotation — this is what the gate tests. */
  effectiveDiscountPct: number;
  maxLineDiscountPct: number;
  byRate: TaxSummaryRow[];
}

export function quotationTotals(
  lines: readonly (LineInput & { hsnSac: string })[],
  treatment: TaxTreatment,
): QuotationTotals {
  let gross = 0, discount = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
  let maxLineDiscountPct = 0;
  const bucket = new Map<string, TaxSummaryRow>();

  for (const l of lines) {
    const a = lineAmounts(l, treatment);
    gross += a.gross; discount += a.discount; taxable += a.taxable;
    cgst += a.cgst; sgst += a.sgst; igst += a.igst;
    maxLineDiscountPct = Math.max(maxLineDiscountPct, l.discountPct);
    const key = `${l.hsnSac}|${l.gstRate}`;
    const row = bucket.get(key) ?? { hsnSac: l.hsnSac, gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable = round2(row.taxable + a.taxable);
    row.cgst = round2(row.cgst + a.cgst);
    row.sgst = round2(row.sgst + a.sgst);
    row.igst = round2(row.igst + a.igst);
    bucket.set(key, row);
  }

  gross = round2(gross); discount = round2(discount); taxable = round2(taxable);
  cgst = round2(cgst); sgst = round2(sgst); igst = round2(igst);
  const tax = round2(cgst + sgst + igst);
  const beforeRounding = round2(taxable + tax);
  const grandTotal = Math.round(beforeRounding);
  return {
    gross, discount, taxable, cgst, sgst, igst, tax,
    beforeRounding, roundOff: round2(grandTotal - beforeRounding), grandTotal,
    effectiveDiscountPct: gross > 0 ? round2((discount / gross) * 100) : 0,
    maxLineDiscountPct,
    byRate: [...bucket.values()].sort((a, b) => a.gstRate - b.gstRate || a.hsnSac.localeCompare(b.hsnSac)),
  };
}

/* --------------------------------------------------------- price list */

/**
 * E3-S4 AC-6 — an item with no entry effective on the quotation date returns
 * null. The caller must leave the rate blank and flag it, never write a zero.
 */
export function priceListRate(ds: Dataset, itemId: string, onDate: Date): number | null {
  const t = onDate.getTime();
  const entry = ds.priceList.find(
    (p) =>
      p.itemId === itemId &&
      new Date(p.effectiveFrom).getTime() <= t &&
      (p.effectiveTo === null || new Date(p.effectiveTo).getTime() >= t),
  );
  return entry ? entry.rate : null;
}

/* ---------------------------------------------------- discount authority */

export interface DiscountBand {
  label: string;
  from: number;
  to: number | null;
  approverRole: Role;
  chainRoles: Role[];
}

/**
 * PD-005, matched to the seeded approval chains (lib/seed — QUOTATION_DISCOUNT
 * chains are banded 0–5 / 5–10 / 10+). Held as data so a client answer is a
 * data edit, and rendered on screen next to the gate.
 */
export const DISCOUNT_BANDS: DiscountBand[] = [
  { label: "Up to 5%", from: 0, to: 5, approverRole: "BRANCH_MANAGER", chainRoles: ["BRANCH_MANAGER"] },
  { label: "Above 5% up to 10%", from: 5, to: 10, approverRole: "DIRECTOR_BUSINESS", chainRoles: ["BRANCH_MANAGER", "DIRECTOR_BUSINESS"] },
  { label: "Above 10%", from: 10, to: null, approverRole: "DIRECTOR_STRATEGY", chainRoles: ["BRANCH_MANAGER", "DIRECTOR_BUSINESS", "DIRECTOR_STRATEGY"] },
];

/** What a role may put out of the building without asking anyone. PD-005. */
export const SELF_AUTHORITY_PCT: Partial<Record<Role, number>> = {
  SALES_EXECUTIVE: 0,
  BRANCH_MANAGER: 5,
  DIRECTOR_BUSINESS: 10,
  DIRECTOR_STRATEGY: Number.POSITIVE_INFINITY,
  SUPER_ADMIN: 0,
};

export function selfAuthorityPct(role: Role): number {
  return SELF_AUTHORITY_PCT[role] ?? 0;
}

export function bandFor(pct: number): DiscountBand {
  return (
    DISCOUNT_BANDS.find((b) => pct > b.from && (b.to === null || pct <= b.to)) ??
    DISCOUNT_BANDS[0]!
  );
}

export interface GateResult {
  required: boolean;
  pct: number;
  authority: number;
  band: DiscountBand;
  /** Role that must clear it first — the name the block message must carry. */
  pendingRole: Role | null;
  explanation: string;
}

export function discountGate(pct: number, role: Role): GateResult {
  const authority = selfAuthorityPct(role);
  const band = bandFor(pct);
  const required = pct > authority && pct > 0;
  return {
    required, pct, authority, band,
    pendingRole: required ? band.chainRoles[0] ?? band.approverRole : null,
    explanation: required
      ? `Effective discount ${pct.toFixed(2)}% exceeds the ${authority}% this role may issue unaided. Band "${band.label}" routes to ${band.chainRoles.length} approver${band.chainRoles.length === 1 ? "" : "s"}.`
      : `Effective discount ${pct.toFixed(2)}% is within the ${authority === Number.POSITIVE_INFINITY ? "unlimited" : `${authority}%`} authority of this role. No approval required.`,
  };
}

/* --------------------------------------------------- quotation lifecycle */

export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "ISSUED"],
  PENDING_APPROVAL: ["ISSUED", "DRAFT"],
  ISSUED: ["NEGOTIATION", "WON", "LOST", "EXPIRED"],
  NEGOTIATION: ["WON", "LOST", "EXPIRED"],
  WON: [],
  LOST: [],
  EXPIRED: [],
};

export const QUOTATION_STATUS_ORDER: QuotationStatus[] = [
  "DRAFT", "PENDING_APPROVAL", "ISSUED", "NEGOTIATION", "WON", "LOST", "EXPIRED",
];

export function validityEnd(q: T.Quotation): Date {
  return new Date(new Date(q.quotationDate).getTime() + q.validityDays * DAY_MS);
}

/**
 * E3-S5 AC-3 — validity is evaluated, not stored. An issued quotation past its
 * validity date reports Expired and drops out of open pipeline value.
 */
export function effectiveStatus(q: T.Quotation, now: Date): QuotationStatus {
  if (q.status === "ISSUED" || q.status === "NEGOTIATION") {
    if (validityEnd(q).getTime() < now.getTime()) return "EXPIRED";
  }
  return q.status;
}

export function autoExpired(q: T.Quotation, now: Date): boolean {
  return q.status !== "EXPIRED" && effectiveStatus(q, now) === "EXPIRED";
}

export function isOpenQuotation(q: T.Quotation, now: Date): boolean {
  const s = effectiveStatus(q, now);
  return s === "ISSUED" || s === "NEGOTIATION" || s === "PENDING_APPROVAL" || s === "DRAFT";
}

export interface TransitionCheck {
  ok: boolean;
  /** Plain statement of the rule that refused. */
  reason?: string;
  /** What would unblock it. */
  remedy?: string;
}

export interface TransitionContext {
  now: Date;
  lines: T.QuotationLine[];
  pendingRateLineIds: Set<string>;
  lossReason: string | null;
  effectiveDiscountPct: number;
  role: Role;
  approvalPendingRole?: Role | null;
}

export function checkTransition(
  q: T.Quotation,
  to: QuotationStatus,
  ctx: TransitionContext,
): TransitionCheck {
  const from = effectiveStatus(q, ctx.now);

  if (from === to) {
    return { ok: false, reason: `The quotation is already ${labelStatus(to)}.`, remedy: "Choose a different state." };
  }

  if (from === "EXPIRED" && to === "WON") {
    return {
      ok: false,
      reason: `This offer lapsed on ${formatDate(validityEnd(q))}. An expired offer cannot be won — the price and validity a customer accepted must still be live.`,
      remedy: `Create revision v${q.version + 1} with fresh validity, issue it, then mark that version Won.`,
    };
  }

  if (from === "EXPIRED") {
    return {
      ok: false,
      reason: `This offer lapsed on ${formatDate(validityEnd(q))} and is read-only.`,
      remedy: `Create revision v${q.version + 1} to continue with this customer.`,
    };
  }

  if (!QUOTATION_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      reason: `${labelStatus(from)} → ${labelStatus(to)} is not a permitted transition. From ${labelStatus(from)} the quotation may only move to ${QUOTATION_TRANSITIONS[from].map(labelStatus).join(", ") || "no other state"}.`,
      remedy: "Follow Draft → Pending Approval → Issued → Negotiation → Won / Lost / Expired.",
    };
  }

  if (to === "LOST" && !ctx.lossReason) {
    return {
      ok: false,
      reason: "A loss needs a structured reason so the pipeline teaches us something.",
      remedy: "Select a reason from the configured list. A competitor name is optional.",
    };
  }

  if (to === "ISSUED" || to === "PENDING_APPROVAL") {
    if (ctx.lines.length === 0) {
      return { ok: false, reason: "A quotation with no lines cannot leave the building.", remedy: "Add at least one line from the item master." };
    }
    const pending = ctx.lines.filter((l) => ctx.pendingRateLineIds.has(l.id));
    if (pending.length > 0) {
      return {
        ok: false,
        reason: `${pending.length} line${pending.length === 1 ? " has" : "s have"} no rate. A line with no price-list entry is never priced at zero.`,
        remedy: "Enter the rate manually on every flagged line.",
      };
    }
  }

  if (to === "ISSUED" && from === "DRAFT") {
    const gate = discountGate(ctx.effectiveDiscountPct, ctx.role);
    if (gate.required) {
      return {
        ok: false,
        reason: gate.explanation,
        remedy: `Send for approval — the request goes to ${gate.pendingRole ? labelRole(gate.pendingRole) : "the configured chain"}.`,
      };
    }
  }

  if (to === "ISSUED" && from === "PENDING_APPROVAL") {
    return {
      ok: false,
      reason: `Issue is blocked while the discount approval sits with ${ctx.approvalPendingRole ? labelRole(ctx.approvalPendingRole) : "the approver"}.`,
      remedy: "The approver records a decision on My Approvals or in the panel below.",
    };
  }

  return { ok: true };
}

export function labelStatus(s: QuotationStatus): string {
  return s === "PENDING_APPROVAL" ? "Pending Approval" : s.charAt(0) + s.slice(1).toLowerCase();
}

const ROLE_WORDS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  DIRECTOR_BUSINESS: "Director – Business",
  DIRECTOR_STRATEGY: "Director – Strategy",
  BRANCH_MANAGER: "Branch Manager",
  SALES_EXECUTIVE: "Sales Executive",
  SERVICE_MANAGER: "Service Manager",
  FIELD_ENGINEER: "Field Engineer",
  PROJECT_MANAGER: "Project Manager",
  ACCOUNTS_EXECUTIVE: "Accounts Executive",
  HR_ADMIN: "HR & Admin",
  STORE_INCHARGE: "Store In-charge",
  AUDITOR: "Auditor",
};
export function labelRole(r: Role): string {
  return ROLE_WORDS[r];
}

export const QUOTATION_TONE: Record<QuotationStatus, "ok" | "warn" | "danger" | "info" | "neutral" | "sim"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warn",
  ISSUED: "info",
  NEGOTIATION: "info",
  WON: "ok",
  LOST: "danger",
  EXPIRED: "warn",
};

/* ------------------------------------------------------------ pipeline */

export type Stage = "ENQUIRY" | "QUALIFIED" | "QUOTED" | "NEGOTIATION" | "WON" | "LOST";

export const STAGES: Stage[] = ["ENQUIRY", "QUALIFIED", "QUOTED", "NEGOTIATION", "WON", "LOST"];

export const STAGE_LABEL: Record<Stage, string> = {
  ENQUIRY: "Enquiry", QUALIFIED: "Qualified", QUOTED: "Quoted",
  NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
};

/** FR-M3-18 — two thresholds per stage, published on the board. */
export const STAGE_AGEING: Record<Stage, { warn: number; escalate: number }> = {
  ENQUIRY: { warn: 7, escalate: 14 },
  QUALIFIED: { warn: 10, escalate: 21 },
  QUOTED: { warn: 14, escalate: 30 },
  NEGOTIATION: { warn: 21, escalate: 45 },
  WON: { warn: 9999, escalate: 9999 },
  LOST: { warn: 9999, escalate: 9999 },
};

export type Ageing = "OK" | "WARN" | "ESCALATE";

export function ageingOf(stage: Stage, days: number): Ageing {
  const t = STAGE_AGEING[stage];
  if (days >= t.escalate) return "ESCALATE";
  if (days >= t.warn) return "WARN";
  return "OK";
}

export interface Opportunity {
  enquiry: T.Enquiry;
  stage: Stage;
  customer: T.Customer | undefined;
  quotations: T.Quotation[];
  latest: T.Quotation | null;
  liveQuotations: T.Quotation[];
  order: T.SalesOrder | null;
  /** Live quotation value where one exists, otherwise the enquiry expectation. */
  value: number;
  valueBasis: string;
  lapsedValue: number;
  daysInStage: number;
  ageing: Ageing;
  nextActionDate: Date | null;
  nextActionOverdue: boolean;
  lastActivity: T.Activity | null;
  ownerUserId: string | null;
}

export interface OpportunityInputs {
  now: Date;
  enquiries: T.Enquiry[];
  quotations: T.Quotation[];
  quotationLines: T.QuotationLine[];
  salesOrders: T.SalesOrder[];
  activities: T.Activity[];
  customers: T.Customer[];
  sites: T.Site[];
}

export function buildOpportunities(i: OpportunityInputs): Opportunity[] {
  const custById = new Map(i.customers.map((c) => [c.id, c]));
  const siteById = new Map(i.sites.map((s) => [s.id, s]));
  const linesByQ = groupBy(i.quotationLines, (l) => l.quotationId);
  const quotesByEnquiry = groupBy(i.quotations.filter((q) => q.enquiryId), (q) => q.enquiryId!);
  const orderByQuotation = new Map(i.salesOrders.map((o) => [o.quotationId, o]));
  const activityByEnquiry = groupBy(i.activities, (a) => `${a.subjectType}:${a.subjectId}`);

  return i.enquiries.map((e) => {
    const customer = custById.get(e.customerId);
    const quotes = (quotesByEnquiry.get(e.id) ?? [])
      .slice()
      .sort((a, b) => a.version - b.version || a.quotationDate.localeCompare(b.quotationDate));
    const latest = quotes.length ? quotes[quotes.length - 1]! : null;
    const live = quotes.filter((q) => isOpenQuotation(q, i.now));
    const order = quotes.map((q) => orderByQuotation.get(q.id)).find(Boolean) ?? null;

    const acts = [
      ...(activityByEnquiry.get(`ENQUIRY:${e.id}`) ?? []),
      ...quotes.flatMap((q) => activityByEnquiry.get(`QUOTATION:${q.id}`) ?? []),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const lastActivity = acts[0] ?? null;

    let stage: Stage;
    if (e.status === "WON") stage = "WON";
    else if (e.status === "LOST" || e.status === "DROPPED") stage = "LOST";
    else if (latest && effectiveStatus(latest, i.now) === "NEGOTIATION") stage = "NEGOTIATION";
    else if (e.status === "NEGOTIATION") stage = "NEGOTIATION";
    else if (quotes.length > 0 || e.status === "QUOTED") stage = "QUOTED";
    else if (e.status === "QUALIFIED" || acts.length > 0) stage = "QUALIFIED";
    else stage = "ENQUIRY";

    const quoteValue = (q: T.Quotation) => {
      const lines = linesByQ.get(q.id) ?? [];
      const pos = derivePlaceOfSupply(customer, q.siteId ? siteById.get(q.siteId) : undefined);
      return quotationTotals(lines, pos.treatment).grandTotal;
    };

    const liveValue = live.reduce((s, q) => s + quoteValue(q), 0);
    const lapsedValue = quotes
      .filter((q) => autoExpired(q, i.now) || effectiveStatus(q, i.now) === "EXPIRED")
      .reduce((s, q) => s + quoteValue(q), 0);
    const wonValue = stage === "WON" && latest ? quoteValue(latest) : 0;

    const value =
      stage === "WON" ? wonValue || e.expectedValue
        : live.length > 0 ? liveValue
          : e.expectedValue;
    const valueBasis =
      stage === "WON" ? "Value of the won quotation"
        : live.length > 0 ? `${live.length} live quotation${live.length === 1 ? "" : "s"}`
          : quotes.length > 0 ? "Expected value — every quotation has lapsed"
            : "Expected value on the enquiry";

    const daysInStage = Math.max(0, daysBetween(e.stageEnteredAt, i.now));
    const nextActionRaw = acts.find((a) => a.nextActionDate)?.nextActionDate ?? null;
    const nextActionDate = nextActionRaw ? new Date(nextActionRaw) : null;
    const closed = stage === "WON" || stage === "LOST";

    return {
      enquiry: e, stage, customer, quotations: quotes, latest,
      liveQuotations: live, order, value, valueBasis, lapsedValue,
      daysInStage, ageing: closed ? "OK" : ageingOf(stage, daysInStage),
      nextActionDate,
      nextActionOverdue: !closed && !!nextActionDate && nextActionDate.getTime() < startOfDay(i.now).getTime(),
      lastActivity, ownerUserId: e.ownerUserId,
    };
  });
}

export function startOfDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Board move rules. Drag and the keyboard control run this same check. */
export function checkStageMove(o: Opportunity, to: Stage, lossReason: string | null): TransitionCheck {
  if (o.stage === to) return { ok: false, reason: `Already in ${STAGE_LABEL[to]}.`, remedy: "Choose a different column." };
  if (o.stage === "WON") {
    return {
      ok: false,
      reason: "A won opportunity is closed — its sales order is the live record from here.",
      remedy: o.order ? `Work the order ${o.order.number} instead.` : "Open the resulting order.",
    };
  }
  if (o.stage === "LOST" && to !== "ENQUIRY") {
    return { ok: false, reason: "A lost opportunity is closed.", remedy: "Reopen it to Enquiry to work it again." };
  }
  if (to === "QUOTED" && o.quotations.length === 0) {
    return { ok: false, reason: "Quoted means a quotation exists. This opportunity has none.", remedy: "Build a quotation from the enquiry first." };
  }
  if (to === "NEGOTIATION" && o.liveQuotations.length === 0) {
    return {
      ok: false,
      reason: o.quotations.length === 0
        ? "Negotiation follows a live offer. This opportunity has no quotation."
        : "Every quotation on this opportunity has lapsed past validity, so there is nothing live to negotiate.",
      remedy: o.quotations.length === 0 ? "Build and issue a quotation." : "Revise the latest quotation to a new version with fresh validity.",
    };
  }
  if (to === "WON") {
    if (o.liveQuotations.length === 0) {
      return {
        ok: false,
        reason: o.quotations.length === 0
          ? "A win must be won against something. This opportunity has no quotation."
          : "The offer has lapsed past validity — an expired quotation cannot be won.",
        remedy: o.quotations.length === 0 ? "Build, issue and then win a quotation." : "Revise to a new version with fresh validity, issue it, then win it.",
      };
    }
  }
  if (to === "LOST" && !lossReason) {
    return { ok: false, reason: "A loss needs a structured reason.", remedy: "Pick a reason from the configured list; a competitor name is optional." };
  }
  return { ok: true };
}

/* ------------------------------------------------------------- customer */

export interface CustomerExposure {
  invoiced: number;
  receipts: number;
  creditNotes: number;
  debitNotes: number;
  outstanding: number;
  limit: number;
  exceeded: boolean;
  overBy: number;
  contributing: { invoice: T.Invoice; total: number; outstanding: number; days: number }[];
}

/**
 * E3-S2 AC-2 — outstanding = invoice totals − allocated receipts − credit notes.
 * Every component is returned so the figure can defend itself on screen.
 */
export function customerExposure(ds: Dataset, customerId: string, now: Date, limit: number): CustomerExposure {
  const invoices = ds.invoices.filter((i) => i.customerId === customerId);
  const ids = new Set(invoices.map((i) => i.id));
  const invoiced = invoices.reduce((s, i) => s + D.invoiceTotal(ds, i.id), 0);
  const receipts = ds.receiptAllocations.filter((a) => ids.has(a.invoiceId)).reduce((s, a) => s + a.amount, 0);
  const notes = ds.creditNotes.filter((c) => ids.has(c.invoiceId));
  const creditNotes = notes.filter((c) => c.kind === "CREDIT").reduce((s, c) => s + c.amount + c.gstAmount, 0);
  const debitNotes = notes.filter((c) => c.kind === "DEBIT").reduce((s, c) => s + c.amount + c.gstAmount, 0);

  const contributing = invoices
    .map((invoice) => ({
      invoice,
      total: D.invoiceTotal(ds, invoice.id),
      outstanding: D.invoiceOutstanding(ds, invoice.id),
      days: Math.max(0, daysBetween(invoice.date, now)),
    }))
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.days - a.days);

  const outstanding = contributing.reduce((s, r) => s + r.outstanding, 0);
  return {
    invoiced, receipts, creditNotes, debitNotes, outstanding, limit,
    exceeded: limit > 0 && outstanding > limit,
    overBy: Math.max(0, outstanding - limit),
    contributing,
  };
}

/* ------------------------------------------------------------ timeline */

export type TimelineKind =
  | "ENQUIRY" | "QUOTATION" | "ORDER" | "TICKET" | "VISIT"
  | "INVOICE" | "RECEIPT" | "ACTIVITY" | "AMC" | "DOCUMENT";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: Date;
  title: string;
  detail: string;
  actor: string;
  href: string | null;
  amount: number | null;
  mono?: string;
}

export interface TimelineOptions {
  invoices: boolean;
  tickets: boolean;
  documents: boolean;
}

export function buildTimeline(
  ds: Dataset,
  customerId: string,
  extra: {
    enquiries: T.Enquiry[];
    quotations: T.Quotation[];
    salesOrders: T.SalesOrder[];
    activities: T.Activity[];
  },
  opts: TimelineOptions,
): TimelineEvent[] {
  const userName = (id: string | null) => ds.users.find((u) => u.id === id)?.name ?? "System";
  const out: TimelineEvent[] = [];

  for (const e of extra.enquiries.filter((x) => x.customerId === customerId)) {
    out.push({
      id: `enq-${e.id}`, kind: "ENQUIRY", at: new Date(e.createdAt),
      title: `Enquiry ${e.number} raised`,
      detail: `${e.source.replace(/_/g, " ").toLowerCase()} · ${e.requirement}`,
      actor: userName(e.ownerUserId), href: `/sales/enquiries?focus=${e.id}`,
      amount: e.expectedValue, mono: e.number,
    });
  }
  for (const q of extra.quotations.filter((x) => x.customerId === customerId)) {
    out.push({
      id: `qt-${q.id}`, kind: "QUOTATION", at: new Date(q.quotationDate),
      title: `Quotation ${q.number} v${q.version} ${q.version > 1 ? "revised" : "raised"}`,
      detail: q.changeSummary ?? `${q.paymentTerms} · validity ${q.validityDays} days`,
      actor: userName(q.ownerUserId), href: `/sales/quotations/${q.id}`,
      amount: null, mono: `${q.number} v${q.version}`,
    });
  }
  for (const o of extra.salesOrders.filter((x) => x.customerId === customerId)) {
    out.push({
      id: `so-${o.id}`, kind: "ORDER", at: new Date(o.orderDate),
      title: `Sales order ${o.number} confirmed`,
      detail: `Customer PO ${o.customerPoRef} · ${o.deliverySchedule}`,
      actor: userName(o.ownerUserId), href: `/sales/orders/${o.id}`,
      amount: null, mono: o.number,
    });
  }
  for (const a of extra.activities.filter((x) => x.customerId === customerId)) {
    out.push({
      id: `act-${a.id}`, kind: "ACTIVITY", at: new Date(a.at),
      title: `${a.mode.charAt(0)}${a.mode.slice(1).toLowerCase()} — ${a.outcome}`,
      detail: a.notes + (a.nextActionDate ? ` · Next action ${formatDate(a.nextActionDate)}` : ""),
      actor: userName(a.byUserId), href: null, amount: null,
    });
  }
  if (opts.tickets) {
    for (const t of ds.tickets.filter((x) => x.customerId === customerId)) {
      out.push({
        id: `tk-${t.id}`, kind: "TICKET", at: new Date(t.loggedAt),
        title: `Service ticket ${t.number} — ${t.severity.toLowerCase()}`,
        detail: t.problem, actor: userName(t.assignedEngineerId),
        href: `/service/tickets/${t.id}`, amount: null, mono: t.number,
      });
    }
    for (const j of ds.jobCards.filter((x) => ds.tickets.some((t) => t.id === x.ticketId && t.customerId === customerId))) {
      if (!j.checkInAt) continue;
      out.push({
        id: `jc-${j.id}`, kind: "VISIT", at: new Date(j.checkInAt),
        title: `Field visit ${j.number}`,
        detail: j.workPerformed || j.observations || "Site visit recorded",
        actor: userName(j.engineerUserId), href: `/service/job-cards/${j.id}`,
        amount: null, mono: j.number,
      });
    }
  }
  if (opts.invoices) {
    for (const i of ds.invoices.filter((x) => x.customerId === customerId)) {
      out.push({
        id: `inv-${i.id}`, kind: "INVOICE", at: new Date(i.date),
        title: `Tax invoice ${i.number}`,
        detail: `${i.type.replace(/_/g, " ").toLowerCase()} · due ${formatDate(i.dueDate)}`,
        actor: userName(i.ownerUserId), href: `/commercial/invoices/${i.id}`,
        amount: D.invoiceTotal(ds, i.id), mono: i.number,
      });
    }
    for (const r of ds.receipts.filter((x) => x.customerId === customerId)) {
      out.push({
        id: `rc-${r.id}`, kind: "RECEIPT", at: new Date(r.date),
        title: `Receipt ${r.number} — ${r.mode}`,
        detail: r.reference, actor: userName(r.byUserId),
        href: `/commercial/receipts/${r.id}`, amount: r.amount, mono: r.number,
      });
    }
  }
  for (const a of ds.amcContracts.filter((x) => x.customerId === customerId)) {
    out.push({
      id: `amc-${a.id}`, kind: "AMC", at: new Date(a.startDate),
      title: `AMC ${a.number} commenced`,
      detail: `${a.coverage.replace(/_/g, "-").toLowerCase()} · ${a.visitsPerYear} visits/year`,
      actor: userName(a.ownerUserId), href: `/service/amc/${a.id}`,
      amount: a.contractValue, mono: a.number,
    });
  }
  if (opts.documents) {
    for (const d of ds.documents.filter((x) => x.linkedType === "CUSTOMER" && x.linkedId === customerId)) {
      out.push({
        id: `doc-${d.id}`, kind: "DOCUMENT", at: new Date(d.uploadedAt),
        title: `Document — ${d.title}`,
        detail: `${d.type.replace(/_/g, " ").toLowerCase()} · v${d.version}`,
        actor: userName(d.ownerUserId), href: `/vault?doc=${d.id}`, amount: null,
      });
    }
  }

  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/* -------------------------------------------------------------- helpers */

export function groupBy<V, K>(list: readonly V[], key: (v: V) => K): Map<K, V[]> {
  const m = new Map<K, V[]>();
  for (const v of list) {
    const k = key(v);
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  }
  return m;
}

/** Deterministic 32-bit FNV-1a — the baseline activity set must be reproducible. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const ACTIVITY_MODES = ["CALL", "VISIT", "EMAIL", "WHATSAPP"] as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[number];

export const FOLLOW_UP_OUTCOMES = [
  "Spoke to buyer — evaluating",
  "Technical clarification given",
  "Awaiting budget approval",
  "Site survey scheduled",
  "Comparing with competitor offer",
  "Asked for revised commercials",
  "No response — retry",
  "Ready to place order",
];

/**
 * The seed ships no activity rows, so the desk, the timeline and the Qualified
 * column would all read empty. This produces a reproducible baseline from the
 * dataset itself — same seed, same follow-ups, every run. Anything the user
 * records is stored on top of it.
 */
export function baselineActivities(
  enquiries: T.Enquiry[],
  quotations: T.Quotation[],
  now: Date,
): T.Activity[] {
  const out: T.Activity[] = [];
  const today = startOfDay(now);
  let n = 0;

  const push = (
    subjectType: T.Activity["subjectType"], subjectId: string, customerId: string,
    byUserId: string, at: Date, seed: number,
  ) => {
    n++;
    const mode = ACTIVITY_MODES[seed % ACTIVITY_MODES.length]!;
    const outcome = FOLLOW_UP_OUTCOMES[(seed >> 3) % FOLLOW_UP_OUTCOMES.length]!;
    const bucket = seed % 7;
    let next: Date | null;
    if (bucket === 0) next = today;
    else if (bucket === 1) next = new Date(today.getTime() - (1 + (seed % 9)) * DAY_MS);
    else if (bucket === 2) next = null;
    else next = new Date(today.getTime() + (1 + (seed % 20)) * DAY_MS);
    out.push({
      id: `ACTB-${String(n).padStart(4, "0")}`,
      subjectType, subjectId, customerId, mode, outcome,
      notes: `${outcome}. Logged from the ${mode.toLowerCase()} channel.`,
      nextActionDate: next ? next.toISOString() : null,
      byUserId, at: at.toISOString(),
    });
  };

  for (const e of enquiries) {
    if (!e.ownerUserId) continue;
    if (e.status === "WON" || e.status === "LOST" || e.status === "DROPPED") continue;
    const h = hash32(e.id);
    const count = h % 3;
    for (let k = 0; k < count; k++) {
      const at = new Date(
        Math.min(now.getTime() - DAY_MS, new Date(e.createdAt).getTime() + (k + 1) * (3 + (h % 11)) * DAY_MS),
      );
      push("ENQUIRY", e.id, e.customerId, e.ownerUserId, at, h + k * 977);
    }
  }
  for (const q of quotations) {
    if (q.status !== "ISSUED" && q.status !== "NEGOTIATION") continue;
    const h = hash32(q.id);
    if (h % 2 === 0) continue;
    const at = new Date(Math.min(now.getTime() - DAY_MS, new Date(q.quotationDate).getTime() + (2 + (h % 9)) * DAY_MS));
    push("QUOTATION", q.id, q.customerId, q.ownerUserId, at, h);
  }
  return out;
}

/* ------------------------------------------------------------- targets */

export interface TargetProgress {
  target: T.Target | null;
  targetAmount: number;
  achieved: number;
  pct: number;
  source: string;
  periodLabel: string;
  orders: T.SalesOrder[];
}

export function targetProgress(
  ds: Dataset,
  salesOrders: T.SalesOrder[],
  salesOrderLines: T.SalesOrderLine[],
  userId: string,
  branchId: string,
  now: Date,
): TargetProgress {
  const inPeriod = (t: T.Target) =>
    new Date(t.periodStart).getTime() <= now.getTime() && new Date(t.periodEnd).getTime() >= now.getTime();
  const personal = ds.targets.find((t) => t.userId === userId && inPeriod(t));
  const branch = ds.targets.find((t) => t.branchId === branchId && inPeriod(t));
  const target = personal ?? branch ?? null;

  const from = target ? new Date(target.periodStart) : D.fyToDate(now).from;
  const to = target ? new Date(target.periodEnd) : now;
  const scopePersonal = !!personal;

  const orders = salesOrders.filter((o) => {
    const d = new Date(o.orderDate).getTime();
    if (d < from.getTime() || d > Math.min(to.getTime(), now.getTime())) return false;
    return scopePersonal ? o.ownerUserId === userId : o.branchId === branchId;
  });
  const linesByOrder = groupBy(salesOrderLines, (l) => l.salesOrderId);
  const achieved = orders.reduce(
    (s, o) => s + (linesByOrder.get(o.id) ?? []).reduce((x, l) => x + l.qty * l.rate, 0),
    0,
  );
  const amount = target?.amount ?? 0;
  return {
    target, targetAmount: amount, achieved: Math.round(achieved),
    pct: amount ? Math.round((achieved / amount) * 100) : 0,
    source: target
      ? `${target.label} — held in Admin › Masters › Sales targets (FR-M3-22)`
      : "No target set for this user or branch in the current period",
    periodLabel: `${formatDate(from)} – ${formatDate(to)}`,
    orders,
  };
}

/* ----------------------------------------------------------- vocabulary */

export const LOSS_REASONS: { value: T.Quotation["lossReason"]; label: string }[] = [
  { value: "PRICE", label: "Price" },
  { value: "DELIVERY_LEAD_TIME", label: "Delivery lead time" },
  { value: "TECHNICAL_FIT", label: "Technical fit" },
  { value: "COMPETITOR_RELATIONSHIP", label: "Competitor relationship" },
  { value: "BUDGET_WITHDRAWN", label: "Budget withdrawn" },
  { value: "NO_DECISION", label: "No decision" },
  { value: "OTHER", label: "Other" },
];

export const VERTICALS: Vertical[] = ["EQUIPMENT_SALES", "SERVICE_AMC", "PROJECTS", "RENTAL"];

export const GSTIN_PATTERN = "99AAAAA9999A9Z9";
export const GSTIN_HINT =
  "15 characters — 2-digit state code, 10-character PAN, 1 entity digit, letter Z, 1 checksum character.";
