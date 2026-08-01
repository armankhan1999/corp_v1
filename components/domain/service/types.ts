import type {
  CoverageType, JobOutcome, RootCause, TicketCategory, TicketSeverity, TicketStatus,
  OEMPrincipal, ProductLine, SLAState,
} from "@/lib/schemas/enums";

/**
 * Epic E4 view models.
 *
 * Server components read the seeded dataset once and hand these compact,
 * fully-serialisable projections to the client surfaces. Timestamps travel as
 * epoch milliseconds so nothing depends on a Date crossing the boundary.
 *
 * No derivation lives here — SLA banding stays in `@/lib/derive`, coverage in
 * `D.coverageState`, formatting in `@/lib/format`. This file is shape only.
 */

/* ------------------------------------------------------------------ shared */

export interface SiteView {
  id: string;
  name: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  contactPerson: string;
  contactPhone: string;
  notes: string;
}

export interface AssetView {
  id: string;
  serial: string;
  principal: OEMPrincipal;
  productLine: ProductLine;
  model: string;
  capacityValue: number;
  capacityUnit: string;
  ratedKw: number | null;
  locationInSite: string;
  runningHours: number;
  runningHoursAtMs: number;
  commissioningDateMs: number | null;
  warrantyMonths: number;
  status: string;
}

export interface EngineerView {
  id: string;
  name: string;
  code: string;
  branchId: string;
  branchName: string;
  phone: string;
  dailyCapacity: number;
  oemCertifications: OEMPrincipal[];
  /** Open tickets already on this engineer today. Derived, never entered. */
  loadToday: number;
  /** Derived from the most advanced status among their open tickets. */
  statusLabel: string;
  statusTone: "ok" | "warn" | "danger" | "info" | "neutral";
}

/* ------------------------------------------------------------------- SLA */

export type SlaRuleSource = "AMC" | "OEM" | "SEVERITY";

/** One rung of the precedence ladder, shown whether or not it was the winner. */
export interface SlaLadderRung {
  source: SlaRuleSource;
  label: string;
  responseHours: number | null;
  restorationHours: number | null;
  applies: boolean;
  /** Why this rung did or did not win — printed, never implied. */
  reason: string;
  definitionId: string | null;
  businessHoursOnly: boolean;
  pauseOnAwaitingParts: boolean;
  pauseOnAwaitingCustomer: boolean;
}

export interface SlaResolution {
  ladder: SlaLadderRung[];
  appliedSource: SlaRuleSource;
  ruleApplied: string;
  responseHours: number;
  restorationHours: number;
  businessHoursOnly: boolean;
  pauseOnAwaitingParts: boolean;
  pauseOnAwaitingCustomer: boolean;
  definitionId: string | null;
}

/** One evaluated test in the coverage derivation, shown as evidence. */
export interface CoverageStep {
  test: string;
  outcome: string;
  passed: boolean;
}

export interface CoverageDerivation {
  coverage: CoverageType;
  basis: string;
  steps: CoverageStep[];
  amcContractId: string | null;
  amcNumber: string | null;
  amcCoverage: "COMPREHENSIVE" | "NON_COMPREHENSIVE" | null;
  warrantyEndMs: number | null;
  /** True where work must be quoted or approved before it starts. */
  requiresApproval: boolean;
}

/* --------------------------------------------------------------- tickets */

export interface TicketView {
  id: string;
  number: string;
  status: TicketStatus;
  severity: TicketSeverity;
  category: TicketCategory;
  problem: string;
  channel: string;

  customerId: string;
  customerName: string;
  customerType: string;

  site: SiteView;
  asset: AssetView;

  contactName: string | null;
  contactDesignation: string | null;
  contactPhone: string | null;

  branchId: string;
  branchName: string;
  branchPhone: string;
  branchLat: number;
  branchLng: number;

  engineerId: string | null;
  engineerName: string | null;
  assignmentOverrideReason: string | null;

  coverage: CoverageType;
  coverageBasis: string;
  amcContractId: string | null;
  amcNumber: string | null;
  amcCoverage: "COMPREHENSIVE" | "NON_COMPREHENSIVE" | null;

  loggedAtMs: number;
  responseDueMs: number;
  restorationDueMs: number;
  firstResponseAtMs: number | null;
  restoredAtMs: number | null;
  closedAtMs: number | null;
  breachedAtMs: number | null;
  breachReasonCode: string | null;
  pausedMs: number;
  pauseStartedAtMs: number | null;

  slaRuleApplied: string;
  slaBusinessHours: boolean;
  slaResponseHours: number;
  slaRestorationHours: number;
  pauseOnAwaitingParts: boolean;
  pauseOnAwaitingCustomer: boolean;

  /** Present for tickets raised in this session from the intake form. */
  sessionCreated?: boolean;
  /** Kept with the record so the detail screen can show the same working. */
  sessionLadder?: SlaLadderRung[];
  sessionCoverage?: CoverageDerivation;
}

/* -------------------------------------------------------------- job cards */

export interface PartLineView {
  id: string;
  jobCardId: string;
  itemId: string;
  itemCode: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  cost: number;
  gstRate: number;
  billable: boolean;
  locationId: string;
  locationName: string;
  movementId: string | null;
  returned: boolean;
  sessionAdded?: boolean;
}

export interface SignatureStroke {
  points: { x: number; y: number }[];
}

export interface PhotoView {
  caption: string;
  tone: string;
}

export interface JobCardView {
  id: string;
  number: string;
  ticketId: string;
  ticketNumber: string;
  assetId: string;
  assetSerial: string;
  assetModel: string;
  assetProductLine: ProductLine;
  assetPrincipal: OEMPrincipal;
  customerId: string;
  customerName: string;
  siteName: string;
  siteAddress: string;
  branchName: string;

  engineerId: string;
  engineerName: string;
  visitSequence: number;
  visitType: string;
  scheduledDateMs: number;

  checkInAtMs: number | null;
  checkOutAtMs: number | null;
  checkInPlace: string | null;
  checkInLat: number | null;
  checkInLng: number | null;

  observations: string;
  rootCause: RootCause | null;
  workPerformed: string;
  runningHoursReading: number | null;
  meterReplacementNote: string | null;
  nextVisitRecommendation: string;
  outcome: JobOutcome | null;

  customerAckName: string | null;
  customerAckDesignation: string | null;
  /** Session captures store strokes; seeded records store a reference token. */
  signatureStrokes: SignatureStroke[] | null;
  signatureRef: string | null;

  photos: PhotoView[];
  labourAmount: number;
  travelAmount: number;
  submittedAtMs: number | null;
  tapCount: number | null;

  coverage: CoverageType;
  coverageBasis: string;
  amcCoverage: "COMPREHENSIVE" | "NON_COMPREHENSIVE" | null;

  /** Highest reading previously recorded against this asset. Validation basis. */
  previousReading: number | null;
  previousReadingAtMs: number | null;
  previousReadingSource: string | null;

  sessionCreated?: boolean;
}

/* ------------------------------------------------------------------ stock */

export interface StockItemView {
  id: string;
  code: string;
  description: string;
  uom: string;
  gstRate: number;
  standardCost: number;
  standardPrice: number;
  productLine: ProductLine | null;
  principal: OEMPrincipal;
  reorderLevel: number;
  onHand: Record<string, number>;
  serviceCritical: boolean;
}

export interface StockLocationView {
  id: string;
  code: string;
  name: string;
  kind: string;
}

/* ------------------------------------------------------- preventive work */

export interface PlannedVisitView {
  id: string;
  amcContractId: string;
  amcNumber: string;
  assetId: string;
  assetSerial: string;
  assetModel: string;
  customerName: string;
  siteName: string;
  siteDistrict: string;
  branchId: string;
  branchName: string;
  dueDateMs: number;
  sequence: number;
  visitsPerYear: number;
}

/* ----------------------------------------------------------------- labels */

export const SEVERITY_TONE: Record<TicketSeverity, "danger" | "warn" | "info" | "neutral"> = {
  CRITICAL: "danger",
  HIGH: "warn",
  NORMAL: "info",
  LOW: "neutral",
};

export const SEVERITY_LABEL: Record<TicketSeverity, string> = {
  CRITICAL: "Critical — production stopped",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export const SEVERITY_SHORT: Record<TicketSeverity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export const COVERAGE_LABEL: Record<CoverageType, string> = {
  IN_WARRANTY: "Warranty",
  UNDER_AMC: "AMC",
  CHARGEABLE: "Chargeable",
};

export const COVERAGE_TONE: Record<CoverageType, "ok" | "info" | "warn"> = {
  IN_WARRANTY: "ok",
  UNDER_AMC: "info",
  CHARGEABLE: "warn",
};

export const OUTCOME_LABEL: Record<JobOutcome, string> = {
  RESOLVED: "Resolved",
  PARTIALLY_RESOLVED: "Partially resolved",
  PARTS_AWAITED: "Parts awaited",
  REVISIT_REQUIRED: "Revisit required",
  NOT_ATTENDED: "Not attended",
};

export const OUTCOME_TONE: Record<JobOutcome, "ok" | "warn" | "danger" | "neutral"> = {
  RESOLVED: "ok",
  PARTIALLY_RESOLVED: "warn",
  PARTS_AWAITED: "warn",
  REVISIT_REQUIRED: "warn",
  NOT_ATTENDED: "danger",
};

export const ROOT_CAUSE_LABEL: Record<RootCause, string> = {
  AIR_END_WEAR: "Air end wear",
  OIL_LEAK: "Oil leak",
  FILTER_CHOKED: "Filter choked",
  BELT_SLIP: "Belt slip",
  MOTOR_OVERLOAD: "Motor overload",
  PRESSURE_SWITCH: "Pressure switch",
  VALVE_FAILURE: "Valve failure",
  COOLER_FOULING: "Cooler fouling",
  CONTROLLER_FAULT: "Controller fault",
  SEAL_FAILURE: "Seal failure",
  IMPELLER_WEAR: "Impeller wear",
  ELECTRICAL_SUPPLY: "Electrical supply",
  OPERATOR_ERROR: "Operator error",
  SCHEDULED_SERVICE: "Scheduled service",
  OTHER: "Other",
};

export const SLA_STATE_LABEL: Record<SLAState, string> = {
  COMFORTABLE: "Comfortable",
  APPROACHING: "Approaching",
  IMMINENT: "Imminent",
  BREACHED: "Breached",
};

/** Lane order for the dispatch board. E4-S3 names these exactly. */
export const DISPATCH_LANES: { status: TicketStatus; label: string }[] = [
  { status: "LOGGED", label: "Logged" },
  { status: "ASSIGNED", label: "Assigned" },
  { status: "EN_ROUTE", label: "En route" },
  { status: "ON_SITE", label: "On site" },
  { status: "AWAITING_PARTS", label: "Awaiting parts" },
  { status: "AWAITING_CUSTOMER", label: "Awaiting customer" },
  { status: "RESOLVED", label: "Resolved" },
];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  LOGGED: "Logged",
  ASSIGNED: "Assigned",
  EN_ROUTE: "En route",
  ON_SITE: "On site",
  AWAITING_PARTS: "Awaiting parts",
  AWAITING_CUSTOMER: "Awaiting customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  BREAKDOWN: "Breakdown",
  PREVENTIVE_MAINTENANCE: "Preventive maintenance",
  INSTALLATION_COMMISSIONING: "Installation & commissioning",
  WARRANTY_CLAIM: "Warranty claim",
  INSPECTION: "Inspection",
  RENTAL_SUPPORT: "Rental support",
};
