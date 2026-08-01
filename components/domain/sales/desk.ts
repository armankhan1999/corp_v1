import type * as T from "@/lib/schemas/entities";
import type { QuotationStatus } from "@/lib/schemas/enums";
import { daysBetween } from "@/lib/format";
import {
  derivePlaceOfSupply, effectiveStatus, groupBy, quotationTotals, startOfDay, validityEnd,
} from "./calc";
import type { SalesWorld } from "./store";

/**
 * E3-S9 — the sales desk. Everything the executive's working screen shows is
 * derived here so the counts on the cards, the lists beneath them and the
 * pipeline board cannot tell three different stories.
 */

export type DueState = "OVERDUE" | "TODAY" | "UPCOMING";

export interface DeskFollowUp {
  activity: T.Activity;
  due: Date;
  state: DueState;
  /** Whole days between the next-action date and today. */
  daysLate: number;
  subjectLabel: string;
  subjectHref: string;
  customerId: string;
  customerName: string;
}

/**
 * E3-S9 AC-4 — a follow-up whose next-action date has passed *with no
 * subsequent activity* is overdue. Only the newest activity on a subject can be
 * unanswered, so the rule reduces to: take the latest activity per subject and
 * test its next-action date. Anything older was answered by definition.
 */
export function deskFollowUps(w: SalesWorld, userId: string): DeskFollowUp[] {
  const today = startOfDay(w.now);
  const bySubject = groupBy(w.activities, (a) => `${a.subjectType}:${a.subjectId}`);
  const out: DeskFollowUp[] = [];

  for (const list of bySubject.values()) {
    const latest = list.slice().sort((a, b) => b.at.localeCompare(a.at))[0];
    if (!latest || !latest.nextActionDate) continue;

    let subjectLabel: string;
    let subjectHref: string;
    if (latest.subjectType === "ENQUIRY") {
      const e = w.enquiryById.get(latest.subjectId);
      if (!e || e.ownerUserId !== userId) continue;
      if (e.status === "WON" || e.status === "LOST" || e.status === "DROPPED") continue;
      subjectLabel = `Enquiry ${e.number}`;
      subjectHref = "/sales/pipeline";
    } else if (latest.subjectType === "QUOTATION") {
      const q = w.quotationById.get(latest.subjectId);
      if (!q || q.ownerUserId !== userId) continue;
      const s = effectiveStatus(q, w.now);
      if (s === "WON" || s === "LOST") continue;
      subjectLabel = `Quotation ${q.number} v${q.version}`;
      subjectHref = `/sales/quotations/${q.id}`;
    } else if (latest.subjectType === "CUSTOMER") {
      const c = w.customerById.get(latest.subjectId);
      if (!c || c.ownerUserId !== userId) continue;
      subjectLabel = `Customer ${c.legalName}`;
      subjectHref = `/sales/customers/${c.id}`;
    } else {
      continue;
    }

    const due = new Date(latest.nextActionDate);
    const daysLate = daysBetween(due, today);
    out.push({
      activity: latest,
      due,
      state: daysLate > 0 ? "OVERDUE" : daysLate === 0 ? "TODAY" : "UPCOMING",
      daysLate,
      subjectLabel,
      subjectHref,
      customerId: latest.customerId,
      customerName: w.customerById.get(latest.customerId)?.legalName ?? "Unknown customer",
    });
  }

  const rank: Record<DueState, number> = { OVERDUE: 0, TODAY: 1, UPCOMING: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || b.daysLate - a.daysLate || a.due.getTime() - b.due.getTime());
}

export interface DeskEnquiry {
  enquiry: T.Enquiry;
  customerName: string;
  ageDays: number;
  quotationCount: number;
  hasNextAction: boolean;
}

export function deskEnquiries(w: SalesWorld, userId: string): DeskEnquiry[] {
  const withNext = new Set(
    w.activities.filter((a) => a.nextActionDate && a.subjectType === "ENQUIRY").map((a) => a.subjectId),
  );
  return w.enquiries
    .filter((e) => e.ownerUserId === userId)
    .filter((e) => e.status !== "WON" && e.status !== "LOST" && e.status !== "DROPPED")
    .map((e) => ({
      enquiry: e,
      customerName: w.customerById.get(e.customerId)?.legalName ?? "Unknown customer",
      ageDays: Math.max(0, daysBetween(e.createdAt, w.now)),
      quotationCount: w.quotations.filter((q) => q.enquiryId === e.id).length,
      hasNextAction: withNext.has(e.id),
    }))
    .sort((a, b) => b.ageDays - a.ageDays);
}

export interface DeskQuotation {
  quotation: T.Quotation;
  status: QuotationStatus;
  customerName: string;
  value: number;
  ageDays: number;
  validUntil: Date;
  /** What this executive has to do about it, in words. */
  action: string;
  tone: "danger" | "warn" | "info" | "neutral";
  priority: number;
}

/** E3-S9 AC-1 — quotations awaiting action, with the action named rather than implied. */
export function deskQuotations(w: SalesWorld, userId: string): DeskQuotation[] {
  const out: DeskQuotation[] = [];

  for (const q of w.quotations) {
    if (q.ownerUserId !== userId) continue;
    const status = effectiveStatus(q, w.now);
    if (status === "WON" || status === "LOST") continue;

    // Only the newest version of a family is actionable; a superseded version
    // is read-only and would double-count the same opportunity.
    const family = w.quotationsByRoot.get(q.rootId) ?? [q];
    if (family[family.length - 1]?.id !== q.id) continue;

    const lines = (w.linesByQuotation.get(q.id) ?? []).filter((l) => l.quotationId === q.id);
    const pos = derivePlaceOfSupply(
      w.customerById.get(q.customerId),
      q.siteId ? w.siteById.get(q.siteId) : undefined,
    );
    const value = quotationTotals(lines, pos.treatment).grandTotal;
    const ageDays = Math.max(0, daysBetween(q.quotationDate, w.now));

    let action: string;
    let tone: DeskQuotation["tone"];
    let priority: number;
    switch (status) {
      case "EXPIRED":
        action = "Lapsed past validity — revise to a new version or close it";
        tone = "danger";
        priority = 0;
        break;
      case "NEGOTIATION":
        action = "In negotiation — close it, or record where it stands";
        tone = "warn";
        priority = 1;
        break;
      case "DRAFT":
        action = "Draft — finish the lines and issue it";
        tone = "neutral";
        priority = 2;
        break;
      case "PENDING_APPROVAL":
        action = "With the approver — issue is blocked until a decision is recorded";
        tone = "info";
        priority = 3;
        break;
      default:
        action = "Issued — chase the customer for a decision";
        tone = "info";
        priority = 4;
    }

    out.push({
      quotation: q,
      status,
      customerName: w.customerById.get(q.customerId)?.legalName ?? "Unknown customer",
      value,
      ageDays,
      validUntil: validityEnd(q),
      action,
      tone,
      priority,
    });
  }

  return out.sort((a, b) => a.priority - b.priority || b.value - a.value);
}
