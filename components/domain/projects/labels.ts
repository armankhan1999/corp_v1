import type { ProjectStatus, RABillStatus, RetentionState } from "@/lib/schemas/enums";

/** E6-S1 — status resolves within exactly these nine values. */
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  TENDERED: "Tendered",
  AWARDED: "Awarded",
  MOBILISED: "Mobilised",
  IN_PROGRESS: "In progress",
  COMMISSIONING: "Commissioning",
  COMPLETED: "Completed",
  DLP: "Defect-liability period",
  CLOSED: "Closed",
  ON_HOLD: "On hold",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "TENDERED", "AWARDED", "MOBILISED", "IN_PROGRESS", "COMMISSIONING",
  "COMPLETED", "DLP", "CLOSED", "ON_HOLD",
];

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "sim";

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  TENDERED: "neutral",
  AWARDED: "info",
  MOBILISED: "info",
  IN_PROGRESS: "ok",
  COMMISSIONING: "ok",
  COMPLETED: "neutral",
  DLP: "warn",
  CLOSED: "neutral",
  ON_HOLD: "danger",
};

export const RA_BILL_STATUS_LABEL: Record<RABillStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_CERTIFICATION: "Under certification",
  CERTIFIED: "Certified",
  PAID: "Paid",
};

export const RA_BILL_STATUS_TONE: Record<RABillStatus, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "warn",
  UNDER_CERTIFICATION: "info",
  CERTIFIED: "ok",
  PAID: "ok",
};

/** E6-S6 — Not eligible / Eligible / Claim raised / Released. */
export const RETENTION_STATE_LABEL: Record<RetentionState, string> = {
  WITHHELD: "Withheld",
  NOT_ELIGIBLE: "Not eligible",
  ELIGIBLE: "Eligible",
  CLAIM_RAISED: "Claim raised",
  RELEASED: "Released",
};

export const RETENTION_STATE_TONE: Record<RetentionState, Tone> = {
  WITHHELD: "neutral",
  NOT_ELIGIBLE: "neutral",
  ELIGIBLE: "warn",
  CLAIM_RAISED: "info",
  RELEASED: "ok",
};

export const HINDRANCE_CAUSE_LABEL: Record<string, string> = {
  WEATHER: "Weather",
  MATERIAL: "Material",
  CLIENT_APPROVAL: "Client approval",
  LABOUR: "Labour",
  DRAWING: "Drawing",
  ACCESS: "Site access",
  OTHER: "Other",
};

export const DOCUMENT_CLASS_LABEL: Record<string, string> = {
  PROJECT_DRAWING: "Drawing",
  CLIENT_APPROVAL: "Client approval",
  TEST_CERTIFICATE: "Test & commissioning certificate",
  MEASUREMENT_RECORD: "Measurement book",
  COMMISSIONING_CERTIFICATE: "Test & commissioning certificate",
  OTHER: "Other",
};

export const APPROVAL_STATE_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  APPROVED: "ok",
  SUPERSEDED: "warn",
};

export const CLIENT_TYPE_LABEL: Record<string, string> = {
  INDUSTRIAL: "Industrial",
  INSTITUTIONAL: "Institutional",
  GOVERNMENT: "Government",
  DEALER: "Dealer",
  RETAIL: "Retail",
};

export const COST_CATEGORY_LABEL: Record<string, string> = {
  MATERIAL: "Material",
  SUBCONTRACT: "Subcontract",
  LABOUR: "Labour",
  PLANT: "Plant & machinery",
  OVERHEAD: "Overhead",
};

/** The unified exception taxonomy names this epic emits. C-16. */
export const EXCEPTION_LABEL: Record<string, string> = {
  PROJECT_SCHEDULE_VARIANCE: "Project schedule variance",
  RABILL_AWAITING_CERTIFICATION: "RA-bill awaiting certification",
  RETENTION_ELIGIBLE: "Retention eligible for release",
  DOCUMENT_EXPIRED: "Document expiring",
};
