import * as D from "@/lib/derive";
import type { AgeingBucket } from "@/lib/derive";
import { daysBetween } from "@/lib/format";
import type { CommercialOverlay } from "./store";
import {
  BUCKET_ORDER, INSTITUTIONAL_TYPES,
  type ChallanRow, type EwayRow, type FollowUpRow, type InvoiceRow,
  type NoteRow, type ReceiptRow,
} from "./types";

/**
 * The seed and the overlay, read as one world.
 *
 * Isomorphic and pure. The server renders the baseline from these functions
 * with an empty overlay and the browser re-renders with the real one, so a
 * figure never changes meaning between first paint and hydration — only its
 * value moves, and only because a recorded mutation moved it.
 */

/* ------------------------------------------------------------------ merges */

export function mergedInvoices(base: InvoiceRow[], overlay: CommercialOverlay, now: Date): InvoiceRow[] {
  const extras = overlay.invoices.map((e) => e.row);
  return [...base, ...extras].map((row) => {
    const link = overlay.sourceLinks[row.id];
    const reported = overlay.irpReported[row.id] ?? row.irpReportedAt;
    return {
      ...row,
      irpReportedAt: reported,
      source: link ?? row.source,
      daysOutstanding: daysBetween(new Date(row.date), now),
      daysPastDue: daysBetween(new Date(row.dueDate), now),
      bucket: D.ageingBucket(row.date, now),
    };
  });
}

export function mergedChallans(base: ChallanRow[], overlay: CommercialOverlay, now: Date): ChallanRow[] {
  const ewbByBase = new Map(overlay.ewayBills.map((e) => [e.baseDocId, e.id]));
  return [...base, ...overlay.challans].map((c) => ({
    ...c,
    ageDays: daysBetween(new Date(c.date), now),
    ewayBillId: c.ewayBillId ?? ewbByBase.get(c.id) ?? null,
  }));
}

export function mergedEway(base: EwayRow[], overlay: CommercialOverlay): EwayRow[] {
  return [...base, ...overlay.ewayBills];
}

export function mergedReceipts(base: ReceiptRow[], overlay: CommercialOverlay): ReceiptRow[] {
  return [...base, ...overlay.receipts];
}

export function mergedNotes(base: NoteRow[], overlay: CommercialOverlay): NoteRow[] {
  return [...base, ...overlay.notes];
}

export function mergedFollowUps(base: FollowUpRow[], overlay: CommercialOverlay): FollowUpRow[] {
  const settled = new Set(overlay.promisesSettled);
  return [...base, ...overlay.followUps].map((f) => ({
    ...f,
    fulfilled: f.fulfilled || settled.has(f.invoiceId),
  }));
}

/* ------------------------------------------------------------- outstanding */

export interface Money {
  total: number;
  allocated: number;
  credited: number;
  debited: number;
  outstanding: number;
}

/**
 * FR-M7-11 / E8-S5 — outstanding is invoice total, less allocated receipts,
 * less credit notes, plus debit notes. One implementation, matching
 * `D.invoiceOutstanding` exactly for the seeded half and extending it to
 * whatever the overlay has added.
 */
export function invoiceMoney(row: InvoiceRow, overlay: CommercialOverlay): Money {
  let allocated = row.allocatedSeed;
  for (const a of overlay.allocations) if (a.invoiceId === row.id) allocated += a.amount;
  let credited = row.creditedSeed;
  let debited = row.debitedSeed;
  for (const n of overlay.notes) {
    if (n.invoiceId !== row.id) continue;
    if (n.kind === "CREDIT") credited += n.amount + n.gstAmount;
    else debited += n.amount + n.gstAmount;
  }
  return {
    total: row.total, allocated, credited, debited,
    outstanding: Math.max(0, row.total - allocated - credited + debited),
  };
}

/** Indexed once when a screen needs the figure for every invoice. */
export function moneyIndex(rows: InvoiceRow[], overlay: CommercialOverlay): Map<string, Money> {
  const allocated = new Map<string, number>();
  for (const a of overlay.allocations) {
    allocated.set(a.invoiceId, (allocated.get(a.invoiceId) ?? 0) + a.amount);
  }
  const credited = new Map<string, number>();
  const debited = new Map<string, number>();
  for (const n of overlay.notes) {
    const m = n.kind === "CREDIT" ? credited : debited;
    m.set(n.invoiceId, (m.get(n.invoiceId) ?? 0) + n.amount + n.gstAmount);
  }
  const out = new Map<string, Money>();
  for (const r of rows) {
    const a = r.allocatedSeed + (allocated.get(r.id) ?? 0);
    const c = r.creditedSeed + (credited.get(r.id) ?? 0);
    const d = r.debitedSeed + (debited.get(r.id) ?? 0);
    out.set(r.id, { total: r.total, allocated: a, credited: c, debited: d, outstanding: Math.max(0, r.total - a - c + d) });
  }
  return out;
}

export function receiptAllocated(receipt: ReceiptRow, overlay: CommercialOverlay): number {
  let sum = receipt.allocatedSeed;
  for (const a of overlay.allocations) if (a.receiptId === receipt.id) sum += a.amount;
  return sum;
}

export function receiptAllocations(receipt: ReceiptRow, overlay: CommercialOverlay, invoiceNumbers: Map<string, string>) {
  return [
    ...receipt.allocationsSeed,
    ...overlay.allocations
      .filter((a) => a.receiptId === receipt.id)
      .map((a) => ({ id: a.id, invoiceId: a.invoiceId, invoiceNumber: invoiceNumbers.get(a.invoiceId) ?? a.invoiceId, amount: a.amount })),
  ];
}

/* ------------------------------------------------------------------ ageing */

export interface AgeingFilters {
  branchId: string;
  customerType: string;
  accountExecutiveId: string;
  segment: "ALL" | "INSTITUTIONAL" | "PRIVATE";
  bucket: AgeingBucket | "ALL";
}

export const NO_FILTERS: AgeingFilters = {
  branchId: "ALL", customerType: "ALL", accountExecutiveId: "ALL", segment: "ALL", bucket: "ALL",
};

export function isInstitutional(row: InvoiceRow): boolean {
  return INSTITUTIONAL_TYPES.includes(row.customerType);
}

export interface OpenInvoice {
  row: InvoiceRow;
  outstanding: number;
  bucket: AgeingBucket;
  days: number;
  institutional: boolean;
}

export function openInvoices(rows: InvoiceRow[], overlay: CommercialOverlay): OpenInvoice[] {
  const money = moneyIndex(rows, overlay);
  const out: OpenInvoice[] = [];
  for (const row of rows) {
    const outstanding = money.get(row.id)?.outstanding ?? 0;
    if (outstanding <= 0) continue;
    out.push({ row, outstanding, bucket: row.bucket, days: row.daysOutstanding, institutional: isInstitutional(row) });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** The branch, customer-type and account-executive filters combine. E8-S6. */
export function applyAgeingFilters(open: OpenInvoice[], f: AgeingFilters): OpenInvoice[] {
  return open.filter((o) => {
    if (f.branchId !== "ALL" && o.row.branchId !== f.branchId) return false;
    if (f.customerType !== "ALL" && o.row.customerType !== f.customerType) return false;
    if (f.accountExecutiveId !== "ALL" && o.row.accountExecutiveId !== f.accountExecutiveId) return false;
    if (f.segment === "INSTITUTIONAL" && !o.institutional) return false;
    if (f.segment === "PRIVATE" && o.institutional) return false;
    if (f.bucket !== "ALL" && o.bucket !== f.bucket) return false;
    return true;
  });
}

export interface AgeingSummary {
  total: number;
  count: number;
  buckets: Record<AgeingBucket, { value: number; count: number }>;
  institutional: { value: number; count: number };
  privateSector: { value: number; count: number };
  /** Buckets must sum to the total exactly — asserted, not assumed. */
  reconciles: boolean;
}

export function ageingSummary(open: OpenInvoice[]): AgeingSummary {
  const buckets = {
    B0_30: { value: 0, count: 0 }, B31_60: { value: 0, count: 0 },
    B61_90: { value: 0, count: 0 }, B90_PLUS: { value: 0, count: 0 },
  } satisfies AgeingSummary["buckets"];
  const institutional = { value: 0, count: 0 };
  const privateSector = { value: 0, count: 0 };
  let total = 0;
  for (const o of open) {
    buckets[o.bucket].value += o.outstanding;
    buckets[o.bucket].count += 1;
    total += o.outstanding;
    const seg = o.institutional ? institutional : privateSector;
    seg.value += o.outstanding;
    seg.count += 1;
  }
  const bucketSum = BUCKET_ORDER.reduce((s, b) => s + buckets[b].value, 0);
  return { total, count: open.length, buckets, institutional, privateSector, reconciles: bucketSum === total };
}

/* ------------------------------------------------------- collection state */

export interface BrokenPromise {
  followUp: FollowUpRow;
  invoice: InvoiceRow;
  outstanding: number;
  promisedAmount: number;
  daysElapsed: number;
}

/**
 * E8-S6 — a promised date that passes without an allocated receipt is a
 * broken promise, carrying the promised amount and the days elapsed.
 */
export function brokenPromises(
  followUps: FollowUpRow[], invoices: Map<string, InvoiceRow>,
  money: Map<string, Money>, now: Date,
): BrokenPromise[] {
  const out: BrokenPromise[] = [];
  for (const f of followUps) {
    if (f.fulfilled || !f.promisedDate) continue;
    const elapsed = daysBetween(new Date(f.promisedDate), now);
    if (elapsed <= 0) continue;
    const invoice = invoices.get(f.invoiceId);
    if (!invoice) continue;
    const outstanding = money.get(f.invoiceId)?.outstanding ?? 0;
    if (outstanding <= 0) continue;
    out.push({
      followUp: f, invoice, outstanding,
      promisedAmount: f.promisedAmount ?? outstanding,
      daysElapsed: elapsed,
    });
  }
  return out.sort((a, b) => b.daysElapsed - a.daysElapsed);
}

export type EscalationLevel = "SIXTY" | "NINETY";

export interface Escalation {
  level: EscalationLevel;
  invoice: InvoiceRow;
  outstanding: number;
  days: number;
  recipients: string[];
  rule: string;
}

/**
 * E8-S6 — crossing 60 days notifies Accounts and the Branch Manager; crossing
 * 90 escalates to Director – Business. The rule is published beside the list
 * so the notification is explicable, not mysterious.
 */
export function escalations(open: OpenInvoice[]): Escalation[] {
  const out: Escalation[] = [];
  for (const o of open) {
    if (o.days > 90) {
      out.push({
        level: "NINETY", invoice: o.row, outstanding: o.outstanding, days: o.days,
        recipients: ["Accounts", `Branch Manager — ${o.row.branchName}`, "Director – Business"],
        rule: "Outstanding beyond 90 days escalates to Director – Business, with Accounts and the Branch Manager retained.",
      });
    } else if (o.days > 60) {
      out.push({
        level: "SIXTY", invoice: o.row, outstanding: o.outstanding, days: o.days,
        recipients: ["Accounts", `Branch Manager — ${o.row.branchName}`],
        rule: "Outstanding crossing 60 days notifies Accounts and the Branch Manager.",
      });
    }
  }
  return out.sort((a, b) => b.days - a.days);
}

/* ---------------------------------------------------------------- periods */

export interface PeriodSpec { key: string; label: string; from: string; to: string }

/** Month options across the seeded history, newest first, plus the two FYs. */
export function periodOptions(now: Date): PeriodSpec[] {
  const out: PeriodSpec[] = [];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    out.push({
      key: `M-${d.getFullYear()}-${d.getMonth() + 1}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      from: from.toISOString(), to: to.toISOString(),
    });
  }
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  for (const y of [fyStart, fyStart - 1]) {
    out.push({
      key: `FY-${y}`,
      label: `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`,
      from: new Date(y, 3, 1, 0, 0, 0, 0).toISOString(),
      to: new Date(y + 1, 2, 31, 23, 59, 59, 999).toISOString(),
    });
  }
  return out;
}

export function inPeriod(iso: string, p: { from: string; to: string }): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(p.from).getTime() && t <= new Date(p.to).getTime();
}
