import { z } from "zod";

/**
 * Enumerations — PRD §6.3, plus the unified exception taxonomy required by
 * PLAN.md conflict C-16 (the spec defined exceptions four times with different
 * membership across FR-M2-06, E2-S4, E8-S3 and E10-S2).
 *
 * Zod is the source of truth; every TS type here is inferred. NFR-16.
 */

export const zVertical = z.enum(["EQUIPMENT_SALES", "SERVICE_AMC", "PROJECTS", "RENTAL"]);
export type Vertical = z.infer<typeof zVertical>;

export const zOEMPrincipal = z.enum(["ELGI", "ATS_ELGI", "KSB", "ION_EXCHANGE", "OTHER"]);
export type OEMPrincipal = z.infer<typeof zOEMPrincipal>;

/** Product lines verbatim from bhushancorp.in. PRD SD-5, SD-6. */
export const zProductLine = z.enum([
  "PISTON_COMPRESSOR",
  "SCREW_COMPRESSOR",
  "OIL_FREE_COMPRESSOR",
  "PORTABLE_COMPRESSOR",
  "DIRECT_DRIVE_COMPRESSOR",
  "AIR_ACCESSORY",
  "BODY_SHOP_EQUIPMENT",
  "LUBE_EQUIPMENT",
  "WASHING_EQUIPMENT",
  "LIFTING_EQUIPMENT",
  "PNEUMATIC_TOOL",
  "TYRE_INFLATOR",
  "PUMP",
  "WATER_TREATMENT",
  "PPR_PIPING",
]);
export type ProductLine = z.infer<typeof zProductLine>;

export const zItemCategory = z.enum([
  "MACHINE",
  "SPARE",
  "CONSUMABLE",
  "ACCESSORY",
  "PIPE_FITTING",
  "SERVICE",
]);
export type ItemCategory = z.infer<typeof zItemCategory>;

export const zCustomerType = z.enum([
  "INDUSTRIAL",
  "INSTITUTIONAL",
  "GOVERNMENT",
  "DEALER",
  "RETAIL",
]);
export type CustomerType = z.infer<typeof zCustomerType>;

export const zEnquirySource = z.enum([
  "PHONE",
  "WEBSITE",
  "WHATSAPP",
  "WALK_IN",
  "REFERRAL",
  "EXHIBITION",
  "OEM_LEAD",
]);
export type EnquirySource = z.infer<typeof zEnquirySource>;

export const zEnquiryStatus = z.enum([
  "NEW",
  "QUALIFIED",
  "QUOTED",
  "NEGOTIATION",
  "WON",
  "LOST",
  "DROPPED",
]);
export type EnquiryStatus = z.infer<typeof zEnquiryStatus>;

export const zQuotationStatus = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "ISSUED",
  "NEGOTIATION",
  "WON",
  "LOST",
  "EXPIRED",
]);
export type QuotationStatus = z.infer<typeof zQuotationStatus>;

export const zLossReason = z.enum([
  "PRICE",
  "DELIVERY_LEAD_TIME",
  "TECHNICAL_FIT",
  "COMPETITOR_RELATIONSHIP",
  "BUDGET_WITHDRAWN",
  "NO_DECISION",
  "OTHER",
]);
export type LossReason = z.infer<typeof zLossReason>;

export const zTicketCategory = z.enum([
  "BREAKDOWN",
  "PREVENTIVE_MAINTENANCE",
  "INSTALLATION_COMMISSIONING",
  "WARRANTY_CLAIM",
  "INSPECTION",
  "RENTAL_SUPPORT",
]);
export type TicketCategory = z.infer<typeof zTicketCategory>;

export const zTicketSeverity = z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]);
export type TicketSeverity = z.infer<typeof zTicketSeverity>;

export const zCoverageType = z.enum(["IN_WARRANTY", "UNDER_AMC", "CHARGEABLE"]);
export type CoverageType = z.infer<typeof zCoverageType>;

export const zTicketStatus = z.enum([
  "LOGGED",
  "ASSIGNED",
  "EN_ROUTE",
  "ON_SITE",
  "AWAITING_PARTS",
  "AWAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
]);
export type TicketStatus = z.infer<typeof zTicketStatus>;

export const zSLAState = z.enum(["COMFORTABLE", "APPROACHING", "IMMINENT", "BREACHED"]);
export type SLAState = z.infer<typeof zSLAState>;

export const zJobOutcome = z.enum([
  "RESOLVED",
  "PARTIALLY_RESOLVED",
  "PARTS_AWAITED",
  "REVISIT_REQUIRED",
  "NOT_ATTENDED",
]);
export type JobOutcome = z.infer<typeof zJobOutcome>;

export const zRootCause = z.enum([
  "AIR_END_WEAR",
  "OIL_LEAK",
  "FILTER_CHOKED",
  "BELT_SLIP",
  "MOTOR_OVERLOAD",
  "PRESSURE_SWITCH",
  "VALVE_FAILURE",
  "COOLER_FOULING",
  "CONTROLLER_FAULT",
  "SEAL_FAILURE",
  "IMPELLER_WEAR",
  "ELECTRICAL_SUPPLY",
  "OPERATOR_ERROR",
  "SCHEDULED_SERVICE",
  "OTHER",
]);
export type RootCause = z.infer<typeof zRootCause>;

export const zAMCCoverage = z.enum(["COMPREHENSIVE", "NON_COMPREHENSIVE"]);
export type AMCCoverage = z.infer<typeof zAMCCoverage>;

export const zAMCStatus = z.enum([
  "DRAFT",
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
  "RENEWED",
  "TERMINATED",
]);
export type AMCStatus = z.infer<typeof zAMCStatus>;

export const zAssetStatus = z.enum(["RUNNING", "DOWN", "DECOMMISSIONED", "ON_RENT"]);
export type AssetStatus = z.infer<typeof zAssetStatus>;

export const zCoverageState = z.enum(["IN_WARRANTY", "UNDER_AMC", "OUT_OF_COVERAGE"]);
export type CoverageState = z.infer<typeof zCoverageState>;

export const zCommissioningSubmission = z.enum([
  "NOT_SUBMITTED",
  "SUBMITTED_IN_WINDOW",
  "SUBMITTED_LATE",
  "OVERDUE",
]);
export type CommissioningSubmission = z.infer<typeof zCommissioningSubmission>;

export const zProjectStatus = z.enum([
  "TENDERED",
  "AWARDED",
  "MOBILISED",
  "IN_PROGRESS",
  "COMMISSIONING",
  "COMPLETED",
  "DLP",
  "CLOSED",
  "ON_HOLD",
]);
export type ProjectStatus = z.infer<typeof zProjectStatus>;

export const zRABillStatus = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_CERTIFICATION",
  "CERTIFIED",
  "PAID",
]);
export type RABillStatus = z.infer<typeof zRABillStatus>;

export const zRetentionState = z.enum([
  "WITHHELD",
  "NOT_ELIGIBLE",
  "ELIGIBLE",
  "CLAIM_RAISED",
  "RELEASED",
]);
export type RetentionState = z.infer<typeof zRetentionState>;

export const zMovementType = z.enum([
  "RECEIPT",
  "ISSUE",
  "RETURN",
  "TRANSFER",
  "ADJUSTMENT",
  "SCRAP",
]);
export type MovementType = z.infer<typeof zMovementType>;

export const zInvoiceType = z.enum([
  "EQUIPMENT",
  "SPARES",
  "SERVICE",
  "AMC",
  "RENTAL",
  "PROJECT_RA",
]);
export type InvoiceType = z.infer<typeof zInvoiceType>;

/** C-14: export branch added — 12 Nepal transactions are seeded and had no rule. */
export const zTaxTreatment = z.enum([
  "INTRA_STATE_CGST_SGST",
  "INTER_STATE_IGST",
  "EXPORT_ZERO_RATED",
]);
export type TaxTreatment = z.infer<typeof zTaxTreatment>;

export const zPaymentMode = z.enum(["NEFT", "RTGS", "CHEQUE", "UPI", "CASH", "ADJUSTMENT"]);
export type PaymentMode = z.infer<typeof zPaymentMode>;

export const zAttendanceState = z.enum([
  "PRESENT",
  "ABSENT",
  "ON_LEAVE",
  "ON_FIELD",
  "HALF_DAY",
  "WEEK_OFF",
  "HOLIDAY",
]);
export type AttendanceState = z.infer<typeof zAttendanceState>;

export const zApprovalStatus = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "ESCALATED",
  "WITHDRAWN",
]);
export type ApprovalStatus = z.infer<typeof zApprovalStatus>;

export const zApprovalRequestType = z.enum([
  "QUOTATION_DISCOUNT",
  "CREDIT_LIMIT_OVERRIDE",
  "PURCHASE_ORDER",
  "LEAVE",
  "EXPENSE_CLAIM",
  "STOCK_ADJUSTMENT",
  "AMC_PRICING_EXCEPTION",
  "RA_BILL_SUBMISSION",
  "PRICE_LIST_CHANGE",
  "USER_ROLE_CHANGE",
]);
export type ApprovalRequestType = z.infer<typeof zApprovalRequestType>;

export const zNotificationChannel = z.enum(["IN_APP", "WHATSAPP", "EMAIL", "SMS"]);
export type NotificationChannel = z.infer<typeof zNotificationChannel>;

export const zMessageState = z.enum(["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"]);
export type MessageState = z.infer<typeof zMessageState>;

export const zConfidenceState = z.enum(["HIGH", "MODERATE", "LOW", "INSUFFICIENT"]);
export type ConfidenceState = z.infer<typeof zConfidenceState>;

export const zEmploymentType = z.enum(["PERMANENT", "FIXED_TERM", "PROBATION", "CONTRACT"]);
export type EmploymentType = z.infer<typeof zEmploymentType>;

export const zWorkLocationType = z.enum(["OFFICE", "FIELD"]);
export type WorkLocationType = z.infer<typeof zWorkLocationType>;

export const zLeaveStatus = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export type LeaveStatus = z.infer<typeof zLeaveStatus>;

export const zPOStatus = z.enum([
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
]);
export type POStatus = z.infer<typeof zPOStatus>;

export const zDocumentCategory = z.enum([
  "CUSTOMERS",
  "INSTALLED_ASSETS",
  "PROJECTS",
  "OEM_TECHNICAL",
  "COMMERCIAL",
  "HR",
  "STATUTORY",
  "COMPANY",
]);
export type DocumentCategory = z.infer<typeof zDocumentCategory>;

export const zDocumentType = z.enum([
  "OEM_MANUAL",
  "TECHNICAL_LITERATURE",
  "WARRANTY_TERMS",
  "AMC_AGREEMENT",
  "COMMISSIONING_CERTIFICATE",
  "PROJECT_DRAWING",
  "TEST_CERTIFICATE",
  "CLIENT_APPROVAL",
  "MEASUREMENT_RECORD",
  "PURCHASE_ORDER_COPY",
  "CUSTOMER_AGREEMENT",
  "APPOINTMENT_LETTER",
  "STATUTORY_RETURN",
  "INSURANCE",
  "LICENCE",
  "OTHER",
]);
export type DocumentType = z.infer<typeof zDocumentType>;

/**
 * Unified exception taxonomy — C-16.
 * Every producer in the platform emits one of exactly these types.
 */
export const zExceptionType = z.enum([
  "SLA_IMMINENT",
  "SLA_BREACHED",
  "COMMISSIONING_WINDOW_CLOSING",
  "COMMISSIONING_OVERDUE",
  "AMC_EXPIRING",
  "AMC_LAPSED",
  "QUOTATION_AGED",
  "INVOICE_OVER_90",
  "PAYMENT_PROMISE_BROKEN",
  "EINVOICE_WINDOW_CLOSING",
  "PROJECT_SCHEDULE_VARIANCE",
  "RABILL_AWAITING_CERTIFICATION",
  "RETENTION_ELIGIBLE",
  "STOCK_SERVICE_CRITICAL",
  "APPROVAL_OVERDUE",
  "DOCUMENT_EXPIRED",
]);
export type ExceptionType = z.infer<typeof zExceptionType>;

export const zExceptionSeverity = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export type ExceptionSeverity = z.infer<typeof zExceptionSeverity>;

export const zHealthState = z.enum(["HEALTHY", "WATCH", "ACTION", "NO_ACTIVITY"]);
export type HealthState = z.infer<typeof zHealthState>;

/** 12 roles. BRD AS-001 says 11; PRD §7.1, §2.1, FR-M1-02 and E1 all say 12. */
export const zRole = z.enum([
  "SUPER_ADMIN",
  "DIRECTOR_BUSINESS",
  "DIRECTOR_STRATEGY",
  "BRANCH_MANAGER",
  "SALES_EXECUTIVE",
  "SERVICE_MANAGER",
  "FIELD_ENGINEER",
  "PROJECT_MANAGER",
  "ACCOUNTS_EXECUTIVE",
  "HR_ADMIN",
  "STORE_INCHARGE",
  "AUDITOR",
]);
export type Role = z.infer<typeof zRole>;

export const zAuditAction = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATE_TRANSITION",
  "APPROVE",
  "REJECT",
  "RETURN",
  "EXPORT",
  "LOGIN",
  "LOGOUT",
  "ACCESS_DENIED",
  "SESSION_IMPERSONATION",
  "VIEW_DOCUMENT",
  "DOWNLOAD",
  "SIMULATED_INTEGRATION",
  "DEMO_RESET",
  "CLOCK_ADVANCE",
]);
export type AuditAction = z.infer<typeof zAuditAction>;

/* ------------------------------------------------------------------ labels */

export const VERTICAL_LABEL: Record<Vertical, string> = {
  EQUIPMENT_SALES: "Equipment Sales",
  SERVICE_AMC: "Service & AMC",
  PROJECTS: "Projects",
  RENTAL: "Rental",
};

/** C-10: exactly four vertical tokens, matching the enum. */
export const VERTICAL_TOKEN: Record<Vertical, string> = {
  EQUIPMENT_SALES: "var(--v-equipment)",
  SERVICE_AMC: "var(--v-service)",
  PROJECTS: "var(--v-projects)",
  RENTAL: "var(--v-rental)",
};

export const OEM_LABEL: Record<OEMPrincipal, string> = {
  ELGI: "ELGi",
  ATS_ELGI: "ATS-ELGi",
  KSB: "KSB",
  ION_EXCHANGE: "Ion Exchange",
  OTHER: "Other",
};

export const PRODUCT_LINE_LABEL: Record<ProductLine, string> = {
  PISTON_COMPRESSOR: "Piston Compressor",
  SCREW_COMPRESSOR: "Electric Lubricated Screw Compressor",
  OIL_FREE_COMPRESSOR: "Oil Free Compressor",
  PORTABLE_COMPRESSOR: "Portable Compressor",
  DIRECT_DRIVE_COMPRESSOR: "Direct Drive Compressor",
  AIR_ACCESSORY: "Air Accessory",
  BODY_SHOP_EQUIPMENT: "Body Shop Equipment",
  LUBE_EQUIPMENT: "Lube Equipment",
  WASHING_EQUIPMENT: "Washing Equipment",
  LIFTING_EQUIPMENT: "Lifting Equipment",
  PNEUMATIC_TOOL: "Pneumatic Tool",
  TYRE_INFLATOR: "Tyre Inflator",
  PUMP: "Pump",
  WATER_TREATMENT: "Water Treatment",
  PPR_PIPING: "PPR Piping",
};

export const PRODUCT_LINE_VERTICAL: Record<ProductLine, Vertical> = {
  PISTON_COMPRESSOR: "EQUIPMENT_SALES",
  SCREW_COMPRESSOR: "EQUIPMENT_SALES",
  OIL_FREE_COMPRESSOR: "EQUIPMENT_SALES",
  PORTABLE_COMPRESSOR: "EQUIPMENT_SALES",
  DIRECT_DRIVE_COMPRESSOR: "EQUIPMENT_SALES",
  AIR_ACCESSORY: "EQUIPMENT_SALES",
  BODY_SHOP_EQUIPMENT: "EQUIPMENT_SALES",
  LUBE_EQUIPMENT: "EQUIPMENT_SALES",
  WASHING_EQUIPMENT: "EQUIPMENT_SALES",
  LIFTING_EQUIPMENT: "EQUIPMENT_SALES",
  PNEUMATIC_TOOL: "EQUIPMENT_SALES",
  TYRE_INFLATOR: "EQUIPMENT_SALES",
  PUMP: "EQUIPMENT_SALES",
  WATER_TREATMENT: "PROJECTS",
  PPR_PIPING: "EQUIPMENT_SALES",
};

export const ROLE_LABEL: Record<Role, string> = {
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

export const ROLE_SHORT: Record<Role, string> = {
  SUPER_ADMIN: "SA",
  DIRECTOR_BUSINESS: "DB",
  DIRECTOR_STRATEGY: "DS",
  BRANCH_MANAGER: "BM",
  SALES_EXECUTIVE: "SE",
  SERVICE_MANAGER: "SM",
  FIELD_ENGINEER: "FE",
  PROJECT_MANAGER: "PM",
  ACCOUNTS_EXECUTIVE: "AC",
  HR_ADMIN: "HR",
  STORE_INCHARGE: "ST",
  AUDITOR: "AU",
};

export const EXCEPTION_LABEL: Record<ExceptionType, string> = {
  SLA_IMMINENT: "SLA imminent",
  SLA_BREACHED: "SLA breached",
  COMMISSIONING_WINDOW_CLOSING: "Commissioning window closing",
  COMMISSIONING_OVERDUE: "Commissioning submission overdue",
  AMC_EXPIRING: "AMC expiring",
  AMC_LAPSED: "AMC expired unrenewed",
  QUOTATION_AGED: "Quotation aged beyond threshold",
  INVOICE_OVER_90: "Invoice beyond 90 days",
  PAYMENT_PROMISE_BROKEN: "Payment promise broken",
  EINVOICE_WINDOW_CLOSING: "E-invoice reporting window closing",
  PROJECT_SCHEDULE_VARIANCE: "Project schedule variance",
  RABILL_AWAITING_CERTIFICATION: "RA-bill awaiting certification",
  RETENTION_ELIGIBLE: "Retention eligible for release",
  STOCK_SERVICE_CRITICAL: "Service-critical stock below reorder",
  APPROVAL_OVERDUE: "Approval pending beyond SLA",
  DOCUMENT_EXPIRED: "Operational document expired",
};
