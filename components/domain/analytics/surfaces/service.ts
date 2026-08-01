import * as D from "@/lib/derive";
import type * as T from "@/lib/schemas/entities";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "@/lib/seed/catalog";
import { formatCount, formatPercent } from "@/lib/format";
import type { ChartSpec, Datum } from "../chartTypes";
import { detectAnomaly } from "../anomaly";
import { monthlyBuckets } from "../scope";
import type { SurfaceContext } from "../surfaceContext";
import {
  COMMISSIONING_STATE_LABEL, OEM_LABEL, PRODUCT_LINE_LABEL, SEVERITY_LABEL, TICKET_CATEGORY_LABEL,
  rootCauseLabel,
} from "./labels";
import { assetRecords, drill, inPeriod, jobCardRecords, ticketRecords, topN } from "./shared";

/** E12-S2 — the service surface. */
export function buildServiceCharts(c: SurfaceContext): ChartSpec[] {
  const { ds, period, now } = c;
  const charts: ChartSpec[] = [];
  const months = monthlyBuckets(now, 12);
  const ticketsInPeriod = ds.tickets.filter((t) => inPeriod(t.loggedAt, period));

  /* ---------------------------- 1. ticket volume by category and severity */
  const SEVERITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;
  const categories = [...new Set(ticketsInPeriod.map((t) => t.category))];
  charts.push({
    id: "svc-volume",
    kind: "stackedBar",
    title: "Ticket volume by category and severity",
    caption: "Every ticket logged in the period, stacked by the severity it was logged at. Severity drives the commitment clock, so the mix is the workload.",
    series: SEVERITIES.map((s, i) => ({
      key: s,
      label: SEVERITY_LABEL[s]!,
      tone: i + 1,
      unit: "COUNT" as const,
      stackId: "sev",
    })),
    xLabel: "Ticket category",
    yLabel: "Tickets logged",
    height: 300,
    data: categories.map((cat) => {
      const rows = ticketsInPeriod.filter((t) => t.category === cat);
      const values: Record<string, number> = {};
      for (const s of SEVERITIES) values[s] = rows.filter((t) => t.severity === s).length;
      return {
        key: cat,
        label: TICKET_CATEGORY_LABEL[cat] ?? cat,
        values,
        drill: drill(
          `${TICKET_CATEGORY_LABEL[cat] ?? cat} tickets`,
          "Tickets logged in the period",
          formatCount(rows.length),
          rows.length,
          ticketRecords(ds, rows),
          `/service/tickets?category=${cat}`,
          "Open the ticket list for this category",
        ),
      };
    }),
  });

  /* -------------------------------- 2. SLA compliance and FTFR trends */
  const slaTrend: Datum[] = months.map((m) => {
    const closed = ds.tickets.filter((t) => t.closedAt && inPeriod(t.closedAt, m));
    return {
      key: m.key,
      label: m.label,
      values: {
        sla: D.slaCompliancePct(ds, m),
        ftfr: D.firstTimeFixRate(ds, m),
      },
      drill: drill(
        `Tickets closed in ${m.label}`,
        "SLA compliance for the month",
        formatPercent(D.slaCompliancePct(ds, m)),
        closed.length,
        ticketRecords(ds, closed),
        "/service/tickets?status=CLOSED",
        "Open the closed-ticket list",
      ),
    };
  });

  const ftfrValues = slaTrend.map((d) => d.values.ftfr ?? 0);
  const ftfrAllZero = ftfrValues.every((v) => v === 0);

  charts.push({
    id: "svc-sla-trend",
    kind: "line",
    title: "SLA compliance and first-time-fix — trailing 12 months",
    caption: "K-05 and K-06 run month by month against the same closed-ticket population, so the two series are directly comparable.",
    series: [
      { key: "sla", label: "SLA compliance (K-05)", tone: 1, unit: "PERCENT" },
      { key: "ftfr", label: "First-time-fix rate (K-06)", tone: 6, unit: "PERCENT" },
    ],
    xLabel: "Month",
    yLabel: "Percent",
    height: 280,
    data: slaTrend,
    note: ftfrAllZero
      ? "First-time-fix reads nil across every month because no closed ticket in the seeded records carries a single job card marked resolved on that visit. The figure is reported as the shared formula computes it rather than adjusted upward on this surface — a metric that disagrees with its records is worse than one that reads nil."
      : null,
    anomaly: detectAnomaly(
      "SLA compliance",
      slaTrend.map((d) => ({ label: d.label, value: d.values.sla ?? 0 })),
      {
        higherIsBetter: true,
        recordSetLabel: "Open the tickets closed in the flagged month",
        recordSetHref: "/service/tickets?status=CLOSED",
      },
    ),
  });

  /* ------------------------------- 3. mean time to respond and restore */
  charts.push({
    id: "svc-mttr",
    kind: "line",
    title: "Mean time to respond and to restore",
    caption: "K-07, split. Response is a dispatch problem; restoration is a parts and skills problem. They move independently and are therefore drawn separately.",
    series: [
      { key: "respond", label: "Mean hours to first response", tone: 3, unit: "HOURS" },
      { key: "restore", label: "Mean hours to restoration", tone: 5, unit: "HOURS" },
    ],
    xLabel: "Month",
    yLabel: "Hours",
    height: 260,
    data: months.map((m) => {
      const v = D.meanResponseRestoreHours(ds, m);
      const closed = ds.tickets.filter((t) => t.closedAt && inPeriod(t.closedAt, m));
      return {
        key: m.key,
        label: m.label,
        values: { respond: v.respond, restore: v.restore },
        drill: drill(
          `Tickets closed in ${m.label}`,
          "Mean hours to restoration",
          `${v.restore.toFixed(1)} h`,
          closed.length,
          ticketRecords(ds, closed),
          "/service/tickets?status=CLOSED",
          "Open the closed-ticket list",
        ),
      };
    }),
  });

  /* ------------------------- 4. engineer utilisation and load distribution */
  const empById = new Map(ds.employees.map((e) => [e.id, e]));
  const cardsInPeriod = ds.jobCards.filter((j) => inPeriod(j.createdAt, period));
  const engineerIds = [...new Set(cardsInPeriod.map((j) => j.engineerUserId))];
  charts.push({
    id: "svc-engineer-load",
    kind: "composed",
    title: "Engineer utilisation and load distribution",
    caption: "Utilisation is K-08 computed for one engineer. Visits is the raw load. An engineer high on one and low on the other is being sent to the wrong jobs.",
    series: [
      { key: "utilisation", label: "Utilisation (K-08)", tone: 1, unit: "PERCENT", as: "bar", axis: "left" },
      { key: "visits", label: "Visits in period", tone: 7, unit: "COUNT", as: "line", axis: "right" },
    ],
    xLabel: "Engineer",
    yLabel: "Percent",
    y2Label: "Visits",
    height: 280,
    data: engineerIds.map((id) => {
      const rows = cardsInPeriod.filter((j) => j.engineerUserId === id);
      return {
        key: id,
        label: empById.get(id)?.name ?? id,
        values: {
          utilisation: D.technicianUtilisation(ds, period, id),
          visits: rows.length,
        },
        drill: drill(
          `${empById.get(id)?.name ?? id} — visits in the period`,
          "Job cards raised",
          formatCount(rows.length),
          rows.length,
          jobCardRecords(ds, rows),
          "/service/job-cards",
          "Open the job-card list",
        ),
      };
    }),
    insufficient:
      engineerIds.length === 0
        ? "No job card falls inside this period and scope, so utilisation cannot be attributed to an engineer."
        : null,
  });

  /* --------------------------------------------- 5. AMC coverage and attach */
  const attach = D.amcAttachRate({ ds, now });
  const uncovered = ds.assets.filter(
    (a) => a.status !== "DECOMMISSIONED" && D.coverageState(ds, a, now) === "OUT_OF_COVERAGE",
  );
  const underAmc = ds.assets.filter((a) => D.coverageState(ds, a, now) === "UNDER_AMC");
  const inWarranty = D.warrantyExposure({ ds, now }).assets;

  charts.push({
    id: "svc-coverage",
    kind: "donut",
    title: "Installed base by coverage state",
    caption: `Three states, three slices. The K-10 attach rate reads ${formatPercent(attach.pct)} because its denominator excludes the ${formatCount(attach.inWarranty)} machines still in warranty and the decommissioned units — the C-11 definition, stated on the tile.`,
    series: [{ key: "count", label: "Installed machines", tone: 1, unit: "COUNT" }],
    xLabel: "Coverage state",
    yLabel: "Installed machines",
    height: 280,
    data: [
      {
        key: "UNDER_AMC",
        label: "Under AMC",
        values: { count: underAmc.length },
        drill: drill("Machines under a live AMC", "Installed machines", formatCount(underAmc.length), underAmc.length, assetRecords(ds, underAmc), "/service/assets?coverage=UNDER_AMC", "Open the installed-asset list"),
      },
      {
        key: "IN_WARRANTY",
        label: "In warranty — excluded from the K-10 denominator",
        values: { count: inWarranty.length },
        drill: drill("Machines in warranty", "Installed machines", formatCount(inWarranty.length), inWarranty.length, assetRecords(ds, inWarranty), "/service/assets?coverage=IN_WARRANTY", "Open the installed-asset list"),
      },
      {
        key: "OUT_OF_COVERAGE",
        label: "Uncovered",
        values: { count: uncovered.length },
        drill: drill("Machines outside coverage", "Installed machines", formatCount(uncovered.length), uncovered.length, assetRecords(ds, uncovered), "/service/assets?coverage=OUT_OF_COVERAGE", "Open the installed-asset list"),
      },
    ],
  });

  /* ------------------------------------------ 6. AMC renewal rate trend */
  const renewalTrend = months.map((m) => {
    const due = ds.amcContracts.filter((a) => inPeriod(a.endDate, m));
    return {
      key: m.key,
      label: m.label,
      values: { rate: D.amcRenewalRate(ds, m), due: due.length },
    };
  });
  const anyDue = renewalTrend.some((d) => (d.values.due ?? 0) > 0);
  charts.push({
    id: "svc-renewal",
    kind: "composed",
    title: "AMC renewal rate against contracts falling due",
    caption: "K-09 by month, with the population it was computed from drawn alongside it. A high rate on two contracts is not a high rate.",
    series: [
      { key: "due", label: "Contracts falling due", tone: 8, unit: "COUNT", as: "bar", axis: "right" },
      { key: "rate", label: "Renewal rate (K-09)", tone: 2, unit: "PERCENT", as: "line", axis: "left" },
    ],
    xLabel: "Month",
    yLabel: "Percent",
    y2Label: "Contracts",
    height: 260,
    data: renewalTrend,
    insufficient: anyDue
      ? null
      : "No AMC contract falls due inside the trailing twelve months for this scope, so a renewal rate cannot be computed. The renewal radar lists the contracts that fall due next.",
  });

  /* ---------------------------- 7. commissioning submission compliance */
  const reportsByPrincipal = new Map<string, T.CommissioningReport[]>();
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  for (const r of ds.commissioningReports) {
    const p = assetById.get(r.assetId)?.principal ?? "OTHER";
    (reportsByPrincipal.get(p) ?? reportsByPrincipal.set(p, []).get(p)!).push(r);
  }
  const STATES = ["SUBMITTED_IN_WINDOW", "SUBMITTED_LATE", "OVERDUE", "NOT_SUBMITTED"] as const;
  charts.push({
    id: "svc-commissioning",
    kind: "stackedBar",
    title: "Commissioning submission compliance by principal",
    caption: `Each report is measured against its own principal's window — ${Object.entries(OEM_COMMISSIONING_WINDOW_DAYS)
      .map(([k, v]) => `${OEM_LABEL[k] ?? k} ${v} days`)
      .join(", ")}. K-12 is the in-window share across all of them.`,
    series: STATES.map((s, i) => ({
      key: s,
      label: COMMISSIONING_STATE_LABEL[s]!,
      tone: [6, 3, 5, 8][i]!,
      unit: "COUNT" as const,
      stackId: "cs",
    })),
    xLabel: "OEM principal",
    yLabel: "Commissioning reports",
    height: 270,
    data: [...reportsByPrincipal].map(([p, reports]) => {
      const values: Record<string, number> = { SUBMITTED_IN_WINDOW: 0, SUBMITTED_LATE: 0, OVERDUE: 0, NOT_SUBMITTED: 0 };
      for (const r of reports) {
        const asset = assetById.get(r.assetId);
        if (!asset) continue;
        const dl = D.commissioningDeadline(r, OEM_COMMISSIONING_WINDOW_DAYS[asset.principal]);
        values[D.commissioningSubmissionState(r, dl, now)] = (values[D.commissioningSubmissionState(r, dl, now)] ?? 0) + 1;
      }
      return {
        key: p,
        label: OEM_LABEL[p] ?? p,
        values,
        drill: drill(
          `${OEM_LABEL[p] ?? p} commissioning reports`,
          "Reports raised",
          formatCount(reports.length),
          reports.length,
          reports.slice(0, 60).map((r) => ({
            id: r.id,
            label: r.number,
            sub: `${assetById.get(r.assetId)?.serial ?? r.assetId} · commissioned ${new Date(r.commissioningDate).toDateString()}`,
            value: r.submittedAt ? "Submitted" : "Not submitted",
            href: `/service/commissioning/${r.id}`,
          })),
          "/service/commissioning",
          "Open the commissioning list",
        ),
      };
    }),
  });

  /* -------------------------------------------- 8. warranty exposure */
  const warrantyByLine = new Map<string, T.InstalledAsset[]>();
  for (const a of inWarranty) {
    (warrantyByLine.get(a.productLine) ?? warrantyByLine.set(a.productLine, []).get(a.productLine)!).push(a);
  }
  charts.push({
    id: "svc-warranty",
    kind: "horizontalBar",
    title: "Warranty exposure by product line",
    caption: "K-11 broken out. These machines are repaired at the company's cost until their warranty ends; the product lines carrying most of them set the free-of-charge workload.",
    series: [{ key: "count", label: "Machines in warranty", tone: 4, unit: "COUNT" }],
    xLabel: "Product line",
    yLabel: "Machines in warranty",
    height: 260,
    data: [...warrantyByLine]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([pl, rows]) => ({
        key: pl,
        label: PRODUCT_LINE_LABEL[pl] ?? pl,
        values: { count: rows.length },
        drill: drill(
          `In-warranty machines — ${PRODUCT_LINE_LABEL[pl] ?? pl}`,
          "Machines in warranty",
          formatCount(rows.length),
          rows.length,
          assetRecords(ds, rows),
          "/service/assets?coverage=IN_WARRANTY",
          "Open the installed-asset list",
        ),
      })),
  });

  /* --------------------------- 9. top failure modes by product line */
  const cardsWithCause = ds.jobCards.filter((j) => j.rootCause && inPeriod(j.createdAt, period));
  const assetLine = (j: T.JobCard) => assetById.get(j.assetId)?.productLine ?? "UNCLASSIFIED";
  const byCause = new Map<string, T.JobCard[]>();
  for (const j of cardsWithCause) {
    const k = j.rootCause!;
    (byCause.get(k) ?? byCause.set(k, []).get(k)!).push(j);
  }
  const topCauses = topN([...byCause], 8);
  const lineCounts = new Map<string, number>();
  for (const j of cardsWithCause) lineCounts.set(assetLine(j), (lineCounts.get(assetLine(j)) ?? 0) + 1);
  const topLines = [...lineCounts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);

  charts.push({
    id: "svc-failure-modes",
    kind: "stackedBar",
    title: "Top failure modes by product line",
    caption: "Root causes recorded on job cards in the period, split across the four product lines that generate the most work. This is what the spares plan should be built from.",
    series: topLines.map((pl, i) => ({
      key: pl,
      label: PRODUCT_LINE_LABEL[pl] ?? pl,
      tone: i + 1,
      unit: "COUNT" as const,
      stackId: "fm",
    })),
    xLabel: "Root cause",
    yLabel: "Job cards",
    height: 320,
    data: topCauses.map(([cause, rows]) => {
      const values: Record<string, number> = {};
      for (const pl of topLines) values[pl] = rows.filter((j) => assetLine(j) === pl).length;
      return {
        key: cause,
        label: rootCauseLabel(cause),
        values,
        drill: drill(
          `Job cards with root cause ${rootCauseLabel(cause).toLowerCase()}`,
          "Job cards recording this cause",
          formatCount(rows.length),
          rows.length,
          jobCardRecords(ds, rows),
          "/service/job-cards",
          "Open the job-card list",
        ),
      };
    }),
  });

  return charts;
}
