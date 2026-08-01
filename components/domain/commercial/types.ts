import type {
  CustomerType, InvoiceType, PaymentMode, Role, TaxTreatment,
} from "@/lib/schemas/enums";
import type { AgeingBucket } from "@/lib/derive";

/**
 * Epic E8 — Commercial. Serialisable row models.
 *
 * Every screen in this epic is a server component that shapes the seeded world
 * into these plain objects and hands them to a client component. The seed
 * generator never crosses the network boundary, and nothing here holds a Date,
 * a class instance or a function, so React can serialise it.
 */

export type TransportMode = "ROAD" | "RAIL" | "AIR" | "SHIP";
export type ChallanSourceType = "SALES_ORDER" | "PROJECT" | "RENTAL" | "SERVICE_PART";
export type NoteKind = "CREDIT" | "DEBIT";
export type FollowUpMode = "CALL" | "VISIT" | "EMAIL" | "WHATSAPP";

/* ------------------------------------------------------------------ actor */

export interface Actor {
  userId: string;
  name: string;
  role: Role;
  branchId: string;
  /** Derived from the RBAC matrix on the server; the client never decides this. */
  canWrite: boolean;
}

/* --------------------------------------------------------------- settings */

/**
 * Held in Masters in production (FR-M7-07, FR-M7-08, FR-M7-09, FR-M7-19).
 * Until the Masters screen owns them, the values live in the commercial
 * overlay so that every acceptance criterion about "the configured value"
 * is demonstrable: change it here and every open document recomputes.
 */
export interface CommercialSettings {
  /** FR-M7-07 — statutory e-invoice reporting window, in days from invoice date. */
  eInvoiceWindowDays: number;
  /** FR-M7-08 — consignment value at or below which no e-way bill is required. */
  ewayThreshold: number;
  /** FR-M7-09 — maximum permitted age of the base document, in days. */
  ewayMaxBaseAgeDays: number;
  /** Part-B validity: one day per this many kilometres, minimum one day. */
  ewayKmPerValidityDay: number;
  /** Days before the reporting deadline at which an invoice is flagged. */
  eInvoiceWarnDays: number;
}

export const DEFAULT_SETTINGS: CommercialSettings = {
  eInvoiceWindowDays: 30,
  ewayThreshold: 50_000,
  ewayMaxBaseAgeDays: 180,
  ewayKmPerValidityDay: 200,
  eInvoiceWarnDays: 7,
};

/* ------------------------------------------------------------------ lines */

export interface LineRow {
  id: string;
  itemId: string | null;
  description: string;
  hsnSac: string;
  uom: string;
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
  /** round(qty · rate · (1 − discount)) — reconciles with D.invoiceTaxable. */
  taxable: number;
  /** round(qty · rate · (1 + gst)) − taxable — reconciles with D.invoiceTotal. */
  tax: number;
  total: number;
}

/* --------------------------------------------------------------- invoices */

export interface InvoiceRow {
  id: string;
  number: string;
  type: InvoiceType;
  date: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  customerGstin: string | null;
  customerCountry: string;
  siteId: string | null;
  siteName: string;
  siteAddress: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  placeOfSupplyStateCode: string;
  placeOfSupplyName: string;
  taxTreatment: TaxTreatment;
  /** Σ line taxable. */
  taxable: number;
  /** Σ line tax. */
  tax: number;
  /** taxable + tax, matching D.invoiceTotal to the rupee. */
  total: number;
  roundOff: number;
  /** Σ receipt allocations in the seed. Overlay allocations add to this. */
  allocatedSeed: number;
  creditedSeed: number;
  debitedSeed: number;
  /** D.invoiceOutstanding before the overlay is applied. */
  outstandingSeed: number;
  daysOutstanding: number;
  daysPastDue: number;
  bucket: AgeingBucket;
  irn: string | null;
  ackNumber: string | null;
  ackDate: string | null;
  irpReportedAt: string | null;
  eInvoiceApplicable: boolean;
  eInvoiceExemptReason: string | null;
  ownerUserId: string;
  ownerName: string;
  /** The customer's account executive — the collections owner, and a filter. */
  accountExecutiveId: string;
  accountExecutiveName: string;
  source: SourceRef | null;
  /** True for anything the overlay created in this browser. */
  simulated: boolean;
}

export interface SourceRef {
  kind: "SALES_ORDER" | "JOB_CARD" | "AMC_CONTRACT" | "RA_BILL" | "RENTAL_AGREEMENT" | "CHALLAN";
  id: string;
  label: string;
  href: string | null;
  /** Set when the link was created in this browser rather than seeded. */
  linkedHere?: boolean;
}

/* --------------------------------------------------------------- challans */

export interface ChallanRow {
  id: string;
  number: string;
  date: string;
  customerId: string;
  customerName: string;
  customerGstin: string | null;
  siteId: string;
  siteName: string;
  siteAddress: string;
  siteStateCode: string;
  siteState: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  sourceType: ChallanSourceType;
  sourceId: string;
  sourceLabel: string;
  reasonForTransportation: string;
  transportMode: TransportMode;
  vehicleNumber: string;
  transporter: string;
  transporterGstin: string;
  lrNumber: string;
  approxDistanceKm: number;
  lines: ChallanLineRow[];
  /** Σ qty × unit taxable value — the consignment value the threshold tests. */
  consignmentValue: number;
  ageDays: number;
  ewayBillId: string | null;
  simulated: boolean;
}

export interface ChallanLineRow {
  itemId: string;
  description: string;
  hsnSac: string;
  uom: string;
  qty: number;
  /** Per-unit taxable value, as held in the seed. */
  taxableValue: number;
  lineValue: number;
}

/* ------------------------------------------------------------ e-way bills */

export interface EwayRow {
  id: string;
  ebn: string;
  baseDocType: "INVOICE" | "CHALLAN";
  baseDocId: string;
  baseDocNumber: string;
  baseDocDate: string;
  customerName: string;
  supplyType: "OUTWARD" | "INWARD";
  subType: string;
  transportMode: TransportMode;
  distanceKm: number;
  transporter: string;
  vehicleNumber: string;
  generatedAt: string;
  validUntil: string;
  consignmentValue: number;
  simulated: boolean;
}

/* ------------------------------------------------------- receipts & notes */

export interface ReceiptRow {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchCode: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  simulatedUpi: boolean;
  byUserId: string;
  byName: string;
  allocationsSeed: { id: string; invoiceId: string; invoiceNumber: string; amount: number }[];
  allocatedSeed: number;
  simulated: boolean;
}

export interface NoteRow {
  id: string;
  number: string;
  kind: NoteKind;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  reason: string;
  amount: number;
  gstAmount: number;
  byUserId: string;
  byName: string;
  simulated: boolean;
}

export interface FollowUpRow {
  id: string;
  invoiceId: string;
  date: string;
  mode: FollowUpMode;
  personSpokenTo: string;
  outcome: string;
  promisedDate: string | null;
  promisedAmount: number | null;
  fulfilled: boolean;
  byUserId: string;
  byName: string;
  simulated: boolean;
}

/* ------------------------------------------------------- numbering series */

export interface SeriesRow {
  id: string;
  docType: string;
  label: string;
  prefix: string;
  fySegment: string;
  width: number;
  issued: number;
  highest: number;
  next: number;
  nextNumber: string;
  /** Sequence numbers between 1 and highest that were never issued. */
  gaps: number[];
  /** Document numbers issued more than once. */
  duplicates: string[];
}

/* ------------------------------------------------- source-document pickers */

export interface SourceOption {
  kind: SourceRef["kind"];
  id: string;
  label: string;
  customerId: string;
  customerName: string;
  date: string;
  value: number;
  detail: string;
  /** Pre-populated lines, so an invoice raised from a source needs no re-entry. */
  lines: { description: string; hsnSac: string; uom: string; qty: number; rate: number; gstRate: number }[];
}

/* -------------------------------------------------------------- reference */

export interface CustomerRef {
  id: string;
  name: string;
  type: CustomerType;
  gstin: string | null;
  country: string;
  creditTermDays: number;
  branchId: string;
  accountExecutiveId: string;
  siteId: string | null;
  siteName: string;
  siteAddress: string;
  stateCode: string;
  stateName: string;
}

export interface BranchRef { id: string; code: string; name: string; gstin: string; address: string }
export interface UserRef { id: string; name: string; role: Role }

/* ------------------------------------------------------------------ misc */

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  EQUIPMENT: "Equipment sale",
  SPARES: "Spares sale",
  SERVICE: "Chargeable service",
  AMC: "AMC billing",
  RENTAL: "Rental billing",
  PROJECT_RA: "Project RA-bill",
};

export const INVOICE_TYPE_SOURCE: Record<InvoiceType, { kind: SourceRef["kind"]; label: string }> = {
  EQUIPMENT: { kind: "SALES_ORDER", label: "Sales order" },
  SPARES: { kind: "SALES_ORDER", label: "Sales order" },
  SERVICE: { kind: "JOB_CARD", label: "Service billing summary (job card)" },
  AMC: { kind: "AMC_CONTRACT", label: "AMC billing schedule" },
  RENTAL: { kind: "RENTAL_AGREEMENT", label: "Rental agreement" },
  PROJECT_RA: { kind: "RA_BILL", label: "Certified RA-bill" },
};

export const SOURCE_KIND_LABEL: Record<SourceRef["kind"], string> = {
  SALES_ORDER: "Sales order",
  JOB_CARD: "Job card",
  AMC_CONTRACT: "AMC contract",
  RA_BILL: "RA-bill",
  RENTAL_AGREEMENT: "Rental agreement",
  CHALLAN: "Delivery challan",
};

export const CHALLAN_SOURCE_LABEL: Record<ChallanSourceType, string> = {
  SALES_ORDER: "Sales order",
  PROJECT: "Project supply",
  RENTAL: "Rental despatch",
  SERVICE_PART: "Service part despatch",
};

export const TRANSPORT_MODE_LABEL: Record<TransportMode, string> = {
  ROAD: "Road", RAIL: "Rail", AIR: "Air", SHIP: "Ship",
};

export const FOLLOWUP_MODE_LABEL: Record<FollowUpMode, string> = {
  CALL: "Telephone call", VISIT: "Site visit", EMAIL: "Email", WHATSAPP: "WhatsApp",
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  NEFT: "NEFT", RTGS: "RTGS", CHEQUE: "Cheque", UPI: "UPI", CASH: "Cash", ADJUSTMENT: "Adjustment",
};

export const BUCKET_LABEL: Record<AgeingBucket, string> = {
  B0_30: "0–30 days", B31_60: "31–60 days", B61_90: "61–90 days", B90_PLUS: "90+ days",
};

export const BUCKET_ORDER: AgeingBucket[] = ["B0_30", "B31_60", "B61_90", "B90_PLUS"];

/** Institutional and government read as one exposure segment. FR-M7-14. */
export const INSTITUTIONAL_TYPES: CustomerType[] = ["INSTITUTIONAL", "GOVERNMENT"];
