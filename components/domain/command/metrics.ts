import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import type { HealthState, Vertical } from "@/lib/schemas/enums";
import { abbreviateINR, formatCount, formatPercent } from "@/lib/format";
import { periodQuery, type ResolvedPeriod } from "./period";

/**
 * E2-S1 / E2-S2 / E2-S7 — the numbers behind the Command Centre.
 *
 * Everything here is assembled from `@/lib/derive`; nothing is recomputed. Each
 * KPI carries the trailing twelve-month series that its own card draws, the
 * comparison basis in words, and the route whose total reconciles to it.
 */

const DAY = 86_400_000;

export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down" | "flat";
  /** Whether the movement is good news. Colour is never the only signal. */
  favourable: boolean;
  basis: string;
  href: string;
  series: number[];
  seriesLabel: string;
  /** True for balance-sheet figures, which are stated as at a date, not for a period. */
  position: boolean;
  hero?: boolean;
}

export interface VerticalTile {
  vertical: Vertical;
  headline: string;
  metric: string;
  supportA: string;
  supportB: string;
  state: HealthState;
  rule: string;
  href: string;
}

export interface CommandMetrics {
  kpis: Kpi[];
  tiles: VerticalTile[];
  locked: { total: number; receivables: number; retention: number };
  receivables: ReturnType<typeof D.receivables>;
  retention: ReturnType<typeof D.retention>;
  revenue: number;
  priorRevenue: number;
}

function monthEnds(asOf: Date, count = 12): Date[] {
  const out: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i + 1, 0, 23, 59, 59, 999);
    out.push(d);
  }
  return out;
}

export function buildMetrics(ds: Dataset, p: ResolvedPeriod): CommandMetrics {
  const asOf = p.asOf;
  const ctx = D.ctxOf(ds, asOf.toISOString());
  const q = periodQuery(p);
  const ends = monthEnds(asOf);

  const revenue = D.revenueInPeriod(ds, p.period);
  const priorRevenue = D.revenueInPeriod(ds, p.prior);
  const growth = priorRevenue ? ((revenue - priorRevenue) / priorRevenue) * 100 : null;

  /* One pass over invoices carries every monetary series below. */
  const invoiceTotals = new Map<string, number>();
  for (const inv of ds.invoices) invoiceTotals.set(inv.id, D.invoiceTotal(ds, inv.id));

  const revenueSeries = ends.map((end) => {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    let sum = 0;
    for (const inv of ds.invoices) {
      const t = new Date(inv.date).getTime();
      if (t >= start.getTime() && t <= end.getTime()) sum += invoiceTotals.get(inv.id) ?? 0;
    }
    return sum;
  });

  const intakeSeries = ends.map((end) => {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    let sum = 0;
    for (const so of ds.salesOrders) {
      const t = new Date(so.orderDate).getTime();
      if (t < start.getTime() || t > end.getTime()) continue;
      sum += ds.salesOrderLines
        .filter((l) => l.salesOrderId === so.id)
        .reduce((s, l) => s + l.qty * l.rate, 0);
    }
    return Math.round(sum);
  });

  /** Locked cash at each month end: invoiced less settled, plus retention held. */
  const lockedSeries = ends.map((end) => {
    const cut = end.getTime();
    let invoiced = 0;
    for (const inv of ds.invoices) {
      if (new Date(inv.date).getTime() <= cut) invoiced += invoiceTotals.get(inv.id) ?? 0;
    }
    let settled = 0;
    const receiptDate = new Map(ds.receipts.map((r) => [r.id, new Date(r.date).getTime()]));
    for (const a of ds.receiptAllocations) {
      if ((receiptDate.get(a.receiptId) ?? Infinity) <= cut) settled += a.amount;
    }
    for (const c of ds.creditNotes) {
      if (new Date(c.date).getTime() <= cut) {
        settled += (c.kind === "CREDIT" ? 1 : -1) * (c.amount + c.gstAmount);
      }
    }
    let held = 0;
    for (const r of ds.retentionEntries) {
      if (new Date(r.withheldOn).getTime() > cut) continue;
      if (r.releasedAt && new Date(r.releasedAt).getTime() <= cut) continue;
      held += r.amount;
    }
    return Math.max(0, invoiced - settled) + held;
  });

  const openSeries = ends.map((end) => {
    const cut = end.getTime();
    return ds.tickets.filter((t) => {
      if (new Date(t.loggedAt).getTime() > cut) return false;
      if (!t.closedAt) return true;
      return new Date(t.closedAt).getTime() > cut;
    }).length;
  });

  const renewalSeries = ends.map((end) => {
    const cut = end.getTime();
    return ds.amcContracts.filter((a) => {
      if (a.terminated) return false;
      const e = new Date(a.endDate).getTime();
      return e >= cut && e <= cut + 90 * DAY;
    }).length;
  });

  const atRiskSeries = ends.map((end) =>
    ds.projects.filter((pr) => {
      if (new Date(pr.startDate) > end) return false;
      if (pr.actualCompletion && new Date(pr.actualCompletion) < end) return false;
      return D.scheduleVariancePct(ds, pr, end) < -pr.varianceTolerancePct;
    }).length);

  const locked = D.lockedCash(ctx);
  const rec = D.receivables(ctx);
  const ret = D.retention(ctx);
  const orderBook = D.orderBookValue(ds);
  const openOrders = ds.salesOrders.filter((o) => o.status === "OPEN" || o.status === "PARTIAL").length;
  const openTickets = ds.tickets.filter(D.isOpenTicket);
  const breached = openTickets.filter((t) => D.slaClock(t, asOf).state === "BREACHED").length;
  const imminent = openTickets.filter((t) => D.slaClock(t, asOf).state === "IMMINENT").length;
  const attach = D.amcAttachRate(ctx);
  const expiring90 = ds.amcContracts.filter((a) => {
    if (a.terminated || a.renewedIntoId) return false;
    const days = (new Date(a.endDate).getTime() - asOf.getTime()) / DAY;
    return days >= 0 && days <= 90;
  });
  const liveProjects = ds.projects.filter(
    (pr) => pr.status === "IN_PROGRESS" || pr.status === "MOBILISED" || pr.status === "COMMISSIONING",
  );
  const atRisk = liveProjects.filter(
    (pr) => D.scheduleVariancePct(ds, pr, asOf) < -pr.varianceTolerancePct,
  );

  const kpis: Kpi[] = [
    {
      id: "revenue",
      label: `Revenue — ${p.label}`,
      value: abbreviateINR(revenue),
      delta: growth === null
        ? "No comparable prior period"
        : `${growth >= 0 ? "+" : "−"}${formatPercent(Math.abs(growth), 1)}`,
      direction: growth === null ? "flat" : growth >= 0 ? "up" : "down",
      favourable: (growth ?? 0) >= 0,
      basis: `against ${p.priorLabel} (${abbreviateINR(priorRevenue)})`,
      href: `/analytics/cash${q}`,
      series: revenueSeries,
      seriesLabel: "Monthly revenue, trailing 12 months",
      position: false,
    },
    {
      id: "order-book",
      label: "Order book",
      value: abbreviateINR(orderBook),
      delta: `${formatCount(openOrders)} orders open`,
      direction: "flat",
      favourable: true,
      basis: "confirmed and not yet invoiced",
      href: `/sales/orders${q}`,
      series: intakeSeries,
      seriesLabel: "Monthly order intake, trailing 12 months",
      position: true,
    },
    {
      id: "locked-cash",
      label: "Locked cash",
      value: abbreviateINR(locked.total),
      delta: `${abbreviateINR(locked.receivables)} receivable · ${abbreviateINR(locked.retention)} retention`,
      direction: lockedSeries[11]! >= lockedSeries[10]! ? "up" : "down",
      favourable: lockedSeries[11]! < lockedSeries[10]!,
      basis: "money sitting outside the business",
      href: "/commercial/receivables",
      series: lockedSeries,
      seriesLabel: "Locked cash at each month end, trailing 12 months",
      position: true,
      hero: true,
    },
    {
      id: "commitments",
      label: "Open service commitments",
      value: formatCount(openTickets.length),
      delta: `${formatCount(breached)} breached · ${formatCount(imminent)} imminent`,
      direction: openSeries[11]! >= openSeries[10]! ? "up" : "down",
      favourable: openSeries[11]! < openSeries[10]!,
      basis: "live SLA clocks, net of recorded pauses",
      href: "/service/dispatch",
      series: openSeries,
      seriesLabel: "Open tickets at each month end, trailing 12 months",
      position: true,
    },
    {
      id: "renewals",
      label: "AMC renewals due — 90 days",
      value: formatCount(expiring90.length),
      delta: abbreviateINR(expiring90.reduce((s, a) => s + a.contractValue, 0)),
      direction: renewalSeries[11]! >= renewalSeries[10]! ? "up" : "down",
      favourable: false,
      basis: "contract value at stake",
      href: "/service/renewals",
      series: renewalSeries,
      seriesLabel: "Contracts falling due in the next 90 days, month by month",
      position: true,
    },
    {
      id: "projects-at-risk",
      label: "Projects at risk",
      value: formatCount(atRisk.length),
      delta: `of ${formatCount(liveProjects.length)} live`,
      direction: atRiskSeries[11]! >= atRiskSeries[10]! ? "up" : "down",
      favourable: atRiskSeries[11]! <= atRiskSeries[10]!,
      basis: "beyond their own contracted schedule tolerance",
      href: "/projects",
      series: atRiskSeries,
      seriesLabel: "Projects beyond tolerance at each month end",
      position: true,
    },
  ];

  /* ------------------------------------------------------- vertical tiles */
  const byVertical = D.revenueByVertical(ds, p.period);
  const byVerticalPrior = D.revenueByVertical(ds, p.prior);
  const equipmentNow = byVertical.EQUIPMENT_SALES ?? 0;
  const equipmentPrior = byVerticalPrior.EQUIPMENT_SALES ?? 0;
  const equipmentMove = equipmentPrior
    ? ((equipmentNow - equipmentPrior) / equipmentPrior) * 100
    : null;
  const quotesInPeriod = ds.quotations.filter(
    (x) => new Date(x.quotationDate) >= p.period.from && new Date(x.quotationDate) <= p.period.to,
  ).length;
  const winRate = D.quotationWinRate(ds, p.period);
  const openQuotes = ds.quotations.filter((x) => x.status === "ISSUED" || x.status === "NEGOTIATION").length;
  const onRent = ds.rentalAgreements.filter((r) => !r.actualReturn).length;
  const overdueReturns = ds.rentalAgreements.filter(
    (r) => !r.actualReturn && new Date(r.expectedReturn) < asOf,
  ).length;
  const rentalUtil = D.rentalUtilisationPct(ctx);
  const rentalRevenue = byVertical.RENTAL ?? 0;

  const tiles: VerticalTile[] = [
    {
      vertical: "EQUIPMENT_SALES",
      headline: `Revenue — ${p.label}`,
      metric: abbreviateINR(equipmentNow),
      supportA: `${formatCount(openQuotes)} quotations still open`,
      supportB: quotesInPeriod
        ? `Win rate ${formatPercent(winRate)} on decided quotations`
        : "No quotation raised in this period",
      state: equipmentNow === 0 && quotesInPeriod === 0
        ? "NO_ACTIVITY"
        : equipmentMove === null
          ? "WATCH"
          : equipmentMove < -15
            ? "ACTION"
            : equipmentMove < 0
              ? "WATCH"
              : "HEALTHY",
      rule: equipmentMove === null
        ? `No equipment revenue is recorded in ${p.priorLabel}, so no comparison can be drawn and the tile holds at Watch.`
        : `Healthy at or above ${p.priorLabel}, Watch when down, Action when down more than 15%. This vertical is ${equipmentMove >= 0 ? "up" : "down"} ${formatPercent(Math.abs(equipmentMove), 1)} on ${abbreviateINR(equipmentPrior)}.`,
      href: `/analytics/sales${q}`,
    },
    {
      vertical: "SERVICE_AMC",
      headline: "AMC attach rate",
      metric: formatPercent(attach.pct),
      supportA: `${formatCount(attach.outOfCoverage)} machines with no cover`,
      supportB: `${formatCount(breached)} commitments already breached`,
      state: breached > 0 || attach.pct < 50 ? "ACTION" : imminent > 0 ? "WATCH" : "HEALTHY",
      rule: `Action when any SLA is breached or attach rate is under 50%; Watch when a clock is imminent. Attach = ${formatCount(attach.underAmc)} covered of ${formatCount(attach.eligible)} eligible, excluding ${formatCount(attach.inWarranty)} still in warranty.`,
      href: `/analytics/service${q}`,
    },
    {
      vertical: "PROJECTS",
      headline: "Retention outstanding",
      metric: abbreviateINR(ret.outstanding),
      supportA: `${abbreviateINR(ret.eligible)} claimable now`,
      supportB: `${formatCount(atRisk.length)} of ${formatCount(liveProjects.length)} live projects beyond tolerance`,
      state: liveProjects.length === 0
        ? "NO_ACTIVITY"
        : atRisk.length > 0
          ? "ACTION"
          : ret.eligible > 0
            ? "WATCH"
            : "HEALTHY",
      rule: "Action when any live project is beyond its own contracted schedule tolerance; Watch when retention is claimable and unclaimed.",
      href: `/analytics/projects${q}`,
    },
    {
      vertical: "RENTAL",
      headline: "Fleet utilisation",
      metric: formatPercent(rentalUtil),
      supportA: `${formatCount(onRent)} of ${formatCount(ds.rentalAssets.length)} units on rent`,
      supportB: overdueReturns
        ? `${formatCount(overdueReturns)} returns overdue`
        : `${abbreviateINR(rentalRevenue)} billed in period`,
      state: ds.rentalAssets.length === 0
        ? "NO_ACTIVITY"
        : overdueReturns > 2
          ? "ACTION"
          : overdueReturns > 0 || rentalUtil < 50
            ? "WATCH"
            : "HEALTHY",
      rule: "Action above two overdue returns; Watch on any overdue return or utilisation under 50%, measured over a trailing 365 days.",
      href: `/service/rental${q}`,
    },
  ];

  return { kpis, tiles, locked, receivables: rec, retention: ret, revenue, priorRevenue };
}
