import { getDataset } from "@/lib/seed";
import { canCreate } from "@/lib/rbac/matrix";
import { requireSession } from "@/components/domain/admin/serverSession";
import { AmcRegister } from "@/components/domain/assets/AmcRegister";
import {
  buildAmcAssetOptions, buildAmcRows, buildBranchOptions, buildCustomerOptions, buildIndexes,
} from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

/**
 * E5-S6 — AMC contracts with generated preventive-visit schedules. Contract
 * status is derived from dates (Draft / Active / Expiring within 60 days /
 * Expired / Renewed) and is never set by hand except Terminated.
 */
export default async function AmcPage() {
  const session = await requireSession();
  const ds = getDataset();
  const now = new Date(ds.meta.today);
  const idx = buildIndexes(ds, now);

  const owners = ds.users
    .filter((u) => u.role === "SERVICE_MANAGER" || u.role === "BRANCH_MANAGER")
    .map((u) => ({ id: u.id, name: u.name }));
  const defaultOwner =
    owners.find((o) => o.id === session.userId)?.id ?? owners[0]?.id ?? session.userId;

  return (
    <AmcRegister
      rows={buildAmcRows(ds, now, idx)}
      customers={buildCustomerOptions(ds)}
      assets={buildAmcAssetOptions(ds, now)}
      branches={buildBranchOptions(ds)}
      owners={owners.length ? owners : [{ id: session.userId, name: session.name }]}
      todayIso={ds.meta.today}
      canCreate={canCreate(session.role, "amc")}
      defaultOwnerId={defaultOwner}
    />
  );
}
