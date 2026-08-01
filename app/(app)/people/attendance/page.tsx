import { cookies } from "next/headers";
import { Explainer } from "@/components/patterns/primitives";
import { redirect } from "next/navigation";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canWrite, isReadOnlyRole } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { AttendanceBoard } from "@/components/domain/people/AttendanceBoard";
import { dayKey } from "@/components/domain/people/derive";

export const dynamic = "force-dynamic";

export default async function AttendanceBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const ds = getDataset();
  const todayKey = dayKey(ds.meta.today);
  const sp = await searchParams;
  const raw = typeof sp.date === "string" ? sp.date : todayKey;
  const key = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayKey;

  const seedRecords = ds.attendance.filter((a) => dayKey(a.date) === key);
  const jobCards = ds.jobCards.filter((j) => j.checkInAt && dayKey(j.checkInAt) === key);
  const siteIds = new Set(
    jobCards
      .map((j) => ds.tickets.find((t) => t.id === j.ticketId)?.siteId)
      .filter((x): x is string => !!x),
  );
  const sites = ds.sites.filter((s) => siteIds.has(s.id));

  const scopeBranchId = session.role === "BRANCH_MANAGER" ? session.branchId : null;
  const scopeReason = scopeBranchId
    ? `RBAC-2 — ${ROLE_LABEL[session.role]} sees only ${
        ds.branches.find((b) => b.id === scopeBranchId)?.name ?? scopeBranchId
      }. The branch selector is locked for this role.`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Attendance board</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">Every state for the selected date, with exceptions lifted out.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Every employee&rsquo;s state for the selected date, grouped by branch and department, with
            exceptions lifted into their own section. Regularisation keeps the original record.
        </Explainer>
        </div>
      </div>

      <AttendanceBoard
        actor={{
          userId: session.userId,
          name: session.name,
          role: session.role,
          branchId: session.branchId,
          employeeId: ds.users.find((u) => u.id === session.userId)?.employeeId ?? null,
        }}
        dateKey={key}
        todayKey={todayKey}
        employees={ds.employees}
        branches={ds.branches}
        seedRecords={seedRecords}
        jobCards={jobCards}
        sites={sites}
        holidays={ds.holidays}
        leaveRequests={ds.leaveRequests}
        canRegularise={canWrite(session.role, "attendance") && !isReadOnlyRole(session.role)}
        scopeBranchId={scopeBranchId}
        scopeReason={scopeReason}
      />
    </div>
  );
}
