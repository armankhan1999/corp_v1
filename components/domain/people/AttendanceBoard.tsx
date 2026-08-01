"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Lock,
  ShieldCheck,
  SunMedium,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type {
  AttendanceRecord,
  Branch,
  Employee,
  Holiday,
  JobCard,
  LeaveRequest,
  Site,
} from "@/lib/schemas/entities";
import type { AttendanceState } from "@/lib/schemas/enums";
import { formatCount, formatDate, formatTime } from "@/lib/format";
import { EmptyState, Panel, PanelHeader, Overline, SimulatedBadge , Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATES,
  ATTENDANCE_STATE_LABEL,
  ATTENDANCE_STATE_TONE,
  DEFAULT_BRANCH_HOLIDAYS,
  GEOFENCE_RADIUS_KM,
  LATE_RULE_LABEL,
  SHIFT_LABEL,
} from "./config";
import {
  addDaysKey,
  allEmployees,
  allHolidays,
  allLeaveRequests,
  countsByState,
  dayKeyToDate,
  exceptionsOf,
  holidayFor,
  rosterFor,
  type RosterRow,
} from "./derive";
import { usePeopleStore, type Actor } from "./store";
import {
  AuditTrail,
  Button,
  CheckLine,
  EXCEPTION_META,
  Field,
  FilteredEmpty,
  MetricChip,
  Modal,
  RuleNote,
  Select,
  SourceChip,
  StateChip,
  Td,
  TextArea,
  Th,
} from "./ui";

export interface AttendanceBoardProps {
  actor: Actor;
  dateKey: string;
  todayKey: string;
  employees: Employee[];
  branches: Branch[];
  seedRecords: AttendanceRecord[];
  jobCards: JobCard[];
  sites: Site[];
  holidays: Holiday[];
  leaveRequests: LeaveRequest[];
  canRegularise: boolean;
  scopeBranchId: string | null;
  scopeReason: string | null;
}

export function AttendanceBoard(props: AttendanceBoardProps) {
  const router = useRouter();
  const { overlay, actions } = usePeopleStore(props.actor);

  const employees = React.useMemo(
    () => allEmployees(props.employees, overlay),
    [props.employees, overlay],
  );
  const holidays = React.useMemo(
    () => allHolidays(props.holidays, DEFAULT_BRANCH_HOLIDAYS, overlay),
    [props.holidays, overlay],
  );
  const leaveRequests = React.useMemo(
    () => allLeaveRequests(props.leaveRequests, overlay),
    [props.leaveRequests, overlay],
  );

  const scoped = React.useMemo(
    () => (props.scopeBranchId ? employees.filter((e) => e.branchId === props.scopeBranchId) : employees),
    [employees, props.scopeBranchId],
  );

  const roster = React.useMemo(
    () =>
      rosterFor({
        employees: scoped,
        seedRecords: props.seedRecords,
        jobCards: props.jobCards,
        sites: props.sites,
        holidays,
        leaveRequests,
        overlay,
        key: props.dateKey,
        todayKey: props.todayKey,
      }),
    [scoped, props.seedRecords, props.jobCards, props.sites, holidays, leaveRequests, overlay, props.dateKey, props.todayKey],
  );

  const counts = React.useMemo(() => countsByState(roster), [roster]);
  const exceptions = React.useMemo(() => exceptionsOf(roster), [roster]);

  /* ------------------------------------------------------------- filters */
  const [branchFilter, setBranchFilter] = React.useState("ALL");
  const [deptFilter, setDeptFilter] = React.useState("ALL");
  const [stateFilter, setStateFilter] = React.useState<AttendanceState | "ALL">("ALL");
  const [query, setQuery] = React.useState("");

  const departments = React.useMemo(
    () => [...new Set(scoped.map((e) => e.department))].sort(),
    [scoped],
  );

  const filtered = roster.filter((r) => {
    if (branchFilter !== "ALL" && r.employee.branchId !== branchFilter) return false;
    if (deptFilter !== "ALL" && r.employee.department !== deptFilter) return false;
    if (stateFilter !== "ALL" && r.state !== stateFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!r.employee.name.toLowerCase().includes(q) && !r.employee.code.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const activeFilters: string[] = [];
  if (branchFilter !== "ALL") {
    activeFilters.push(`Branch: ${props.branches.find((b) => b.id === branchFilter)?.city ?? branchFilter}`);
  }
  if (deptFilter !== "ALL") activeFilters.push(`Department: ${deptFilter}`);
  if (stateFilter !== "ALL") activeFilters.push(`State: ${ATTENDANCE_STATE_LABEL[stateFilter]}`);
  if (query) activeFilters.push(`Search: “${query}”`);

  function clearFilters() {
    setBranchFilter("ALL");
    setDeptFilter("ALL");
    setStateFilter("ALL");
    setQuery("");
  }

  /* ------------------------------------------------------- regularisation */
  const [target, setTarget] = React.useState<RosterRow | null>(null);
  const [newState, setNewState] = React.useState<AttendanceState>("PRESENT");
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  function openRegularise(row: RosterRow) {
    setTarget(row);
    setNewState(row.state === "ABSENT" ? "PRESENT" : row.state);
    setReason("");
    setTouched(false);
  }

  const reasonError = touched && reason.trim().length < 10 ? "A reason of at least 10 characters is mandatory." : null;

  function commitRegularise() {
    setTouched(true);
    if (!target || reason.trim().length < 10) return;
    actions.regularise(target.record, newState, reason.trim());
    setTarget(null);
  }

  /* ---------------------------------------------------------- device batch */
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [batchAck, setBatchAck] = React.useState(false);
  const batchCandidates = roster
    .filter((r) => r.employee.workLocationType === "OFFICE" && r.origin !== "OVERLAY")
    .slice(0, 8)
    .map((r) => r.employee);

  function runBatch() {
    actions.injectDeviceBatch(batchCandidates, props.dateKey, "Branch reader — Exhibition Road");
    setBatchOpen(false);
    setBatchAck(false);
  }

  /* ----------------------------------------------------------- rendering */
  const dateObj = dayKeyToDate(props.dateKey);
  const isFuture = props.dateKey > props.todayKey;
  const branchHolidays = props.branches
    .map((b) => ({ branch: b, holiday: holidayFor(holidays, props.dateKey, b.id) }))
    .filter((x) => x.holiday);
  const branchScopedHoliday = branchHolidays.filter((x) => x.holiday!.branchId !== null);
  const noRecords = roster.every((r) => r.origin === "SYNTHETIC" && r.record.id.startsWith("ATT-NIL-"));

  const groups = React.useMemo(() => {
    const map = new Map<string, Map<string, RosterRow[]>>();
    for (const r of filtered) {
      const byDept = map.get(r.employee.branchId) ?? new Map<string, RosterRow[]>();
      const rows = byDept.get(r.employee.department) ?? [];
      rows.push(r);
      byDept.set(r.employee.department, rows);
      map.set(r.employee.branchId, byDept);
    }
    return map;
  }, [filtered]);

  const peopleAudit = overlay.audit.filter(
    (a) => a.entityType === "AttendanceRecord" || a.entityType === "Holiday",
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Date navigation ------------------------------------------------ */}
      <Panel>
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Link
              href={`/people/attendance?date=${addDaysKey(props.dateKey, -1)}`}
              aria-label="Previous day"
              className="grid size-8 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link
              href={`/people/attendance?date=${addDaysKey(props.dateKey, 1)}`}
              aria-label="Next day"
              className="grid size-8 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-text-lo" aria-hidden />
            <span className="t-heading-md text-text-hi">{formatDate(dateObj)}</span>
            <span className="t-body-sm text-text-lo">
              {dateObj.toLocaleDateString("en-IN", { weekday: "long" })}
              {props.dateKey === props.todayKey ? " · today" : ""}
            </span>
          </div>
          <label className="flex items-center gap-2">
            <span className="sr-only">Choose a date</span>
            <input
              type="date"
              value={props.dateKey}
              onChange={(e) => router.push(`/people/attendance?date=${e.target.value}`)}
              className="t-body-sm rounded-md border border-line bg-surface-2 px-2 py-1 text-text-hi"
            />
          </label>
          {props.dateKey !== props.todayKey ? (
            <Link
              href="/people/attendance"
              className="t-body-sm rounded-md border border-line px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Back to today
            </Link>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href={`/people/attendance/summary?month=${props.dateKey.slice(0, 7)}`}
              className="t-body-sm rounded-md border border-line px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Payroll input
            </Link>
            <Link
              href="/people/attendance/holidays"
              className="t-body-sm rounded-md border border-line px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Holiday calendar
            </Link>
            <Link
              href="/people/attendance/utilisation"
              className="t-body-sm rounded-md border border-line px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Utilisation
            </Link>
          </div>
        </div>
      </Panel>

      {props.scopeReason ? (
        <RuleNote title="Branch scope locked" tone="neutral" icon={Lock}>
          {props.scopeReason}
        </RuleNote>
      ) : null}

      {branchScopedHoliday.length > 0 ? (
        <RuleNote title="Branch holiday in force" tone="info" icon={SunMedium}>
          {branchScopedHoliday
            .map((x) => `${x.holiday!.name} — ${x.branch.city} only`)
            .join(" · ")}
          . Employees of {branchScopedHoliday.map((x) => x.branch.city).join(" and ")} show Holiday;
          every other branch renders normally.
        </RuleNote>
      ) : null}

      {isFuture ? (
        <RuleNote title="Future date" tone="warn" icon={TriangleAlert}>
          The board is available up to {formatDate(dayKeyToDate(props.todayKey))}. Nothing has been
          recorded for a date that has not happened.
        </RuleNote>
      ) : null}

      {/* Counts per state ------------------------------------------------ */}
      <div className="flex flex-wrap gap-2">
        <MetricChip
          label="On register"
          value={formatCount(roster.length)}
          onClick={() => setStateFilter("ALL")}
          active={stateFilter === "ALL"}
        />
        {ATTENDANCE_STATES.map((s) => (
          <MetricChip
            key={s}
            label={ATTENDANCE_STATE_LABEL[s]}
            value={formatCount(counts[s])}
            tone={counts[s] === 0 ? "neutral" : ATTENDANCE_STATE_TONE[s] === "sim" ? "neutral" : ATTENDANCE_STATE_TONE[s]}
            onClick={() => setStateFilter(stateFilter === s ? "ALL" : s)}
            active={stateFilter === s}
          />
        ))}
      </div>

      {/* Exceptions — a separate section, never buried in the list -------- */}
      <Panel>
        <PanelHeader
          title="Exceptions"
          sub={`Late marks, missing check-outs and field check-ins outside the ${GEOFENCE_RADIUS_KM} km geofence, lifted out of the roster.`}
          right={
            <span className={cn("t-heading-md tabular-nums", exceptions.length ? "text-warn" : "text-ok")}>
              {formatCount(exceptions.length)}
            </span>
          }
        />
        {exceptions.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-4">
            <ShieldCheck className="size-4 text-ok" aria-hidden />
            <p className="t-body-sm text-text-mid">
              No exceptions on this date. Shift {SHIFT_LABEL}. {LATE_RULE_LABEL}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[var(--line)]">
              {exceptions.map((ex, i) => {
                const meta = EXCEPTION_META[ex.kind];
                const Icon = meta.icon;
                return (
                  <li
                    key={`${ex.kind}-${ex.row.employee.id}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
                  >
                    <span
                      className={cn(
                        "t-overline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                        meta.tone === "danger"
                          ? "border-danger/40 bg-danger-bg text-danger"
                          : "border-warn/40 bg-warn-bg text-warn",
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                      {meta.label}
                    </span>
                    <Link
                      href={`/people/employees/${ex.row.employee.id}`}
                      className="t-body-sm font-medium text-text-hi hover:underline"
                    >
                      {ex.row.employee.name}
                    </Link>
                    <span className="t-mono text-[0.6875rem] text-text-lo">{ex.row.employee.code}</span>
                    <span className="t-body-sm text-text-lo">
                      {props.branches.find((b) => b.id === ex.row.employee.branchId)?.city} ·{" "}
                      {ex.row.employee.department}
                    </span>
                    <span className="t-body-sm text-text-mid">{ex.detail}</span>
                    {ex.row.jobCardId ? (
                      <Link
                        href={`/service/job-cards/${ex.row.jobCardId}`}
                        className="t-mono text-[0.6875rem] text-info hover:underline"
                      >
                        {ex.row.jobCardId}
                      </Link>
                    ) : null}
                    <span className="ml-auto flex items-center gap-2">
                      {ex.row.checkIn ? (
                        <span className="t-mono text-[0.6875rem] text-text-lo">
                          in {formatTime(ex.row.checkIn)}
                        </span>
                      ) : null}
                      {props.canRegularise ? (
                        <Button onClick={() => openRegularise(ex.row)}>Regularise</Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Explainer className="border-t border-line px-4 py-2 text-text-lo">
              Shift {SHIFT_LABEL}. {LATE_RULE_LABEL} Late marks are derived from this rule on every
              surface rather than read from a stored flag, so the board, the payroll input and the
              audit log cannot disagree.
            </Explainer>
          </>
        )}
      </Panel>

      {/* Filters ---------------------------------------------------------- */}
      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2.5">
          <Field label="Search" className="w-48">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or employee code"
              className="t-body-sm w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-text-hi placeholder:text-text-lo"
            />
          </Field>
          {!props.scopeBranchId ? (
            <Field label="Branch" className="w-40">
              <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="ALL">All branches</option>
                {props.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.city}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Department" className="w-44">
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="ALL">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <div className="ml-auto flex items-center gap-2">
            {activeFilters.length > 0 ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : null}
            <Button tone="ghost" onClick={() => setBatchOpen(true)}>
              <Fingerprint className="size-3.5" aria-hidden />
              Device batch
            </Button>
          </div>
        </div>

        {noRecords && !isFuture ? (
          <EmptyState
            icon={CalendarDays}
            title="No attendance recorded for this date"
            body="Attendance is held at full fidelity for the last 60 days and sampled weekly before that. Choose a date inside the recorded window, or return to today."
            action={
              <Link
                href="/people/attendance"
                className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                Back to today
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <FilteredEmpty filters={activeFilters} onClear={clearFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse">
              <caption className="sr-only">
                Attendance by branch and department for {formatDate(dateObj)}
              </caption>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Designation</Th>
                  <Th>State</Th>
                  <Th numeric>Check-in</Th>
                  <Th numeric>Check-out</Th>
                  <Th>Source</Th>
                  <Th>Location / job card</Th>
                  <Th />
                </tr>
              </thead>
              {[...groups.entries()].map(([branchId, byDept]) => {
                const branch = props.branches.find((b) => b.id === branchId);
                const branchRows = [...byDept.values()].flat();
                const branchCounts = countsByState(branchRows);
                return (
                  <tbody key={branchId}>
                    <tr>
                      <th
                        colSpan={8}
                        scope="colgroup"
                        className="border-b border-line-strong bg-surface-2 px-3 py-1.5 text-left"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="t-label font-semibold text-text-hi">
                            {branch?.name ?? branchId}
                          </span>
                          <span className="t-body-sm text-text-lo">
                            {branchRows.length} on register
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {ATTENDANCE_STATES.filter((s) => branchCounts[s] > 0).map((s) => (
                              <span key={s} className="t-overline text-text-lo">
                                {ATTENDANCE_STATE_LABEL[s]} {branchCounts[s]}
                              </span>
                            ))}
                          </span>
                        </span>
                      </th>
                    </tr>
                    {[...byDept.entries()].map(([dept, rows]) => (
                      <React.Fragment key={dept}>
                        <tr>
                          <th
                            colSpan={8}
                            scope="rowgroup"
                            className="t-overline border-b border-line bg-surface-1 px-3 py-1 text-left text-text-lo"
                          >
                            {dept} · {rows.length}
                          </th>
                        </tr>
                        {rows.map((r) => (
                          <React.Fragment key={r.employee.id}>
                            <tr className="hover:bg-surface-2">
                              <Td>
                                <Link
                                  href={`/people/employees/${r.employee.id}`}
                                  className="flex flex-col hover:underline"
                                >
                                  <span className="t-body-sm font-medium text-text-hi">
                                    {r.employee.name}
                                  </span>
                                  <span className="t-mono text-[0.6875rem] text-text-lo">
                                    {r.employee.code}
                                  </span>
                                </Link>
                              </Td>
                              <Td>{r.employee.designation}</Td>
                              <Td>
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <StateChip state={r.state} />
                                  {r.patch ? (
                                    <span className="t-overline rounded-md border border-info/40 bg-info-bg px-1.5 py-0.5 text-info">
                                      Regularised
                                    </span>
                                  ) : null}
                                  {r.simulated ? <SimulatedBadge what="biometric device batch" /> : null}
                                </span>
                              </Td>
                              <Td numeric>
                                {r.checkIn ? (
                                  <span className={cn("t-mono", r.late && "text-warn")}>
                                    {formatTime(r.checkIn)}
                                  </span>
                                ) : (
                                  <span className="text-text-lo">—</span>
                                )}
                              </Td>
                              <Td numeric>
                                {r.checkOut ? (
                                  <span className="t-mono">{formatTime(r.checkOut)}</span>
                                ) : r.missingCheckOut ? (
                                  <span className="t-body-sm text-danger">Missing</span>
                                ) : (
                                  <span className="text-text-lo">—</span>
                                )}
                              </Td>
                              <Td>
                                <SourceChip source={r.record.source} />
                              </Td>
                              <Td>
                                <span className="flex flex-col gap-0.5">
                                  <span className="text-text-mid">{r.placeLabel ?? "—"}</span>
                                  {r.jobCardId ? (
                                    <Link
                                      href={`/service/job-cards/${r.jobCardId}`}
                                      className="t-mono text-[0.6875rem] text-info hover:underline"
                                    >
                                      {r.jobCardId}
                                    </Link>
                                  ) : null}
                                  {r.geofenceBreachKm !== null ? (
                                    <span className="t-body-sm text-warn">
                                      {r.geofenceBreachKm} km outside geofence
                                    </span>
                                  ) : null}
                                </span>
                              </Td>
                              <Td className="text-right">
                                {props.canRegularise ? (
                                  r.patch ? (
                                    <Button
                                      tone="quiet"
                                      onClick={() => actions.undoRegularisation(r.record.id)}
                                    >
                                      <Undo2 className="size-3.5" aria-hidden />
                                      Withdraw
                                    </Button>
                                  ) : (
                                    <Button onClick={() => openRegularise(r)}>Regularise</Button>
                                  )
                                ) : null}
                              </Td>
                            </tr>
                            {r.patch ? (
                              <tr className="bg-surface-2/60">
                                <Td colSpan={8} className="text-text-lo">
                                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="t-overline text-text-lo">Original record retained</span>
                                    <StateChip state={r.patch.original.state} />
                                    <span className="t-mono text-[0.6875rem]">
                                      in{" "}
                                      {r.patch.original.checkInAt
                                        ? formatTime(
                                            new Date(
                                              new Date(r.patch.original.date).setHours(0, 0, 0, 0) +
                                                (new Date(r.patch.original.checkInAt).getTime() -
                                                  new Date(r.patch.original.date).getTime()),
                                            ),
                                          )
                                        : "—"}
                                    </span>
                                    <span className="t-body-sm text-text-mid">
                                      Reason: {r.patch.reason}
                                    </span>
                                    <span className="t-body-sm">
                                      {r.patch.byName} · {new Date(r.patch.at).toLocaleString("en-IN")}
                                    </span>
                                  </span>
                                </Td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </Panel>

      <AuditTrail
        entries={peopleAudit}
        title="Attendance audit trail"
        empty="No regularisation, holiday change or device batch has been recorded in this session. Every one of those writes an entry here with actor, role and timestamp."
      />

      {/* Regularisation ---------------------------------------------------- */}
      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Regularise attendance"
        sub={
          target
            ? `${target.employee.name} · ${target.employee.code} · ${formatDate(dateObj)}`
            : undefined
        }
        footer={
          <>
            <Button onClick={() => setTarget(null)}>Cancel</Button>
            <Button tone="primary" onClick={commitRegularise} disabled={reason.trim().length < 10}>
              Record regularisation
            </Button>
          </>
        }
      >
        {target ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] px-3 py-2.5">
              <Overline>Original record — retained, not overwritten</Overline>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <StateChip state={target.record.state} />
                <span className="t-mono text-[0.6875rem] text-text-mid">
                  in {target.checkIn ? formatTime(target.checkIn) : "—"} · out{" "}
                  {target.checkOut ? formatTime(target.checkOut) : "—"}
                </span>
                <SourceChip source={target.record.source} />
                {target.geofenceBreachKm !== null ? (
                  <span className="t-body-sm text-warn">{target.geofenceBreachKm} km outside geofence</span>
                ) : null}
              </div>
            </div>

            <Field label="Corrected state" required>
              <Select value={newState} onChange={(e) => setNewState(e.target.value as AttendanceState)}>
                {ATTENDANCE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {ATTENDANCE_STATE_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Reason"
              required
              error={reasonError}
              hint="Mandatory. Recorded verbatim in the audit log against your user and role."
            >
              <TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Engineer was at the Sultanganj site; network unavailable at check-out. Confirmed with the customer contact."
              />
            </Field>

            {reason.trim().length < 10 ? (
              <RuleNote title="Action blocked" tone="warn" icon={TriangleAlert}>
                A regularisation cannot be recorded without a reason.{" "}
                <span className="text-text-hi">Enter at least 10 characters to unblock it.</span>
              </RuleNote>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Device batch ------------------------------------------------------ */}
      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="Simulated biometric device batch"
        sub="Demo Controls · INT-10 attendance device"
        footer={
          <>
            <Button onClick={() => setBatchOpen(false)}>Cancel</Button>
            <Button tone="primary" onClick={runBatch} disabled={!batchAck || batchCandidates.length === 0}>
              Inject {batchCandidates.length} device records
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <RuleNote title="No hardware is involved" tone="info">
            BRD X-02 places real biometric hardware outside Phase 1. This injects device-sourced
            records alongside app-sourced ones so the board can be seen distinguishing them. Each
            injected record is labelled <span className="text-text-hi">Biometric device</span> and
            carries a <span className="text-text-hi">Simulated</span> chip.{" "}
            <Link href="/admin/integrations" className="text-info hover:underline">
              Integration readiness
            </Link>
          </RuleNote>
          <div>
            <Overline>Records to be injected — {formatDate(dateObj)}</Overline>
            <ul className="mt-1.5 flex flex-col gap-1">
              {batchCandidates.map((e) => (
                <li key={e.id} className="t-body-sm flex items-center gap-2 text-text-mid">
                  <span className="t-mono text-[0.6875rem] text-text-lo">{e.code}</span>
                  {e.name}
                  <span className="text-text-lo">· {e.department}</span>
                </li>
              ))}
              {batchCandidates.length === 0 ? (
                <li className="t-body-sm text-text-lo">
                  Every office record for this date already came from the app or a previous batch.
                </li>
              ) : null}
            </ul>
          </div>
          <CheckLine id="batch-ack" checked={batchAck} onChange={setBatchAck}>
            I understand these records are simulated and will be marked as such on every surface.
          </CheckLine>
        </div>
      </Modal>
    </div>
  );
}
