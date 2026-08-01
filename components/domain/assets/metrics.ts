import type { AssetRow, RentalAgreementRow } from "./types";

/**
 * Client-side mirrors of two `lib/derive` KPIs, used only so that a browser
 * mutation (a decommissioning, a new asset, a recorded rental return) is
 * reflected immediately. With an empty overlay these return exactly what
 * `D.amcAttachRate` and `D.rentalUtilisationPct` return on the server.
 */

export interface AttachSummary {
  /** K-10. Denominator per PLAN.md C-11. */
  pct: number;
  underAmc: number;
  eligible: number;
  inWarranty: number;
  outOfCoverage: number;
  decommissioned: number;
  totalAssets: number;
}

/**
 * K-10 — AMC attach rate.
 * C-11: eligible = total assets − in warranty − decommissioned. An in-warranty
 * machine is not yet an AMC opportunity and a decommissioned one never will be,
 * so neither belongs in the denominator. 104 / 248 = 42%.
 */
export function attachRateOf(rows: AssetRow[]): AttachSummary {
  let underAmc = 0;
  let inWarranty = 0;
  let outOfCoverage = 0;
  let decommissioned = 0;
  for (const r of rows) {
    if (r.status === "DECOMMISSIONED") {
      decommissioned += 1;
      continue;
    }
    if (r.coverage === "IN_WARRANTY") inWarranty += 1;
    else if (r.coverage === "UNDER_AMC") underAmc += 1;
    else outOfCoverage += 1;
  }
  const totalAssets = rows.length;
  const eligible = totalAssets - inWarranty - decommissioned;
  return {
    pct: eligible ? Math.round((underAmc / eligible) * 10000) / 100 : 0,
    underAmc,
    eligible,
    inWarranty,
    outOfCoverage,
    decommissioned,
    totalAssets,
  };
}

export const ATTACH_FORMULA =
  "AMC attach rate = assets under AMC ÷ (total assets − assets in warranty − decommissioned assets)";

export function attachFormulaWithNumbers(a: AttachSummary): string {
  return `${a.pct.toFixed(1)}% = ${a.underAmc} under AMC ÷ (${a.totalAssets} total − ${a.inWarranty} in warranty − ${a.decommissioned} decommissioned = ${a.eligible} eligible)`;
}

export interface Fulfilment {
  pct: number;
  completed: number;
  committed: number;
  dueToDate: number;
  behindBy: number;
  behindSchedule: boolean;
}

/** E5-S6 — completed against committed, and behind-schedule against due-to-date. */
export function fulfilmentOf(args: {
  committed: number;
  completed: number;
  dueToDate: number;
}): Fulfilment {
  const { committed, completed, dueToDate } = args;
  const behindBy = Math.max(0, dueToDate - completed);
  return {
    pct: committed ? Math.round((completed / committed) * 1000) / 10 : 0,
    completed,
    committed,
    dueToDate,
    behindBy,
    behindSchedule: behindBy > 0,
  };
}

const DAY = 86_400_000;

export interface UtilisationResult {
  pct: number;
  onRentDays: number;
  availableDays: number;
}

/** K-22 — days on rent ÷ days available across the trailing window. */
export function rentalUtilisation(
  agreements: RentalAgreementRow[],
  fleetSize: number,
  now: Date,
  trailingDays = 365,
): UtilisationResult {
  const windowStart = now.getTime() - trailingDays * DAY;
  let onRentDays = 0;
  for (const ag of agreements) {
    const start = Math.max(new Date(ag.startDate).getTime(), windowStart);
    const end = Math.min(new Date(ag.actualReturn ?? now.toISOString()).getTime(), now.getTime());
    if (end > start) onRentDays += (end - start) / DAY;
  }
  const availableDays = fleetSize * trailingDays;
  return {
    pct: availableDays ? Math.round((onRentDays / availableDays) * 10000) / 100 : 0,
    onRentDays: Math.round(onRentDays),
    availableDays,
  };
}

export function assetUtilisation(
  agreements: RentalAgreementRow[],
  assetId: string,
  now: Date,
  trailingDays = 365,
): UtilisationResult {
  return rentalUtilisation(
    agreements.filter((a) => a.rentalAssetId === assetId),
    1,
    now,
    trailingDays,
  );
}
