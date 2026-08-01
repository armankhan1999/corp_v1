import Link from "next/link";
import { Explainer } from "@/components/patterns/primitives";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarRange, ShieldAlert } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canApprove, canCreate, isReadOnlyRole, scopeFor } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { formatCount } from "@/lib/format";
import { LeaveWorkspace } from "@/components/domain/people/LeaveWorkspace";
import { coverageImpact, dayKey, monthKey } from "@/components/domain/people/derive";
import { MIN_FIELD_ENGINEERS } from "@/components/domain/people/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leave — Pravaah",
};

/**
 * E9-S4 — leave requests, approval and the coverage warning.
 *
 * The screen is the existing workspace; this route's job is to hand it a
 * correctly scoped world and to state the two rules that make the story land:
 * a leave request routes to the reporting manager through the approval engine,
 * and a request that would drop a branch's available field engineers below the
 * configured minimum warns *both* requester and approver, with approval gated
 * on acknowledging the shortfall.
 */
export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const ds = getDataset();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const todayKey = dayKey(ds.meta.today);
  const rawMonth = one(sp.month);
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : monthKey(ds.meta.today);

  const user = ds.users.find((u) => u.id === session.userId) ?? null;
  const readOnly = isReadOnlyRole(session.role);

  /* Counts stated in the lede so the screen's claims are checkable on sight. */
  const pending = ds.leaveRequests.filter((l) => l.status === "PENDING");
  const withShortfall = pending.filter((l) =>
    coverageImpact(ds.employees, ds.branches, ds.leaveRequests, l),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="t-display-md text-text-hi">Leave</h1>
          <p className="t-body-sm mt-1 text-text-mid">Balances, requests and cover — against each branch&rsquo;s engineer floor.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Balances accrue by type, requests capture their own cover arrangement and route to the reporting
            manager, and the team calendar keeps pending visually apart from approved.{" "}
            <span className="text-text-hi">{formatCount(pending.length)}</span>{" "}
            {pending.length === 1 ? "request is" : "requests are"} awaiting a decision
            {withShortfall.length > 0 ? (
              <>
                , of which <span className="text-danger">{formatCount(withShortfall.length)}</span> would take a
                branch below its configured field-engineer minimum
              </>
            ) : null}
            .
        </Explainer>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/people/attendance"
            className="t-body-sm inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <CalendarRange className="size-3.5" aria-hidden />
            Attendance board
          </Link>
          <Link
            href="/workflow/approvals"
            className="t-body-sm inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <ShieldAlert className="size-3.5" aria-hidden />
            My approvals
          </Link>
        </div>
      </div>

      <Explainer className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] px-3 py-2 text-text-mid">
        <span className="text-text-hi">Coverage rule.</span> Minimum available field engineers per branch —{" "}
        {Object.entries(MIN_FIELD_ENGINEERS)
          .map(([branchId, minimum]) => {
            const branch = ds.branches.find((b) => b.id === branchId);
            return `${branch?.city ?? branchId} ${minimum}`;
          })
          .join(" · ")}
        . Configured in Masters against the committed AMC preventive-visit plan, and evaluated for the requester at
        submission as well as for the approver at decision. {ROLE_LABEL[session.role]}{" "}
        {readOnly
          ? "holds a read-only view: no request or decision control is rendered anywhere on this screen."
          : canApprove(session.role, "leave")
            ? "holds approval authority for leave, so an acknowledged coverage warning is required before an approval is accepted."
            : "may raise leave for themselves; the decision sits with the reporting manager."}
      </Explainer>

      <LeaveWorkspace
        actor={{
          userId: session.userId,
          name: session.name,
          role: session.role,
          branchId: session.branchId,
          employeeId: user?.employeeId ?? null,
        }}
        employees={ds.employees}
        branches={ds.branches}
        users={ds.users}
        leaveTypes={ds.leaveTypes}
        leaveRequests={ds.leaveRequests}
        holidays={ds.holidays}
        canApprove={canApprove(session.role, "leave") && !readOnly}
        canRequestForOthers={canCreate(session.role, "leave") && scopeFor(session.role, "leave") === "ALL" && !readOnly}
        nowIso={ds.meta.today}
        todayKey={todayKey}
        month={month}
      />
    </div>
  );
}
