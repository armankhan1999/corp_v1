import * as D from "@/lib/derive";
import type * as T from "@/lib/schemas/entities";
import {
  CUSTOMER_TYPE_LABEL, LOSS_REASON_LABEL, OEM_LABEL, PRODUCT_LINE_LABEL,
} from "./labels";
import { abbreviateINR, formatCount, formatPercent } from "@/lib/format";
import type { ChartSpec, Datum } from "../chartTypes";
import { detectAnomaly } from "../anomaly";
import { monthlyBuckets } from "../scope";
import type { SurfaceContext } from "../surfaceContext";
import {
  drill, enquiryRecords, inPeriod, invoiceDimensions, invoiceRecords, quotationRecords, revenueOf,
} from "./shared";

/**
 * E12-S2 — the sales surface.
 *
 * Every bar is a filtered record set fed to a `/lib/derive` formula, so a bar
 * clicked opens exactly the records that produced it and their aggregate is the
 * number that was on the bar.
 */

/**
 * Order value has no implementation in `/lib/derive` because it is not one of
 * the 22 dictionary KPIs, and nothing else in the platform publishes it. It is
 * defined once, here, so it also cannot be computed two ways.
 */
function salesOrderValue(lines: T.SalesOrderLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.qty * l.rate * (1 - l.discountPct / 100), 0));
}

export function buildSalesCharts(c: SurfaceContext): ChartSpec[] {
  const { ds, period, now } = c;
  const dims = invoiceDimensions(ds);
  const invoicesInPeriod = ds.invoices.filter((i) => inPeriod(i.date, period));
  const totalRevenue = D.revenueInPeriod(ds, period);

  const charts: ChartSpec[] = [];

  /* ------------------------------------------------ 1. enquiry funnel */
  const enquiries = ds.enquiries.filter((e) => inPeriod(e.createdAt, period));
  const enquiryIds = new Set(enquiries.map((e) => e.id));
  const quotedIds = new Set(
    ds.quotations.filter((q) => q.enquiryId && enquiryIds.has(q.enquiryId)).map((q) => q.enquiryId!),
  );
  const negotiating = enquiries.filter(
    (e) => e.status === "NEGOTIATION" || e.status === "WON" ||
      ds.quotations.some((q) => q.enquiryId === e.id && (q.status === "NEGOTIATION" || q.status === "WON")),
  );
  const qualified = enquiries.filter((e) => e.status !== "NEW" && e.status !== "DROPPED");
  const quoted = enquiries.filter((e) => quotedIds.has(e.id) || ["QUOTED", "NEGOTIATION", "WON", "LOST"].includes(e.status));
  const won = enquiries.filter((e) => e.status === "WON");

  const stages: { key: string; label: string; rows: T.Enquiry[] }[] = [
    { key: "received", label: "Enquiry received", rows: enquiries },
    { key: "qualified", label: "Qualified", rows: qualified },
    { key: "quoted", label: "Quotation issued", rows: quoted },
    { key: "negotiation", label: "In negotiation", rows: negotiating },
    { key: "won", label: "Order won", rows: won },
  ];

  charts.push({
    id: "sales-funnel",
    kind: "horizontalBar",
    title: "Enquiry funnel with stage conversion",
    caption: `Each stage counts the enquiries raised in this period that reached it. Conversion between stages: ${stages
      .slice(1)
      .map((s, i) => `${s.label.toLowerCase()} ${formatPercent(stages[i]!.rows.length ? (s.rows.length / stages[i]!.rows.length) * 100 : 0)}`)
      .join(" · ")}.`,
    series: [{ key: "count", label: "Enquiries", tone: 1, unit: "COUNT" }],
    xLabel: "Funnel stage",
    yLabel: "Enquiries",
    height: 240,
    data: stages.map((s, i) => ({
      key: s.key,
      label:
        i === 0
          ? s.label
          : `${s.label} · ${formatPercent(stages[i - 1]!.rows.length ? (s.rows.length / stages[i - 1]!.rows.length) * 100 : 0)} of prior`,
      values: { count: s.rows.length },
      drill: drill(
        s.label,
        "Enquiries reaching this stage",
        formatCount(s.rows.length),
        s.rows.length,
        enquiryRecords(ds, s.rows),
        "/sales/enquiries",
        "Open the enquiry list",
      ),
    })),
  });

  /* ------------------------------------------ 2. revenue by product line */
  const byProductLine = new Map<string, T.Invoice[]>();
  for (const inv of invoicesInPeriod) {
    const k = dims.get(inv.id)?.productLine ?? "UNCLASSIFIED";
    (byProductLine.get(k) ?? byProductLine.set(k, []).get(k)!).push(inv);
  }
  const plData: Datum[] = [...byProductLine]
    .map(([k, invs]) => {
      const value = revenueOf(ds, invs, period);
      return {
        key: k,
        label: PRODUCT_LINE_LABEL[k] ?? "Unclassified",
        values: { revenue: value },
        drill: drill(
          `Revenue — ${PRODUCT_LINE_LABEL[k] ?? "Unclassified"}`,
          "Invoiced revenue in the period",
          abbreviateINR(value),
          invs.length,
          invoiceRecords(ds, invs),
          "/commercial/invoices",
          "Open the invoice list",
        ),
      };
    })
    .sort((a, b) => (b.values.revenue ?? 0) - (a.values.revenue ?? 0))
    .slice(0, 10);

  charts.push({
    id: "sales-revenue-productline",
    kind: "horizontalBar",
    title: "Revenue by product line",
    caption: `Each invoice is attributed whole to the product line of its largest line, so these bars sum to ${abbreviateINR(totalRevenue)} — the same figure the revenue formula produces for this period.`,
    series: [{ key: "revenue", label: "Invoiced revenue", tone: 2, unit: "MONEY" }],
    xLabel: "Product line",
    yLabel: "Invoiced revenue",
    height: 300,
    data: plData,
  });

  /* -------------------------------------- 3. revenue by OEM principal */
  const byPrincipal = new Map<string, T.Invoice[]>();
  for (const inv of invoicesInPeriod) {
    const k = dims.get(inv.id)?.principal ?? "OTHER";
    (byPrincipal.get(k) ?? byPrincipal.set(k, []).get(k)!).push(inv);
  }
  charts.push({
    id: "sales-revenue-principal",
    kind: "donut",
    title: "Revenue by OEM principal",
    caption: "Five principals, five slices. Each invoice is attributed to the principal of its largest line.",
    series: [{ key: "revenue", label: "Invoiced revenue", tone: 1, unit: "MONEY" }],
    xLabel: "OEM principal",
    yLabel: "Invoiced revenue",
    height: 280,
    data: [...byPrincipal].map(([k, invs]) => {
      const value = revenueOf(ds, invs, period);
      return {
        key: k,
        label: OEM_LABEL[k] ?? k,
        values: { revenue: value },
        drill: drill(
          `Revenue — ${OEM_LABEL[k] ?? k}`,
          "Invoiced revenue in the period",
          abbreviateINR(value),
          invs.length,
          invoiceRecords(ds, invs),
          "/commercial/invoices",
          "Open the invoice list",
        ),
      };
    }),
  });

  /* --------------------------------------- 4. revenue by customer type */
  const custType = new Map(ds.customers.map((x) => [x.id, x.type as string]));
  const byCustType = new Map<string, T.Invoice[]>();
  for (const inv of invoicesInPeriod) {
    const k = custType.get(inv.customerId) ?? "INDUSTRIAL";
    (byCustType.get(k) ?? byCustType.set(k, []).get(k)!).push(inv);
  }
  charts.push({
    id: "sales-revenue-customertype",
    kind: "bar",
    title: "Revenue by customer type",
    caption: "Institutional and government revenue is the slowest to collect; this bar is the input to the cash surface's exposure view.",
    series: [{ key: "revenue", label: "Invoiced revenue", tone: 3, unit: "MONEY" }],
    xLabel: "Customer type",
    yLabel: "Invoiced revenue",
    height: 240,
    data: [...byCustType].map(([k, invs]) => {
      const value = revenueOf(ds, invs, period);
      return {
        key: k,
        label: CUSTOMER_TYPE_LABEL[k] ?? k,
        values: { revenue: value },
        drill: drill(
          `Revenue — ${CUSTOMER_TYPE_LABEL[k] ?? k}`,
          "Invoiced revenue in the period",
          abbreviateINR(value),
          invs.length,
          invoiceRecords(ds, invs),
          "/commercial/invoices",
          "Open the invoice list",
        ),
      };
    }),
  });

  /* ------------------------------- 5. target against achieved, by branch */
  const branchTargets = c.full.targets.filter((t) => t.branchId);
  charts.push({
    id: "sales-target-branch",
    kind: "groupedBar",
    title: "Target against achieved — by branch",
    caption: "Achieved is revenue invoiced inside the period. Targets are annual, so a part-year period reads short by design; the period is named on every bar's tooltip.",
    series: [
      { key: "target", label: "Target", tone: 8, unit: "MONEY" },
      { key: "achieved", label: "Achieved", tone: 1, unit: "MONEY" },
    ],
    xLabel: "Branch",
    yLabel: "Rupees",
    height: 260,
    data: c.full.branches
      .filter((b) => !c.scope.branchId || b.id === c.scope.branchId)
      .map((b) => {
        const target = branchTargets.filter((t) => t.branchId === b.id).reduce((s, t) => s + t.amount, 0);
        const invs = invoicesInPeriod.filter((i) => i.branchId === b.id);
        const achieved = revenueOf(ds, invs, period);
        return {
          key: b.id,
          label: b.name,
          values: { target, achieved },
          drill: drill(
            `${b.name} — invoiced in the period`,
            "Invoiced revenue",
            abbreviateINR(achieved),
            invs.length,
            invoiceRecords(ds, invs),
            `/commercial/invoices?branch=${b.id}`,
            "Open the invoice list for this branch",
          ),
        };
      }),
  });

  /* ---------------------------- 6. target against achieved, by executive */
  const userTargets = c.full.targets.filter((t) => t.userId);
  const execRows = userTargets
    .map((t) => {
      const user = c.full.users.find((u) => u.id === t.userId);
      const invs = invoicesInPeriod.filter((i) => i.ownerUserId === t.userId);
      const achieved = revenueOf(ds, invs, period);
      return {
        key: String(t.userId),
        label: user?.name ?? String(t.userId),
        values: { target: t.amount, achieved },
        drill: drill(
          `${user?.name ?? t.userId} — invoiced in the period`,
          "Invoiced revenue",
          abbreviateINR(achieved),
          invs.length,
          invoiceRecords(ds, invs),
          "/commercial/invoices",
          "Open the invoice list",
        ),
      };
    })
    .filter((r) => !c.scope.ownerUserId || r.key === c.scope.ownerUserId);

  charts.push({
    id: "sales-target-exec",
    kind: "groupedBar",
    title: "Target against achieved — by executive",
    caption: "Personal annual targets against revenue invoiced under that owner in the period.",
    series: [
      { key: "target", label: "Target", tone: 8, unit: "MONEY" },
      { key: "achieved", label: "Achieved", tone: 6, unit: "MONEY" },
    ],
    xLabel: "Executive",
    yLabel: "Rupees",
    height: 240,
    data: execRows,
    insufficient:
      execRows.length === 0
        ? "No personal sales target is set for anyone inside this scope, so target against achieved cannot be stated at executive level. Set targets in Masters to populate this chart."
        : null,
  });

  /* ------------------------------------- 7. quotation ageing distribution */
  const openQuotes = ds.quotations.filter((q) => q.status === "ISSUED" || q.status === "NEGOTIATION");
  const ageBuckets: { key: string; label: string; min: number; max: number }[] = [
    { key: "b0", label: "0–15 days", min: 0, max: 15 },
    { key: "b1", label: "16–30 days", min: 16, max: 30 },
    { key: "b2", label: "31–60 days", min: 31, max: 60 },
    { key: "b3", label: "61–90 days", min: 61, max: 90 },
    { key: "b4", label: "Over 90 days", min: 91, max: Number.MAX_SAFE_INTEGER },
  ];
  const ageOf = (q: T.Quotation) => Math.floor((now.getTime() - new Date(q.quotationDate).getTime()) / 86_400_000);

  charts.push({
    id: "sales-quote-ageing",
    kind: "bar",
    title: "Quotation ageing distribution",
    caption: `Open quotations by days since issue. The mean across all ${formatCount(openQuotes.length)} of them is the K-03 tile above.`,
    series: [{ key: "count", label: "Open quotations", tone: 3, unit: "COUNT" }],
    xLabel: "Age band",
    yLabel: "Open quotations",
    height: 240,
    data: ageBuckets.map((b) => {
      const rows = openQuotes.filter((q) => ageOf(q) >= b.min && ageOf(q) <= b.max);
      return {
        key: b.key,
        label: b.label,
        values: { count: rows.length },
        drill: drill(
          `Quotations open ${b.label.toLowerCase()}`,
          "Open quotations in this band",
          formatCount(rows.length),
          rows.length,
          quotationRecords(ds, rows),
          "/sales/quotations?status=ISSUED",
          "Open the quotation list",
        ),
      };
    }),
  });

  /* ------------------------------------------ 8. loss-reason distribution */
  const lost = ds.quotations.filter((q) => q.status === "LOST" && inPeriod(q.quotationDate, period));
  const byReason = new Map<string, T.Quotation[]>();
  for (const q of lost) {
    const k = q.lossReason ?? "OTHER";
    (byReason.get(k) ?? byReason.set(k, []).get(k)!).push(q);
  }
  charts.push({
    id: "sales-loss-reasons",
    kind: "horizontalBar",
    title: "Loss-reason distribution",
    caption: "Why decided quotations were lost in this period. Delivery lead time and price are separable causes with separate remedies.",
    series: [{ key: "count", label: "Quotations lost", tone: 5, unit: "COUNT" }],
    xLabel: "Loss reason",
    yLabel: "Quotations lost",
    height: 260,
    data: [...byReason]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([k, rows]) => ({
        key: k,
        label: LOSS_REASON_LABEL[k] ?? k,
        values: { count: rows.length },
        drill: drill(
          `Lost to ${(LOSS_REASON_LABEL[k] ?? k).toLowerCase()}`,
          "Quotations lost for this reason",
          formatCount(rows.length),
          rows.length,
          quotationRecords(ds, rows),
          "/sales/quotations?status=LOST",
          "Open the lost-quotation list",
        ),
      })),
  });

  /* ------------------------------------------- 9. win-rate trend, 12 months */
  const months = monthlyBuckets(now, 12);
  const winTrend = months.map((m) => ({
    key: m.key,
    label: m.label,
    values: {
      winRate: D.quotationWinRate(ds, m),
      conversion: D.enquiryToOrderConversion(ds, m),
    },
    drill: drill(
      `Quotations decided in ${m.label}`,
      "Win rate for the month",
      formatPercent(D.quotationWinRate(ds, m)),
      ds.quotations.filter((q) => inPeriod(q.quotationDate, m) && (q.status === "WON" || q.status === "LOST")).length,
      quotationRecords(ds, ds.quotations.filter((q) => inPeriod(q.quotationDate, m) && (q.status === "WON" || q.status === "LOST"))),
      "/sales/quotations",
      "Open the quotation list",
    ),
  }));

  charts.push({
    id: "sales-winrate-trend",
    kind: "line",
    title: "Quotation win rate and enquiry conversion — trailing 12 months",
    caption: "Both series are the dictionary formulas K-02 and K-01 run month by month, not a smoothed variant of them.",
    series: [
      { key: "winRate", label: "Quotation win rate (K-02)", tone: 1, unit: "PERCENT" },
      { key: "conversion", label: "Enquiry to order conversion (K-01)", tone: 4, unit: "PERCENT" },
    ],
    xLabel: "Month",
    yLabel: "Percent",
    height: 260,
    data: winTrend,
    anomaly: detectAnomaly(
      "Quotation win rate",
      winTrend.map((d) => ({ label: d.label, value: d.values.winRate! })),
      {
        higherIsBetter: true,
        recordSetLabel: "Open the quotations decided in the flagged month",
        recordSetHref: "/sales/quotations",
        tolerance: { pct: 15, window: 6 },
      },
    ),
  });

  /* --------------------------------------------- 10. average deal value */
  const ordersInPeriod = ds.salesOrders.filter((o) => inPeriod(o.orderDate, period));
  const dealMonths = months.map((m) => {
    const orders = ds.salesOrders.filter((o) => inPeriod(o.orderDate, m));
    const values = orders.map((o) => salesOrderValue(ds.salesOrderLines.filter((l) => l.salesOrderId === o.id)));
    const avg = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
    return {
      key: m.key,
      label: m.label,
      values: { avg, orders: orders.length },
    };
  });

  charts.push({
    id: "sales-deal-value",
    kind: "composed",
    title: "Average deal value and order count",
    caption: `Average deal value is the mean net line value of the orders placed in each month. Across the selected period that is ${abbreviateINR(
      ordersInPeriod.length
        ? Math.round(
            ordersInPeriod
              .map((o) => salesOrderValue(ds.salesOrderLines.filter((l) => l.salesOrderId === o.id)))
              .reduce((s, v) => s + v, 0) / ordersInPeriod.length,
          )
        : 0,
    )} across ${formatCount(ordersInPeriod.length)} orders.`,
    series: [
      { key: "avg", label: "Average deal value", tone: 2, unit: "MONEY", as: "bar", axis: "left" },
      { key: "orders", label: "Orders placed", tone: 7, unit: "COUNT", as: "line", axis: "right" },
    ],
    xLabel: "Month",
    yLabel: "Rupees",
    y2Label: "Orders",
    height: 260,
    data: dealMonths,
  });

  return charts;
}
