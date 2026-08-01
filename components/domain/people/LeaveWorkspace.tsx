"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarRange,
  Check,
  Clock3,
  Route,
  ShieldAlert,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import type { Branch, Employee, Holiday, LeaveRequest, LeaveType, User } from "@/lib/schemas/entities";
import { formatCount, formatDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { EmptyState, Mono, Overline, Panel, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { COVERAGE_RULE_LABEL, DEFAULT_BRANCH_HOLIDAYS, MIN_FIELD_ENGINEERS } from "./config";
import {
  addDaysKey,
  allEmployees,
  allHolidays,
  allLeaveRequests,
  coverageImpact,
  dayKey,
  dayKeyToDate,
  daysInMonthKeys,
  fieldEngineersOf,
  leaveBalances,
  leaveDaysBetween,
  monthsElapsedInFy,
  type CoverageImpact,
} from "./derive";
import { usePeopleStore, type Actor } from "./store";
import {
  AuditTrail,
  Button,
  CheckLine,
  Field,
  MetricChip,
  Modal,
  RuleNote,
  Select,
  Tabs,
  Td,
  TextArea,
  TextInput,
  Th,
} from "./ui";

export interface LeaveWorkspaceProps {
  actor: Actor;
  employees: Employee[];
  branches: Branch[];
  users: User[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  canApprove: boolean;
  canRequestForOthers: boolean;
  nowIso: string;
  todayKey: string;
  month: string;
}

export function LeaveWorkspace(props: LeaveWorkspaceProps) {
  const { overlay, actions } = usePeopleStore(props.actor);
  const now = React.useMemo(() => new Date(props.nowIso), [props.nowIso]);

  const employees = React.useMemo(() => allEmployees(props.employees, overlay), [props.employees, overlay]);
  const requests = React.useMemo(
    () => allLeaveRequests(props.leaveRequests, overlay),
    [props.leaveRequests, overlay],
  );
  const holidays = React.useMemo(
    () => allHolidays(props.holidays, DEFAULT_BRANCH_HOLIDAYS, overlay),
    [props.holidays, overlay],
  );

  const selfEmployee =
    employees.find((e) => e.id === props.actor.employeeId) ?? employees[0]!;

  const [tab, setTab] = React.useState(props.canApprove ? "approvals" : "mine");
  const [subject, setSubject] = React.useState(selfEmployee.id);
  const subjectEmployee = employees.find((e) => e.id === subject) ?? selfEmployee;

  const balances = React.useMemo(
    () => leaveBalances(props.leaveTypes, requests, subjectEmployee.id, now),
    [props.leaveTypes, requests, subjectEmployee.id, now],
  );

  const pending = requests
    .filter((l) => l.status === "PENDING")
    .filter((l) => {
      if (props.actor.role === "BRANCH_MANAGER") {
        const emp = employees.find((e) => e.id === l.employeeId);
        return emp?.branchId === props.actor.branchId;
      }
      return true;
    })
    .sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));

  const pendingWithCoverage = pending
    .map((l) => ({ request: l, impact: coverageImpact(employees, props.branches, requests, l) }))
    .filter((x) => x.impact);

  const leaveAudit = overlay.audit.filter((a) => a.entityType === "LeaveRequest");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <MetricChip label="Pending decisions" value={formatCount(pending.length)} tone={pending.length ? "warn" : "ok"} />
        <MetricChip
          label="Coverage warnings"
          value={formatCount(pendingWithCoverage.length)}
          tone={pendingWithCoverage.length ? "danger" : "ok"}
        />
        <MetricChip
          label="Approved this FY"
          value={formatCount(
            requests.filter((l) => l.status === "APPROVED" && new Date(l.fromDate) >= new Date(now.getFullYear(), 3, 1)).length,
          )}
        />
        <MetricChip label="Leave types" value={formatCount(props.leaveTypes.length)} />
      </div>

      <Panel>
        <Tabs
          tabs={[
            { id: "approvals", label: "Approvals", count: pending.length },
            { id: "mine", label: "Balance & request" },
            { id: "calendar", label: "Team calendar" },
            { id: "types", label: "Leave types", count: props.leaveTypes.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "approvals" ? (
          <ApprovalsTab
            pending={pending}
            employees={employees}
            branches={props.branches}
            users={props.users}
            leaveTypes={props.leaveTypes}
            requests={requests}
            canApprove={props.canApprove}
            actorRole={props.actor.role}
            onDecide={(request, status, note, ack) =>
              actions.decideLeave(request, {
                status,
                byUserId: props.actor.userId,
                byName: props.actor.name,
                byRole: props.actor.role,
                at: new Date().toISOString(),
                note,
                coverageAcknowledged: ack,
              })
            }
            decisions={overlay.leaveDecisions}
          />
        ) : null}

        {tab === "mine" ? (
          <MineTab
            employees={employees}
            branches={props.branches}
            users={props.users}
            leaveTypes={props.leaveTypes}
            requests={requests}
            holidays={holidays}
            balances={balances}
            subject={subjectEmployee}
            onSubjectChange={setSubject}
            canPickOther={props.canRequestForOthers}
            monthsElapsed={monthsElapsedInFy(now)}
            todayKey={props.todayKey}
            onSubmit={(request, warning, routedTo) => actions.submitLeave(request, warning, routedTo)}
          />
        ) : null}

        {tab === "calendar" ? (
          <CalendarTab
            month={props.month}
            employees={employees}
            branches={props.branches}
            requests={requests}
            leaveTypes={props.leaveTypes}
          />
        ) : null}

        {tab === "types" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Leave type</Th>
                  <Th numeric>Annual entitlement</Th>
                  <Th numeric>Accrual per month</Th>
                  <Th>Accrual basis</Th>
                </tr>
              </thead>
              <tbody>
                {props.leaveTypes.map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <Mono>{t.code}</Mono>
                    </Td>
                    <Td className="text-text-hi">{t.name}</Td>
                    <Td numeric>{t.annualEntitlement || "—"}</Td>
                    <Td numeric>{t.accrualPerMonth || "—"}</Td>
                    <Td>
                      {t.accrualPerMonth
                        ? "Accrues monthly from 1 April, capped at the annual entitlement"
                        : "No entitlement — recorded as unpaid absence"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <AuditTrail
        entries={leaveAudit}
        title="Leave audit trail"
        empty="No leave has been requested or decided in this session."
      />
    </div>
  );
}

/* -------------------------------------------------------------- approvals */

function ApprovalsTab({
  pending,
  employees,
  branches,
  users,
  leaveTypes,
  requests,
  canApprove,
  actorRole,
  onDecide,
  decisions,
}: {
  pending: LeaveRequest[];
  employees: Employee[];
  branches: Branch[];
  users: User[];
  leaveTypes: LeaveType[];
  requests: LeaveRequest[];
  canApprove: boolean;
  actorRole: Actor["role"];
  onDecide: (r: LeaveRequest, status: "APPROVED" | "REJECTED", note: string, ack: boolean) => void;
  decisions: Record<string, unknown>;
}) {
  const [open, setOpen] = React.useState<LeaveRequest | null>(null);
  const [ack, setAck] = React.useState(false);
  const [note, setNote] = React.useState("");

  const impact = open ? coverageImpact(employees, branches, requests, open) : null;

  function decide(status: "APPROVED" | "REJECTED") {
    if (!open) return;
    if (status === "APPROVED" && impact && !ack) return;
    onDecide(open, status, note.trim() || (status === "APPROVED" ? "Approved." : "Rejected."), ack);
    setOpen(null);
    setAck(false);
    setNote("");
  }

  if (pending.length === 0) {
    return (
      <EmptyState
        icon={UserRoundCheck}
        title="No leave awaiting a decision"
        body="Requests route to the reporting manager through the approval engine. When one arrives it appears here with its coverage position already worked out."
        action={
          <Link
            href="/workflow/approvals"
            className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            My approvals
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-[var(--line)]">
        {pending.map((l) => {
          const emp = employees.find((e) => e.id === l.employeeId);
          if (!emp) return null;
          const type = leaveTypes.find((t) => t.id === l.leaveTypeId);
          const cover = coverageImpact(employees, branches, requests, l);
          const manager = employees.find((e) => e.id === emp.reportingManagerId);
          const managerUser = users.find((u) => u.employeeId === manager?.id);
          return (
            <li key={l.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Mono className="text-text-lo">{l.number}</Mono>
                <Link
                  href={`/people/employees/${emp.id}`}
                  className="t-body font-medium text-text-hi hover:underline"
                >
                  {emp.name}
                </Link>
                <span className="t-body-sm text-text-lo">
                  {emp.designation} · {branches.find((b) => b.id === emp.branchId)?.city}
                </span>
                <StatusBadge tone="warn">Pending</StatusBadge>
                {cover ? <StatusBadge tone="danger">Coverage shortfall</StatusBadge> : null}
                <span className="ml-auto flex items-center gap-2">
                  {canApprove ? (
                    <Button
                      tone="primary"
                      onClick={() => {
                        setOpen(l);
                        setAck(false);
                        setNote("");
                      }}
                    >
                      Decide
                    </Button>
                  ) : (
                    <span className="t-body-sm text-text-lo">
                      {ROLE_LABEL[actorRole]} holds no approval authority for leave.
                    </span>
                  )}
                </span>
              </div>
              <div className="t-body-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-text-mid">
                <span>
                  {type?.name ?? l.leaveTypeId} · {formatDate(l.fromDate)} → {formatDate(l.toDate)} ·{" "}
                  <span className="tabular-nums">{l.days}</span> {l.days === 1 ? "day" : "days"}
                </span>
                <span>Reason: {l.reason}</span>
                <span>Cover: {l.coverageArrangement}</span>
              </div>
              <div className="t-body-sm flex flex-wrap items-center gap-1.5 text-text-lo">
                <Route className="size-3.5 shrink-0" aria-hidden />
                Routed to {manager ? manager.name : "the reporting line"}
                {managerUser ? ` (${ROLE_LABEL[managerUser.role]})` : ""} through chain{" "}
                <Mono className="text-[0.6875rem]">APC-05 · Leave request</Mono>
              </div>
              {cover ? (
                <RuleNote title="Coverage shortfall" tone="danger" icon={ShieldAlert}>
                  {cover.message} {COVERAGE_RULE_LABEL} Approval requires an explicit
                  acknowledgement of this shortfall.
                </RuleNote>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title="Decide leave request"
        sub={open ? `${open.number} · ${employees.find((e) => e.id === open.employeeId)?.name}` : undefined}
        footer={
          <>
            <Button onClick={() => setOpen(null)}>Cancel</Button>
            <Button tone="danger" onClick={() => decide("REJECTED")}>
              Reject
            </Button>
            <Button tone="primary" onClick={() => decide("APPROVED")} disabled={!!impact && !ack}>
              Approve
            </Button>
          </>
        }
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <Overline>Dates</Overline>
                <p className="t-body text-text-hi">
                  {formatDate(open.fromDate)} → {formatDate(open.toDate)}
                </p>
              </div>
              <div>
                <Overline>Days</Overline>
                <p className="t-body tabular-nums text-text-hi">{open.days}</p>
              </div>
              <div>
                <Overline>Reason</Overline>
                <p className="t-body text-text-hi">{open.reason}</p>
              </div>
              <div>
                <Overline>Coverage arrangement</Overline>
                <p className="t-body text-text-hi">{open.coverageArrangement}</p>
              </div>
            </dl>

            {impact ? (
              <>
                <RuleNote title="Approving this drops the branch below its minimum" tone="danger" icon={TriangleAlert}>
                  {impact.message}
                  <span className="mt-1 block">
                    {impact.branchName} runs {impact.complement} field{" "}
                    {impact.complement === 1 ? "engineer" : "engineers"} against a configured minimum
                    of {impact.minimum}. {COVERAGE_RULE_LABEL}
                  </span>
                </RuleNote>
                <CheckLine id="cover-ack" checked={ack} onChange={setAck}>
                  I acknowledge the coverage shortfall of {impact.shortfall}{" "}
                  {impact.shortfall === 1 ? "engineer" : "engineers"} in {impact.branchName} and
                  accept it on the record.
                </CheckLine>
                {!ack ? (
                  <RuleNote title="Action blocked" tone="warn" icon={TriangleAlert}>
                    Approval is blocked while a coverage shortfall is unacknowledged.{" "}
                    <span className="text-text-hi">Tick the acknowledgement to unblock it.</span>
                  </RuleNote>
                ) : null}
              </>
            ) : (
              <RuleNote title="No coverage impact" tone="info" icon={Check}>
                This request does not reduce any branch below its configured minimum available field
                engineers.
              </RuleNote>
            )}

            <Field label="Decision note" hint="Recorded in the audit log with the decision.">
              <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>
      {Object.keys(decisions).length > 0 ? (
        <Explainer className="border-t border-line px-4 py-2 text-text-lo">
          Decisions recorded in this session update the balance and are reflected as{" "}
          <span className="text-text-mid">On leave</span> on the attendance board for those dates.
        </Explainer>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------- balance & new */

function MineTab({
  employees,
  branches,
  users,
  leaveTypes,
  requests,
  holidays,
  balances,
  subject,
  onSubjectChange,
  canPickOther,
  monthsElapsed,
  todayKey,
  onSubmit,
}: {
  employees: Employee[];
  branches: Branch[];
  users: User[];
  leaveTypes: LeaveType[];
  requests: LeaveRequest[];
  holidays: Holiday[];
  balances: ReturnType<typeof leaveBalances>;
  subject: Employee;
  onSubjectChange: (id: string) => void;
  canPickOther: boolean;
  monthsElapsed: number;
  todayKey: string;
  onSubmit: (request: LeaveRequest, warning: string | null, routedTo: string) => void;
}) {
  const [typeId, setTypeId] = React.useState(leaveTypes[0]?.id ?? "");
  const [from, setFrom] = React.useState(addDaysKey(todayKey, 7));
  const [to, setTo] = React.useState(addDaysKey(todayKey, 8));
  const [reason, setReason] = React.useState("");
  const [cover, setCover] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);

  const days = leaveDaysBetween(from, to, holidays, subject.branchId);
  const impact: CoverageImpact | null = coverageImpact(employees, branches, requests, {
    employeeId: subject.id,
    fromDate: dayKeyToDate(from).toISOString(),
    toDate: dayKeyToDate(to).toISOString(),
  });
  const manager = employees.find((e) => e.id === subject.reportingManagerId);
  const managerUser = users.find((u) => u.employeeId === manager?.id);
  const routedTo = manager
    ? `${manager.name}${managerUser ? ` (${ROLE_LABEL[managerUser.role]})` : ""}`
    : "the reporting line";

  const balance = balances.find((b) => b.type.id === typeId);
  const errors = {
    dates: to < from ? "The end date cannot be before the start date." : days === 0 ? "The selected range contains no working days." : null,
    reason: reason.trim().length < 5 ? "A reason is required." : null,
    cover: cover.trim().length < 5 ? "State who covers the work while you are away." : null,
    balance:
      balance && balance.type.annualEntitlement > 0 && days > balance.available
        ? `Only ${balance.available} ${balance.type.code} days are available; this request is for ${days}.`
        : null,
  };
  const valid = !errors.dates && !errors.reason && !errors.cover;
  const blockedByAck = !!impact && !ack;

  function submit() {
    setTouched(true);
    if (!valid || blockedByAck) return;
    const seq = requests.length + 1;
    const request: LeaveRequest = {
      id: `LVR-NEW-${Date.now().toString(36).toUpperCase()}`,
      number: `BC/LV/2627/${String(seq).padStart(4, "0")}`,
      employeeId: subject.id,
      leaveTypeId: typeId,
      fromDate: dayKeyToDate(from).toISOString(),
      toDate: dayKeyToDate(to).toISOString(),
      days,
      reason: reason.trim(),
      coverageArrangement: cover.trim(),
      status: "PENDING",
      approvalRequestId: null,
      coverageWarning: impact ? impact.message : null,
      raisedAt: new Date().toISOString(),
      decidedAt: null,
    };
    onSubmit(request, impact ? impact.message : null, routedTo);
    setDone(request.number);
    setReason("");
    setCover("");
    setAck(false);
    setTouched(false);
  }

  const branchFieldEngineers = fieldEngineersOf(employees, subject.branchId).length;

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="t-heading-md text-text-hi">Leave balance</h2>
              <p className="t-body-sm text-text-mid">
                Accrued over {monthsElapsed} {monthsElapsed === 1 ? "month" : "months"} of the
                financial year, less approved leave taken.
              </p>
            </div>
            {canPickOther ? (
              <Field label="Employee" className="w-64">
                <Select value={subject.id} onChange={(e) => onSubjectChange(e.target.value)}>
                  {employees
                    .filter((e) => e.active)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.code} — {e.name}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse">
              <thead>
                <tr>
                  <Th>Leave type</Th>
                  <Th numeric>Entitlement</Th>
                  <Th numeric>Accrued</Th>
                  <Th numeric>Taken</Th>
                  <Th numeric>Available</Th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.type.id} className={b.type.id === typeId ? "bg-surface-2" : undefined}>
                    <Td>
                      <Mono className="text-text-lo">{b.type.code}</Mono> {b.type.name}
                    </Td>
                    <Td numeric>{b.entitlement || "—"}</Td>
                    <Td numeric>{b.accrued}</Td>
                    <Td numeric>{b.taken}</Td>
                    <Td numeric className={b.available <= 0 ? "text-warn" : "text-text-hi"}>
                      {b.available}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="t-heading-md text-text-hi">Recent requests</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Type</Th>
                  <Th numeric>From</Th>
                  <Th numeric>Days</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {requests
                  .filter((l) => l.employeeId === subject.id)
                  .slice(0, 8)
                  .map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <Mono>{l.number}</Mono>
                      </Td>
                      <Td>{leaveTypes.find((t) => t.id === l.leaveTypeId)?.code}</Td>
                      <Td numeric>{formatDate(l.fromDate)}</Td>
                      <Td numeric>{l.days}</Td>
                      <Td>
                        <StatusBadge
                          tone={
                            l.status === "APPROVED"
                              ? "ok"
                              : l.status === "PENDING"
                                ? "warn"
                                : l.status === "REJECTED"
                                  ? "danger"
                                  : "neutral"
                          }
                        >
                          {l.status.toLowerCase()}
                        </StatusBadge>
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Request form ------------------------------------------------------ */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
        <div>
          <h2 className="t-heading-md text-text-hi">New leave request</h2>
          <p className="t-body-sm text-text-mid">
            Type, dates, reason and coverage arrangement are captured, then routed to{" "}
            {routedTo} through the approval engine.
          </p>
        </div>

        {done ? (
          <RuleNote title="Request submitted" tone="info" icon={Check}>
            <Mono className="text-text-hi">{done}</Mono> is pending with {routedTo}. It appears on
            the approvals tab and on the team calendar as pending.
          </RuleNote>
        ) : null}

        <Field label="Leave type" required>
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" required>
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" required error={touched ? errors.dates : null}>
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <p className="t-body-sm text-text-lo">
          <span className="tabular-nums text-text-hi">{days}</span> working{" "}
          {days === 1 ? "day" : "days"} — Sundays and{" "}
          {branches.find((b) => b.id === subject.branchId)?.city} holidays excluded.
        </p>
        {touched && errors.balance ? (
          <RuleNote title="Balance exceeded" tone="warn" icon={TriangleAlert}>
            {errors.balance} It can still be submitted; the approver decides whether to allow it as
            leave without pay.
          </RuleNote>
        ) : null}

        <Field label="Reason" required error={touched ? errors.reason : null}>
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field
          label="Coverage arrangement"
          required
          error={touched ? errors.cover : null}
          hint="Who holds the work while you are away."
        >
          <TextArea value={cover} onChange={(e) => setCover(e.target.value)} />
        </Field>

        {impact ? (
          <>
            <RuleNote title="Coverage warning" tone="danger" icon={ShieldAlert}>
              {impact.message} {branches.find((b) => b.id === subject.branchId)?.city} runs{" "}
              {branchFieldEngineers} field {branchFieldEngineers === 1 ? "engineer" : "engineers"};
              the configured minimum is {MIN_FIELD_ENGINEERS[subject.branchId] ?? 1}. The approver
              sees this same warning and must acknowledge it before approving.
            </RuleNote>
            <CheckLine id="req-ack" checked={ack} onChange={setAck}>
              I have read the coverage shortfall and still wish to submit this request.
            </CheckLine>
          </>
        ) : null}

        <Button tone="primary" size="touch" onClick={submit} disabled={!valid || blockedByAck}>
          Submit request
        </Button>
        {blockedByAck ? (
          <p className="t-body-sm text-warn">
            Submission is blocked while the coverage warning is unread. Tick the acknowledgement to
            unblock it.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- team calendar */

function CalendarTab({
  month,
  employees,
  branches,
  requests,
  leaveTypes,
}: {
  month: string;
  employees: Employee[];
  branches: Branch[];
  requests: LeaveRequest[];
  leaveTypes: LeaveType[];
}) {
  const keys = daysInMonthKeys(month);
  const inMonth = requests.filter(
    (l) =>
      (l.status === "APPROVED" || l.status === "PENDING") &&
      dayKey(l.fromDate) <= keys[keys.length - 1]! &&
      dayKey(l.toDate) >= keys[0]!,
  );

  const rows = employees
    .filter((e) => e.active && inMonth.some((l) => l.employeeId === e.id))
    .sort(
      (a, b) =>
        a.branchId.localeCompare(b.branchId) ||
        a.department.localeCompare(b.department) ||
        a.code.localeCompare(b.code),
    );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No approved or pending leave this month"
        body="The team calendar shows approved and pending leave by branch and department. Choose another month from the attendance board, or submit a request to see it appear here."
      />
    );
  }

  const grouped = new Map<string, Map<string, Employee[]>>();
  for (const e of rows) {
    const byDept = grouped.get(e.branchId) ?? new Map<string, Employee[]>();
    const list = byDept.get(e.department) ?? [];
    list.push(e);
    byDept.set(e.department, list);
    grouped.set(e.branchId, byDept);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="t-body-sm flex items-center gap-1.5 text-text-mid">
          <span className="inline-flex size-4 items-center justify-center rounded-md border border-ok/50 bg-ok-bg text-ok">
            <Check className="size-3" aria-hidden />
          </span>
          Approved
        </span>
        <span className="t-body-sm flex items-center gap-1.5 text-text-mid">
          <span className="inline-flex size-4 items-center justify-center rounded-md border border-dashed border-warn bg-warn-bg text-warn">
            <Clock3 className="size-3" aria-hidden />
          </span>
          Pending — awaiting a decision
        </span>
        <span className="t-body-sm text-text-lo">
          {formatCount(inMonth.filter((l) => l.status === "APPROVED").length)} approved ·{" "}
          {formatCount(inMonth.filter((l) => l.status === "PENDING").length)} pending in{" "}
          {formatDate(dayKeyToDate(keys[0]!))} – {formatDate(dayKeyToDate(keys[keys.length - 1]!))}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[62rem] border-collapse">
          <caption className="sr-only">Team leave calendar for {month}</caption>
          <thead>
            <tr>
              <Th className="sticky left-0 bg-surface-1">Employee</Th>
              {keys.map((k) => {
                const d = dayKeyToDate(k);
                return (
                  <th
                    key={k}
                    scope="col"
                    className={cn(
                      "t-overline w-6 border-b border-line px-0 py-2 text-center font-semibold",
                      d.getDay() === 0 ? "text-text-lo" : "text-text-mid",
                    )}
                  >
                    {d.getDate()}
                  </th>
                );
              })}
            </tr>
          </thead>
          {[...grouped.entries()].map(([branchId, byDept]) => (
            <tbody key={branchId}>
              <tr>
                <th
                  colSpan={keys.length + 1}
                  scope="colgroup"
                  className="t-label border-b border-line-strong bg-surface-2 px-3 py-1.5 text-left font-semibold text-text-hi"
                >
                  {branches.find((b) => b.id === branchId)?.name ?? branchId}
                </th>
              </tr>
              {[...byDept.entries()].map(([dept, list]) => (
                <React.Fragment key={dept}>
                  <tr>
                    <th
                      colSpan={keys.length + 1}
                      scope="rowgroup"
                      className="t-overline border-b border-line px-3 py-1 text-left text-text-lo"
                    >
                      {dept}
                    </th>
                  </tr>
                  {list.map((e) => (
                    <tr key={e.id}>
                      <Td className="sticky left-0 bg-surface-1 whitespace-nowrap">
                        <Link href={`/people/employees/${e.id}`} className="hover:underline">
                          <span className="text-text-hi">{e.name}</span>{" "}
                          <span className="t-mono text-[0.6875rem] text-text-lo">{e.code}</span>
                        </Link>
                      </Td>
                      {keys.map((k) => {
                        const hit = inMonth.find(
                          (l) => l.employeeId === e.id && dayKey(l.fromDate) <= k && dayKey(l.toDate) >= k,
                        );
                        const type = hit ? leaveTypes.find((t) => t.id === hit.leaveTypeId) : null;
                        return (
                          <td
                            key={k}
                            className="border-b border-line p-0.5 text-center"
                            title={
                              hit
                                ? `${e.name} — ${type?.name ?? ""} · ${hit.status.toLowerCase()} · ${formatDate(hit.fromDate)} → ${formatDate(hit.toDate)}`
                                : undefined
                            }
                          >
                            {hit ? (
                              <span
                                className={cn(
                                  "inline-flex size-4 items-center justify-center rounded-md border",
                                  hit.status === "APPROVED"
                                    ? "border-ok/50 bg-ok-bg text-ok"
                                    : "border-dashed border-warn bg-warn-bg text-warn",
                                )}
                              >
                                {hit.status === "APPROVED" ? (
                                  <Check className="size-3" aria-hidden />
                                ) : (
                                  <Clock3 className="size-3" aria-hidden />
                                )}
                                <span className="sr-only">
                                  {hit.status === "APPROVED" ? "Approved leave" : "Pending leave"}
                                </span>
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
