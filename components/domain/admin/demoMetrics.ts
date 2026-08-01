/**
 * E14-S6 — "what recomputes when the clock moves", answered with real figures.
 *
 * Every number below comes from `/lib/derive`, the single implementation of each
 * derived value (AR-1/AR-2). The builder is pure over `(dataset, now)`: it is
 * called twice per render, once with the seeded today and once with the
 * simulated date, and it never writes to the dataset — `ctxOf` takes the date as
 * an argument precisely so the seed stays the reproducible baseline (SD-1).
 *
 * Deliberately server-side. Re-deriving these five families in the browser would
 * mean shipping the whole ticket, AMC, retention and commissioning record sets
 * (~230 KB of JSON) because each derive signature takes a complete entity; the
 * derive layer is pure, so computing both columns on the server is the same
 * arithmetic with none of the payload.
 */

import type { Dataset } from "@/lib/schemas";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "@/lib/seed/catalog";
import {
  amcStatus,
  commissioningDeadline,
  commissioningSubmissionState,
  coverageState,
  ctxOf,
  isOpenTicket,
  receivables,
  retention,
  retentionStateOf,
  slaClock,
} from "@/lib/derive";

export type FigureUnit = "COUNT" | "MONEY";

export interface DemoFigure {
  key: string;
  label: string;
  unit: FigureUnit;
  value: number;
  /** Rising is bad for most of these; stated so the delta can be read honestly. */
  risingIs: "BAD" | "GOOD" | "NEUTRAL";
}

export interface DemoMetricGroup {
  key: string;
  label: string;
  /** Plain language: what moving the clock actually changes here. */
  explains: string;
  /** The exported derivation that produced the figures. */
  source: string;
  href: string;
  hrefLabel: string;
  figures: DemoFigure[];
}

export function buildDemoMetrics(ds: Dataset, todayIso: string): DemoMetricGroup[] {
  const ctx = ctxOf(ds, todayIso);
  const now = ctx.now;

  /* ------------------------------------------------------------ SLA clocks */
  const open = ds.tickets.filter(isOpenTicket);
  let breached = 0;
  let imminent = 0;
  for (const t of open) {
    const c = slaClock(t, now);
    if (c.breached) breached += 1;
    else if (c.state === "IMMINENT") imminent += 1;
  }

  /* ------------------------------------------------------- coverage & AMC */
  let amcActive = 0;
  let amcExpiring = 0;
  let amcExpired = 0;
  for (const c of ds.amcContracts) {
    const s = amcStatus(c, now);
    if (s === "ACTIVE") amcActive += 1;
    else if (s === "EXPIRING") amcExpiring += 1;
    else if (s === "EXPIRED") amcExpired += 1;
  }
  let inWarranty = 0;
  let underAmc = 0;
  let outOfCoverage = 0;
  for (const a of ds.assets) {
    const s = coverageState(ds, a, now);
    if (s === "IN_WARRANTY") inWarranty += 1;
    else if (s === "UNDER_AMC") underAmc += 1;
    else outOfCoverage += 1;
  }

  /* --------------------------------------------------- receivables ageing */
  const r = receivables(ctx);

  /* --------------------------------------------------------- retention */
  const ret = retention(ctx);
  const eligibleEntries = ds.retentionEntries.filter(
    (e) => retentionStateOf(e, now) === "ELIGIBLE",
  ).length;

  /* ----------------------------------------------------- commissioning */
  let overdue = 0;
  let inWindow = 0;
  let late = 0;
  for (const report of ds.commissioningReports) {
    const asset = ds.assets.find((a) => a.id === report.assetId);
    if (!asset) continue;
    const deadline = commissioningDeadline(report, OEM_COMMISSIONING_WINDOW_DAYS[asset.principal]);
    const state = commissioningSubmissionState(report, deadline, now);
    if (state === "OVERDUE") overdue += 1;
    else if (state === "NOT_SUBMITTED") inWindow += 1;
    else if (state === "SUBMITTED_LATE") late += 1;
  }

  return [
    {
      key: "sla",
      label: "SLA clocks",
      explains:
        "Every open ticket's restoration clock is measured from its logged time to its due time. Moving the clock forward does not change the due times — it moves the observer, so tickets cross from comfortable to imminent to breached.",
      source: "slaClock · isOpenTicket",
      href: "/service/tickets",
      hrefLabel: "Service tickets",
      figures: [
        { key: "open", label: "Open tickets", unit: "COUNT", value: open.length, risingIs: "NEUTRAL" },
        { key: "breached", label: "Open and breached", unit: "COUNT", value: breached, risingIs: "BAD" },
        { key: "imminent", label: "Within 10% of due", unit: "COUNT", value: imminent, risingIs: "BAD" },
      ],
    },
    {
      key: "coverage",
      label: "Coverage and AMC status",
      explains:
        "Warranty end is commissioning date plus warranty months; an AMC is in force between its start and end dates. Both are compared against the clock, so cover lapses as the date advances and the uncovered population grows.",
      source: "amcStatus · coverageState",
      href: "/service/amc",
      hrefLabel: "AMC contracts",
      figures: [
        { key: "amcActive", label: "AMC contracts active", unit: "COUNT", value: amcActive, risingIs: "GOOD" },
        { key: "amcExpiring", label: "AMC expiring within 60 days", unit: "COUNT", value: amcExpiring, risingIs: "BAD" },
        { key: "amcExpired", label: "AMC expired unrenewed", unit: "COUNT", value: amcExpired, risingIs: "BAD" },
        { key: "inWarranty", label: "Assets in warranty", unit: "COUNT", value: inWarranty, risingIs: "GOOD" },
        { key: "underAmc", label: "Assets under AMC", unit: "COUNT", value: underAmc, risingIs: "GOOD" },
        { key: "outOfCoverage", label: "Assets out of coverage", unit: "COUNT", value: outOfCoverage, risingIs: "BAD" },
      ],
    },
    {
      key: "ageing",
      label: "Receivables ageing",
      explains:
        "Outstanding per invoice is total less allocated receipts less credit notes — unaffected by the clock. The bucket an invoice falls into is its age today, so the same rupees migrate rightwards as the date advances.",
      source: "receivables · ageingBucket",
      href: "/commercial/receivables",
      hrefLabel: "Receivables",
      figures: [
        { key: "total", label: "Total outstanding", unit: "MONEY", value: r.total, risingIs: "NEUTRAL" },
        { key: "b0", label: "0–30 days", unit: "MONEY", value: r.buckets.B0_30.value, risingIs: "GOOD" },
        { key: "b31", label: "31–60 days", unit: "MONEY", value: r.buckets.B31_60.value, risingIs: "NEUTRAL" },
        { key: "b61", label: "61–90 days", unit: "MONEY", value: r.buckets.B61_90.value, risingIs: "BAD" },
        { key: "b90", label: "Beyond 90 days", unit: "MONEY", value: r.buckets.B90_PLUS.value, risingIs: "BAD" },
      ],
    },
    {
      key: "retention",
      label: "Retention eligibility",
      explains:
        "A retention entry becomes eligible for release on its eligible-from date, which is defect-liability driven. Advancing the clock past that date turns withheld money into claimable money.",
      source: "retention · retentionStateOf",
      href: "/projects/retention",
      hrefLabel: "Retention register",
      figures: [
        { key: "eligibleCount", label: "Entries eligible for release", unit: "COUNT", value: eligibleEntries, risingIs: "GOOD" },
        { key: "eligibleValue", label: "Value eligible or claimed", unit: "MONEY", value: ret.eligible, risingIs: "GOOD" },
        { key: "outstanding", label: "Retention still withheld", unit: "MONEY", value: ret.outstanding, risingIs: "BAD" },
      ],
    },
    {
      key: "commissioning",
      label: "Commissioning deadlines",
      explains:
        "Each report is measured against its own principal's submission window, counted from the commissioning date. An unsubmitted report inside the window becomes overdue the moment the clock passes the deadline.",
      source: "commissioningDeadline · commissioningSubmissionState",
      href: "/service/commissioning",
      hrefLabel: "Commissioning",
      figures: [
        { key: "overdue", label: "Submissions overdue", unit: "COUNT", value: overdue, risingIs: "BAD" },
        { key: "inWindow", label: "Unsubmitted, still in window", unit: "COUNT", value: inWindow, risingIs: "NEUTRAL" },
        { key: "late", label: "Submitted outside the window", unit: "COUNT", value: late, risingIs: "BAD" },
      ],
    },
  ];
}
