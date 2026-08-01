import { getDataset } from "@/lib/seed";
import { canWrite } from "@/lib/rbac/matrix";
import { requireSession } from "@/components/domain/admin/serverSession";
import {
  buildBranchOptions,
  buildIndexes,
  buildRentalAgreements,
  buildRentalAssets,
} from "@/components/domain/assets/server";
import { RentalRegister } from "./RentalRegister";

export const dynamic = "force-dynamic";

/**
 * E5-S8 — the rental fleet register. Eleven machines, the agreements against
 * them, overdue returns flagged, and utilisation across the trailing year.
 */
export default async function RentalPage() {
  const session = await requireSession();
  const ds = getDataset();
  const now = new Date(ds.meta.today);
  const idx = buildIndexes(ds, now);

  return (
    <RentalRegister
      assets={buildRentalAssets(ds, idx)}
      agreements={buildRentalAgreements(ds, idx)}
      branches={buildBranchOptions(ds)}
      todayIso={ds.meta.today}
      canWrite={canWrite(session.role, "rental")}
    />
  );
}
