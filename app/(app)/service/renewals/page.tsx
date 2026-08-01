import { getDataset } from "@/lib/seed";
import { canWrite, scopeFor } from "@/lib/rbac/matrix";
import { requireSession } from "@/components/domain/admin/serverSession";
import { RenewalRadar } from "@/components/domain/assets/RenewalRadar";
import { attachRateOf } from "@/components/domain/assets/metrics";
import {
  amcRatePerKw,
  buildAmcRows,
  buildAssetRows,
  buildBranchOptions,
  buildIndexes,
  buildUncoveredRows,
  buildWarrantyOpportunities,
} from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const HORIZON_DAYS = 90;
const LAPSED_TRAILING_DAYS = 365;

/**
 * E5-S7 — the renewal radar.
 *
 * Every AMC and warranty inside the 90-day horizon, the full out-of-coverage
 * population with the K-10 attach rate, and the contracts that already lapsed.
 * A BRANCH_MANAGER session sees only that branch, per the story's last AC.
 */
export default async function RenewalsPage() {
  const session = await requireSession();
  const ds = getDataset();
  const now = new Date(ds.meta.today);
  const idx = buildIndexes(ds, now);
  const perKw = amcRatePerKw(ds, now);

  const branchScoped = scopeFor(session.role, "renewals") === "BRANCH";
  const inBranch = (branchId: string) => !branchScoped || branchId === session.branchId;

  const allAmc = buildAmcRows(ds, now, idx);

  /** Live cover reaching its end date inside the radar horizon. */
  const contracts = allAmc
    .filter(
      (r) =>
        !r.terminated &&
        (r.status === "ACTIVE" || r.status === "EXPIRING") &&
        r.daysRemaining >= 0 &&
        r.daysRemaining <= HORIZON_DAYS &&
        inBranch(r.branchId),
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  /** Expired without a renewal, retained for the trailing twelve months. */
  const lapsed = allAmc.filter(
    (r) =>
      r.status === "EXPIRED" &&
      !r.renewedIntoId &&
      !r.terminated &&
      now.getTime() - new Date(r.endDate).getTime() <= LAPSED_TRAILING_DAYS * DAY &&
      inBranch(r.branchId),
  );

  const warrantyOps = buildWarrantyOpportunities(ds, now, idx, perKw).filter((r) =>
    inBranch(r.branchId),
  );
  const uncovered = buildUncoveredRows(ds, now, idx, perKw).filter((r) => inBranch(r.branchId));

  /**
   * K-10 over the visible population. `attachRateOf` is the sanctioned mirror of
   * `D.amcAttachRate` and applies the identical C-11 denominator; with no branch
   * scope it returns exactly what the platform KPI returns — 104 / 248 = 41.9%.
   */
  const assetRows = buildAssetRows(ds, now, idx).filter((r) => inBranch(r.branchId));
  const attach = attachRateOf(assetRows);

  return (
    <RenewalRadar
      contracts={contracts}
      lapsed={lapsed}
      warrantyOps={warrantyOps}
      uncovered={uncovered}
      attach={attach}
      branches={buildBranchOptions(ds)}
      canWrite={canWrite(session.role, "renewals")}
      branchScoped={branchScoped}
    />
  );
}
