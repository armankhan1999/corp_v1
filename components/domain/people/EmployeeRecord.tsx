"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  BellRing,
  CalendarClock,
  CircleAlert,
  FileCheck2,
  FileWarning,
  Mail,
  Phone,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import type {
  AttendanceRecord,
  Branch,
  Employee,
  EmployeeDocument,
  LeaveRequest,
  LeaveType,
} from "@/lib/schemas/entities";
import type { OEMPrincipal, Role } from "@/lib/schemas/enums";
import { OEM_LABEL } from "@/lib/schemas/enums";
import { formatDate, formatDateTime, formatPhone, formatTime, initials } from "@/lib/format";
import { KeyValue, Mono, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { EXPIRY_NOTICE_DAYS } from "./config";
import {
  allEmployees,
  documentFile,
  leaveBalances,
  wallClock,
  type DocSlot,
} from "./derive";
import { usePeopleStore, type Actor } from "./store";
import {
  AuditTrail,
  Button,
  DeniedPanel,
  RuleNote,
  SourceChip,
  StateChip,
  Tabs,
  Td,
  Th,
} from "./ui";

const OEM_OPTIONS: OEMPrincipal[] = ["ELGI", "ATS_ELGI", "KSB", "ION_EXCHANGE", "OTHER"];

export interface EmployeeRecordProps {
  actor: Actor;
  employee: Employee;
  manager: Employee | null;
  reports: Employee[];
  branch: Branch | null;
  documents: EmployeeDocument[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  leaveTypes: LeaveType[];
  dispatchDemand: { principal: OEMPrincipal; openTickets: number }[];
  personalVisible: boolean;
  canEdit: boolean;
  hrHolders: Role[];
  nowIso: string;
}

export function EmployeeRecord(props: EmployeeRecordProps) {
  const { overlay, actions } = usePeopleStore(props.actor);
  const now = React.useMemo(() => new Date(props.nowIso), [props.nowIso]);

  const employee = React.useMemo(() => {
    const merged = allEmployees([props.employee], overlay);
    return merged[0] ?? props.employee;
  }, [props.employee, overlay]);

  const documents = React.useMemo(
    () => [...props.documents, ...overlay.documentsAdded.filter((d) => d.employeeId === employee.id)],
    [props.documents, overlay.documentsAdded, employee.id],
  );

  const file = React.useMemo(
    () => documentFile(employee, documents, now),
    [employee, documents, now],
  );

  const balances = React.useMemo(
    () => leaveBalances(props.leaveTypes, props.leaveRequests, employee.id, now),
    [props.leaveTypes, props.leaveRequests, employee.id, now],
  );

  const [tab, setTab] = React.useState("overview");

  /* E9-S1 — a request for personal data or documents without HR permission is
     denied and the denial is itself written to the audit log. */
  const denied = !props.personalVisible;
  React.useEffect(() => {
    if (denied && (tab === "documents" || tab === "overview")) {
      actions.logDenial(
        tab === "documents"
          ? "Employee document file requested without the hrDocuments capability."
          : "Employee personal data requested without the hrDocuments capability.",
        employee.id,
        `${employee.code} · ${employee.name}`,
      );
    }
  }, [denied, tab, actions, employee.id, employee.code, employee.name]);

  const tabs = [
    { id: "overview", label: "Record" },
    { id: "documents", label: "Documents", count: props.personalVisible ? file.slots.length : undefined },
    { id: "skills", label: "Certifications & dispatch" },
    { id: "attendance", label: "Attendance", count: props.attendance.length },
    { id: "leave", label: "Leave", count: props.leaveRequests.length },
  ];

  const recordAudit = overlay.audit.filter((a) => a.entityId === employee.id);

  return (
    <div className="flex flex-col gap-4">
      {/* Identity ---------------------------------------------------------- */}
      <Panel>
        <div className="flex flex-wrap items-start gap-4 px-4 py-3.5">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] text-text-mid"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {initials(employee.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="t-heading-lg text-text-hi">{employee.name}</h1>
              <Mono className="text-text-lo">{employee.code}</Mono>
              <StatusBadge tone={employee.active ? "ok" : "neutral"}>
                {employee.active ? "Active" : "Inactive"}
              </StatusBadge>
              {employee.workLocationType === "FIELD" ? (
                <StatusBadge tone="info">Field</StatusBadge>
              ) : null}
            </div>
            <p className="t-body-sm mt-1 text-text-mid">
              {employee.designation} · {employee.department} · {props.branch?.name ?? employee.branchId}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "t-overline inline-flex items-center gap-1 rounded-md border px-2 py-1",
                file.statutoryPct === 100
                  ? "border-ok/40 bg-ok-bg text-ok"
                  : "border-danger/40 bg-danger-bg text-danger",
              )}
            >
              {file.statutoryPct === 100 ? (
                <FileCheck2 className="size-3.5" aria-hidden />
              ) : (
                <FileWarning className="size-3.5" aria-hidden />
              )}
              Statutory file {file.requiredPresent}/{file.requiredTotal}
            </span>
            <Link
              href={`/people/attendance?date=${props.nowIso.slice(0, 10)}`}
              className="t-body-sm rounded-md border border-line px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Attendance board
            </Link>
          </div>
        </div>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </Panel>

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Panel>
            <PanelHeader title="Employment record" sub="Captured on the employee form and held as the single source for attendance, leave and payroll input." />
            <dl className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
              <KeyValue label="Employee code">
                <Mono>{employee.code}</Mono>
              </KeyValue>
              <KeyValue label="Designation">{employee.designation}</KeyValue>
              <KeyValue label="Department">{employee.department}</KeyValue>
              <KeyValue label="Branch">{props.branch?.name ?? employee.branchId}</KeyValue>
              <KeyValue label="Reporting manager">
                {props.manager ? (
                  <Link href={`/people/employees/${props.manager.id}`} className="hover:underline">
                    {props.manager.name}
                  </Link>
                ) : (
                  <span className="text-text-lo">Reports to the board</span>
                )}
              </KeyValue>
              <KeyValue label="Date of joining">{formatDate(employee.dateOfJoining)}</KeyValue>
              <KeyValue label="Employment type">
                {employee.employmentType.replace(/_/g, " ").toLowerCase()}
              </KeyValue>
              <KeyValue label="Work location type">
                {employee.workLocationType === "FIELD" ? "Field" : "Office"}
              </KeyValue>
              <KeyValue label="Daily visit capacity">
                {employee.dailyCapacity ? `${employee.dailyCapacity} visits/day` : "—"}
              </KeyValue>
              <KeyValue label="Direct reports">{props.reports.length}</KeyValue>
              <KeyValue label="Status">{employee.active ? "Active" : "Inactive"}</KeyValue>
            </dl>
          </Panel>

          <div className="flex flex-col gap-4">
            {props.personalVisible ? (
              <>
                <Panel>
                  <PanelHeader title="Contact" sub="Personal data — HR & Admin scope." />
                  <dl className="flex flex-col gap-3 px-4 py-4">
                    <KeyValue label="Mobile">
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-text-lo" aria-hidden />
                        <Mono>{formatPhone(employee.phone)}</Mono>
                      </span>
                    </KeyValue>
                    <KeyValue label="Email">
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5 text-text-lo" aria-hidden />
                        {employee.email}
                      </span>
                    </KeyValue>
                    <KeyValue label="Emergency contact">
                      {employee.emergencyContactName}
                      <span className="t-mono ml-2 text-[0.6875rem] text-text-lo">
                        {formatPhone(employee.emergencyContactPhone)}
                      </span>
                    </KeyValue>
                  </dl>
                </Panel>

                <Panel>
                  <PanelHeader
                    title="Statutory identifiers"
                    sub="Held masked. The full number is never stored or displayed."
                  />
                  <dl className="flex flex-col gap-3 px-4 py-4">
                    <KeyValue label="EPF number">
                      <Mono>{employee.pfNumberMasked}</Mono>
                    </KeyValue>
                    <KeyValue label="ESIC number">
                      <Mono>{employee.esicNumberMasked}</Mono>
                    </KeyValue>
                    <KeyValue label="UAN">
                      <Mono>{employee.uanMasked}</Mono>
                    </KeyValue>
                  </dl>
                </Panel>
              </>
            ) : (
              <DeniedPanel
                what="employee personal data"
                capability="hrDocuments"
                holders={props.hrHolders}
              />
            )}
          </div>
        </div>
      ) : null}

      {tab === "documents" ? (
        props.personalVisible ? (
          <DocumentsTab
            slots={file.slots}
            employee={employee}
            canNotify={props.canEdit}
            onNotify={(slot, threshold) =>
              actions.notifyExpiry(
                slot.document?.id ?? `${employee.id}-${slot.spec.title}`,
                employee.id,
                `${employee.code} · ${slot.spec.title}`,
                threshold,
              )
            }
            noticesSent={overlay.notices.filter((n) => n.employeeId === employee.id)}
          />
        ) : (
          <DeniedPanel
            what="the employee document file"
            capability="hrDocuments"
            holders={props.hrHolders}
          />
        )
      ) : null}

      {tab === "skills" ? (
        <SkillsTab
          employee={employee}
          dispatchDemand={props.dispatchDemand}
          canEdit={props.canEdit}
          onSave={(certs) => actions.setCertifications(employee, certs)}
          expiredCert={file.slots.find(
            (s) => s.spec.title === "OEM Training Certificate" && s.expiryState === "EXPIRED",
          )}
        />
      ) : null}

      {tab === "attendance" ? (
        <Panel>
          <PanelHeader
            title="Recent attendance"
            sub="The last recorded days for this employee. Every row opens on the board for the same date."
          />
          {props.attendance.length === 0 ? (
            <p className="t-body-sm px-4 py-6 text-text-lo">No attendance recorded for this employee yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead>
                  <tr>
                    <Th numeric>Date</Th>
                    <Th>State</Th>
                    <Th numeric>Check-in</Th>
                    <Th numeric>Check-out</Th>
                    <Th>Source</Th>
                    <Th>Location / job card</Th>
                  </tr>
                </thead>
                <tbody>
                  {props.attendance.map((a) => {
                    const inAt = wallClock(a, a.checkInAt);
                    const outAt = wallClock(a, a.checkOutAt);
                    return (
                      <tr key={a.id} className="hover:bg-surface-2">
                        <Td numeric>
                          <Link
                            href={`/people/attendance?date=${a.date.slice(0, 10)}`}
                            className="t-mono text-text-hi hover:underline"
                          >
                            {formatDate(a.date)}
                          </Link>
                        </Td>
                        <Td>
                          <StateChip state={a.state} />
                        </Td>
                        <Td numeric>{inAt ? <Mono>{formatTime(inAt)}</Mono> : <span className="text-text-lo">—</span>}</Td>
                        <Td numeric>{outAt ? <Mono>{formatTime(outAt)}</Mono> : <span className="text-text-lo">—</span>}</Td>
                        <Td>
                          <SourceChip source={a.source} />
                        </Td>
                        <Td>
                          <span className="flex flex-col">
                            <span>{a.placeLabel ?? "—"}</span>
                            {a.jobCardId ? (
                              <Link
                                href={`/service/job-cards/${a.jobCardId}`}
                                className="t-mono text-[0.6875rem] text-info hover:underline"
                              >
                                {a.jobCardId}
                              </Link>
                            ) : null}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "leave" ? (
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Leave balance" sub="Accrued to date this financial year, less approved leave taken." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse">
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
                    <tr key={b.type.id}>
                      <Td>
                        <Mono className="text-text-lo">{b.type.code}</Mono> {b.type.name}
                      </Td>
                      <Td numeric>{b.entitlement || "—"}</Td>
                      <Td numeric>{b.accrued}</Td>
                      <Td numeric>{b.taken}</Td>
                      <Td numeric className={b.available < 0 ? "text-danger" : "text-text-hi"}>
                        {b.available}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Leave history" right={<Link href="/people/leave" className="t-body-sm text-info hover:underline">Open leave workspace</Link>} />
            {props.leaveRequests.length === 0 ? (
              <p className="t-body-sm px-4 py-6 text-text-lo">No leave has been requested.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse">
                  <thead>
                    <tr>
                      <Th>Number</Th>
                      <Th>Type</Th>
                      <Th numeric>From</Th>
                      <Th numeric>To</Th>
                      <Th numeric>Days</Th>
                      <Th>Status</Th>
                      <Th>Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.leaveRequests.map((l) => (
                      <tr key={l.id}>
                        <Td>
                          <Mono>{l.number}</Mono>
                        </Td>
                        <Td>{props.leaveTypes.find((t) => t.id === l.leaveTypeId)?.name ?? l.leaveTypeId}</Td>
                        <Td numeric>{formatDate(l.fromDate)}</Td>
                        <Td numeric>{formatDate(l.toDate)}</Td>
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
                        <Td>{l.reason}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      <AuditTrail
        entries={recordAudit}
        title="Record audit trail"
        empty="No change to this record has been made in this session."
      />
    </div>
  );
}

/* -------------------------------------------------------------- documents */

function DocumentsTab({
  slots,
  employee,
  canNotify,
  onNotify,
  noticesSent,
}: {
  slots: DocSlot[];
  employee: Employee;
  canNotify: boolean;
  onNotify: (slot: DocSlot, threshold: number) => void;
  noticesSent: { documentId: string; threshold: number; at: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <RuleNote title="Appointment letter is the required document" tone="neutral" icon={FileCheck2}>
        Every employee record must carry an appointment letter; its present-or-missing state is shown
        first and drives the statutory completeness figure on the dashboard. A statutory document
        with an expiry date raises a notice to the document owner and HR at{" "}
        {EXPIRY_NOTICE_DAYS.join(" and ")} days.
      </RuleNote>

      <Panel>
        <PanelHeader title="Document file" sub={`${employee.code} · ${employee.name}`} />
        <ul className="divide-y divide-[var(--line)]">
          {slots.map((slot) => {
            const sent = noticesSent.filter((n) => n.documentId === (slot.document?.id ?? ""));
            return (
              <li key={slot.spec.title} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <span className="mt-0.5">
                  {slot.present ? (
                    <FileCheck2 className={cn("size-4", slot.expiryState === "EXPIRED" ? "text-danger" : "text-ok")} aria-hidden />
                  ) : slot.spec.requirement === "REQUIRED" ? (
                    <FileWarning className="size-4 text-danger" aria-hidden />
                  ) : (
                    <CircleAlert className="size-4 text-text-lo" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="t-body font-medium text-text-hi">{slot.spec.title}</span>
                    <StatusBadge tone={slot.spec.requirement === "REQUIRED" ? "warn" : "neutral"}>
                      {slot.spec.requirement === "REQUIRED" ? "Required" : "Recommended"}
                    </StatusBadge>
                    {slot.spec.statutory ? <StatusBadge tone="info">Statutory</StatusBadge> : null}
                    {slot.present ? (
                      <StatusBadge tone="ok">Present</StatusBadge>
                    ) : (
                      <StatusBadge tone={slot.spec.requirement === "REQUIRED" ? "danger" : "neutral"}>
                        Missing
                      </StatusBadge>
                    )}
                  </span>
                  <p className="t-body-sm mt-1 text-text-mid">{slot.spec.note}</p>
                  {slot.document ? (
                    <p className="t-body-sm mt-1 text-text-lo">
                      Issued {formatDate(slot.document.issuedOn)}
                      {slot.expiresOn ? (
                        <>
                          {" · "}
                          Expires <span className="text-text-mid">{formatDate(slot.expiresOn)}</span>
                          {slot.daysToExpiry !== null ? (
                            <>
                              {" · "}
                              {slot.daysToExpiry < 0
                                ? `${Math.abs(slot.daysToExpiry)} days overdue`
                                : `${slot.daysToExpiry} days remaining`}
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {slot.expiryState === "EXPIRED" || slot.expiryState === "DUE_30" || slot.expiryState === "DUE_60" ? (
                    <p className="t-body-sm mt-1 flex flex-wrap items-center gap-1.5 text-warn">
                      <BellRing className="size-3.5 shrink-0" aria-hidden />
                      {slot.expiryState === "EXPIRED"
                        ? "Expired — 60-day and 30-day notices have both fallen due for the document owner and HR."
                        : `Within the ${slot.expiryState === "DUE_30" ? 30 : 60}-day window — notice due to the document owner and HR.`}
                    </p>
                  ) : null}
                  {sent.length > 0 ? (
                    <p className="t-body-sm mt-1 text-ok">
                      Notice sent{" "}
                      {sent
                        .map((n) => `${n.threshold}-day at ${formatDateTime(n.at)}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {slot.expiresOn && canNotify ? (
                    <Button
                      onClick={() => onNotify(slot, slot.daysToExpiry !== null && slot.daysToExpiry <= 30 ? 30 : 60)}
                    >
                      <BellRing className="size-3.5" aria-hidden />
                      Notify owner &amp; HR
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ skills tab */

function SkillsTab({
  employee,
  dispatchDemand,
  canEdit,
  onSave,
  expiredCert,
}: {
  employee: Employee;
  dispatchDemand: { principal: OEMPrincipal; openTickets: number }[];
  canEdit: boolean;
  onSave: (certs: OEMPrincipal[]) => void;
  expiredCert?: DocSlot;
}) {
  const [certs, setCerts] = React.useState<OEMPrincipal[]>(employee.oemCertifications);
  React.useEffect(() => setCerts(employee.oemCertifications), [employee.oemCertifications]);
  const dirty =
    certs.length !== employee.oemCertifications.length ||
    certs.some((c) => !employee.oemCertifications.includes(c));

  const eligible = dispatchDemand.filter((d) => certs.includes(d.principal));
  const eligibleTickets = eligible.reduce((s, d) => s + d.openTickets, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          title="OEM certification tags"
          sub="Applied on the employee record. These tags are what the dispatch board matches a ticket's principal against."
        />
        <div className="flex flex-col gap-3 px-4 py-4">
          {employee.workLocationType !== "FIELD" ? (
            <p className="t-body-sm text-text-lo">
              Certification tags apply to field staff. This record is office-based.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {OEM_OPTIONS.map((o) => {
                  const on = certs.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setCerts(on ? certs.filter((c) => c !== o) : [...certs, o])}
                      className={cn(
                        "t-body-sm inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 disabled:cursor-not-allowed",
                        on
                          ? "border-primary-500 bg-primary-100 text-text-hi"
                          : "border-line text-text-mid hover:border-line-strong",
                      )}
                    >
                      {on ? <BadgeCheck className="size-3.5" aria-hidden /> : null}
                      {OEM_LABEL[o]}
                    </button>
                  );
                })}
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Button tone="primary" disabled={!dirty} onClick={() => onSave(certs)}>
                    Save certifications
                  </Button>
                  {dirty ? (
                    <Button onClick={() => setCerts(employee.oemCertifications)}>Discard</Button>
                  ) : null}
                </div>
              ) : (
                <p className="t-body-sm text-text-lo">
                  Read-only for your role. HR &amp; Admin maintains certification tags.
                </p>
              )}
              {expiredCert ? (
                <RuleNote title="Training certificate expired" tone="danger" icon={ShieldAlert}>
                  The OEM training certificate expired on{" "}
                  {expiredCert.expiresOn ? formatDate(expiredCert.expiresOn) : "an earlier date"}.
                  Dispatch should treat this engineer as uncertified for that principal until it is
                  renewed.
                </RuleNote>
              ) : null}
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Skill-based dispatch"
          sub="Open tickets in this branch by principal, and which of them this engineer's tags qualify for."
          right={
            <Link href="/service/dispatch" className="t-body-sm text-info hover:underline">
              Dispatch board
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Principal</Th>
                <Th numeric>Open tickets in branch</Th>
                <Th>Eligible</Th>
              </tr>
            </thead>
            <tbody>
              {dispatchDemand.map((d) => (
                <tr key={d.principal}>
                  <Td>{OEM_LABEL[d.principal]}</Td>
                  <Td numeric>{d.openTickets}</Td>
                  <Td>
                    {certs.includes(d.principal) ? (
                      <StatusBadge tone="ok">Certified</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Not certified</StatusBadge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="t-body-sm flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-text-mid">
          <Wrench className="size-3.5 shrink-0 text-text-lo" aria-hidden />
          {eligibleTickets} open {eligibleTickets === 1 ? "ticket" : "tickets"} in{" "}
          {employee.branchId} match this engineer&rsquo;s certification tags. Daily capacity{" "}
          {employee.dailyCapacity || 0} visits.
        </p>
      </Panel>

      <Panel className="lg:col-span-2">
        <PanelHeader title="Assignment window" sub="Attendance state and capacity are what the dispatch board reads before it offers this engineer." />
        <div className="flex flex-wrap items-center gap-4 px-4 py-3.5">
          <span className="t-body-sm flex items-center gap-1.5 text-text-mid">
            <CalendarClock className="size-3.5 text-text-lo" aria-hidden />
            Standard shift 10:00 – 18:30 IST
          </span>
          <span className="t-body-sm text-text-mid">
            Capacity {employee.dailyCapacity || 0} visits per day
          </span>
          <span className="t-body-sm text-text-mid">
            {certs.length} certification {certs.length === 1 ? "tag" : "tags"}
          </span>
        </div>
      </Panel>
    </div>
  );
}
