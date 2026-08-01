/**
 * E11-S5 / FR-M10-13 — outbound message templates with variable substitution.
 *
 * Templates mirror the shape a WhatsApp Business API template actually takes:
 * a fixed body with numbered placeholders, a declared variable list, and an
 * optional interactive button set. Substitution is pulled from the subject
 * entity, and the composed message is previewable before dispatch.
 */

import type { NotificationChannel } from "@/lib/schemas/enums";

export interface TemplateVariable {
  key: string;
  label: string;
  /** Where the value comes from when the composer auto-fills. */
  source: string;
  example: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  /** Meta template category, as it would be submitted for approval. */
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  channels: NotificationChannel[];
  /** Notification matrix event this template serves. */
  eventKey: string;
  body: string;
  variables: TemplateVariable[];
  buttons: { id: "APPROVE" | "REJECT" | "OPEN"; label: string }[];
  footer: string;
}

const V = (key: string, label: string, source: string, example: string): TemplateVariable => ({
  key, label, source, example,
});

export const TEMPLATES: MessageTemplate[] = [
  {
    id: "approval_request_v1",
    name: "Approval required",
    category: "UTILITY",
    channels: ["WHATSAPP"],
    eventKey: "DISCOUNT_APPROVAL_REQUIRED",
    body:
      "*Pravaah — Approval required*\n" +
      "{{subject}}\n\n" +
      "Type: {{requestType}}\n" +
      "Value: {{value}}\n" +
      "Raised by: {{requester}}\n" +
      "Reference: {{number}}\n\n" +
      "Step {{step}} of {{steps}} · SLA {{sla}} h\n" +
      "Reply or use the buttons below to decide.",
    variables: [
      V("subject", "Subject", "ApprovalRequest.subjectLabel", "Discount 12% on screw compressor package"),
      V("requestType", "Request type", "ApprovalRequest.type", "Quotation discount"),
      V("value", "Value", "ApprovalRequest.value", "₹14.5 L"),
      V("requester", "Requester", "User.name of ApprovalRequest.requesterUserId", "R. Prasad"),
      V("number", "Reference", "ApprovalRequest.number", "BC/APR/2627/0001"),
      V("step", "Current step", "ApprovalRequest.currentStep", "1"),
      V("steps", "Total steps", "ApprovalRequest.resolvedSteps.length", "3"),
      V("sla", "Step SLA hours", "resolvedSteps[current].escalationHours", "8"),
    ],
    buttons: [
      { id: "APPROVE", label: "Approve" },
      { id: "REJECT", label: "Reject" },
    ],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "approval_escalation_v1",
    name: "Approval escalated",
    category: "UTILITY",
    channels: ["WHATSAPP", "SMS"],
    eventKey: "APPROVAL_PENDING",
    body:
      "*Pravaah — Approval escalated*\n" +
      "{{subject}}\n\n" +
      "Pending {{age}} h against a {{sla}} h step SLA.\n" +
      "Original approver: {{originalApprover}}\n" +
      "Now also actionable by: {{escalatedTo}}\n" +
      "Reference: {{number}}",
    variables: [
      V("subject", "Subject", "ApprovalRequest.subjectLabel", "Credit limit override — institutional client"),
      V("age", "Hours pending", "now − stepStartedAt", "40"),
      V("sla", "Step SLA hours", "resolvedSteps[current].escalationHours", "8"),
      V("originalApprover", "Original approver", "resolvedSteps[current].approverRole", "Accounts Executive"),
      V("escalatedTo", "Escalated to", "next authority", "Director – Business"),
      V("number", "Reference", "ApprovalRequest.number", "BC/APR/2627/0005"),
    ],
    buttons: [
      { id: "APPROVE", label: "Approve" },
      { id: "REJECT", label: "Reject" },
    ],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "approval_outcome_v1",
    name: "Approval outcome to requester",
    category: "UTILITY",
    channels: ["WHATSAPP", "SMS", "EMAIL"],
    eventKey: "APPROVAL_PENDING",
    body:
      "*Pravaah — {{outcome}}*\n" +
      "{{subject}}\n\n" +
      "Decided by: {{approver}}\n" +
      "Reason: {{reason}}\n" +
      "Reference: {{number}}",
    variables: [
      V("outcome", "Outcome", "ApprovalDecision.decision", "Returned for clarification"),
      V("subject", "Subject", "ApprovalRequest.subjectLabel", "RA-bill 05 submission"),
      V("approver", "Approver", "User.name of decision actor", "S. Kumar"),
      V("reason", "Reason", "ApprovalDecision.comment", "Attach the certified measurement sheet"),
      V("number", "Reference", "ApprovalRequest.number", "BC/APR/2627/0006"),
    ],
    buttons: [{ id: "OPEN", label: "Open in Pravaah" }],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "leave_request_v1",
    name: "Leave request",
    category: "UTILITY",
    channels: ["WHATSAPP"],
    eventKey: "LEAVE_REQUEST_RAISED",
    body:
      "*Pravaah — Leave request*\n" +
      "{{employee}} has applied for {{days}} day(s).\n\n" +
      "From: {{fromDate}}\n" +
      "To: {{toDate}}\n" +
      "Type: {{leaveType}}\n" +
      "Coverage: {{coverage}}\n" +
      "Reference: {{number}}",
    variables: [
      V("employee", "Employee", "Employee.name", "A. Kumar"),
      V("days", "Days", "LeaveRequest.days", "3"),
      V("fromDate", "From", "LeaveRequest.fromDate", "04 Aug 2026"),
      V("toDate", "To", "LeaveRequest.toDate", "06 Aug 2026"),
      V("leaveType", "Leave type", "LeaveType.name", "Casual Leave"),
      V("coverage", "Coverage arrangement", "LeaveRequest.coverageArrangement", "Handover to colleague"),
      V("number", "Reference", "LeaveRequest.number", "BC/LV/2627/0031"),
    ],
    buttons: [
      { id: "APPROVE", label: "Approve" },
      { id: "REJECT", label: "Reject" },
    ],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "sla_breach_v1",
    name: "SLA breached",
    category: "UTILITY",
    channels: ["WHATSAPP", "SMS"],
    eventKey: "SLA_BREACHED",
    body:
      "*Pravaah — SLA breached*\n" +
      "Ticket {{ticket}} at {{customer}}, {{site}}.\n\n" +
      "Severity: {{severity}}\n" +
      "Overrun: {{overrun}}\n" +
      "Engineer: {{engineer}}",
    variables: [
      V("ticket", "Ticket number", "ServiceTicket.number", "BC/TKT/2627/0412"),
      V("customer", "Customer", "Customer.tradeName", "Bihar Steels"),
      V("site", "Site", "Site.name", "Fatuha Works"),
      V("severity", "Severity", "ServiceTicket.severity", "Critical"),
      V("overrun", "Overrun", "slaClock().overrunMs", "6h 20m"),
      V("engineer", "Engineer", "Employee.name", "M. Singh"),
    ],
    buttons: [{ id: "OPEN", label: "Open ticket" }],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "amc_expiry_v1",
    name: "AMC expiring",
    category: "UTILITY",
    channels: ["WHATSAPP"],
    eventKey: "AMC_EXPIRING",
    body:
      "*Pravaah — AMC expiring*\n" +
      "{{contract}} for {{customer}} expires on {{endDate}} ({{daysLeft}} days).\n\n" +
      "Contract value: {{value}}\n" +
      "Machines covered: {{assets}}",
    variables: [
      V("contract", "Contract number", "AMCContract.number", "BC/AMC/2627/0044"),
      V("customer", "Customer", "Customer.tradeName", "Magadh Cements"),
      V("endDate", "End date", "AMCContract.endDate", "12 Sep 2026"),
      V("daysLeft", "Days remaining", "endDate − today", "43"),
      V("value", "Contract value", "AMCContract.contractValue", "₹2.24 L"),
      V("assets", "Machines covered", "AMCContract.assetIds.length", "4"),
    ],
    buttons: [{ id: "OPEN", label: "Open renewal radar" }],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "stock_critical_v1",
    name: "Service-critical stock",
    category: "UTILITY",
    channels: ["WHATSAPP"],
    eventKey: "STOCK_SERVICE_CRITICAL",
    body:
      "*Pravaah — Service-critical stock*\n" +
      "{{item}} is at {{onHand}} {{uom}}, at or below the reorder level of {{reorder}}.\n\n" +
      "Lead time: {{leadTime}} days\n" +
      "Open job cards awaiting this part: {{blocked}}",
    variables: [
      V("item", "Item", "Item.description", "Air end oil filter — screw series"),
      V("onHand", "On hand", "stockOnHand()", "2"),
      V("uom", "Unit", "Item.uom", "NOS"),
      V("reorder", "Reorder level", "Item.reorderLevel", "6"),
      V("leadTime", "Lead time", "Item.leadTimeDays", "12"),
      V("blocked", "Blocked job cards", "partsRequests count", "3"),
    ],
    buttons: [{ id: "OPEN", label: "Open reorder list" }],
    footer: "Bhushancorp Private Limited · Patna",
  },
  {
    id: "payment_reminder_v1",
    name: "Payment reminder",
    category: "UTILITY",
    channels: ["WHATSAPP", "SMS"],
    eventKey: "INVOICE_OVER_90",
    body:
      "*Pravaah — Payment reminder*\n" +
      "Invoice {{invoice}} dated {{invoiceDate}} for {{amount}} is {{days}} days outstanding.\n\n" +
      "Customer: {{customer}}\n" +
      "Outstanding: {{outstanding}}",
    variables: [
      V("invoice", "Invoice number", "Invoice.number", "BC/INV/2627/0618"),
      V("invoiceDate", "Invoice date", "Invoice.date", "18 Mar 2026"),
      V("amount", "Invoice value", "invoiceTotal()", "₹8.4 L"),
      V("days", "Days outstanding", "today − Invoice.date", "135"),
      V("customer", "Customer", "Customer.tradeName", "Nalanda Infratech"),
      V("outstanding", "Outstanding", "invoiceOutstanding()", "₹6.1 L"),
    ],
    buttons: [{ id: "OPEN", label: "Open invoice" }],
    footer: "Bhushancorp Private Limited · Patna",
  },
];

export const TEMPLATE_BY_ID: Record<string, MessageTemplate> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

export function templateName(id: string): string {
  return TEMPLATE_BY_ID[id]?.name ?? id;
}

export interface RenderResult {
  text: string;
  missing: string[];
}

/** `{{key}}` substitution. Unfilled variables are reported, never left raw. */
export function renderTemplate(
  template: MessageTemplate,
  values: Record<string, string>,
): RenderResult {
  const missing: string[] = [];
  const text = template.body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = values[key];
    if (v === undefined || v.trim() === "") {
      missing.push(key);
      return `[${key}]`;
    }
    return v;
  });
  return { text, missing };
}

/**
 * WhatsApp inline formatting: *bold*, _italic_, ~strike~, ```mono```.
 * Returned as tokens so the renderer never has to set innerHTML.
 */
export type RichToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "strike"; value: string }
  | { kind: "mono"; value: string };

const PATTERN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g;

export function parseRich(line: string): RichToken[] {
  const out: RichToken[] = [];
  let last = 0;
  for (const m of line.matchAll(PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", value: line.slice(last, idx) });
    const tok = m[0]!;
    if (tok.startsWith("```")) out.push({ kind: "mono", value: tok.slice(3, -3) });
    else if (tok.startsWith("*")) out.push({ kind: "bold", value: tok.slice(1, -1) });
    else if (tok.startsWith("_")) out.push({ kind: "italic", value: tok.slice(1, -1) });
    else out.push({ kind: "strike", value: tok.slice(1, -1) });
    last = idx + tok.length;
  }
  if (last < line.length) out.push({ kind: "text", value: line.slice(last) });
  return out.length ? out : [{ kind: "text", value: line }];
}
