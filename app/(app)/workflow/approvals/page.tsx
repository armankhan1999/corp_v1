import { requireSession } from "@/components/domain/admin/serverSession";
import { buildWorkflowSnapshot } from "@/components/domain/workflow/snapshot";
import { ApprovalsClient, ApprovalsDenied } from "@/components/domain/workflow/ApprovalsClient";
import { LANDING_ROUTE } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";

export const dynamic = "force-dynamic";

/**
 * E11-S2 — My Approvals with inline decision context. RBAC-4: data access and
 * approval authority are separate, so a role that can read the queue but not
 * decide gets the authority note rather than hidden controls.
 */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const snapshot = buildWorkflowSnapshot(session);
  const requestId = Array.isArray(sp.request) ? sp.request[0] : sp.request;

  if (!snapshot.viewer.hasApprovalAuthority && snapshot.viewer.readOnly) {
    return (
      <ApprovalsDenied
        role={ROLE_LABEL[session.role]}
        landing={LANDING_ROUTE[session.role]}
      />
    );
  }

  return <ApprovalsClient snapshot={snapshot} initialRequestId={requestId ?? null} />;
}
