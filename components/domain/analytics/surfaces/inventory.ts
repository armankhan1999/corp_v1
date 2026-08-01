import type { Dataset } from "@/lib/schemas";
import * as D from "@/lib/derive";
import type * as T from "@/lib/schemas/entities";
import { abbreviateINR, formatCount, formatPercent } from "@/lib/format";
import type { ChartSpec } from "../chartTypes";
import { detectAnomaly } from "../anomaly";
import { monthlyBuckets } from "../scope";
import type { SurfaceContext } from "../surfaceContext";
import { ITEM_CATEGORY_LABEL } from "./labels";
import { drill, inPeriod, itemRecords, jobCardRecords } from "./shared";

/**
 * E12-S3 — the inventory surface, including the stock-out against
 * first-time-fix relationship the epic asks to be stated explicitly rather than
 * left for the reader to infer from two charts side by side.
 */
export function buildInventoryCharts(c: SurfaceContext): ChartSpec[] {
  const { ds, period, now } = c;
  const charts: ChartSpec[] = [];
  const months = monthlyBuckets(now, 12);

  /** Movements indexed by item, so per-item positions stay cheap on 3,000+ rows. */
  const movementsByItem = new Map<string, T.StockMovement[]>();
  for (const m of ds.stockMovements) {
    const cur = movementsByItem.get(m.itemId);
    if (cur) cur.push(m);
    else movementsByItem.set(m.itemId, [m]);
  }
  const itemsWithMovement = ds.items.filter((i) => movementsByItem.has(i.id));
  const onHand = (item: T.Item, locationId?: string) =>
    D.stockOnHand({ ...ds, stockMovements: movementsByItem.get(item.id) ?? [] } as Dataset, item.id, locationId);

  /* --------------------------------------- 1. stock value by category */
  const CATEGORIES = ["MACHINE", "SPARE", "CONSUMABLE", "ACCESSORY", "PIPE_FITTING"] as const;
  charts.push({
    id: "inv-value-category",
    kind: "bar",
    title: "Stock value by category",
    caption: "Quantity on hand valued at standard cost. Spares dominate by count; machines dominate by value, and the two need different disciplines.",
    series: [{ key: "value", label: "Stock value", tone: 1, unit: "MONEY" }],
    xLabel: "Category",
    yLabel: "Rupees",
    height: 250,
    data: CATEGORIES.map((cat) => {
      const items = ds.items.filter((i) => i.category === cat);
      const value = D.stockValue({ ...ds, items } as Dataset);
      const rows = items
        .filter((i) => movementsByItem.has(i.id))
        .map((i) => ({ item: i, qty: onHand(i), value: Math.round(onHand(i) * i.standardCost) }))
        .filter((r) => r.qty > 0)
        .sort((a, b) => b.value - a.value);
      return {
        key: cat,
        label: ITEM_CATEGORY_LABEL[cat] ?? cat,
        values: { value },
        drill: drill(
          `${ITEM_CATEGORY_LABEL[cat] ?? cat} stock`,
          "Value at standard cost",
          abbreviateINR(value),
          rows.length,
          itemRecords(rows),
          `/inventory/stock?category=${cat}`,
          "Open the stock list for this category",
        ),
      };
    }),
  });

  /* --------------------------------------- 2. stock value by location */
  charts.push({
    id: "inv-value-location",
    kind: "horizontalBar",
    title: "Stock value by location",
    caption: "Central warehouse, branch stores, engineer boot stock and project sites, valued at standard cost. Boot stock is inventory too.",
    series: [{ key: "value", label: "Stock value", tone: 2, unit: "MONEY" }],
    xLabel: "Location",
    yLabel: "Rupees",
    height: 300,
    data: ds.stockLocations
      .map((loc) => {
        const rows = itemsWithMovement
          .map((i) => {
            const qty = onHand(i, loc.id);
            return { item: i, qty, value: Math.round(qty * i.standardCost) };
          })
          .filter((r) => r.qty > 0)
          .sort((a, b) => b.value - a.value);
        const value = rows.reduce((s, r) => s + r.value, 0);
        return {
          key: loc.id,
          label: `${loc.name} · ${loc.kind.replace(/_/g, " ").toLowerCase()}`,
          values: { value },
          drill: drill(
            loc.name,
            "Value held at this location",
            abbreviateINR(value),
            rows.length,
            itemRecords(rows),
            `/inventory/stock?location=${loc.id}`,
            "Open the stock list for this location",
          ),
        };
      })
      .filter((d) => d.values.value > 0)
      .sort((a, b) => b.values.value - a.values.value),
  });

  /* --------------------------------------------- 3. movement velocity */
  charts.push({
    id: "inv-velocity",
    kind: "composed",
    title: "Movement velocity",
    caption: "Issues and receipts by month. Velocity is what separates working stock from dead capital; the non-moving line below is the residue.",
    series: [
      { key: "issues", label: "Issue movements", tone: 5, unit: "COUNT", as: "bar", axis: "left" },
      { key: "receipts", label: "Receipt movements", tone: 6, unit: "COUNT", as: "bar", axis: "left" },
      { key: "issueValue", label: "Value issued", tone: 3, unit: "MONEY", as: "line", axis: "right" },
    ],
    xLabel: "Month",
    yLabel: "Movements",
    y2Label: "Rupees",
    height: 270,
    data: months.map((m) => {
      const rows = ds.stockMovements.filter((x) => inPeriod(x.at, m));
      const issues = rows.filter((x) => x.type === "ISSUE");
      return {
        key: m.key,
        label: m.label,
        values: {
          issues: issues.length,
          receipts: rows.filter((x) => x.type === "RECEIPT").length,
          issueValue: Math.round(issues.reduce((s, x) => s + x.qty * x.rate, 0)),
        },
        drill: drill(
          `Stock movements in ${m.label}`,
          "Issue movements",
          formatCount(issues.length),
          issues.length,
          issues.slice(0, 60).map((x) => ({
            id: x.id,
            label: ds.items.find((i) => i.id === x.itemId)?.code ?? x.itemId,
            sub: `${x.sourceLabel} · ${x.type.toLowerCase()}`,
            value: formatCount(x.qty),
            href: "/inventory/movements",
          })),
          "/inventory/movements",
          "Open the movement register",
        ),
      };
    }),
  });

  /* ---------------------------------------------- 4. reorder exposure */
  const belowReorder = itemsWithMovement
    .map((i) => ({ item: i, qty: onHand(i), value: 0 }))
    .filter((r) => r.item.reorderLevel > 0 && r.qty < r.item.reorderLevel)
    .map((r) => ({ ...r, value: Math.round(Math.max(0, r.item.reorderLevel - r.qty) * r.item.standardCost) }))
    .sort((a, b) => b.value - a.value);

  charts.push({
    id: "inv-reorder",
    kind: "bar",
    title: "Reorder exposure by category",
    caption: `${formatCount(belowReorder.length)} items sit below their reorder level. Exposure is the cost of bringing each back up to that level — the purchase the business has already committed to in practice.`,
    series: [{ key: "value", label: "Cost to replenish", tone: 3, unit: "MONEY" }],
    xLabel: "Category",
    yLabel: "Rupees",
    height: 250,
    data: CATEGORIES.map((cat) => {
      const rows = belowReorder.filter((r) => r.item.category === cat);
      const value = rows.reduce((s, r) => s + r.value, 0);
      return {
        key: cat,
        label: ITEM_CATEGORY_LABEL[cat] ?? cat,
        values: { value },
        drill: drill(
          `${ITEM_CATEGORY_LABEL[cat] ?? cat} items below reorder level`,
          "Cost to replenish",
          abbreviateINR(value),
          rows.length,
          itemRecords(rows),
          "/inventory/reorder",
          "Open the reorder list",
        ),
      };
    }),
    insufficient:
      belowReorder.length === 0
        ? "No item inside this scope is below its reorder level, so there is no replenishment exposure to state."
        : null,
  });

  /* ----------------- 5. stock-out incidence against first-time-fix (E12-S3) */
  const partsBlockedCards = ds.jobCards.filter((j) =>
    ds.partsRequests.some((r) => r.jobCardId === j.id && r.serviceCritical),
  );
  const relationship = months.map((m) => {
    const cardsInMonth = ds.jobCards.filter((j) => inPeriod(j.createdAt, m));
    const blocked = partsBlockedCards.filter((j) => inPeriod(j.createdAt, m));
    return {
      key: m.key,
      label: m.label,
      values: {
        stockOut: D.stockOutIncidencePct(ds, m),
        ftfr: D.firstTimeFixRate(ds, m),
      },
      drill: drill(
        `Job cards blocked on service-critical parts in ${m.label}`,
        "Job cards contributing to stock-out incidence",
        formatCount(blocked.length),
        blocked.length,
        jobCardRecords(ds, blocked),
        "/service/job-cards?blocked=parts",
        "Open the job-card list",
      ),
      __cards: cardsInMonth.length,
    };
  });

  const revisits = ds.jobCards.filter((j) => j.visitSequence > 1);
  const revisitsFromParts = ds.jobCards.filter(
    (j) => j.visitSequence > 1 && ds.jobCards.some((p) => p.ticketId === j.ticketId && p.visitSequence === j.visitSequence - 1 && p.outcome === "PARTS_AWAITED"),
  );

  charts.push({
    id: "inv-stockout-ftfr",
    kind: "composed",
    title: "Stock-out incidence against first-time-fix",
    caption: "K-19 and K-06 on one pair of axes, month by month, because the two are the same story told from two ends of the building.",
    note:
      `The relationship, stated plainly: of ${formatCount(revisits.length)} repeat visits in the seeded records, ` +
      `${formatCount(revisitsFromParts.length)} follow a visit that closed as parts awaited — ` +
      `${formatPercent(revisits.length ? (revisitsFromParts.length / revisits.length) * 100 : 0)} of all revisits. ` +
      `A part that is not on the shelf when the engineer arrives becomes a second journey, a second half-day, and a customer who waited twice. ` +
      `Click any month to open the job cards that contributed to that month's stock-out incidence.`,
    series: [
      { key: "stockOut", label: "Stock-out incidence (K-19)", tone: 5, unit: "PERCENT", as: "bar", axis: "left" },
      { key: "ftfr", label: "First-time-fix rate (K-06)", tone: 6, unit: "PERCENT", as: "line", axis: "right" },
    ],
    xLabel: "Month",
    yLabel: "Stock-out incidence",
    y2Label: "First-time-fix",
    height: 290,
    data: relationship.map(({ __cards, ...d }) => {
      void __cards;
      return d;
    }),
  });

  /* --------------------------------- 6. non-moving stock value trend */
  const nonMovingTrend = months.map((m) => ({
    key: m.key,
    label: m.label,
    values: { value: D.nonMovingStockValue({ ds, now: m.to }, 180) },
  }));

  charts.push({
    id: "inv-nonmoving-trend",
    kind: "area",
    title: "Non-moving stock value — trailing 12 months",
    caption: "K-20 recomputed at each month end: the value of everything with no issue movement in the 180 days before that date.",
    series: [{ key: "value", label: "Non-moving stock value (K-20)", tone: 7, unit: "MONEY" }],
    xLabel: "Month",
    yLabel: "Rupees",
    height: 250,
    data: nonMovingTrend,
    anomaly: detectAnomaly(
      "Non-moving stock value",
      nonMovingTrend.map((d) => ({ label: d.label, value: d.values.value })),
      {
        higherIsBetter: false,
        recordSetLabel: "Open the non-moving items",
        recordSetHref: "/inventory/stock?filter=non-moving",
        tolerance: { pct: 20, window: 6 },
      },
    ),
  });

  /* ---------------------------------- 7. non-moving items by category */
  const nonMoving = D.nonMovingItems({ ds, now }, 180);
  charts.push({
    id: "inv-nonmoving-category",
    kind: "horizontalBar",
    title: "Non-moving stock by category",
    caption: `${abbreviateINR(D.nonMovingStockValue({ ds, now }, 180))} across ${formatCount(nonMoving.length)} items with no issue in 180 days.`,
    series: [{ key: "value", label: "Non-moving value", tone: 8, unit: "MONEY" }],
    xLabel: "Category",
    yLabel: "Rupees",
    height: 240,
    data: CATEGORIES.map((cat) => {
      const rows = nonMoving.filter((r) => r.item.category === cat);
      const value = rows.reduce((s, r) => s + r.value, 0);
      return {
        key: cat,
        label: ITEM_CATEGORY_LABEL[cat] ?? cat,
        values: { value },
        drill: drill(
          `Non-moving ${(ITEM_CATEGORY_LABEL[cat] ?? cat).toLowerCase()} stock`,
          "Value with no issue in 180 days",
          abbreviateINR(value),
          rows.length,
          itemRecords(rows),
          "/inventory/stock?filter=non-moving",
          "Open the non-moving item list",
        ),
      };
    }).filter((d) => d.values.value > 0),
  });

  void period;
  return charts;
}
