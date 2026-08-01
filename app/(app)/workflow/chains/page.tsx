import { requireSession } from "@/components/domain/admin/serverSession";
import { buildWorkflowSnapshot } from "@/components/domain/workflow/snapshot";
import { ChainsClient } from "@/components/domain/workflow/ChainsClient";

export const dynamic = "force-dynamic";

/** E11-S3 — visual approval chain designer with threshold-band validation. */
export default async function ChainsPage() {
  const session = await requireSession();
  return <ChainsClient snapshot={buildWorkflowSnapshot(session)} />;
}
