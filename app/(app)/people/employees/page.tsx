import { cookies } from "next/headers";
import { Explainer } from "@/components/patterns/primitives";
import { redirect } from "next/navigation";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { can, canCreate, isReadOnlyRole, rolesHolding } from "@/lib/rbac/matrix";
import { DEPARTMENTS } from "@/lib/seed/catalog";
import { EmployeeRegister } from "@/components/domain/people/EmployeeRegister";

export const dynamic = "force-dynamic";

export default async function EmployeeRegisterPage() {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const ds = getDataset();
  const personalVisible = can(session.role, "hrDocuments");
  const scoped =
    session.role === "BRANCH_MANAGER"
      ? ds.employees.filter((e) => e.branchId === session.branchId)
      : session.role === "FIELD_ENGINEER"
        ? ds.employees.filter(
            (e) => e.id === ds.users.find((u) => u.id === session.userId)?.employeeId,
          )
        : ds.employees;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="t-display-md text-text-hi">Employee register</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">Organisational, contact and statutory records, with evidence attached.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          {ds.employees.length} records across {ds.branches.length} branches. Each record carries the
          organisational fields, the contact and emergency details, the masked statutory identifiers
          and the document file that evidences compliance without opening a cabinet.
        </Explainer>
      </div>

      <EmployeeRegister
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
        departments={[...DEPARTMENTS]}
        personalVisible={personalVisible}
        canCreate={canCreate(session.role, "employees") && !isReadOnlyRole(session.role)}
        hrHolders={rolesHolding("hrDocuments")}
        nowIso={ds.meta.today}
      />
    </div>
  );
}
