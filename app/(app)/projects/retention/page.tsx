import { getDataset } from "@/lib/seed";
import { canWrite, scopeFor } from "@/lib/rbac/matrix";
import { requireSession } from "@/components/domain/admin/serverSession";
import {
  RetentionRegister, type RetentionRow,
} from "@/components/domain/projects/RetentionRegister";
import { addMonths } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * E6-S6 — the retention register. Its outstanding total is the retention leg of
 * the Command Centre locked-cash panel, and must reconcile to the sum of the
 * individual entries (₹34.6 L in the seeded dataset).
 */
export default async function RetentionRegisterPage() {
  const session = await requireSession();
  const ds = getDataset();
  const scope = scopeFor(session.role, "retention");

  const projectById = new Map(ds.projects.map((p) => [p.id, p]));
  const billById = new Map(ds.raBills.map((b) => [b.id, b]));
  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const userById = new Map(ds.users.map((u) => [u.id, u]));

  const visible = ds.retentionEntries.filter((e) => {
    if (scope !== "ASSIGNED") return true;
    return projectById.get(e.projectId)?.managerUserId === session.userId;
  });

  const rows: RetentionRow[] = visible.flatMap((e) => {
    const p = projectById.get(e.projectId);
    const b = billById.get(e.raBillId);
    if (!p || !b) return [];
    return [{
      id: e.id,
      projectId: p.id,
      projectCode: p.code,
      projectName: p.name,
      clientName: customerById.get(p.customerId)?.tradeName ?? "—",
      managerName: userById.get(p.managerUserId)?.name ?? "—",
      projectStatus: p.status,
      raBillId: b.id,
      raBillNumber: b.number,
      raBillSequence: b.sequence,
      amount: e.amount,
      withheldOn: e.withheldOn,
      eligibleFrom: e.eligibleFrom,
      claimRaisedAt: e.claimRaisedAt,
      releasedAt: e.releasedAt,
      releasedAmount: e.releasedAmount,
      releaseRef: e.releaseRef,
      dlpExpiry: (p.actualCompletion
        ? addMonths(new Date(p.actualCompletion), p.defectLiabilityMonths)
        : addMonths(new Date(p.contractualCompletion), p.defectLiabilityMonths)
      ).toISOString(),
      retentionPct: p.retentionPct,
      source: "SEED",
    }];
  });

  const scopeNote =
    scope === "ASSIGNED"
      ? "Showing retention on the projects you manage."
      : "Showing retention across every project.";

  return (
    <RetentionRegister
      rows={rows}
      today={ds.meta.today}
      actor={{ id: session.userId, name: session.name }}
      canWrite={canWrite(session.role, "retention")}
      scopeNote={scopeNote}
    />
  );
}
