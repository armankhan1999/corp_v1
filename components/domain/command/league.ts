import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import type { Branch } from "@/lib/schemas/entities";
import { abbreviateINR, formatPercent } from "@/lib/format";
import { fyElapsedFraction, type ResolvedPeriod } from "./period";

/**
 * E2-S5 — the branch league table.
 *
 * The AC requires the composite not to be a black box, so the whole method is
 * data rather than prose: WEIGHTS, NORMALISATION and the exclusion rules below
 * are rendered on screen verbatim from these constants.
 *
 * Branch-scoped figures reuse the `@/lib/derive` implementations against a
 * filtered view of the dataset rather than reimplementing them, so a branch row
 * and the all-branch total can never drift apart (AR-1, AR-2).
 */

export type MetricKey = "revenue" | "sla" | "receivables" | "amc";

export const WEIGHTS: Record<MetricKey, number> = {
  revenue: 40,
  sla: 25,
  receivables: 20,
  amc: 15,
};

export const METRIC_LABEL: Record<MetricKey, string> = {
  revenue: "Revenue vs target",
  sla: "SLA compliance",
  receivables: "Receivables health",
  amc: "AMC renewal rate",
};

export const NORMALISATION: { title: string; body: string }[] = [
  {
    title: "1 · Every column is a ratio, never a rupee total",
    body:
      "Branch size is neutralised by construction. Revenue is measured against that branch's own approved target, so Patna must clear ₹4.2 Cr while Gaya clears ₹1.2 Cr for the same score. The other three columns are already proportions of their own base.",
  },
  {
    title: "2 · The target is pro-rated to the elapsed period",
    body:
      "The annual target is multiplied by the share of the financial year the selected period covers, so a four-month window is not judged against a twelve-month bar.",
  },
  {
    title: "3 · Each ratio becomes a 0–100 score, capped at 120%",
    body:
      "Achievement is capped at 120% and divided by 1.2. Over-delivery is recognised up to a point and then stops buying rank, so one exceptional order cannot mask a weak quarter.",
  },
  {
    title: "4 · A column with nothing to say is dropped, and said so",
    body:
      "A column with no denominator for a branch, or with the same value at every branch, separates nothing. It is excluded from that composite and the remaining weights are re-based to 100, with the exclusion named in the table.",
  },
  {
    title: "5 · Composite and rank",
    body:
      "Composite = weighted mean of the included scores at Revenue 40 · SLA 25 · Receivables 20 · AMC 15. Rank is descending composite; ties break on revenue achievement.",
  },
];

export interface MetricCell {
  key: MetricKey;
  /** The measured ratio as a percentage. Null when there is no denominator. */
  raw: number | null;
  /** 0–100 normalised score. Null when raw is null. */
  score: number | null;
  display: string;
  sub: string;
  href: string;
  excluded: boolean;
  excludeReason: string | null;
}

export interface LeagueRow {
  branch: Branch;
  revenue: number;
  annualTarget: number;
  proratedTarget: number;
  cells: Record<MetricKey, MetricCell>;
  composite: number;
  /** Weights actually used after re-basing, as a readable string. */
  weightNote: string;
  rank: number;
}

export interface League {
  rows: LeagueRow[];
  /** Columns dropped from every composite, with the reason, for on-screen disclosure. */
  globalExclusions: { key: MetricKey; reason: string }[];
  elapsedFraction: number;
  fyLabel: string;
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
const capScore = (achievementPct: number) => clamp100(Math.min(achievementPct, 120) / 1.2);

export function buildLeague(ds: Dataset, p: ResolvedPeriod, query: string): League {
  const fyStartYear = p.asOf.getMonth() >= 3 ? p.asOf.getFullYear() : p.asOf.getFullYear() - 1;
  const fyStart = new Date(fyStartYear, 3, 1);
  const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
  const elapsedFraction = fyElapsedFraction(p.period, fyStart, fyEnd);
  const ctx = D.ctxOf(ds, p.asOf.toISOString());

  const partial: Omit<LeagueRow, "composite" | "rank" | "weightNote">[] = ds.branches.map((branch) => {
    const scoped: Dataset = {
      ...ds,
      tickets: ds.tickets.filter((t) => t.branchId === branch.id),
      amcContracts: ds.amcContracts.filter((a) => a.branchId === branch.id),
    };

    const revenue = D.revenueInPeriod(ds, p.period, { branchId: branch.id });
    const annualTarget = ds.targets
      .filter((t) => t.branchId === branch.id)
      .reduce((s, t) => s + t.amount, 0);
    const proratedTarget = Math.round(annualTarget * elapsedFraction);
    const achievement = proratedTarget > 0 ? (revenue / proratedTarget) * 100 : null;

    const slaPct = D.slaCompliancePct(scoped, p.period);
    const closedCount = scoped.tickets.filter(
      (t) => t.closedAt && new Date(t.closedAt) >= p.period.from && new Date(t.closedAt) <= p.period.to,
    ).length;

    const rec = D.receivables(ctx, { branchId: branch.id });
    const withinTerms = rec.buckets.B0_30.value + rec.buckets.B31_60.value;
    const health = rec.total > 0 ? (withinTerms / rec.total) * 100 : null;

    const amcDue = scoped.amcContracts.filter(
      (a) => new Date(a.endDate) >= p.period.from && new Date(a.endDate) <= p.period.to,
    );
    const amcPct = amcDue.length ? D.amcRenewalRate(scoped, p.period) : null;

    const cells: Record<MetricKey, MetricCell> = {
      revenue: {
        key: "revenue",
        raw: achievement,
        score: achievement === null ? null : capScore(achievement),
        display: achievement === null ? "No target set" : formatPercent(achievement, 0),
        sub: `${abbreviateINR(revenue)} of ${abbreviateINR(proratedTarget)} pro-rated`,
        href: `/analytics/cash${query ? query + "&" : "?"}branch=${branch.id}`,
        excluded: false,
        excludeReason: null,
      },
      sla: {
        key: "sla",
        raw: closedCount ? slaPct : null,
        score: closedCount ? clamp100(slaPct) : null,
        display: closedCount ? formatPercent(slaPct, 1) : "No tickets closed",
        sub: closedCount
          ? `${closedCount} tickets closed in period`
          : "No denominator in this period",
        href: `/service/tickets?branch=${branch.id}&closed=in-period`,
        excluded: false,
        excludeReason: null,
      },
      receivables: {
        key: "receivables",
        raw: health,
        score: health === null ? null : clamp100(health),
        display: health === null ? "Nothing outstanding" : formatPercent(health, 1),
        sub: health === null
          ? "No open invoices"
          : `${abbreviateINR(withinTerms)} within 60 days of ${abbreviateINR(rec.total)}`,
        href: `/commercial/receivables?branch=${branch.id}`,
        excluded: false,
        excludeReason: null,
      },
      amc: {
        key: "amc",
        raw: amcPct,
        score: amcPct === null ? null : clamp100(amcPct),
        display: amcPct === null ? "None fell due" : formatPercent(amcPct, 0),
        sub: amcPct === null
          ? "No contract ended in this period"
          : `${amcDue.filter((a) => a.renewedIntoId).length} renewed of ${amcDue.length} due`,
        href: `/service/renewals?branch=${branch.id}`,
        excluded: false,
        excludeReason: null,
      },
    };

    return { branch, revenue, annualTarget, proratedTarget, cells };
  });

  /* Rule 4 — drop columns that separate nothing, and name the exclusion. */
  const globalExclusions: { key: MetricKey; reason: string }[] = [];
  (Object.keys(WEIGHTS) as MetricKey[]).forEach((key) => {
    const values = partial.map((r) => r.cells[key].score).filter((v): v is number => v !== null);
    if (values.length === 0) {
      globalExclusions.push({ key, reason: "No branch has a denominator for this column in the selected period." });
    } else if (values.length > 1 && values.every((v) => Math.abs(v - values[0]!) < 0.01)) {
      globalExclusions.push({
        key,
        reason: `Every branch records ${formatPercent(values[0]!, 0)} here, so the column cannot separate them. It re-enters the composite as soon as the branches diverge.`,
      });
    }
  });
  const excludedKeys = new Set(globalExclusions.map((e) => e.key));

  const rows: LeagueRow[] = partial.map((r) => {
    const used: MetricKey[] = [];
    let weighted = 0;
    let weightSum = 0;
    (Object.keys(WEIGHTS) as MetricKey[]).forEach((key) => {
      const cell = r.cells[key];
      if (excludedKeys.has(key)) {
        cell.excluded = true;
        cell.excludeReason = globalExclusions.find((e) => e.key === key)?.reason ?? null;
        return;
      }
      if (cell.score === null) {
        cell.excluded = true;
        cell.excludeReason = "No denominator at this branch — weight re-based across the remaining columns.";
        return;
      }
      used.push(key);
      weighted += cell.score * WEIGHTS[key];
      weightSum += WEIGHTS[key];
    });
    const composite = weightSum ? Math.round((weighted / weightSum) * 10) / 10 : 0;
    return {
      ...r,
      composite,
      weightNote: used.length
        ? `${used.map((k) => `${METRIC_LABEL[k]} ${Math.round((WEIGHTS[k] / weightSum) * 100)}`).join(" · ")} (re-based to 100)`
        : "No column carried a denominator; composite not computed",
      rank: 0,
    };
  });

  rows
    .slice()
    .sort((a, b) => b.composite - a.composite || (b.cells.revenue.raw ?? 0) - (a.cells.revenue.raw ?? 0))
    .forEach((r, i) => {
      r.rank = i + 1;
    });

  return {
    rows,
    globalExclusions,
    elapsedFraction,
    fyLabel: `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`,
  };
}

export type SortKey = MetricKey | "composite" | "branch";

export function sortLeague(rows: LeagueRow[], key: SortKey, dir: "asc" | "desc"): LeagueRow[] {
  const value = (r: LeagueRow): number | string => {
    if (key === "branch") return r.branch.name;
    if (key === "composite") return r.composite;
    return r.cells[key].score ?? -1;
  };
  const out = rows.slice().sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv));
    }
    return av - bv;
  });
  return dir === "desc" ? out.reverse() : out;
}

/**
 * BRD R-07 — the table is introduced as coaching, not judgement. The lines
 * below are comparative and derived, never adjectival about people.
 */
export function coachingNotes(league: League): string[] {
  const notes: string[] = [];
  const byRank = league.rows.slice().sort((a, b) => a.rank - b.rank);
  const top = byRank[0];
  const bottom = byRank[byRank.length - 1];
  if (!top || !bottom) return notes;

  notes.push(
    `${top.branch.city} leads the composite at ${top.composite.toFixed(1)}. The method is published above — the figure is arithmetic, not judgement.`,
  );

  (Object.keys(WEIGHTS) as MetricKey[]).forEach((key) => {
    const scored = league.rows.filter((r) => r.cells[key].score !== null && !r.cells[key].excluded);
    if (scored.length < 2) return;
    const best = scored.reduce((a, b) => (a.cells[key].score! >= b.cells[key].score! ? a : b));
    const worst = scored.reduce((a, b) => (a.cells[key].score! <= b.cells[key].score! ? a : b));
    const gap = best.cells[key].score! - worst.cells[key].score!;
    if (gap < 5) return;
    notes.push(
      `${METRIC_LABEL[key]}: ${best.branch.city} is at ${best.cells[key].display}, ${worst.branch.city} at ${worst.cells[key].display}. The practice that produces the difference is worth moving between the two branches.`,
    );
  });

  if (bottom.rank !== top.rank) {
    notes.push(
      `${bottom.branch.city} sits last on the composite. Its single largest recoverable gap is ${weakestColumn(bottom)} — that is one conversation, not a performance review.`,
    );
  }
  return notes;
}

function weakestColumn(row: LeagueRow): string {
  let worst: MetricKey | undefined;
  let worstScore = Infinity;
  for (const key of Object.keys(WEIGHTS) as MetricKey[]) {
    const cell = row.cells[key];
    if (cell.excluded || cell.score === null) continue;
    if (cell.score < worstScore) {
      worstScore = cell.score;
      worst = key;
    }
  }
  if (!worst) return "not identifiable from the current columns";
  return `${METRIC_LABEL[worst].toLowerCase()} at ${row.cells[worst].display}`;
}
