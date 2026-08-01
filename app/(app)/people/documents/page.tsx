import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canWrite, isReadOnlyRole } from "@/lib/rbac/matrix";
import { DocumentDashboard } from "@/components/domain/people/DocumentDashboard";

export const dynamic = "force-dynamic";

export default async function StatutoryDocumentsPage() {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const ds = getDataset();
  const scoped =
    session.role === "FIELD_ENGINEER"
      ? ds.employees.filter((e) => e.id === ds.users.find((u) => u.id === session.userId)?.employeeId)
      : ds.employees;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="t-display-md text-text-hi">Statutory document dashboard</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
          Completeness per employee, so a gap is visible at a glance rather than discovered during an
          inspection. The appointment letter is the required document; expiry-bearing certificates
          raise notices to the owner and to HR.
        </p>
      </div>

      <DocumentDashboard
        actor={{
          userId: session.userId,
          name: session.name,
          role: session.role,
          branchId: session.branchId,
          employeeId: ds.users.find((u) => u.id === session.userId)?.employeeId ?? null,
        }}
        employees={scoped}
        branches={ds.branches}
        documents={ds.employeeDocuments}
        canNotify={canWrite(session.role, "hrDocuments") && !isReadOnlyRole(session.role)}
        nowIso={ds.meta.today}
      />
    </div>
  );
}
