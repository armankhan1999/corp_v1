import Link from "next/link";
import { Explainer } from "@/components/patterns/primitives";
import { getDataset } from "@/lib/seed";
import { canCreate, canWrite, isReadOnlyRole } from "@/lib/rbac/matrix";
import { formatCount, pluralise } from "@/lib/format";
import { UsersClient, type BranchLite, type EmployeeLite } from "@/components/domain/admin/UsersClient";
import { actorOf, requireSession } from "@/components/domain/admin/serverSession";
import type { UserRow } from "@/components/domain/admin/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users & roles — Pravaah",
};

/**
 * E1 / FR-M1-02 — the user register. A server component reads the seeded world
 * once and hands plain rows to the client surface, which layers the browser
 * overlay on top. Middleware has already denied any role without
 * `admin.users`; the capability checks here decide whether the write controls
 * are rendered at all, which is the E1-S3 rule: absent, never disabled.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const ds = getDataset();

  const activity = new Map<string, number>();
  for (const entry of ds.auditLog) {
    activity.set(entry.actorUserId, (activity.get(entry.actorUserId) ?? 0) + 1);
  }

  const employees: Record<string, EmployeeLite> = {};
  for (const u of ds.users) {
    if (!u.employeeId) continue;
    const emp = ds.employees.find((e) => e.id === u.employeeId);
    if (emp) employees[u.employeeId] = { code: emp.code, name: emp.name };
  }

  const users: UserRow[] = ds.users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    branchId: u.branchId,
    email: u.email,
    phone: u.phone,
    designation: u.designation,
    active: u.active,
    employeeId: u.employeeId,
    activityCount: activity.get(u.id) ?? 0,
    isSelf: u.id === session.userId,
  }));

  const branches: BranchLite[] = ds.branches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    city: b.city,
  }));

  const focus = typeof sp.focus === "string" ? sp.focus : null;
  const editable = canWrite(session.role, "admin.users");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="t-display-md text-text-hi">Users &amp; roles</h1>
          <p className="t-body-sm mt-1 text-text-mid">One seeded account per role, across every branch.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          {formatCount(users.length)} seeded {pluralise(users.length, "account")} across{" "}
            {formatCount(branches.length)} {pluralise(branches.length, "branch", "branches")} — one
            per role, so every persona in the demonstration signs in as a real record rather than a
            switch. A role decides what an account can reach; a branch decides how much of it.
            Accounts are deactivated, never deleted, so the work already attributed to them keeps
            reading correctly.
        </Explainer>
        </div>
        <Link
          href="/admin"
          className="t-body-sm rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          Administration
        </Link>
      </div>

      <UsersClient
        users={users}
        branches={branches}
        employees={employees}
        actor={actorOf(session)}
        canEdit={editable}
        canCreate={canCreate(session.role, "admin.users")}
        readOnlyRole={isReadOnlyRole(session.role)}
        focusId={focus}
      />
    </div>
  );
}
