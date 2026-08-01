import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { can, canWrite, isReadOnlyRole, rolesHolding } from "@/lib/rbac/matrix";
import type { OEMPrincipal } from "@/lib/schemas/enums";
import { EmployeeRecord } from "@/components/domain/people/EmployeeRecord";

export const dynamic = "force-dynamic";

const PRINCIPALS: OEMPrincipal[] = ["ELGI", "ATS_ELGI", "KSB", "ION_EXCHANGE", "OTHER"];

export default async function EmployeeRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const { id } = await params;
  const ds = getDataset();
  const employee = ds.employees.find((e) => e.id === id);
  if (!employee) notFound();

  const attendance = ds.attendance
    .filter((a) => a.employeeId === employee.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const leaveRequests = ds.leaveRequests
    .filter((l) => l.employeeId === employee.id)
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  const openTickets = ds.tickets.filter(
    (t) => t.branchId === employee.branchId && D.isOpenTicket(t),
  );
  const dispatchDemand = PRINCIPALS.map((principal) => ({
    principal,
    openTickets: openTickets.filter(
      (t) => ds.assets.find((a) => a.id === t.assetId)?.principal === principal,
    ).length,
  })).filter((d) => d.openTickets > 0 || employee.oemCertifications.includes(d.principal));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/people/employees" className="t-body-sm w-fit text-text-mid hover:text-text-hi">
        ← Employee register
      </Link>
      <EmployeeRecord
        actor={{
          userId: session.userId,
          name: session.name,
          role: session.role,
          branchId: session.branchId,
          employeeId: ds.users.find((u) => u.id === session.userId)?.employeeId ?? null,
        }}
        employee={employee}
        manager={ds.employees.find((e) => e.id === employee.reportingManagerId) ?? null}
        reports={ds.employees.filter((e) => e.reportingManagerId === employee.id)}
        branch={ds.branches.find((b) => b.id === employee.branchId) ?? null}
        documents={ds.employeeDocuments.filter((d) => d.employeeId === employee.id)}
        attendance={attendance}
        leaveRequests={leaveRequests}
        leaveTypes={ds.leaveTypes}
        dispatchDemand={dispatchDemand}
        personalVisible={can(session.role, "hrDocuments")}
        canEdit={canWrite(session.role, "employees") && !isReadOnlyRole(session.role)}
        hrHolders={rolesHolding("hrDocuments")}
        nowIso={ds.meta.today}
      />
    </div>
  );
}
