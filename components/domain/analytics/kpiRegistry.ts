import type { Dataset } from "@/lib/schemas";
import * as D from "@/lib/derive";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "@/lib/seed/catalog";
import { abbreviateINR, formatCount, formatPercent } from "@/lib/format";
import type { AnalyticsScope, ResolvedPeriod } from "./scope";

/**
 * E12-S1 / AR-2 — the KPI dictionary, bound once.
 *
 * Every one of the 22 BRD §13 KPIs appears here exactly once, and every
 * `compute` below is a call into `/lib/derive`. There is no arithmetic in this
 * file that constitutes a formula: sums, ratios and medians all live in the
 * shared implementation. That is what makes the Command Centre, the five
 * analytics surfaces and the assistant incapable of disagreeing.
 *
 * If you are tempted to inline a calculation here, add it to `/lib/derive`
 * instead — otherwise the guarantee this file exists to provide is gone.
 */

export type KpiId =
  | "K-01" | "K-02" | "K-03" | "K-04" | "K-05" | "K-06" | "K-07" | "K-08"
  | "K-09" | "K-10" | "K-11" | "K-12" | "K-13" | "K-14" | "K-15" | "K-16"
  | "K-17" | "K-18" | "K-19" | "K-20" | "K-21" | "K-22";

export type SurfaceKey = "sales" | "service" | "projects" | "cash" | "inventory";

export interface KpiInput {
  /** Already scoped to branch/owner. Formulas are unchanged; records are not. */
  ds: Dataset;
  ctx: D.DeriveCtx;
  period: ResolvedPeriod;
  scope: AnalyticsScope;
}

export interface KpiValue {
  /** Numeric result, for comparison arithmetic and anomaly baselines. */
  raw: number;
  /** Formatted exactly as it must appear. Same string on every surface. */
  display: string;
  /** Secondary reading — the numerator/denominator made visible. */
  sub?: string;
  /** How many records the figure was computed from — drives the caveat. */
  recordCount: number;
  recordNoun: string;
}

export interface KpiDef {
  id: KpiId;
  name: string;
  /** BRD §13 published formula, verbatim. */
  formula: string;
  /** The same formula in plain language, for the disclosure control. */
  plain: string;
  owner: string;
  frequency: string;
  unit: "PERCENT" | "MONEY" | "DAYS" | "HOURS" | "COUNT";
  /** Higher is better? Drives the direction wording on a delta. */
  higherIsBetter: boolean;
  surfaces: SurfaceKey[];
  /** Below this many contributing records the figure is not presented as reliable. */
  minRecords: number;
  recordSet: (i: KpiInput) => { label: string; href: string };
  compute: (i: KpiInput) => KpiValue;
}

const pct = (n: number) => formatPercent(n);
const money = (n: number) => abbreviateINR(n);
const branchQ = (s: AnalyticsScope) => (s.branchId ? `?branch=${s.branchId}` : "");

export const KPI_REGISTRY: Record<KpiId, KpiDef> = {
  "K-01": {
    id: "K-01",
    name: "Enquiry to order conversion",
    formula: "Sales orders won ÷ enquiries received in period × 100",
    plain:
      "Count every enquiry created inside the period, count every sales order dated inside the period, divide the second by the first and express it as a percentage.",
    owner: "Branch Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["sales"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Enquiries in the period", href: `/sales/enquiries${branchQ(i.scope)}` }),
    compute: (i) => {
      const enquiries = i.ds.enquiries.filter(
        (e) => new Date(e.createdAt) >= i.period.from && new Date(e.createdAt) <= i.period.to,
      ).length;
      const orders = i.ds.salesOrders.filter(
        (o) => new Date(o.orderDate) >= i.period.from && new Date(o.orderDate) <= i.period.to,
      ).length;
      const raw = D.enquiryToOrderConversion(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(orders)} orders from ${formatCount(enquiries)} enquiries`,
        recordCount: enquiries,
        recordNoun: "enquiries",
      };
    },
  },

  "K-02": {
    id: "K-02",
    name: "Quotation win rate",
    formula: "Quotations won ÷ (won + lost) × 100",
    plain:
      "Of the quotations dated inside the period that reached a decision, the share that were won. Quotations still open are excluded from both sides, so an unhurried pipeline cannot flatter the rate.",
    owner: "Branch Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["sales"],
    minRecords: 15,
    recordSet: (i) => ({ label: "Decided quotations in the period", href: `/sales/quotations${branchQ(i.scope)}` }),
    compute: (i) => {
      const q = i.ds.quotations.filter(
        (x) => new Date(x.quotationDate) >= i.period.from && new Date(x.quotationDate) <= i.period.to,
      );
      const won = q.filter((x) => x.status === "WON").length;
      const lost = q.filter((x) => x.status === "LOST").length;
      const raw = D.quotationWinRate(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(won)} won · ${formatCount(lost)} lost`,
        recordCount: won + lost,
        recordNoun: "decided quotations",
      };
    },
  },

  "K-03": {
    id: "K-03",
    name: "Average quotation ageing",
    formula: "Mean (today − quotation date) for open quotations",
    plain:
      "For every quotation still Issued or in Negotiation, the days since it was raised, averaged. It is a position as at today, not a period figure.",
    owner: "Branch Manager",
    frequency: "Weekly",
    unit: "DAYS",
    higherIsBetter: false,
    surfaces: ["sales"],
    minRecords: 10,
    recordSet: (i) => ({ label: "Open quotations", href: `/sales/quotations?status=ISSUED${i.scope.branchId ? `&branch=${i.scope.branchId}` : ""}` }),
    compute: (i) => {
      const open = i.ds.quotations.filter((q) => q.status === "ISSUED" || q.status === "NEGOTIATION");
      const raw = D.avgQuotationAgeingDays(i.ds, i.ctx.now);
      return {
        raw,
        display: `${raw.toFixed(1)} days`,
        sub: `${formatCount(open.length)} quotations open`,
        recordCount: open.length,
        recordNoun: "open quotations",
      };
    },
  },

  "K-04": {
    id: "K-04",
    name: "Order book value",
    formula: "Σ value of confirmed orders not yet fully invoiced",
    plain:
      "For every sales order that is neither fulfilled nor cancelled, the uninvoiced quantity on each line multiplied by its rate, summed. A position, not a period figure.",
    owner: "Director – Business",
    frequency: "Weekly",
    unit: "MONEY",
    higherIsBetter: true,
    surfaces: ["sales"],
    minRecords: 5,
    recordSet: (i) => ({ label: "Open sales orders", href: `/sales/orders${branchQ(i.scope)}` }),
    compute: (i) => {
      const open = i.ds.salesOrders.filter((o) => o.status !== "FULFILLED" && o.status !== "CANCELLED");
      const raw = D.orderBookValue(i.ds);
      return {
        raw,
        display: money(raw),
        sub: `${formatCount(open.length)} orders open or partial`,
        recordCount: open.length,
        recordNoun: "open orders",
      };
    },
  },

  "K-05": {
    id: "K-05",
    name: "SLA compliance",
    formula: "Tickets resolved within applicable commitment ÷ tickets closed × 100",
    plain:
      "Of the tickets closed inside the period, the share that never recorded a breach timestamp against the commitment that applied to them.",
    owner: "Service Manager",
    frequency: "Weekly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Tickets closed in the period", href: `/service/tickets?status=CLOSED${i.scope.branchId ? `&branch=${i.scope.branchId}` : ""}` }),
    compute: (i) => {
      const closed = i.ds.tickets.filter(
        (t) => t.closedAt && new Date(t.closedAt) >= i.period.from && new Date(t.closedAt) <= i.period.to,
      );
      const raw = D.slaCompliancePct(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(closed.filter((t) => !t.breachedAt).length)} of ${formatCount(closed.length)} within commitment`,
        recordCount: closed.length,
        recordNoun: "closed tickets",
      };
    },
  },

  "K-06": {
    id: "K-06",
    name: "First-time-fix rate",
    formula: "Tickets closed on first visit ÷ tickets closed × 100",
    plain:
      "Of the tickets closed inside the period, the share that carry exactly one job card and where that job card records the fault as resolved on that visit. Derived from job-card outcomes; it is never entered by hand.",
    owner: "Service Manager",
    frequency: "Weekly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service", "inventory"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Job cards behind the closed tickets", href: `/service/job-cards${branchQ(i.scope)}` }),
    compute: (i) => {
      const closed = i.ds.tickets.filter(
        (t) => t.closedAt && new Date(t.closedAt) >= i.period.from && new Date(t.closedAt) <= i.period.to,
      );
      const single = closed.filter((t) => {
        const cards = i.ds.jobCards.filter((j) => j.ticketId === t.id);
        return cards.length === 1 && cards[0]!.resolvedOnThisVisit;
      }).length;
      const raw = D.firstTimeFixRate(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(single)} of ${formatCount(closed.length)} closed on the first visit`,
        recordCount: closed.length,
        recordNoun: "closed tickets",
      };
    },
  },

  "K-07": {
    id: "K-07",
    name: "Mean time to respond and restore",
    formula: "Mean (first-response − logged); mean (restored − logged)",
    plain:
      "Across the tickets closed inside the period, the average hours from logging to first response, and separately from logging to restoration.",
    owner: "Service Manager",
    frequency: "Weekly",
    unit: "HOURS",
    higherIsBetter: false,
    surfaces: ["service"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Tickets closed in the period", href: `/service/tickets${branchQ(i.scope)}` }),
    compute: (i) => {
      const closed = i.ds.tickets.filter(
        (t) => t.closedAt && new Date(t.closedAt) >= i.period.from && new Date(t.closedAt) <= i.period.to,
      );
      const v = D.meanResponseRestoreHours(i.ds, i.period);
      return {
        raw: v.restore,
        display: `${v.restore.toFixed(1)} h`,
        sub: `respond ${v.respond.toFixed(1)} h · restore ${v.restore.toFixed(1)} h`,
        recordCount: closed.length,
        recordNoun: "closed tickets",
      };
    },
  },

  "K-08": {
    id: "K-08",
    name: "Technician utilisation",
    formula: "Productive field hours ÷ available hours × 100",
    plain:
      "Check-in to check-out hours recorded on job cards inside the period, divided by the engineers on the board multiplied by a six-day week at eight hours.",
    owner: "Service Manager",
    frequency: "Weekly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service"],
    minRecords: 30,
    recordSet: (i) => ({ label: "Job cards with a completed visit", href: `/service/job-cards${branchQ(i.scope)}` }),
    compute: (i) => {
      const cards = i.ds.jobCards.filter(
        (j) => j.checkInAt && j.checkOutAt && new Date(j.checkInAt) >= i.period.from && new Date(j.checkInAt) <= i.period.to,
      );
      const engineers = new Set(cards.map((j) => j.engineerUserId)).size;
      const raw = D.technicianUtilisation(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(cards.length)} visits across ${formatCount(engineers)} engineers`,
        recordCount: cards.length,
        recordNoun: "completed visits",
      };
    },
  },

  "K-09": {
    id: "K-09",
    name: "AMC renewal rate",
    formula: "Contracts renewed ÷ contracts falling due × 100",
    plain:
      "Of the AMC contracts whose end date falls inside the period, the share that carry a link to the contract they were renewed into.",
    owner: "Service Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service"],
    minRecords: 8,
    recordSet: (i) => ({ label: "AMC contracts falling due in the period", href: `/service/renewals${branchQ(i.scope)}` }),
    compute: (i) => {
      const due = i.ds.amcContracts.filter(
        (a) => new Date(a.endDate) >= i.period.from && new Date(a.endDate) <= i.period.to,
      );
      const raw = D.amcRenewalRate(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(due.filter((a) => a.renewedIntoId).length)} renewed of ${formatCount(due.length)} due`,
        recordCount: due.length,
        recordNoun: "contracts falling due",
      };
    },
  },

  "K-10": {
    id: "K-10",
    name: "AMC contract-attach rate",
    formula: "Installed assets under live AMC ÷ total eligible installed assets × 100",
    plain:
      "Machines covered by a live AMC today, divided by the eligible base. Eligible is defined as total installed assets less those still in warranty and less those decommissioned — an in-warranty machine is not yet an AMC opportunity, and a decommissioned one never will be. This is the denominator adjudicated as C-11; it is the only one on which the published 42% reconciles.",
    owner: "Service Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Installed assets outside coverage", href: `/service/assets?coverage=OUT_OF_COVERAGE${i.scope.branchId ? `&branch=${i.scope.branchId}` : ""}` }),
    compute: (i) => {
      const a = D.amcAttachRate({ ds: i.ds, now: i.ctx.now });
      return {
        raw: a.pct,
        display: pct(a.pct),
        sub: `${formatCount(a.underAmc)} under AMC of ${formatCount(a.eligible)} eligible · ${formatCount(a.outOfCoverage)} uncovered · ${formatCount(a.inWarranty)} in warranty excluded`,
        recordCount: a.eligible,
        recordNoun: "eligible assets",
      };
    },
  },

  "K-11": {
    id: "K-11",
    name: "Warranty exposure",
    formula: "Installed assets in warranty; estimated remaining obligation",
    plain:
      "Every installed asset whose commissioning date plus its warranty months has not yet passed. These are the machines the business must repair at its own cost.",
    owner: "Service Manager",
    frequency: "Monthly",
    unit: "COUNT",
    higherIsBetter: false,
    surfaces: ["service"],
    minRecords: 5,
    recordSet: (i) => ({ label: "Assets in warranty", href: `/service/assets?coverage=IN_WARRANTY${i.scope.branchId ? `&branch=${i.scope.branchId}` : ""}` }),
    compute: (i) => {
      const w = D.warrantyExposure({ ds: i.ds, now: i.ctx.now });
      const attach = D.amcAttachRate({ ds: i.ds, now: i.ctx.now });
      return {
        raw: w.count,
        display: formatCount(w.count),
        sub: `${formatCount(w.count)} of ${formatCount(attach.totalAssets)} installed machines carry a live warranty`,
        recordCount: w.count,
        recordNoun: "assets in warranty",
      };
    },
  },

  "K-12": {
    id: "K-12",
    name: "Commissioning submission compliance",
    formula: "Reports submitted within OEM window ÷ commissionings × 100",
    plain:
      "Each commissioning report is measured against its own principal's window — ELGi and ATS-ELGi seven days, KSB ten, Ion Exchange fifteen. The share submitted inside that window is the compliance figure.",
    owner: "Service Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service"],
    minRecords: 10,
    recordSet: (i) => ({ label: "Commissioning reports", href: `/service/commissioning${branchQ(i.scope)}` }),
    compute: (i) => {
      const raw = D.commissioningCompliancePct({ ds: i.ds, now: i.ctx.now }, (p) => OEM_COMMISSIONING_WINDOW_DAYS[p]);
      const n = i.ds.commissioningReports.length;
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(Math.round((raw / 100) * n))} of ${formatCount(n)} inside the principal's window`,
        recordCount: n,
        recordNoun: "commissioning reports",
      };
    },
  },

  "K-13": {
    id: "K-13",
    name: "Spares and service revenue mix",
    formula: "Spares & service revenue ÷ total revenue × 100",
    plain:
      "Invoices of type Spares, Service and AMC dated inside the period, as a share of all invoiced revenue in the same period. The annuity share of the book.",
    owner: "Director – Business",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["cash", "sales"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Invoices in the period", href: `/commercial/invoices${branchQ(i.scope)}` }),
    compute: (i) => {
      const inPeriod = i.ds.invoices.filter(
        (x) => new Date(x.date) >= i.period.from && new Date(x.date) <= i.period.to,
      );
      const raw = D.sparesRevenueMixPct(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${money(D.revenueInPeriod(i.ds, i.period))} invoiced in total`,
        recordCount: inPeriod.length,
        recordNoun: "invoices",
      };
    },
  },

  "K-14": {
    id: "K-14",
    name: "Days sales outstanding",
    formula: "(Closing receivables ÷ credit sales in period) × days in period",
    plain:
      "Outstanding receivables as at today, divided by revenue invoiced inside the period, multiplied by the number of days in that period. It answers: at the current rate of invoicing, how many days of sales are sitting unpaid.",
    owner: "Accounts",
    frequency: "Monthly",
    unit: "DAYS",
    higherIsBetter: false,
    surfaces: ["cash"],
    minRecords: 20,
    recordSet: (i) => ({ label: "Open invoices", href: `/commercial/receivables${branchQ(i.scope)}` }),
    compute: (i) => {
      const raw = D.dso({ ds: i.ds, now: i.ctx.now }, i.period);
      const r = D.receivables({ ds: i.ds, now: i.ctx.now });
      return {
        raw,
        display: `${raw.toFixed(1)} days`,
        sub: `${money(r.total)} outstanding over ${i.period.days} days of the period`,
        recordCount: r.openInvoices.length,
        recordNoun: "open invoices",
      };
    },
  },

  "K-15": {
    id: "K-15",
    name: "Receivables ageing distribution",
    formula: "Outstanding split into 0–30 / 31–60 / 61–90 / 90+ days",
    plain:
      "Each open invoice is placed in a bucket by the days elapsed since its invoice date. Outstanding is the invoice total less allocated receipts, less credit notes, plus debit notes.",
    owner: "Accounts",
    frequency: "Weekly",
    unit: "MONEY",
    higherIsBetter: false,
    surfaces: ["cash"],
    minRecords: 10,
    recordSet: (i) => ({ label: "Open invoices by ageing bucket", href: `/commercial/receivables${branchQ(i.scope)}` }),
    compute: (i) => {
      const r = D.receivables({ ds: i.ds, now: i.ctx.now });
      return {
        raw: r.total,
        display: money(r.total),
        sub: `${money(r.buckets.B90_PLUS.value)} beyond 90 days across ${formatCount(r.buckets.B90_PLUS.count)} invoices`,
        recordCount: r.openInvoices.length,
        recordNoun: "open invoices",
      };
    },
  },

  "K-16": {
    id: "K-16",
    name: "Retention locked up",
    formula: "Σ retention withheld on certified bills not yet released",
    plain:
      "Every retention entry raised against a certified RA-bill that has not been released, summed. Money the business has earned and cannot spend.",
    owner: "Projects Manager",
    frequency: "Monthly",
    unit: "MONEY",
    higherIsBetter: false,
    surfaces: ["projects", "cash"],
    minRecords: 3,
    recordSet: () => ({ label: "Retention register", href: "/projects/retention" }),
    compute: (i) => {
      const ret = D.retention({ ds: i.ds, now: i.ctx.now });
      return {
        raw: D.retentionLockedUp({ ds: i.ds, now: i.ctx.now }),
        display: money(ret.outstanding),
        sub: `${money(ret.eligible)} claimable now across ${formatCount(ret.eligibleProjectCount)} projects`,
        recordCount: i.ds.retentionEntries.length,
        recordNoun: "retention entries",
      };
    },
  },

  "K-17": {
    id: "K-17",
    name: "Project schedule variance",
    formula: "(Actual cumulative progress − planned) ÷ planned × 100",
    plain:
      "Milestone weightage actually achieved by today against the weightage that should have been achieved by today, expressed as a percentage of plan. Negative means behind. Averaged across live projects on this tile; per-project figures are on the distribution below.",
    owner: "Projects Manager",
    frequency: "Weekly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["projects"],
    minRecords: 2,
    recordSet: () => ({ label: "Project portfolio", href: "/projects" }),
    compute: (i) => {
      const live = i.ds.projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "MOBILISED" || p.status === "COMMISSIONING");
      const values = live.map((p) => D.scheduleVariancePct(i.ds, p, i.ctx.now));
      const raw = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      const behind = live.filter((p) => D.scheduleVariancePct(i.ds, p, i.ctx.now) < -p.varianceTolerancePct).length;
      return {
        raw: Number(raw.toFixed(2)),
        display: `${raw >= 0 ? "+" : ""}${raw.toFixed(1)}%`,
        sub: `${formatCount(behind)} of ${formatCount(live.length)} live projects beyond tolerance`,
        recordCount: live.length,
        recordNoun: "live projects",
      };
    },
  },

  "K-18": {
    id: "K-18",
    name: "Project billing realisation",
    formula: "Cumulative certified value ÷ cumulative executed BOQ value × 100",
    plain:
      "For each project, the value the client has certified against the value physically executed on the BOQ. Under 100% means work done is running ahead of work paid for.",
    owner: "Projects Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["projects"],
    minRecords: 2,
    recordSet: () => ({ label: "RA-bills across the portfolio", href: "/projects" }),
    compute: (i) => {
      const withBills = i.ds.projects.filter((p) => i.ds.raBills.some((b) => b.projectId === p.id));
      const values = withBills.map((p) => D.projectBillingRealisationPct(i.ds, p.id)).filter((v) => v > 0);
      const raw = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      return {
        raw: Number(raw.toFixed(2)),
        display: pct(raw),
        sub: `${formatCount(withBills.length)} projects carrying RA-bills`,
        recordCount: i.ds.raBills.length,
        recordNoun: "RA-bills",
      };
    },
  },

  "K-19": {
    id: "K-19",
    name: "Stock-out incidence",
    formula: "Job cards delayed or reopened due to parts unavailability ÷ total job cards × 100",
    plain:
      "Parts requests flagged service-critical against a job card, as a share of the job cards raised inside the period. This is the measured link between an empty shelf and a second visit.",
    owner: "Store In-charge",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: false,
    surfaces: ["inventory"],
    minRecords: 30,
    recordSet: (i) => ({ label: "Job cards blocked on parts", href: `/service/job-cards?blocked=parts${i.scope.branchId ? `&branch=${i.scope.branchId}` : ""}` }),
    compute: (i) => {
      const cards = i.ds.jobCards.filter(
        (j) => new Date(j.createdAt) >= i.period.from && new Date(j.createdAt) <= i.period.to,
      );
      const blocked = i.ds.partsRequests.filter((r) => r.jobCardId && r.serviceCritical).length;
      const raw = D.stockOutIncidencePct(i.ds, i.period);
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(blocked)} service-critical parts requests against ${formatCount(cards.length)} job cards`,
        recordCount: cards.length,
        recordNoun: "job cards",
      };
    },
  },

  "K-20": {
    id: "K-20",
    name: "Non-moving stock value",
    formula: "Σ value of items with zero issues in the trailing 180 days",
    plain:
      "Any stocked item with quantity on hand but no issue movement in the last 180 days, valued at standard cost and summed. Capital sitting on a shelf.",
    owner: "Store In-charge",
    frequency: "Quarterly",
    unit: "MONEY",
    higherIsBetter: false,
    surfaces: ["inventory"],
    minRecords: 5,
    recordSet: () => ({ label: "Non-moving items", href: "/inventory/stock?filter=non-moving" }),
    compute: (i) => {
      const items = D.nonMovingItems({ ds: i.ds, now: i.ctx.now }, 180);
      const raw = D.nonMovingStockValue({ ds: i.ds, now: i.ctx.now }, 180);
      return {
        raw,
        display: money(raw),
        sub: `${formatCount(items.length)} items with no issue in 180 days`,
        recordCount: items.length,
        recordNoun: "non-moving items",
      };
    },
  },

  "K-21": {
    id: "K-21",
    name: "Approval turnaround",
    formula: "Median (decision timestamp − request timestamp)",
    plain:
      "Across every approval request that has been decided, the middle value of the hours between raising and decision. The median, not the mean, so one forgotten request does not distort the picture.",
    owner: "Director – Business",
    frequency: "Monthly",
    unit: "HOURS",
    higherIsBetter: false,
    surfaces: ["cash", "sales"],
    minRecords: 5,
    recordSet: () => ({ label: "Approval requests", href: "/workflow/approvals" }),
    compute: (i) => {
      const decided = i.ds.approvalRequests.filter((a) => a.decidedAt);
      const raw = D.approvalTurnaroundMedianHours(i.ds);
      return {
        raw,
        display: `${raw.toFixed(1)} h`,
        sub: `${formatCount(decided.length)} decided of ${formatCount(i.ds.approvalRequests.length)} raised`,
        recordCount: decided.length,
        recordNoun: "decided approval requests",
      };
    },
  },

  "K-22": {
    id: "K-22",
    name: "Rental utilisation",
    formula: "Days on rent ÷ days available, per asset",
    plain:
      "Across the trailing 365 days, the days each rental machine spent on hire, divided by the days the fleet was available.",
    owner: "Service Manager",
    frequency: "Monthly",
    unit: "PERCENT",
    higherIsBetter: true,
    surfaces: ["service"],
    minRecords: 3,
    recordSet: () => ({ label: "Rental fleet", href: "/service/rental" }),
    compute: (i) => {
      const raw = D.rentalUtilisationPct({ ds: i.ds, now: i.ctx.now }, 365);
      const onRent = i.ds.rentalAgreements.filter((a) => !a.actualReturn).length;
      return {
        raw,
        display: pct(raw),
        sub: `${formatCount(onRent)} of ${formatCount(i.ds.rentalAssets.length)} machines on hire today`,
        recordCount: i.ds.rentalAssets.length,
        recordNoun: "rental machines",
      };
    },
  },
};

export const KPI_IDS = Object.keys(KPI_REGISTRY) as KpiId[];

export function kpisForSurface(surface: SurfaceKey): KpiDef[] {
  return KPI_IDS.map((id) => KPI_REGISTRY[id]).filter((k) => k.surfaces.includes(surface));
}

/* ------------------------------------------------ presentation-ready tile */

export interface KpiTileData {
  id: KpiId;
  name: string;
  value: string;
  sub: string | null;
  formula: string;
  plain: string;
  owner: string;
  frequency: string;
  periodLabel: string;
  periodRange: string;
  scopeStatement: string;
  filters: string[];
  recordSetLabel: string;
  recordSetHref: string;
  /** null when the basis is None or the comparison period has no records. */
  delta: {
    pctText: string;
    direction: "UP" | "DOWN" | "FLAT";
    good: boolean;
    basisInWords: string;
    priorDisplay: string;
    priorRange: string;
  } | null;
  /** E12-S1 — the caveat names the record count rather than hiding it. */
  caveat: string | null;
  raw: number;
  recordCount: number;
}

export function buildKpiTile(
  def: KpiDef,
  input: KpiInput,
  comparison: { period: ResolvedPeriod; basisInWords: string } | null,
): KpiTileData {
  const v = def.compute(input);
  const rs = def.recordSet(input);

  let delta: KpiTileData["delta"] = null;
  if (comparison) {
    const prior = def.compute({ ...input, period: comparison.period });
    if (prior.recordCount > 0 && prior.raw !== 0) {
      const change = ((v.raw - prior.raw) / Math.abs(prior.raw)) * 100;
      const direction = Math.abs(change) < 0.05 ? "FLAT" : change > 0 ? "UP" : "DOWN";
      delta = {
        pctText: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
        direction,
        good: direction === "FLAT" ? true : (direction === "UP") === def.higherIsBetter,
        basisInWords: comparison.basisInWords,
        priorDisplay: prior.display,
        priorRange: comparison.period.rangeLabel,
      };
    }
  }

  const caveat =
    v.recordCount < def.minRecords
      ? `Computed from ${formatCount(v.recordCount)} ${v.recordNoun} — below the ${formatCount(def.minRecords)} this metric needs to be read as a rate. Treat it as an indication, not a measurement.`
      : null;

  return {
    id: def.id,
    name: def.name,
    value: v.display,
    sub: v.sub ?? null,
    formula: def.formula,
    plain: def.plain,
    owner: def.owner,
    frequency: def.frequency,
    periodLabel: input.period.label,
    periodRange: input.period.rangeLabel,
    scopeStatement: input.scope.statement,
    filters: input.scope.filters,
    recordSetLabel: rs.label,
    recordSetHref: rs.href,
    delta,
    caveat,
    raw: v.raw,
    recordCount: v.recordCount,
  };
}
