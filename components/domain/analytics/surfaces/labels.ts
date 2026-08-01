import {
  OEM_LABEL as OEM, PRODUCT_LINE_LABEL as PL, VERTICAL_LABEL as VL,
} from "@/lib/schemas/enums";
import { enumLabel } from "@/lib/format";

/**
 * The enum label maps in `/lib/schemas/enums` are keyed to their union types.
 * Chart dimensions arrive as plain strings, so these widened views let a
 * breakdown look up a label without a cast at every call site. The labels
 * themselves are still the ones the platform publishes — nothing is renamed here.
 */

export const PRODUCT_LINE_LABEL: Record<string, string> = { ...PL, UNCLASSIFIED: "Unclassified" };
export const OEM_LABEL: Record<string, string> = { ...OEM };
export const VERTICAL_LABEL: Record<string, string> = { ...VL };

export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  INDUSTRIAL: "Industrial",
  INSTITUTIONAL: "Institutional",
  GOVERNMENT: "Government",
  DEALER: "Dealer",
  RETAIL: "Retail",
};

export const LOSS_REASON_LABEL: Record<string, string> = {
  PRICE: "Price",
  DELIVERY_LEAD_TIME: "Delivery lead time",
  TECHNICAL_FIT: "Technical fit",
  COMPETITOR_RELATIONSHIP: "Competitor relationship",
  BUDGET_WITHDRAWN: "Budget withdrawn",
  NO_DECISION: "No decision taken",
  OTHER: "Other",
};

export const TICKET_CATEGORY_LABEL: Record<string, string> = {
  BREAKDOWN: "Breakdown",
  PREVENTIVE_MAINTENANCE: "Preventive maintenance",
  INSTALLATION_COMMISSIONING: "Installation & commissioning",
  WARRANTY_CLAIM: "Warranty claim",
  INSPECTION: "Inspection",
  RENTAL_SUPPORT: "Rental support",
};

export const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export const ITEM_CATEGORY_LABEL: Record<string, string> = {
  MACHINE: "Machine",
  SPARE: "Spare",
  CONSUMABLE: "Consumable",
  ACCESSORY: "Accessory",
  PIPE_FITTING: "Pipe & fitting",
  SERVICE: "Service",
};

export const COMMISSIONING_STATE_LABEL: Record<string, string> = {
  SUBMITTED_IN_WINDOW: "Submitted in window",
  SUBMITTED_LATE: "Submitted late",
  NOT_SUBMITTED: "Not yet submitted",
  OVERDUE: "Overdue",
};

export const rootCauseLabel = (v: string): string => enumLabel(v);
