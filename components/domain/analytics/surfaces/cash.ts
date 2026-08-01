import * as D from "@/lib/derive";
import { abbreviateINR, formatCount, formatDate, formatPercent } from "@/lib/format";
import type { ChartSpec } from "../chartTypes";
import { detectAnomaly } from "../anomaly";
import { monthlyBuckets } from "../scope";
import type { SurfaceContext } from "../surfaceContext";
import { drill, inPeriod, invoiceRecords } from "./shared";

/** E12-S3 — the cash surface. Locked cash here must reconcile to the Command Centre. */
export function buildCashCharts(c: SurfaceContext): ChartSpec[] {
  const { ds, period, now } = c;
  const charts: ChartSpec[] = [];
  const months = monthlyBuckets(now, 12);

  /* ------------------------------------------------- 1. revenue trend */
  const revenueTrend = months.map((m) => {
    const invs = ds.invoices.filter((i) => inPeriod(i.date, m));
    return {
      key: m.key,
      label: m.label,
      values: { revenue: D.revenueInPeriod(ds, m) },
      drill: drill(
        `Invoices raised in ${m.label}`,
        "Invoiced revenue for the month",
        abbreviateINR(D.revenueInPeriod(ds, m)),
        invs.length,
        invoiceRecords(ds, invs),
        "/commercial/invoices",
        "Open the invoice list",
      ),
    };
  });

  charts.push({
    id: "cash-revenue-trend",
    kind: "composed",
    title: "Revenue trend — trailing 12 months",
    caption: "Invoiced revenue by month, computed by the same formula the Command Centre headline uses.",
    series: [{ key: "revenue", label: "Invoiced revenue", tone: 1, unit: "MONEY", as: "bar" }],
    xLabel: "Month",
    yLabel: "Rupees",
    height: 260,
    data: revenueTrend,
    anomaly: detectAnomaly(
      "Invoiced revenue",
      revenueTrend.map((d) => ({ label: d.label, value: d.values.revenue })),
      {
        higherIsBetter: true,
        recordSetLabel: "Open the invoices raised in the flagged month",
        recordSetHref: "/commercial/invoices",
        tolerance: { pct: 20, window: 6 },
      },
    ),
  });

  /* --------------------------------------- 2. receivables ageing trend */
  const BUCKETS = [
    { key: "B0_30", label: "0–30 days", tone: 6 },
    { key: "B31_60", label: "31–60 days", tone: 3 },
    { key: "B61_90", label: "61–90 days", tone: 5 },
    { key: "B90_PLUS", label: "Over 90 days", tone: 7 },
  ] as const;

  charts.push({
    id: "cash-ageing-trend",
    kind: "stackedArea",
    title: "Receivables ageing trend",
    caption: "The receivables formula re-run at the close of each month, so the ageing is recomputed against that date rather than shifted forward from today's snapshot.",
    series: BUCKETS.map((b) => ({ key: b.key, label: b.label, tone: b.tone, unit: "MONEY" as const, stackId: "age" })),
    xLabel: "Month",
    yLabel: "Rupees outstanding",
    height: 280,
    data: months.map((m) => {
      const r = D.receivables({ ds, now: m.to });
      return {
        key: m.key,
        label: m.label,
        values: {
          B0_30: r.buckets.B0_30.value,
          B31_60: r.buckets.B31_60.value,
          B61_90: r.buckets.B61_90.value,
          B90_PLUS: r.buckets.B90_PLUS.value,
        },
      };
    }),
  });

  /* --------------------------------------------------- 3. DSO trend */
  const dsoTrend = months.map((m) => ({
    key: m.key,
    label: m.label,
    values: { dso: D.dso({ ds, now: m.to }, m) },
  }));

  charts.push({
    id: "cash-dso-trend",
    kind: "line",
    title: "Days sales outstanding — trailing 12 months",
    caption: "K-14 computed at each month end against that month's invoicing. A month with little invoicing produces a high DSO by construction, which is why the revenue trend sits above it.",
    series: [{ key: "dso", label: "DSO (K-14)", tone: 5, unit: "DAYS" }],
    xLabel: "Month",
    yLabel: "Days",
    height: 250,
    data: dsoTrend,
    anomaly: detectAnomaly(
      "Days sales outstanding",
      dsoTrend.map((d) => ({ label: d.label, value: d.values.dso })),
      {
        higherIsBetter: false,
        recordSetLabel: "Open the receivables ledger",
        recordSetHref: "/commercial/receivables",
        tolerance: { pct: 25, window: 6 },
      },
    ),
  });

  /* --------------------------------------------- 4. collection efficiency */
  charts.push({
    id: "cash-collection",
    kind: "composed",
    title: "Collection efficiency",
    caption: "Receipts banked in the month against revenue invoiced in the same month. Above one hundred per cent means the month collected on earlier invoices as well as its own.",
    series: [
      { key: "invoiced", label: "Invoiced", tone: 8, unit: "MONEY", as: "bar", axis: "left" },
      { key: "collected", label: "Collected", tone: 6, unit: "MONEY", as: "bar", axis: "left" },
      { key: "efficiency", label: "Collection efficiency", tone: 3, unit: "PERCENT", as: "line", axis: "right" },
    ],
    xLabel: "Month",
    yLabel: "Rupees",
    y2Label: "Percent",
    height: 280,
    data: months.map((m) => {
      const invoiced = D.revenueInPeriod(ds, m);
      const receipts = ds.receipts.filter((r) => inPeriod(r.date, m));
      const collected = receipts.reduce((s, r) => s + r.amount, 0);
      return {
        key: m.key,
        label: m.label,
        values: {
          invoiced,
          collected,
          efficiency: invoiced ? Number(((collected / invoiced) * 100).toFixed(1)) : 0,
        },
        drill: drill(
          `Receipts banked in ${m.label}`,
          "Collected in the month",
          abbreviateINR(collected),
          receipts.length,
          receipts.slice(0, 60).map((r) => ({
            id: r.id,
            label: r.number,
            sub: `${r.mode} · ${formatDate(r.date)} · ${r.reference}`,
            value: abbreviateINR(r.amount),
            href: `/commercial/receipts/${r.id}`,
          })),
          "/commercial/receipts",
          "Open the receipt list",
        ),
      };
    }),
  });

  /* ----------------------------------------- 5. locked-cash composition */
  const locked = D.lockedCash({ ds, now });
  const rec = D.receivables({ ds, now });
  const ret = D.retention({ ds, now });

  charts.push({
    id: "cash-locked-composition",
    kind: "bar",
    title: "Locked-cash composition",
    caption: `Receivables outstanding plus project retention — ${abbreviateINR(locked.total)} in total. The same formula produces the Command Centre locked-cash panel, so for the same scope the two figures are the same figure.`,
    note: c.scope.branchId
      ? `This composition is filtered to ${c.scope.branchLabel}. The Command Centre locked-cash panel is company-wide; to reconcile the two, clear the branch filter in the header above.`
      : `Reconciliation — the Command Centre locked-cash panel reads ${abbreviateINR(locked.total)} for this scope. Identical, because both call the same implementation.`,
    series: [{ key: "value", label: "Locked cash", tone: 5, unit: "MONEY" }],
    xLabel: "Component",
    yLabel: "Rupees",
    height: 270,
    data: [
      bucketDatum("0–30 days", rec.buckets.B0_30, ds, rec, "B0_30"),
      bucketDatum("31–60 days", rec.buckets.B31_60, ds, rec, "B31_60"),
      bucketDatum("61–90 days", rec.buckets.B61_90, ds, rec, "B61_90"),
      bucketDatum("Over 90 days", rec.buckets.B90_PLUS, ds, rec, "B90_PLUS"),
      {
        key: "retention",
        label: "Project retention",
        values: { value: ret.outstanding },
        drill: drill(
          "Retention withheld and not released",
          "Retention outstanding (K-16)",
          abbreviateINR(ret.outstanding),
          ds.retentionEntries.filter((e) => !e.releasedAt).length,
          ds.retentionEntries
            .filter((e) => !e.releasedAt)
            .slice(0, 60)
            .map((e) => ({
              id: e.id,
              label: e.projectId,
              sub: `withheld ${formatDate(e.withheldOn)} · eligible ${formatDate(e.eligibleFrom)}`,
              value: abbreviateINR(e.amount),
              href: "/projects/retention",
            })),
          "/projects/retention",
          "Open the retention register",
        ),
      },
    ],
  });

  /* ------------------------------- 6. institutional against private exposure */
  charts.push({
    id: "cash-exposure",
    kind: "donut",
    title: "Institutional against private exposure",
    caption: `Institutional and government customers hold ${formatPercent(
      rec.total ? (rec.institutional / rec.total) * 100 : 0,
    )} of what is outstanding. They pay on committee cycles, not on credit terms, which is the reason DSO sits where it does.`,
    series: [{ key: "value", label: "Outstanding", tone: 1, unit: "MONEY" }],
    xLabel: "Customer class",
    yLabel: "Rupees outstanding",
    height: 260,
    data: [
      exposureDatum("Institutional & government", rec.institutional, ds, rec, true),
      exposureDatum("Private sector", rec.privateSector, ds, rec, false),
    ],
  });

  /* ------------------------------------------ 7. promised against received */
  charts.push({
    id: "cash-promises",
    kind: "groupedBar",
    title: "Promised against received",
    caption: "Payment promises taken during collection follow-up, against what was actually banked in the month the promise fell due. A broken promise is a record, not an impression.",
    series: [
      { key: "promised", label: "Promised", tone: 3, unit: "MONEY" },
      { key: "received", label: "Received", tone: 6, unit: "MONEY" },
    ],
    xLabel: "Month promised",
    yLabel: "Rupees",
    height: 260,
    data: months.map((m) => {
      const promises = ds.collectionFollowUps.filter((f) => f.promisedDate && inPeriod(f.promisedDate, m));
      const promised = promises.reduce((s, f) => s + (f.promisedAmount ?? 0), 0);
      const received = promises.filter((f) => f.fulfilled).reduce((s, f) => s + (f.promisedAmount ?? 0), 0);
      return {
        key: m.key,
        label: m.label,
        values: { promised, received },
        drill: drill(
          `Payment promises due in ${m.label}`,
          "Promised",
          abbreviateINR(promised),
          promises.length,
          promises.map((f) => {
            const inv = ds.invoices.find((i) => i.id === f.invoiceId);
            return {
              id: f.id,
              label: inv?.number ?? f.invoiceId,
              sub: `${f.mode.toLowerCase()} with ${f.personSpokenTo} on ${formatDate(f.date)} · ${f.fulfilled ? "kept" : "broken"}`,
              value: abbreviateINR(f.promisedAmount ?? 0),
              href: `/commercial/receivables`,
            };
          }),
          "/commercial/receivables",
          "Open the receivables ledger",
        ),
      };
    }),
    insufficient:
      ds.collectionFollowUps.length === 0
        ? "No collection follow-up carrying a payment promise exists inside this scope, so promised against received cannot be drawn. Record a promise during follow-up to populate it."
        : null,
  });

  /* ---------------------------------------- 8. spares and service mix trend */
  charts.push({
    id: "cash-mix",
    kind: "line",
    title: "Spares and service revenue mix",
    caption: "K-13 by month. The annuity share of the book — the part that does not depend on winning a machine sale.",
    series: [{ key: "mix", label: "Spares & service mix (K-13)", tone: 2, unit: "PERCENT" }],
    xLabel: "Month",
    yLabel: "Percent of revenue",
    height: 250,
    data: months.map((m) => ({
      key: m.key,
      label: m.label,
      values: { mix: D.sparesRevenueMixPct(ds, m) },
    })),
  });

  void period;
  return charts;
}

function bucketDatum(
  label: string,
  bucket: { value: number; count: number },
  ds: SurfaceContext["ds"],
  rec: ReturnType<typeof D.receivables>,
  key: "B0_30" | "B31_60" | "B61_90" | "B90_PLUS",
) {
  const rows = rec.openInvoices.filter((o) => o.bucket === key);
  return {
    key,
    label,
    values: { value: bucket.value },
    drill: drill(
      `Invoices outstanding ${label.toLowerCase()}`,
      "Outstanding in this bucket",
      abbreviateINR(bucket.value),
      bucket.count,
      rows.slice(0, 60).map((o) => ({
        id: o.invoice.id,
        label: o.invoice.number,
        sub: `${formatDate(o.invoice.date)} · ${formatCount(o.days)} days old`,
        value: abbreviateINR(o.outstanding),
        href: `/commercial/invoices/${o.invoice.id}`,
      })),
      `/commercial/receivables?bucket=${key}`,
      "Open the receivables ledger for this bucket",
    ),
  };
}

function exposureDatum(
  label: string,
  value: number,
  ds: SurfaceContext["ds"],
  rec: ReturnType<typeof D.receivables>,
  institutional: boolean,
) {
  const instIds = new Set(
    ds.customers.filter((x) => x.type === "INSTITUTIONAL" || x.type === "GOVERNMENT").map((x) => x.id),
  );
  const rows = rec.openInvoices.filter((o) => instIds.has(o.invoice.customerId) === institutional);
  return {
    key: institutional ? "inst" : "private",
    label,
    values: { value },
    drill: drill(
      label,
      "Outstanding from this class",
      abbreviateINR(value),
      rows.length,
      rows.slice(0, 60).map((o) => ({
        id: o.invoice.id,
        label: o.invoice.number,
        sub: `${ds.customers.find((x) => x.id === o.invoice.customerId)?.tradeName ?? ""} · ${formatCount(o.days)} days old`,
        value: abbreviateINR(o.outstanding),
        href: `/commercial/invoices/${o.invoice.id}`,
      })),
      "/commercial/receivables",
      "Open the receivables ledger",
    ),
  };
}
