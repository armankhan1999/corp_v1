import * as D from "@/lib/derive";
import type * as T from "@/lib/schemas/entities";
import { abbreviateINR, formatCount, formatDate, formatPercent } from "@/lib/format";
import type { ChartSpec, Datum, RecordRef } from "../chartTypes";
import { monthlyBuckets } from "../scope";
import type { SurfaceContext } from "../surfaceContext";
import { drill } from "./shared";

/** E12-S3 — the projects surface. */
export function buildProjectCharts(c: SurfaceContext): ChartSpec[] {
  const { ds, now } = c;
  const charts: ChartSpec[] = [];
  const projects = ds.projects;
  const live = projects.filter(
    (p) => p.status === "IN_PROGRESS" || p.status === "MOBILISED" || p.status === "COMMISSIONING",
  );

  const projectRecords = (rows: T.Project[]): RecordRef[] =>
    rows.map((p) => ({
      id: p.id,
      label: p.code,
      sub: `${p.name} · ${p.district}`,
      value: abbreviateINR(p.contractValue),
      href: `/projects/${p.id}`,
    }));

  /* ------------------------------------------------- 1. portfolio value */
  charts.push({
    id: "prj-portfolio",
    kind: "horizontalBar",
    title: "Portfolio value by project",
    caption: `Contract value across ${formatCount(projects.length)} projects, totalling ${abbreviateINR(
      projects.reduce((s, p) => s + p.contractValue, 0),
    )}. Status is on each bar's record set.`,
    series: [{ key: "value", label: "Contract value", tone: 4, unit: "MONEY" }],
    xLabel: "Project",
    yLabel: "Contract value",
    height: 300,
    data: projects
      .slice()
      .sort((a, b) => b.contractValue - a.contractValue)
      .map((p) => ({
        key: p.id,
        label: p.code,
        values: { value: p.contractValue },
        drill: drill(
          p.name,
          "Contract value",
          abbreviateINR(p.contractValue),
          1,
          projectRecords([p]),
          `/projects/${p.id}`,
          "Open the project",
        ),
      })),
  });

  /* ------------------------------ 2. physical against financial progress */
  charts.push({
    id: "prj-progress",
    kind: "groupedBar",
    title: "Physical against financial progress",
    caption: "Physical is executed BOQ value as a share of the contracted BOQ. Financial is the certified value as a share of what has been executed — K-18. A wide gap is work done and not yet paid for.",
    series: [
      { key: "physical", label: "Physical progress", tone: 1, unit: "PERCENT" },
      { key: "financial", label: "Billing realisation (K-18)", tone: 6, unit: "PERCENT" },
    ],
    xLabel: "Project",
    yLabel: "Percent",
    height: 280,
    data: projects.map((p) => {
      const prog = D.projectProgress(ds, p.id);
      return {
        key: p.id,
        label: p.code,
        values: { physical: prog.pct, financial: D.projectBillingRealisationPct(ds, p.id) },
        drill: drill(
          `${p.name} — progress`,
          "Executed BOQ value",
          abbreviateINR(prog.executedValue),
          ds.boqLines.filter((l) => l.projectId === p.id).length,
          ds.boqLines
            .filter((l) => l.projectId === p.id)
            .slice(0, 60)
            .map((l) => ({
              id: l.id,
              label: l.code,
              sub: `${l.description} · ${l.section}`,
              value: abbreviateINR(D.boqExecutedQty(ds, l.id) * l.rate),
              href: `/projects/${p.id}`,
            })),
          `/projects/${p.id}`,
          "Open the project BOQ",
        ),
      };
    }),
  });

  /* ------------------------------------------------ 3. S-curve per project */
  for (const p of live) {
    charts.push(sCurve(c, p));
  }
  if (live.length === 0) {
    charts.push({
      id: "prj-scurve-none",
      kind: "line",
      title: "S-curve",
      caption: "Planned against actual cumulative progress.",
      series: [],
      xLabel: "Month",
      yLabel: "Percent complete",
      data: [],
      insufficient: "No project inside this scope is mobilised, in progress or commissioning, so there is no live S-curve to draw.",
    });
  }

  /* --------------------------------- 4. schedule variance distribution */
  charts.push({
    id: "prj-variance",
    kind: "bar",
    title: "Schedule variance distribution",
    caption: "K-17 per project. Negative is behind plan. The dashed line is the tolerance band the portfolio is managed to; a bar past it is an exception, not a wobble.",
    series: [{ key: "variance", label: "Schedule variance (K-17)", tone: 5, unit: "PERCENT" }],
    xLabel: "Project",
    yLabel: "Percent against plan",
    height: 260,
    reference: { value: -(live[0]?.varianceTolerancePct ?? 5), label: "Tolerance", tone: "warn" },
    data: projects.map((p) => {
      const v = D.scheduleVariancePct(ds, p, now);
      const ms = ds.milestones.filter((m) => m.projectId === p.id);
      return {
        key: p.id,
        label: p.code,
        values: { variance: v },
        drill: drill(
          `${p.name} — milestones`,
          "Schedule variance",
          `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
          ms.length,
          ms.map((m) => ({
            id: m.id,
            label: m.name,
            sub: `planned ${formatDate(m.plannedDate)}${m.actualDate ? ` · actual ${formatDate(m.actualDate)}` : " · not achieved"}`,
            value: `${m.weightage}% weight`,
            href: `/projects/${p.id}`,
          })),
          `/projects/${p.id}`,
          "Open the project schedule",
        ),
      };
    }),
  });

  /* ------------------------- 5. RA-bill claimed against certified variance */
  const bills = ds.raBills.slice().sort((a, b) => a.projectId.localeCompare(b.projectId) || a.sequence - b.sequence);
  charts.push({
    id: "prj-rabill",
    kind: "groupedBar",
    title: "RA-bill claimed against certified",
    caption: "Every RA-bill raised, with what was claimed against what the client certified. The gap is the negotiation the project manager is carrying.",
    series: [
      { key: "claimed", label: "Claimed", tone: 3, unit: "MONEY" },
      { key: "certified", label: "Certified", tone: 6, unit: "MONEY" },
    ],
    xLabel: "RA-bill",
    yLabel: "Rupees",
    height: 300,
    data: bills.map((b) => ({
      key: b.id,
      label: `${b.projectId.replace("PRJ-", "P")} RA-${b.sequence}`,
      values: { claimed: b.claimedValue, certified: b.certifiedValue ?? 0 },
      drill: drill(
        `${b.number} — claimed against certified`,
        "Claimed value",
        abbreviateINR(b.claimedValue),
        1,
        [
          {
            id: b.id,
            label: b.number,
            sub: `${formatDate(b.periodFrom)} – ${formatDate(b.periodTo)} · ${b.status.replace(/_/g, " ").toLowerCase()}`,
            value: b.certifiedValue === null ? "not certified" : abbreviateINR(b.certifiedValue),
            href: `/projects/${b.projectId}`,
          },
        ],
        `/projects/${b.projectId}`,
        "Open the project RA-bills",
      ),
    })),
    insufficient: bills.length === 0 ? "No RA-bill has been raised inside this scope." : null,
  });

  /* ---------------------------- 6. retention outstanding trend and ageing */
  const months = monthlyBuckets(now, 12);
  charts.push({
    id: "prj-retention-trend",
    kind: "area",
    title: "Retention outstanding — trailing 12 months",
    caption: "K-16 recomputed at the close of each month. Retention only leaves this line when it is released, which is why it climbs.",
    series: [{ key: "retention", label: "Retention outstanding (K-16)", tone: 4, unit: "MONEY" }],
    xLabel: "Month",
    yLabel: "Rupees",
    height: 250,
    data: months.map((m) => ({
      key: m.key,
      label: m.label,
      values: { retention: D.retentionLockedUp({ ds, now: m.to }) },
    })),
  });

  const ret = D.retention({ ds, now });
  const ageBands = [
    { key: "eligible", label: "Eligible for release now", rows: ds.retentionEntries.filter((e) => !e.releasedAt && new Date(e.eligibleFrom) <= now) },
    { key: "within12", label: "Eligible within 12 months", rows: ds.retentionEntries.filter((e) => !e.releasedAt && new Date(e.eligibleFrom) > now && new Date(e.eligibleFrom).getTime() - now.getTime() <= 365 * 86_400_000) },
    { key: "beyond12", label: "Eligible beyond 12 months", rows: ds.retentionEntries.filter((e) => !e.releasedAt && new Date(e.eligibleFrom).getTime() - now.getTime() > 365 * 86_400_000) },
    { key: "released", label: "Released", rows: ds.retentionEntries.filter((e) => e.releasedAt) },
  ];

  charts.push({
    id: "prj-retention-ageing",
    kind: "bar",
    title: "Retention ageing by release eligibility",
    caption: `${abbreviateINR(ret.outstanding)} outstanding across ${formatCount(ret.projectCount)} projects, of which ${abbreviateINR(ret.eligible)} is claimable today.`,
    series: [{ key: "value", label: "Retention", tone: 2, unit: "MONEY" }],
    xLabel: "Release eligibility",
    yLabel: "Rupees",
    height: 250,
    data: ageBands.map((band) => {
      const value = band.rows.reduce((s, e) => s + (e.releasedAt ? (e.releasedAmount ?? e.amount) : e.amount), 0);
      return {
        key: band.key,
        label: band.label,
        values: { value },
        drill: drill(
          band.label,
          "Retention in this band",
          abbreviateINR(value),
          band.rows.length,
          band.rows.slice(0, 60).map((e) => ({
            id: e.id,
            label: e.projectId,
            sub: `withheld ${formatDate(e.withheldOn)} · eligible ${formatDate(e.eligibleFrom)}`,
            value: abbreviateINR(e.amount),
            href: "/projects/retention",
          })),
          "/projects/retention",
          "Open the retention register",
        ),
      };
    }),
  });

  return charts;
}

function sCurve(c: SurfaceContext, p: T.Project): ChartSpec {
  const { ds, now } = c;
  const milestones = ds.milestones
    .filter((m) => m.projectId === p.id)
    .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());

  const bills = ds.raBills
    .filter((b) => b.projectId === p.id)
    .sort((a, b) => a.sequence - b.sequence);
  const contracted = ds.boqLines
    .filter((l) => l.projectId === p.id)
    .reduce((s, l) => s + (l.contractedQty + l.variationQty) * l.rate, 0);

  let plannedCum = 0;
  let actualCum = 0;
  const data: Datum[] = milestones.map((m) => {
    plannedCum += m.weightage;
    if (m.actualDate && new Date(m.actualDate) <= now) actualCum += m.weightage;
    const billed = bills
      .filter((b) => new Date(b.periodTo) <= new Date(m.plannedDate))
      .reduce((s, b) => s + (b.certifiedValue ?? 0), 0);
    return {
      key: m.id,
      label: `${m.name} · ${formatDate(m.plannedDate)}`,
      values: {
        planned: Number(plannedCum.toFixed(1)),
        actual: Number(actualCum.toFixed(1)),
        financial: contracted ? Number(((billed / contracted) * 100).toFixed(1)) : 0,
      },
    };
  });

  return {
    id: `prj-scurve-${p.id}`,
    kind: "line",
    title: `S-curve — ${p.name}`,
    caption: `Cumulative milestone weightage planned against achieved, with certified value as a share of the contracted BOQ drawn alongside. Schedule variance today is ${formatPercent(
      D.scheduleVariancePct(ds, p, now),
    )} against a tolerance of ${formatPercent(p.varianceTolerancePct)}.`,
    series: [
      { key: "planned", label: "Planned cumulative", tone: 8, unit: "PERCENT" },
      { key: "actual", label: "Achieved cumulative", tone: 1, unit: "PERCENT" },
      { key: "financial", label: "Certified value against contract", tone: 6, unit: "PERCENT" },
    ],
    xLabel: "Milestone",
    yLabel: "Percent complete",
    height: 280,
    data,
    insufficient:
      milestones.length === 0
        ? `${p.name} has no milestone schedule recorded, so a planned curve cannot be drawn. Add milestones with weightages to produce the S-curve.`
        : null,
  };
}
