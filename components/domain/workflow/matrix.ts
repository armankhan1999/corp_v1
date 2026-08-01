/**
 * E11-S4 — the notification & escalation matrix, transcribed from PRD §14.
 *
 * All 34 events, with their recipients, channels, timing and escalation target
 * exactly as published. The dispatcher reads this table; nothing else decides
 * who gets told what. Two rules are enforced structurally:
 *
 *   1. A notification for an entity the recipient's role cannot access is never
 *      produced at all (E11-S4 AC) — the gate is `capability`, checked against
 *      the RBAC matrix at dispatch, not at click.
 *   2. `digest: true` events are batched into one daily item rather than sent
 *      individually (E11-S4 AC).
 */

import type { Capability } from "@/lib/rbac/matrix";
import { can } from "@/lib/rbac/matrix";
import type { NotificationChannel, Role } from "@/lib/schemas/enums";

export type Timing =
  | "IMMEDIATE"
  | "ON_THRESHOLD"
  | "ON_BREACH"
  | "ON_EXPIRY"
  | "ON_DATE"
  | "ON_SUBMISSION"
  | "ON_COMPUTATION"
  | "ON_ELIGIBILITY"
  | "DAILY"
  | "DAILY_DIGEST";

export const TIMING_LABEL: Record<Timing, string> = {
  IMMEDIATE: "Immediate",
  ON_THRESHOLD: "On threshold",
  ON_BREACH: "On breach",
  ON_EXPIRY: "On expiry",
  ON_DATE: "On date",
  ON_SUBMISSION: "On submission",
  ON_COMPUTATION: "On computation",
  ON_ELIGIBILITY: "On eligibility",
  DAILY: "Daily",
  DAILY_DIGEST: "Daily digest",
};

/** Recipients the PRD names by relationship rather than by role. */
export type RelationRecipient =
  | "ASSIGNED_ENGINEER"
  | "ACCOUNT_OWNER"
  | "REPORTING_MANAGER"
  | "DOCUMENT_OWNER"
  | "REQUESTER"
  | "APPROVER_PER_CHAIN"
  | "CUSTOMER_CONTACT";

export const RELATION_LABEL: Record<RelationRecipient, string> = {
  ASSIGNED_ENGINEER: "Assigned engineer",
  ACCOUNT_OWNER: "Account owner",
  REPORTING_MANAGER: "Reporting manager",
  DOCUMENT_OWNER: "Document owner",
  REQUESTER: "Requester",
  APPROVER_PER_CHAIN: "Approver per chain",
  CUSTOMER_CONTACT: "Customer contact (simulated)",
};

export interface NotificationEventDef {
  /** Stable key, also used as `Notification.type` on the record. */
  key: string;
  /** PRD §14 event column, verbatim. */
  event: string;
  group: "Service" | "Assets & AMC" | "Sales" | "Approvals" | "Commercial" | "Projects" | "Inventory" | "People";
  roles: Role[];
  relations: RelationRecipient[];
  channels: NotificationChannel[];
  /** WhatsApp message carries Approve / Reject buttons. */
  actionable: boolean;
  timing: Timing;
  digest: boolean;
  exceptionFeed: boolean;
  escalatesTo: string | null;
  /** RBAC gate — a role without this capability is never a recipient. */
  capability: Capability;
  entityType: string;
}

const E = (d: NotificationEventDef) => d;

/** PRD §14 — all 34 rows, in published order. */
export const NOTIFICATION_MATRIX: NotificationEventDef[] = [
  E({
    key: "TICKET_LOGGED", event: "Ticket logged", group: "Service",
    roles: ["SERVICE_MANAGER"], relations: ["ASSIGNED_ENGINEER"],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "tickets", entityType: "TICKET",
  }),
  E({
    key: "SLA_APPROACHING", event: "SLA approaching (< 25% remaining)", group: "Service",
    roles: ["SERVICE_MANAGER"], relations: ["ASSIGNED_ENGINEER"],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "tickets", entityType: "TICKET",
  }),
  E({
    key: "SLA_IMMINENT", event: "SLA imminent (< 10% remaining)", group: "Service",
    roles: ["SERVICE_MANAGER"], relations: [],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: false, escalatesTo: "Director – Business at breach",
    capability: "tickets", entityType: "TICKET",
  }),
  E({
    key: "SLA_BREACHED", event: "SLA breached", group: "Service",
    roles: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"], relations: [],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "ON_BREACH",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "tickets", entityType: "TICKET",
  }),
  E({
    key: "JOB_CARD_SUBMITTED", event: "Job card submitted", group: "Service",
    roles: ["SERVICE_MANAGER"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "jobCards", entityType: "JOB_CARD",
  }),
  E({
    key: "PARTS_REQUEST_RAISED", event: "Parts request raised", group: "Inventory",
    roles: ["STORE_INCHARGE", "SERVICE_MANAGER"], relations: [],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: "Service Manager after 4 h",
    capability: "stock", entityType: "PARTS_REQUEST",
  }),
  E({
    key: "COMMISSIONING_RECORDED", event: "Commissioning recorded", group: "Assets & AMC",
    roles: ["SERVICE_MANAGER"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "commissioning", entityType: "COMMISSIONING",
  }),
  E({
    key: "COMMISSIONING_WINDOW_CLOSING", event: "Commissioning submission window at 2 days", group: "Assets & AMC",
    roles: ["SERVICE_MANAGER", "BRANCH_MANAGER"], relations: [],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: false, escalatesTo: "Director – Business at expiry",
    capability: "commissioning", entityType: "COMMISSIONING",
  }),
  E({
    key: "COMMISSIONING_OVERDUE", event: "Commissioning window expired", group: "Assets & AMC",
    roles: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_EXPIRY",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "commissioning", entityType: "COMMISSIONING",
  }),
  E({
    key: "AMC_EXPIRING", event: "AMC expiring in 60 / 30 / 7 days", group: "Assets & AMC",
    roles: ["SERVICE_MANAGER", "BRANCH_MANAGER"], relations: ["ACCOUNT_OWNER"],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: false, escalatesTo: "Director – Business at 7 days",
    capability: "amc", entityType: "AMC_CONTRACT",
  }),
  E({
    key: "AMC_LAPSED", event: "AMC expired unrenewed", group: "Assets & AMC",
    roles: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_EXPIRY",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "amc", entityType: "AMC_CONTRACT",
  }),
  E({
    key: "WARRANTY_EXPIRING", event: "Warranty expiring in 90 days", group: "Assets & AMC",
    roles: ["BRANCH_MANAGER"], relations: ["ACCOUNT_OWNER"],
    channels: ["IN_APP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "assets", entityType: "ASSET",
  }),
  E({
    key: "QUOTATION_ISSUED", event: "Quotation issued", group: "Sales",
    roles: [], relations: ["CUSTOMER_CONTACT", "ACCOUNT_OWNER"],
    channels: ["WHATSAPP", "IN_APP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "quotations", entityType: "QUOTATION",
  }),
  E({
    key: "QUOTATION_AGED", event: "Quotation ageing beyond stage threshold", group: "Sales",
    roles: ["BRANCH_MANAGER"], relations: ["ACCOUNT_OWNER"],
    channels: ["IN_APP"], actionable: false, timing: "DAILY_DIGEST",
    digest: true, exceptionFeed: false, escalatesTo: "Branch Manager at second threshold",
    capability: "quotations", entityType: "QUOTATION",
  }),
  E({
    key: "QUOTATION_EXPIRING", event: "Quotation expiring in 3 days", group: "Sales",
    roles: [], relations: ["ACCOUNT_OWNER"],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "quotations", entityType: "QUOTATION",
  }),
  E({
    key: "DISCOUNT_APPROVAL_REQUIRED", event: "Discount approval required", group: "Approvals",
    roles: [], relations: ["APPROVER_PER_CHAIN"],
    channels: ["IN_APP", "WHATSAPP"], actionable: true, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: "Next authority after SLA",
    capability: "approvals", entityType: "APPROVAL",
  }),
  E({
    key: "APPROVAL_PENDING", event: "Approval pending beyond SLA", group: "Approvals",
    roles: [], relations: ["APPROVER_PER_CHAIN", "REQUESTER"],
    channels: ["IN_APP", "WHATSAPP"], actionable: true, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: true, escalatesTo: "Next authority",
    capability: "approvals", entityType: "APPROVAL",
  }),
  E({
    key: "INVOICE_RAISED", event: "Invoice raised", group: "Commercial",
    roles: ["ACCOUNTS_EXECUTIVE"], relations: ["CUSTOMER_CONTACT"],
    channels: ["WHATSAPP", "IN_APP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "invoices", entityType: "INVOICE",
  }),
  E({
    key: "INVOICE_OVER_90", event: "Invoice crossing 60 / 90 days", group: "Commercial",
    roles: ["ACCOUNTS_EXECUTIVE", "BRANCH_MANAGER"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "DAILY_DIGEST",
    digest: true, exceptionFeed: false, escalatesTo: "Director – Business at 90",
    capability: "receivables", entityType: "INVOICE",
  }),
  E({
    key: "PAYMENT_PROMISE_BROKEN", event: "Payment promise date passed unpaid", group: "Commercial",
    roles: ["ACCOUNTS_EXECUTIVE", "BRANCH_MANAGER"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_DATE",
    digest: false, exceptionFeed: true, escalatesTo: "Director – Business",
    capability: "receivables", entityType: "INVOICE",
  }),
  E({
    key: "EINVOICE_WINDOW_CLOSING", event: "E-invoice reporting window closing", group: "Commercial",
    roles: ["ACCOUNTS_EXECUTIVE"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "DAILY",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "invoices", entityType: "INVOICE",
  }),
  E({
    key: "RECEIPT_RECORDED", event: "Receipt recorded", group: "Commercial",
    roles: ["ACCOUNTS_EXECUTIVE"], relations: ["ACCOUNT_OWNER"],
    channels: ["IN_APP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "receipts", entityType: "RECEIPT",
  }),
  E({
    key: "RABILL_CERTIFIED", event: "RA-bill certified", group: "Projects",
    roles: ["PROJECT_MANAGER", "ACCOUNTS_EXECUTIVE"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "raBills", entityType: "RA_BILL",
  }),
  E({
    key: "RABILL_AWAITING_CERTIFICATION", event: "RA-bill awaiting certification > 30 days", group: "Projects",
    roles: ["PROJECT_MANAGER", "DIRECTOR_BUSINESS"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "raBills", entityType: "RA_BILL",
  }),
  E({
    key: "RETENTION_ELIGIBLE", event: "Retention eligible for release", group: "Projects",
    roles: ["PROJECT_MANAGER", "ACCOUNTS_EXECUTIVE", "DIRECTOR_BUSINESS"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_ELIGIBILITY",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "retention", entityType: "RETENTION",
  }),
  E({
    key: "PROJECT_SCHEDULE_VARIANCE", event: "Project schedule variance beyond tolerance", group: "Projects",
    roles: ["PROJECT_MANAGER", "DIRECTOR_BUSINESS"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_COMPUTATION",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "projects", entityType: "PROJECT",
  }),
  E({
    key: "DPR_NOT_FILED", event: "DPR not filed for 2 days on a live project", group: "Projects",
    roles: ["PROJECT_MANAGER"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "DAILY",
    digest: false, exceptionFeed: false, escalatesTo: "Director – Business at 5 days",
    capability: "dpr", entityType: "PROJECT",
  }),
  E({
    key: "STOCK_SERVICE_CRITICAL", event: "Stock at or below reorder (service-critical)", group: "Inventory",
    roles: ["STORE_INCHARGE", "SERVICE_MANAGER"], relations: [],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "IMMEDIATE",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "reorder", entityType: "ITEM",
  }),
  E({
    key: "STOCK_ROUTINE", event: "Stock at or below reorder (routine)", group: "Inventory",
    roles: ["STORE_INCHARGE"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "DAILY_DIGEST",
    digest: true, exceptionFeed: false, escalatesTo: null,
    capability: "reorder", entityType: "ITEM",
  }),
  E({
    key: "ATTENDANCE_EXCEPTION", event: "Attendance exception", group: "People",
    roles: ["HR_ADMIN"], relations: ["REPORTING_MANAGER"],
    channels: ["IN_APP"], actionable: false, timing: "DAILY",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "attendance", entityType: "ATTENDANCE",
  }),
  E({
    key: "LEAVE_REQUEST_RAISED", event: "Leave request raised", group: "People",
    roles: [], relations: ["REPORTING_MANAGER"],
    channels: ["IN_APP", "WHATSAPP"], actionable: true, timing: "IMMEDIATE",
    digest: false, exceptionFeed: false, escalatesTo: "HR after SLA",
    capability: "leave", entityType: "LEAVE",
  }),
  E({
    key: "LEAVE_COVERAGE_BREACH", event: "Leave would breach engineer coverage minimum", group: "People",
    roles: ["SERVICE_MANAGER", "HR_ADMIN"], relations: [],
    channels: ["IN_APP"], actionable: false, timing: "ON_SUBMISSION",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "leave", entityType: "LEAVE",
  }),
  E({
    key: "DOCUMENT_EXPIRING", event: "Document expiring in 60 / 30 days", group: "People",
    roles: ["HR_ADMIN", "PROJECT_MANAGER"], relations: ["DOCUMENT_OWNER"],
    channels: ["IN_APP"], actionable: false, timing: "ON_THRESHOLD",
    digest: false, exceptionFeed: true, escalatesTo: null,
    capability: "vault", entityType: "DOCUMENT",
  }),
  E({
    key: "RENTAL_RETURN_OVERDUE", event: "Rental return overdue", group: "Assets & AMC",
    roles: ["SERVICE_MANAGER", "ACCOUNTS_EXECUTIVE"], relations: [],
    channels: ["IN_APP", "WHATSAPP"], actionable: false, timing: "DAILY",
    digest: false, exceptionFeed: false, escalatesTo: null,
    capability: "rental", entityType: "RENTAL",
  }),
];

export const EVENT_BY_KEY: Record<string, NotificationEventDef> = Object.fromEntries(
  NOTIFICATION_MATRIX.map((e) => [e.key, e]),
);

export const EVENT_GROUPS = [
  "Service", "Assets & AMC", "Sales", "Approvals", "Commercial", "Projects", "Inventory", "People",
] as const;

export type EventGroup = (typeof EVENT_GROUPS)[number];

export function eventFor(type: string): NotificationEventDef | null {
  return EVENT_BY_KEY[type] ?? null;
}

export function eventLabel(type: string): string {
  return EVENT_BY_KEY[type]?.event ?? type.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export function eventGroup(type: string): EventGroup {
  return (EVENT_BY_KEY[type]?.group ?? "Service") as EventGroup;
}

/**
 * E11-S4 AC — "a notification for an entity the user's role cannot access is
 * not delivered to that user at all rather than delivered and blocked on click."
 * This is the dispatch gate. If it returns false the record is never written.
 */
export function deliverable(role: Role, type: string): boolean {
  const def = EVENT_BY_KEY[type];
  if (!def) return true;
  return can(role, def.capability);
}

export function suppressionReason(role: Role, type: string): string | null {
  const def = EVENT_BY_KEY[type];
  if (!def) return null;
  if (can(role, def.capability)) return null;
  return `${def.event} concerns ${def.entityType.replace(/_/g, " ").toLowerCase()} records, which this role cannot read. Suppressed at dispatch.`;
}

/** Digest-type events are batched into one item per day rather than sent individually. */
export function isDigestType(type: string): boolean {
  return EVENT_BY_KEY[type]?.digest === true;
}

export interface DigestGroup {
  type: string;
  day: string;
  items: { id: string; title: string; body: string; href: string | null; at: string }[];
}

export function batchDigest<
  N extends { id: string; type: string; title: string; body: string; href: string | null; at: string },
>(notifications: N[]): { individual: N[]; digests: DigestGroup[] } {
  const individual: N[] = [];
  const byKey = new Map<string, DigestGroup>();
  for (const n of notifications) {
    if (!isDigestType(n.type)) {
      individual.push(n);
      continue;
    }
    const day = n.at.slice(0, 10);
    const key = `${n.type}|${day}`;
    const g = byKey.get(key) ?? { type: n.type, day, items: [] };
    g.items.push({ id: n.id, title: n.title, body: n.body, href: n.href, at: n.at });
    byKey.set(key, g);
  }
  return { individual, digests: [...byKey.values()].sort((a, b) => b.day.localeCompare(a.day)) };
}

/* ------------------------------------------------------- channel annotations */

/**
 * E11-S6 AC — the SMS / WhatsApp regulatory distinction is a deliberate
 * credibility point and is stated as fact, not as a hint.
 */
export const CHANNEL_NOTE: Record<NotificationChannel, string | null> = {
  IN_APP: null,
  WHATSAPP: "DLT registration is not required for WhatsApp. Phase 2 needs Meta Business verification, a WABA and phone number, template approval and a BSP (INT-04).",
  EMAIL: "No Indian telecom registration applies. Phase 2 needs a transactional sending domain with SPF, DKIM and DMARC.",
  SMS: "Transactional SMS requires TRAI DLT registration of both the sender header and the message template before a single message can be delivered (INT-05).",
};

export const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  IN_APP: "In-app",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  SMS: "SMS",
};

export const CHANNEL_REGULATORY: Record<NotificationChannel, "NONE" | "DLT_REQUIRED" | "NOT_REQUIRED"> = {
  IN_APP: "NONE",
  WHATSAPP: "NOT_REQUIRED",
  EMAIL: "NONE",
  SMS: "DLT_REQUIRED",
};

export const ALL_CHANNELS: NotificationChannel[] = ["IN_APP", "WHATSAPP", "EMAIL", "SMS"];

/* ------------------------------------------------------------- dispatch */

export interface DispatchTarget {
  role: Role;
  userId: string | null;
  name: string;
  channels: NotificationChannel[];
  suppressed: boolean;
  suppressedBecause: string | null;
}

/**
 * Resolve the recipient list for an event against the live role→user map and
 * the configured channel preferences. Roles the matrix names but that cannot
 * read the entity are returned marked `suppressed` so the preference screen can
 * show *why* nothing is sent, rather than silently omitting them.
 */
export function resolveDispatch(
  def: NotificationEventDef,
  users: { id: string; name: string; role: Role }[],
  preferences: { notificationType: string; role: Role; channels: NotificationChannel[] }[],
): DispatchTarget[] {
  return def.roles.map((role) => {
    const user = users.find((u) => u.role === role) ?? null;
    const pref = preferences.find((p) => p.notificationType === def.key && p.role === role);
    const channels = (pref?.channels ?? def.channels).filter((c) => def.channels.includes(c));
    const ok = can(role, def.capability);
    return {
      role,
      userId: user?.id ?? null,
      name: user?.name ?? "—",
      channels: ok ? channels : [],
      suppressed: !ok,
      suppressedBecause: ok ? null : suppressionReason(role, def.key),
    };
  });
}
