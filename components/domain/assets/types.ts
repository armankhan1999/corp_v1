import type {
  AMCCoverage,
  AMCStatus,
  AssetStatus,
  CommissioningSubmission,
  CoverageState,
  OEMPrincipal,
  ProductLine,
  RootCause,
} from "@/lib/schemas/enums";

/**
 * Wire shapes for Epic E5. Server components project the seeded dataset into
 * these plain records; client components apply the localStorage overlay on top.
 * Nothing here is authoritative — `lib/derive` remains the single source of
 * every derived value computed on the server (AR-1).
 */

export interface AssetRow {
  id: string;
  serial: string;
  principal: OEMPrincipal;
  productLine: ProductLine;
  model: string;
  capacityValue: number;
  capacityUnit: string;
  ratedKw: number | null;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  siteDistrict: string;
  locationInSite: string;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  saleInvoiceId: string | null;
  saleInvoiceNumber: string | null;
  installationDate: string | null;
  commissioningDate: string | null;
  warrantyMonths: number;
  /** Derived on the server via D.warrantyEnd — commissioning date + duration. */
  warrantyEnd: string | null;
  runningHours: number;
  runningHoursAt: string;
  status: AssetStatus;
  branchId: string;
  branchCode: string;
  branchName: string;
  decommissionReason: string | null;
  /** Derived on the server via D.coverageState. Never editable. */
  coverage: CoverageState;
  /** A live AMC, if one exists — shown as additionally in force in warranty. */
  amcId: string | null;
  amcNumber: string | null;
  amcStart: string | null;
  amcEnd: string | null;
  openTickets: number;
  totalTickets: number;
  lastServiceAt: string | null;
  commissioningReportId: string | null;
  commissioningNumber: string | null;
  commissioningDeadline: string | null;
  commissioningSubmission: CommissioningSubmission | null;
  /** Local record only — set when this row was created in the browser. */
  local?: boolean;
}

export interface CustomerOption {
  id: string;
  name: string;
  branchId: string;
  sites: { id: string; name: string; district: string }[];
}

export interface ItemOption {
  id: string;
  code: string;
  description: string;
  principal: OEMPrincipal;
  productLine: ProductLine | null;
}

export interface InvoiceOption {
  id: string;
  number: string;
  customerId: string;
  date: string;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
}

/** E5-S1 — an asset generated from a sales-order line re-enters nothing. */
export interface OrderLineOption {
  lineId: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  customerId: string;
  customerName: string;
  siteId: string | null;
  siteName: string | null;
  itemId: string;
  itemCode: string;
  description: string;
  qty: number;
  branchId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  principal: OEMPrincipal;
  productLine: ProductLine | null;
  capacityUnit: string;
  warrantyMonths: number;
}

export interface ProductLineConfig {
  productLine: ProductLine;
  principal: OEMPrincipal;
  warrantyMonths: number;
  capacityUnit: string;
  series: string;
}

/* ------------------------------------------------------------- passport */

export interface TicketRow {
  id: string;
  number: string;
  category: string;
  severity: string;
  status: string;
  problem: string;
  coverage: string;
  coverageBasis: string;
  loggedAt: string;
  closedAt: string | null;
  breached: boolean;
  rootCauses: RootCause[];
}

export interface VisitRow {
  id: string;
  number: string;
  ticketId: string;
  ticketNumber: string;
  visitType: string;
  scheduledDate: string;
  engineerName: string;
  outcome: string | null;
  rootCause: RootCause | null;
  workPerformed: string;
  observations: string;
  runningHoursReading: number | null;
  resolvedOnThisVisit: boolean;
  submittedAt: string | null;
}

export interface PartRow {
  id: string;
  itemCode: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  billable: boolean;
  at: string;
  jobCardId: string;
  jobCardNumber: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  type: string;
  uploadedAt: string;
  version: number;
  sizeKb: number;
  pageCount: number;
}

export interface CoverageBand {
  kind: "WARRANTY" | "AMC" | "GAP";
  label: string;
  from: string;
  to: string;
  live: boolean;
}

/* -------------------------------------------------------- commissioning */

export interface ChecklistEntry {
  item: string;
  pass: boolean;
  remark: string;
}

export interface CommissioningRow {
  id: string;
  number: string;
  assetId: string;
  serial: string;
  model: string;
  principal: OEMPrincipal;
  customerId: string;
  customerName: string;
  siteName: string;
  branchId: string;
  branchCode: string;
  commissioningDate: string;
  windowDays: number;
  deadline: string;
  submittedAt: string | null;
  acknowledgementRef: string | null;
  submission: CommissioningSubmission;
  engineerName: string;
  warrantyMonths: number;
  warrantyEnd: string | null;
  cleanReport: boolean;
  failedItems: number;
  local?: boolean;
}

export interface CommissioningDetail extends CommissioningRow {
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
  installationDate: string | null;
  locationInSite: string;
  siteAddress: string;
  capacityValue: number;
  capacityUnit: string;
  ratedKw: number | null;
  itemCode: string;
}

/* -------------------------------------------------------------------- AMC */

export interface AmcVisitRow {
  id: string;
  assetId: string;
  serial: string;
  sequence: number;
  dueDate: string;
  completedAt: string | null;
  ticketId: string | null;
  ticketNumber: string | null;
  local?: boolean;
}

export interface AmcRow {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchCode: string;
  assetIds: string[];
  assetSerials: string[];
  coverage: AMCCoverage;
  startDate: string;
  endDate: string;
  contractValue: number;
  billingSchedule: string;
  visitsPerYear: number;
  responseHours: number;
  restorationHours: number;
  inclusions: string;
  exclusions: string;
  ownerUserId: string;
  ownerName: string;
  terminated: boolean;
  terminationReason: string | null;
  renewedIntoId: string | null;
  renewalQuotationId: string | null;
  /** Derived on the server via D.amcStatus. Never manually set except Terminated. */
  status: AMCStatus;
  committedVisits: number;
  completedVisits: number;
  dueToDate: number;
  daysRemaining: number;
  local?: boolean;
}

export interface AmcAssetOption {
  id: string;
  serial: string;
  model: string;
  customerId: string;
  branchId: string;
  coverage: CoverageState;
  status: AssetStatus;
  ratedKw: number | null;
}

/* --------------------------------------------------------------- renewals */

export interface WarrantyOpportunityRow {
  assetId: string;
  serial: string;
  model: string;
  principal: OEMPrincipal;
  customerId: string;
  customerName: string;
  siteName: string;
  branchId: string;
  branchCode: string;
  warrantyEnd: string;
  daysRemaining: number;
  tickets: number;
  visits: number;
  partsSpend: number;
  lastServiceAt: string | null;
  estimatedAmcValue: number;
}

export interface UncoveredRow {
  assetId: string;
  serial: string;
  model: string;
  principal: OEMPrincipal;
  customerId: string;
  customerName: string;
  siteName: string;
  branchId: string;
  branchCode: string;
  monthsSinceLastService: number | null;
  lastServiceAt: string | null;
  estimatedAmcValue: number;
  status: AssetStatus;
}

/* ----------------------------------------------------------------- rental */

export interface RentalAgreementRow {
  id: string;
  number: string;
  rentalAssetId: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  startDate: string;
  expectedReturn: string;
  actualReturn: string | null;
  rateBasis: string;
  rate: number;
  deposit: number;
  returnCondition: string | null;
  damageNote: string | null;
  local?: boolean;
}

export interface RentalAssetRow {
  id: string;
  serial: string;
  model: string;
  capacityValue: number;
  capacityUnit: string;
  condition: string;
  branchId: string;
  branchCode: string;
  availableFrom: string;
  itemCode: string;
}
