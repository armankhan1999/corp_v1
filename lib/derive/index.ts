import type { Dataset } from "../schemas";
import type * as T from "../schemas/entities";
import type { CoverageState, SLAState, RetentionState, AMCStatus, CommissioningSubmission } from "../schemas/enums";
import { round2 } from "../seed/rng";

/**
 * AR-1 / AR-2 — every derived value and every KPI has exactly one implementation
 * here. Dashboards, analytics surfaces, the AI assistant and the seed validator
 * all import from this module, so the same number cannot differ between screens.
 */

const DAY = 86_400_000;
const addMonths = (d: Date, m: number) => {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() < day) x.setDate(0);
  return x;
};

export interface DeriveCtx {
  ds: Dataset;
  now: Date;
}

export function ctxOf(ds: Dataset, todayIso?: string): DeriveCtx {
  return { ds, now: new Date(todayIso ?? ds.meta.today) };
}

/* ------------------------------------------------------------- money basics */

/**
 * Per-dataset index. Without this, `invoiceTotal` scanned all 1,565 invoice
 * lines for each of 618 invoices and `receivables()` called it once per
 * invoice — roughly a million array visits per request, on every `force-dynamic`
 * route. Measured under two concurrent Playwright workers it starved the server
 * and sign-in exceeded 20 s.
 *
 * The derive layer is pure over (dataset, now), so indexing is a cache and not
 * a redesign. A WeakMap keyed on the dataset keeps it correct across a Demo
 * Controls reset, which swaps the object rather than mutating it.
 */
interface MoneyIndex {
  totalByInvoice: Map<string, number>;
  taxableByInvoice: Map<string, number>;
  allocatedByInvoice: Map<string, number>;
  creditByInvoice: Map<string, number>;
  debitByInvoice: Map<string, number>;
}

const moneyIndexes = new WeakMap<Dataset, MoneyIndex>();

function moneyIndex(ds: Dataset): MoneyIndex {
  const cached = moneyIndexes.get(ds);
  if (cached) return cached;

  const idx: MoneyIndex = {
    totalByInvoice: new Map(), taxableByInvoice: new Map(),
    allocatedByInvoice: new Map(), creditByInvoice: new Map(), debitByInvoice: new Map(),
  };
  const bump = (m: Map<string, number>, k: string, v: number) =>
    m.set(k, (m.get(k) ?? 0) + v);

  for (const l of ds.invoiceLines) {
    bump(idx.totalByInvoice, l.invoiceId, Math.round(l.qty * l.rate * (1 + l.gstRate / 100)));
    bump(idx.taxableByInvoice, l.invoiceId, Math.round(l.qty * l.rate * (1 - l.discountPct / 100)));
  }
  for (const a of ds.receiptAllocations) bump(idx.allocatedByInvoice, a.invoiceId, a.amount);
  for (const c of ds.creditNotes) {
    const target = c.kind === "CREDIT" ? idx.creditByInvoice : idx.debitByInvoice;
    bump(target, c.invoiceId, c.amount + c.gstAmount);
  }

  moneyIndexes.set(ds, idx);
  return idx;
}

/** Invalidate the cache after a mutation that changes invoice money. */
export function invalidateMoneyIndex(ds: Dataset): void {
  moneyIndexes.delete(ds);
}

export function invoiceTotal(ds: Dataset, invoiceId: string): number {
  return moneyIndex(ds).totalByInvoice.get(invoiceId) ?? 0;
}

export function invoiceTaxable(ds: Dataset, invoiceId: string): number {
  return moneyIndex(ds).taxableByInvoice.get(invoiceId) ?? 0;
}

/** Invoice.outstanding = total − allocated receipts − credit notes. PRD §6.4. */
export function invoiceOutstanding(ds: Dataset, invoiceId: string): number {
  const idx = moneyIndex(ds);
  const total = idx.totalByInvoice.get(invoiceId) ?? 0;
  const allocated = idx.allocatedByInvoice.get(invoiceId) ?? 0;
  const credited = idx.creditByInvoice.get(invoiceId) ?? 0;
  const debited = idx.debitByInvoice.get(invoiceId) ?? 0;
  return Math.max(0, total - allocated - credited + debited);
}

export type AgeingBucket = "B0_30" | "B31_60" | "B61_90" | "B90_PLUS";

export function ageingBucket(invoiceDate: string | Date, now: Date): AgeingBucket {
  const days = Math.floor((now.getTime() - new Date(invoiceDate).getTime()) / DAY);
  if (days <= 30) return "B0_30";
  if (days <= 60) return "B31_60";
  if (days <= 90) return "B61_90";
  return "B90_PLUS";
}

export interface ReceivablesSummary {
  total: number;
  buckets: Record<AgeingBucket, { value: number; count: number }>;
  institutional: number;
  privateSector: number;
  openInvoices: { invoice: T.Invoice; outstanding: number; bucket: AgeingBucket; days: number }[];
}

export function receivables(ctx: DeriveCtx, filter?: { branchId?: string }): ReceivablesSummary {
  const { ds, now } = ctx;
  const instIds = new Set(
    ds.customers.filter((c) => c.type === "INSTITUTIONAL" || c.type === "GOVERNMENT").map((c) => c.id),
  );
  const buckets: ReceivablesSummary["buckets"] = {
    B0_30: { value: 0, count: 0 }, B31_60: { value: 0, count: 0 },
    B61_90: { value: 0, count: 0 }, B90_PLUS: { value: 0, count: 0 },
  };
  let total = 0, institutional = 0, privateSector = 0;
  const openInvoices: ReceivablesSummary["openInvoices"] = [];

  for (const inv of ds.invoices) {
    if (filter?.branchId && inv.branchId !== filter.branchId) continue;
    const outstanding = invoiceOutstanding(ds, inv.id);
    if (outstanding <= 0) continue;
    const bucket = ageingBucket(inv.date, now);
    const days = Math.floor((now.getTime() - new Date(inv.date).getTime()) / DAY);
    buckets[bucket].value += outstanding;
    buckets[bucket].count += 1;
    total += outstanding;
    if (instIds.has(inv.customerId)) institutional += outstanding;
    else privateSector += outstanding;
    openInvoices.push({ invoice: inv, outstanding, bucket, days });
  }
  openInvoices.sort((a, b) => b.days - a.days);
  return { total, buckets, institutional, privateSector, openInvoices };
}

/* ----------------------------------------------------------------- retention */

export function retentionStateOf(entry: T.RetentionEntry, now: Date): RetentionState {
  if (entry.releasedAt) return "RELEASED";
  if (entry.claimRaisedAt) return "CLAIM_RAISED";
  return new Date(entry.eligibleFrom) <= now ? "ELIGIBLE" : "NOT_ELIGIBLE";
}

export interface RetentionSummary {
  withheld: number;
  released: number;
  outstanding: number;
  eligible: number;
  projectCount: number;
  eligibleProjectCount: number;
  byProject: { projectId: string; outstanding: number; eligible: number; state: RetentionState }[];
}

export function retention(ctx: DeriveCtx): RetentionSummary {
  const { ds, now } = ctx;
  let withheld = 0, released = 0, outstanding = 0, eligible = 0;
  const byProjectMap = new Map<string, { outstanding: number; eligible: number; state: RetentionState }>();

  for (const e of ds.retentionEntries) {
    withheld += e.amount;
    const state = retentionStateOf(e, now);
    if (state === "RELEASED") {
      released += e.releasedAmount ?? e.amount;
      continue;
    }
    outstanding += e.amount;
    if (state === "ELIGIBLE" || state === "CLAIM_RAISED") eligible += e.amount;
    const cur = byProjectMap.get(e.projectId) ?? { outstanding: 0, eligible: 0, state };
    cur.outstanding += e.amount;
    if (state === "ELIGIBLE" || state === "CLAIM_RAISED") cur.eligible += e.amount;
    if (state === "ELIGIBLE") cur.state = "ELIGIBLE";
    byProjectMap.set(e.projectId, cur);
  }
  const byProject = [...byProjectMap].map(([projectId, v]) => ({ projectId, ...v }));
  return {
    withheld, released, outstanding, eligible,
    projectCount: byProject.length,
    eligibleProjectCount: byProject.filter((p) => p.eligible > 0).length,
    byProject,
  };
}

/** The headline. Locked cash = receivables outstanding + retention outstanding. */
export function lockedCash(ctx: DeriveCtx): { total: number; receivables: number; retention: number } {
  const r = receivables(ctx);
  const ret = retention(ctx);
  return { total: r.total + ret.outstanding, receivables: r.total, retention: ret.outstanding };
}

/* ------------------------------------------------------------------ coverage */

export function warrantyEnd(asset: T.InstalledAsset): Date | null {
  if (!asset.commissioningDate) return null;
  return addMonths(new Date(asset.commissioningDate), asset.warrantyMonths);
}

export function liveAmcFor(ds: Dataset, assetId: string, now: Date): T.AMCContract | null {
  return (
    ds.amcContracts.find(
      (a) =>
        !a.terminated &&
        a.assetIds.includes(assetId) &&
        new Date(a.startDate) <= now &&
        new Date(a.endDate) >= now,
    ) ?? null
  );
}

/** Derived, never stored. In Warranty takes precedence; AMC shown as additionally in force. */
export function coverageState(ds: Dataset, asset: T.InstalledAsset, now: Date): CoverageState {
  if (asset.status === "DECOMMISSIONED") return "OUT_OF_COVERAGE";
  const wEnd = warrantyEnd(asset);
  if (wEnd && wEnd > now) return "IN_WARRANTY";
  if (liveAmcFor(ds, asset.id, now)) return "UNDER_AMC";
  return "OUT_OF_COVERAGE";
}

export function amcStatus(contract: T.AMCContract, now: Date): AMCStatus {
  if (contract.terminated) return "TERMINATED";
  if (contract.renewedIntoId) return "RENEWED";
  const start = new Date(contract.startDate), end = new Date(contract.endDate);
  if (start > now) return "DRAFT";
  if (end < now) return "EXPIRED";
  const daysLeft = Math.floor((end.getTime() - now.getTime()) / DAY);
  return daysLeft <= 60 ? "EXPIRING" : "ACTIVE";
}

/* ----------------------------------------------------------------- SLA clock */

export interface SlaClock {
  state: SLAState;
  remainingMs: number;
  elapsedMs: number;
  totalMs: number;
  fractionRemaining: number;
  breached: boolean;
  overrunMs: number;
  dueAt: Date;
}

export function slaClock(ticket: T.ServiceTicket, now: Date): SlaClock {
  const logged = new Date(ticket.loggedAt).getTime();
  const due = new Date(ticket.restorationDue).getTime() + ticket.pausedMs;
  const stop = ticket.restoredAt ? new Date(ticket.restoredAt).getTime() : now.getTime();
  const totalMs = due - logged;
  const remainingMs = due - stop;
  const fractionRemaining = totalMs > 0 ? remainingMs / totalMs : 0;
  let state: SLAState;
  if (remainingMs <= 0) state = "BREACHED";
  else if (fractionRemaining < 0.1) state = "IMMINENT";
  else if (fractionRemaining < 0.25) state = "APPROACHING";
  else state = "COMFORTABLE";
  return {
    state, remainingMs, elapsedMs: stop - logged, totalMs,
    fractionRemaining, breached: remainingMs <= 0,
    overrunMs: remainingMs < 0 ? -remainingMs : 0,
    dueAt: new Date(due),
  };
}

export function isOpenTicket(t: T.ServiceTicket): boolean {
  return !["CLOSED", "CANCELLED", "RESOLVED"].includes(t.status);
}

/* ----------------------------------------------------------- commissioning */

export function commissioningDeadline(
  report: T.CommissioningReport, principalWindowDays: number,
): Date {
  return new Date(new Date(report.commissioningDate).getTime() + principalWindowDays * DAY);
}

export function commissioningSubmissionState(
  report: T.CommissioningReport, deadline: Date, now: Date,
): CommissioningSubmission {
  if (!report.submittedAt) return now > deadline ? "OVERDUE" : "NOT_SUBMITTED";
  return new Date(report.submittedAt) <= deadline ? "SUBMITTED_IN_WINDOW" : "SUBMITTED_LATE";
}

/* ------------------------------------------------------------------- stock */

/**
 * Same indexing rationale as the money index: an unindexed `stockOnHand` walked
 * all ~4,200 movements per item, and the stock list asks for 1,240 items.
 * Balance is still the sum of the ledger (E7-S2) — this only changes how the
 * sum is reached, never what it equals, which the seed validator asserts.
 */
interface StockIndex {
  netByItem: Map<string, number>;
  netByItemLocation: Map<string, number>;
  lastIssueByItem: Map<string, number>;
}

const stockIndexes = new WeakMap<Dataset, StockIndex>();

function stockIndex(ds: Dataset): StockIndex {
  const cached = stockIndexes.get(ds);
  if (cached) return cached;

  const idx: StockIndex = {
    netByItem: new Map(), netByItemLocation: new Map(), lastIssueByItem: new Map(),
  };
  const bump = (m: Map<string, number>, k: string, v: number) =>
    m.set(k, (m.get(k) ?? 0) + v);

  for (const m of ds.stockMovements) {
    if (m.toLocationId) {
      bump(idx.netByItem, m.itemId, m.qty);
      bump(idx.netByItemLocation, `${m.itemId}|${m.toLocationId}`, m.qty);
    }
    if (m.fromLocationId) {
      bump(idx.netByItem, m.itemId, -m.qty);
      bump(idx.netByItemLocation, `${m.itemId}|${m.fromLocationId}`, -m.qty);
    }
    if (m.type === "ISSUE") {
      const at = new Date(m.at).getTime();
      const prev = idx.lastIssueByItem.get(m.itemId);
      if (prev === undefined || at > prev) idx.lastIssueByItem.set(m.itemId, at);
    }
  }

  stockIndexes.set(ds, idx);
  return idx;
}

export function invalidateStockIndex(ds: Dataset): void {
  stockIndexes.delete(ds);
}

export function stockOnHand(ds: Dataset, itemId: string, locationId?: string): number {
  const idx = stockIndex(ds);
  return locationId
    ? idx.netByItemLocation.get(`${itemId}|${locationId}`) ?? 0
    : idx.netByItem.get(itemId) ?? 0;
}

export function stockReserved(ds: Dataset, itemId: string, locationId?: string): number {
  return ds.stockReservations
    .filter((r) => r.itemId === itemId && (!locationId || r.locationId === locationId))
    .reduce((s, r) => s + r.qty, 0);
}

export function stockValue(ds: Dataset): number {
  const costById = new Map(ds.items.map((i) => [i.id, i.standardCost]));
  let value = 0;
  for (const [itemId, qty] of stockIndex(ds).netByItem) {
    value += qty * (costById.get(itemId) ?? 0);
  }
  return Math.round(value);
}

export function lastIssueDate(ds: Dataset, itemId: string): Date | null {
  const at = stockIndex(ds).lastIssueByItem.get(itemId);
  return at === undefined ? null : new Date(at);
}

export function nonMovingItems(ctx: DeriveCtx, trailingDays = 180): { item: T.Item; qty: number; value: number }[] {
  const { ds, now } = ctx;
  const out: { item: T.Item; qty: number; value: number }[] = [];
  for (const item of ds.items) {
    if (item.category === "SERVICE") continue;
    const last = lastIssueDate(ds, item.id);
    if (last && (now.getTime() - last.getTime()) / DAY <= trailingDays) continue;
    const qty = stockOnHand(ds, item.id);
    if (qty <= 0) continue;
    out.push({ item, qty, value: Math.round(qty * item.standardCost) });
  }
  return out.sort((a, b) => b.value - a.value);
}

/* -------------------------------------------------------------------- BOQ */

export function boqExecutedQty(ds: Dataset, boqLineId: string): number {
  let qty = 0;
  for (const dpr of ds.dprs) {
    if (dpr.supersedesId) continue;
    for (const e of dpr.execution) if (e.boqLineId === boqLineId) qty += e.qty;
  }
  return round2(qty);
}

export function projectProgress(ds: Dataset, projectId: string): { executedValue: number; contractedValue: number; pct: number } {
  const lines = ds.boqLines.filter((l) => l.projectId === projectId);
  const contractedValue = lines.reduce((s, l) => s + (l.contractedQty + l.variationQty) * l.rate, 0);
  const executedValue = lines.reduce((s, l) => s + boqExecutedQty(ds, l.id) * l.rate, 0);
  return {
    executedValue: Math.round(executedValue),
    contractedValue: Math.round(contractedValue),
    pct: contractedValue ? round2((executedValue / contractedValue) * 100) : 0,
  };
}

export function scheduleVariancePct(ds: Dataset, project: T.Project, now: Date): number {
  const ms = ds.milestones.filter((m) => m.projectId === project.id);
  const plannedPct = ms
    .filter((m) => new Date(m.plannedDate) <= now)
    .reduce((s, m) => s + m.weightage, 0);
  const actualPct = ms
    .filter((m) => m.actualDate && new Date(m.actualDate) <= now)
    .reduce((s, m) => s + m.weightage, 0);
  if (plannedPct === 0) return 0;
  return round2(((actualPct - plannedPct) / plannedPct) * 100);
}

export function raBillCurrentPeriodValue(bill: T.RABill): number {
  return bill.cumulativeValue - bill.previousCumulative;
}

/* ------------------------------------------------------- KPI dictionary (22) */

export interface Period { from: Date; to: Date }

export function fyToDate(now: Date): Period {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: new Date(startYear, 3, 1), to: now };
}

const inPeriod = (d: string | Date, p: Period) => {
  const t = new Date(d).getTime();
  return t >= p.from.getTime() && t <= p.to.getTime();
};

export function revenueInPeriod(ds: Dataset, p: Period, filter?: { branchId?: string }): number {
  return ds.invoices
    .filter((i) => inPeriod(i.date, p) && (!filter?.branchId || i.branchId === filter.branchId))
    .reduce((s, i) => s + invoiceTotal(ds, i.id), 0);
}

export function revenueByVertical(ds: Dataset, p: Period): Record<string, number> {
  const out: Record<string, number> = {
    EQUIPMENT_SALES: 0, SERVICE_AMC: 0, PROJECTS: 0, RENTAL: 0,
  };
  for (const inv of ds.invoices) {
    if (!inPeriod(inv.date, p)) continue;
    const v =
      inv.type === "EQUIPMENT" || inv.type === "SPARES" ? "EQUIPMENT_SALES"
        : inv.type === "SERVICE" || inv.type === "AMC" ? "SERVICE_AMC"
          : inv.type === "PROJECT_RA" ? "PROJECTS" : "RENTAL";
    out[v] += invoiceTotal(ds, inv.id);
  }
  return out;
}

/** K-01 */
export function enquiryToOrderConversion(ds: Dataset, p: Period): number {
  const enquiries = ds.enquiries.filter((e) => inPeriod(e.createdAt, p)).length;
  const won = ds.salesOrders.filter((o) => inPeriod(o.orderDate, p)).length;
  return enquiries ? round2((won / enquiries) * 100) : 0;
}

/** K-02 */
export function quotationWinRate(ds: Dataset, p: Period): number {
  const q = ds.quotations.filter((x) => inPeriod(x.quotationDate, p));
  const won = q.filter((x) => x.status === "WON").length;
  const lost = q.filter((x) => x.status === "LOST").length;
  return won + lost ? round2((won / (won + lost)) * 100) : 0;
}

/** K-03 */
export function avgQuotationAgeingDays(ds: Dataset, now: Date): number {
  const open = ds.quotations.filter((q) => q.status === "ISSUED" || q.status === "NEGOTIATION");
  if (!open.length) return 0;
  const total = open.reduce((s, q) => s + (now.getTime() - new Date(q.quotationDate).getTime()) / DAY, 0);
  return round2(total / open.length);
}

/** K-04 — confirmed orders not yet fully invoiced */
export function orderBookValue(ds: Dataset): number {
  let value = 0;
  for (const so of ds.salesOrders) {
    if (so.status === "FULFILLED" || so.status === "CANCELLED") continue;
    const lines = ds.salesOrderLines.filter((l) => l.salesOrderId === so.id);
    value += lines.reduce((s, l) => s + (l.qty - l.qtyInvoiced) * l.rate, 0);
  }
  return Math.round(value);
}

/** K-05 */
export function slaCompliancePct(ds: Dataset, p: Period): number {
  const closed = ds.tickets.filter((t) => t.closedAt && inPeriod(t.closedAt, p));
  if (!closed.length) return 0;
  const onTime = closed.filter((t) => !t.breachedAt).length;
  return round2((onTime / closed.length) * 100);
}

/** K-06 — derived from job-card outcomes, never entered */
export function firstTimeFixRate(ds: Dataset, p: Period): number {
  const closed = ds.tickets.filter((t) => t.closedAt && inPeriod(t.closedAt, p));
  if (!closed.length) return 0;
  const firstVisitFixed = closed.filter((t) => {
    const cards = ds.jobCards.filter((j) => j.ticketId === t.id);
    return cards.length === 1 && cards[0]!.resolvedOnThisVisit;
  }).length;
  return round2((firstVisitFixed / closed.length) * 100);
}

/** K-07 */
export function meanResponseRestoreHours(ds: Dataset, p: Period): { respond: number; restore: number } {
  const closed = ds.tickets.filter((t) => t.closedAt && inPeriod(t.closedAt, p));
  if (!closed.length) return { respond: 0, restore: 0 };
  const respond = closed.filter((t) => t.firstResponseAt)
    .map((t) => (new Date(t.firstResponseAt!).getTime() - new Date(t.loggedAt).getTime()) / 3_600_000);
  const restore = closed.filter((t) => t.restoredAt)
    .map((t) => (new Date(t.restoredAt!).getTime() - new Date(t.loggedAt).getTime()) / 3_600_000);
  const avg = (a: number[]) => (a.length ? round2(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return { respond: avg(respond), restore: avg(restore) };
}

/** K-08 */
export function technicianUtilisation(ds: Dataset, p: Period, employeeId?: string): number {
  const cards = ds.jobCards.filter(
    (j) => j.checkInAt && j.checkOutAt && inPeriod(j.checkInAt, p) && (!employeeId || j.engineerUserId === employeeId),
  );
  const productiveHours = cards.reduce(
    (s, j) => s + (new Date(j.checkOutAt!).getTime() - new Date(j.checkInAt!).getTime()) / 3_600_000, 0,
  );
  const engineers = employeeId ? 1 : new Set(cards.map((j) => j.engineerUserId)).size || 1;
  const workingDays = Math.max(1, Math.round((p.to.getTime() - p.from.getTime()) / DAY * (6 / 7)));
  const available = engineers * workingDays * 8;
  return available ? round2((productiveHours / available) * 100) : 0;
}

/** K-09 */
export function amcRenewalRate(ds: Dataset, p: Period): number {
  const due = ds.amcContracts.filter((a) => inPeriod(a.endDate, p));
  if (!due.length) return 0;
  const renewed = due.filter((a) => a.renewedIntoId).length;
  return round2((renewed / due.length) * 100);
}

/**
 * K-10 — AMC attach rate.
 * C-11: "eligible" excludes assets still in warranty and decommissioned units,
 * because an in-warranty machine is not yet an AMC opportunity. The published
 * 42% figure only reconciles on this denominator (104 / 248), so the definition
 * is stated here and surfaced in the on-screen formula disclosure.
 */
export function amcAttachRate(ctx: DeriveCtx): {
  pct: number; underAmc: number; eligible: number; inWarranty: number;
  outOfCoverage: number; totalAssets: number;
} {
  const { ds, now } = ctx;
  let underAmc = 0, inWarranty = 0, outOfCoverage = 0, decommissioned = 0;
  for (const a of ds.assets) {
    if (a.status === "DECOMMISSIONED") { decommissioned++; continue; }
    const st = coverageState(ds, a, now);
    if (st === "IN_WARRANTY") inWarranty++;
    else if (st === "UNDER_AMC") underAmc++;
    else outOfCoverage++;
  }
  const totalAssets = ds.assets.length;
  const eligible = totalAssets - inWarranty - decommissioned;
  return {
    pct: eligible ? round2((underAmc / eligible) * 100) : 0,
    underAmc, eligible, inWarranty, outOfCoverage, totalAssets,
  };
}

/** K-11 */
export function warrantyExposure(ctx: DeriveCtx): { count: number; assets: T.InstalledAsset[] } {
  const { ds, now } = ctx;
  const assets = ds.assets.filter((a) => coverageState(ds, a, now) === "IN_WARRANTY");
  return { count: assets.length, assets };
}

/** K-12 */
export function commissioningCompliancePct(ctx: DeriveCtx, windowDays: (p: T.InstalledAsset["principal"]) => number): number {
  const { ds, now } = ctx;
  if (!ds.commissioningReports.length) return 0;
  let inWindow = 0;
  for (const r of ds.commissioningReports) {
    const asset = ds.assets.find((a) => a.id === r.assetId);
    if (!asset) continue;
    const dl = commissioningDeadline(r, windowDays(asset.principal));
    if (commissioningSubmissionState(r, dl, now) === "SUBMITTED_IN_WINDOW") inWindow++;
  }
  return round2((inWindow / ds.commissioningReports.length) * 100);
}

/** K-13 */
export function sparesRevenueMixPct(ds: Dataset, p: Period): number {
  const total = revenueInPeriod(ds, p);
  if (!total) return 0;
  const spares = ds.invoices
    .filter((i) => inPeriod(i.date, p) && (i.type === "SPARES" || i.type === "SERVICE" || i.type === "AMC"))
    .reduce((s, i) => s + invoiceTotal(ds, i.id), 0);
  return round2((spares / total) * 100);
}

/** K-14 */
export function dso(ctx: DeriveCtx, p: Period): number {
  const { ds } = ctx;
  const closing = receivables(ctx).total;
  const credit = revenueInPeriod(ds, p);
  const days = Math.max(1, Math.round((p.to.getTime() - p.from.getTime()) / DAY));
  return credit ? round2((closing / credit) * days) : 0;
}

/** K-16 */
export function retentionLockedUp(ctx: DeriveCtx): number {
  return retention(ctx).outstanding;
}

/** K-18 */
export function projectBillingRealisationPct(ds: Dataset, projectId: string): number {
  const certified = ds.raBills
    .filter((b) => b.projectId === projectId && b.certifiedValue !== null)
    .reduce((s, b) => s + (b.certifiedValue ?? 0), 0);
  const executed = projectProgress(ds, projectId).executedValue;
  return executed ? round2((certified / executed) * 100) : 0;
}

/** K-19 */
export function stockOutIncidencePct(ds: Dataset, p: Period): number {
  const cards = ds.jobCards.filter((j) => inPeriod(j.createdAt, p));
  if (!cards.length) return 0;
  const blocked = ds.partsRequests.filter((r) => r.jobCardId && r.serviceCritical).length;
  return round2((blocked / cards.length) * 100);
}

/** K-20 */
export function nonMovingStockValue(ctx: DeriveCtx, trailingDays = 180): number {
  return nonMovingItems(ctx, trailingDays).reduce((s, x) => s + x.value, 0);
}

/** K-21 */
export function approvalTurnaroundMedianHours(ds: Dataset): number {
  const decided = ds.approvalRequests.filter((a) => a.decidedAt);
  if (!decided.length) return 0;
  const hours = decided
    .map((a) => (new Date(a.decidedAt!).getTime() - new Date(a.raisedAt).getTime()) / 3_600_000)
    .sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  return round2(hours.length % 2 ? hours[mid]! : (hours[mid - 1]! + hours[mid]!) / 2);
}

/** K-22 */
export function rentalUtilisationPct(ctx: DeriveCtx, trailingDays = 365): number {
  const { ds, now } = ctx;
  if (!ds.rentalAssets.length) return 0;
  const windowStart = new Date(now.getTime() - trailingDays * DAY);
  let onRentDays = 0;
  for (const ag of ds.rentalAgreements) {
    const start = Math.max(new Date(ag.startDate).getTime(), windowStart.getTime());
    const end = Math.min(new Date(ag.actualReturn ?? now.toISOString()).getTime(), now.getTime());
    if (end > start) onRentDays += (end - start) / DAY;
  }
  const available = ds.rentalAssets.length * trailingDays;
  return available ? round2((onRentDays / available) * 100) : 0;
}
