"use client";

import * as React from "react";
import Link from "next/link";
import { EyeOff, FileWarning, ShieldCheck, UserPlus, Users } from "lucide-react";
import type { Branch, Employee, EmployeeDocument } from "@/lib/schemas/entities";
import type { OEMPrincipal, Role } from "@/lib/schemas/enums";
import { OEM_LABEL } from "@/lib/schemas/enums";
import { formatCount, formatDate, formatPhone } from "@/lib/format";
import { EmptyState, Panel, Overline } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { PRIVACY_STATEMENT } from "./config";
import { allEmployees, documentFile, type DocFile } from "./derive";
import { employeeSearchFields, SEARCH_EXCLUSION_NOTE } from "./search";
import { usePeopleStore, type Actor } from "./store";
import {
  Button,
  Field,
  FilteredEmpty,
  MetricChip,
  Modal,
  RuleNote,
  Select,
  Td,
  TextInput,
  Th,
} from "./ui";

const OEM_OPTIONS: OEMPrincipal[] = ["ELGI", "ATS_ELGI", "KSB", "ION_EXCHANGE", "OTHER"];
const EMPLOYMENT_TYPES = ["PERMANENT", "FIXED_TERM", "PROBATION", "CONTRACT"] as const;

export interface EmployeeRegisterProps {
  actor: Actor;
  employees: Employee[];
  branches: Branch[];
  documents: EmployeeDocument[];
  departments: string[];
  personalVisible: boolean;
  canCreate: boolean;
  hrHolders: Role[];
  nowIso: string;
}

export function EmployeeRegister(props: EmployeeRegisterProps) {
  const { overlay, actions } = usePeopleStore(props.actor);
  const now = React.useMemo(() => new Date(props.nowIso), [props.nowIso]);

  const employees = React.useMemo(
    () => allEmployees(props.employees, overlay),
    [props.employees, overlay],
  );
  const documents = React.useMemo(
    () => [...props.documents, ...overlay.documentsAdded],
    [props.documents, overlay.documentsAdded],
  );

  const files = React.useMemo(() => {
    const map = new Map<string, DocFile>();
    for (const e of employees) map.set(e.id, documentFile(e, documents, now));
    return map;
  }, [employees, documents, now]);

  const [query, setQuery] = React.useState("");
  const [branch, setBranch] = React.useState("ALL");
  const [dept, setDept] = React.useState("ALL");
  const [employment, setEmployment] = React.useState("ALL");
  const [location, setLocation] = React.useState("ALL");
  const [cert, setCert] = React.useState("ALL");
  const [docState, setDocState] = React.useState("ALL");

  const filtered = employees.filter((e) => {
    if (!e.active) return false;
    if (branch !== "ALL" && e.branchId !== branch) return false;
    if (dept !== "ALL" && e.department !== dept) return false;
    if (employment !== "ALL" && e.employmentType !== employment) return false;
    if (location !== "ALL" && e.workLocationType !== location) return false;
    if (cert !== "ALL" && !e.oemCertifications.includes(cert as OEMPrincipal)) return false;
    if (docState === "GAPS" && files.get(e.id)!.statutoryPct === 100) return false;
    if (docState === "COMPLETE" && files.get(e.id)!.statutoryPct !== 100) return false;
    if (query && !employeeSearchFields(e, props.personalVisible).includes(query.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  const activeFilters: string[] = [];
  if (query) activeFilters.push(`Search: “${query}”`);
  if (branch !== "ALL") activeFilters.push(`Branch: ${props.branches.find((b) => b.id === branch)?.city}`);
  if (dept !== "ALL") activeFilters.push(`Department: ${dept}`);
  if (employment !== "ALL") activeFilters.push(`Employment: ${employment}`);
  if (location !== "ALL") activeFilters.push(`Work location: ${location}`);
  if (cert !== "ALL") activeFilters.push(`Certification: ${OEM_LABEL[cert as OEMPrincipal]}`);
  if (docState !== "ALL") activeFilters.push(`Documents: ${docState === "GAPS" ? "with gaps" : "complete"}`);

  function clearFilters() {
    setQuery("");
    setBranch("ALL");
    setDept("ALL");
    setEmployment("ALL");
    setLocation("ALL");
    setCert("ALL");
    setDocState("ALL");
  }

  const gaps = employees.filter((e) => e.active && files.get(e.id)!.statutoryPct !== 100).length;
  const fieldCount = employees.filter((e) => e.active && e.workLocationType === "FIELD").length;

  /* ------------------------------------------------------- create record */
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <MetricChip label="On register" value={formatCount(employees.filter((e) => e.active).length)} />
        <MetricChip label="Field staff" value={formatCount(fieldCount)} tone="info" />
        <MetricChip
          label="Statutory gaps"
          value={formatCount(gaps)}
          tone={gaps ? "danger" : "ok"}
          onClick={() => setDocState(docState === "GAPS" ? "ALL" : "GAPS")}
          active={docState === "GAPS"}
        />
        <MetricChip label="Branches" value={formatCount(props.branches.length)} />
      </div>

      <RuleNote title="Personal data handling" tone="neutral" icon={props.personalVisible ? ShieldCheck : EyeOff}>
        {PRIVACY_STATEMENT}{" "}
        {props.personalVisible ? (
          <>
            Your role holds <span className="t-mono text-text-hi">hrDocuments</span>, so contact
            details, emergency contacts and masked statutory identifiers are visible on the record.
          </>
        ) : (
          <>
            Your role does not hold <span className="t-mono text-text-hi">hrDocuments</span>. This
            register shows organisational fields only; contact details, emergency contacts,
            statutory identifiers and the document file are withheld, and{" "}
            {SEARCH_EXCLUSION_NOTE.toLowerCase()}
          </>
        )}
      </RuleNote>

      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2.5">
          <Field label="Search" className="w-52">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={props.personalVisible ? "Name, code, designation, contact" : "Name, code, designation"}
            />
          </Field>
          <Field label="Branch" className="w-36">
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="ALL">All branches</option>
              {props.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" className="w-40">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="ALL">All departments</option>
              {props.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Employment" className="w-36">
            <Select value={employment} onChange={(e) => setEmployment(e.target.value)}>
              <option value="ALL">All types</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Work location" className="w-32">
            <Select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="ALL">All</option>
              <option value="OFFICE">Office</option>
              <option value="FIELD">Field</option>
            </Select>
          </Field>
          <Field label="OEM certification" className="w-40">
            <Select value={cert} onChange={(e) => setCert(e.target.value)}>
              <option value="ALL">Any</option>
              {OEM_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {OEM_LABEL[o]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="ml-auto flex items-center gap-2">
            {activeFilters.length > 0 ? <Button onClick={clearFilters}>Clear filters</Button> : null}
            <Link
              href="/people/documents"
              className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <FileWarning className="size-3.5" aria-hidden />
              Document dashboard
            </Link>
            {props.canCreate ? (
              <Button tone="primary" onClick={() => setOpen(true)}>
                <UserPlus className="size-3.5" aria-hidden />
                New employee
              </Button>
            ) : null}
          </div>
        </div>

        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees on the register"
            body="The employee register is the spine of attendance, leave and payroll input. Add the first record to begin."
            action={props.canCreate ? <Button tone="primary" onClick={() => setOpen(true)}>New employee</Button> : undefined}
          />
        ) : filtered.length === 0 ? (
          <FilteredEmpty filters={activeFilters} onClear={clearFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] border-collapse">
              <caption className="sr-only">Employee register</caption>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Designation</Th>
                  <Th>Department</Th>
                  <Th>Branch</Th>
                  <Th>Employment</Th>
                  <Th>Work location</Th>
                  <Th numeric>Joined</Th>
                  <Th>OEM certifications</Th>
                  <Th>Statutory file</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const file = files.get(e.id)!;
                  return (
                    <tr key={e.id} className="hover:bg-surface-2">
                      <Td>
                        <Link
                          href={`/people/employees/${e.id}`}
                          className="t-mono text-text-hi hover:underline"
                        >
                          {e.code}
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/people/employees/${e.id}`}
                          className="font-medium text-text-hi hover:underline"
                        >
                          {e.name}
                        </Link>
                        {props.personalVisible ? (
                          <span className="t-mono ml-2 text-[0.6875rem] text-text-lo">
                            {formatPhone(e.phone)}
                          </span>
                        ) : null}
                      </Td>
                      <Td>{e.designation}</Td>
                      <Td>{e.department}</Td>
                      <Td>{props.branches.find((b) => b.id === e.branchId)?.city ?? e.branchId}</Td>
                      <Td>{e.employmentType.replace(/_/g, " ").toLowerCase()}</Td>
                      <Td>
                        <span
                          className={cn(
                            "t-overline rounded-md border px-1.5 py-0.5",
                            e.workLocationType === "FIELD"
                              ? "border-info/40 bg-info-bg text-info"
                              : "border-line bg-surface-2 text-text-mid",
                          )}
                        >
                          {e.workLocationType === "FIELD" ? "Field" : "Office"}
                        </span>
                      </Td>
                      <Td numeric>{formatDate(e.dateOfJoining)}</Td>
                      <Td>
                        {e.oemCertifications.length ? (
                          <span className="flex flex-wrap gap-1">
                            {e.oemCertifications.map((c) => (
                              <span
                                key={c}
                                className="t-overline rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid"
                              >
                                {OEM_LABEL[c]}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-text-lo">—</span>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            "t-overline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                            file.statutoryPct === 100
                              ? "border-ok/40 bg-ok-bg text-ok"
                              : "border-danger/40 bg-danger-bg text-danger",
                          )}
                        >
                          {file.statutoryPct === 100 ? (
                            <ShieldCheck className="size-3" aria-hidden />
                          ) : (
                            <FileWarning className="size-3" aria-hidden />
                          )}
                          {file.requiredPresent}/{file.requiredTotal} required
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

      {props.canCreate ? (
        <NewEmployeeModal
          open={open}
          onClose={() => setOpen(false)}
          branches={props.branches}
          departments={props.departments}
          employees={employees}
          onCreate={(employee, docs) => {
            actions.addEmployee(employee, docs);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ create form */

function NewEmployeeModal({
  open,
  onClose,
  branches,
  departments,
  employees,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  departments: string[];
  employees: Employee[];
  onCreate: (employee: Employee, documents: EmployeeDocument[]) => void;
}) {
  const nextCode = React.useMemo(() => {
    const max = employees.reduce((m, e) => {
      const n = Number(e.code.replace(/\D/g, ""));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `BC${String(max + 1).padStart(3, "0")}`;
  }, [employees]);

  const [form, setForm] = React.useState({
    name: "",
    designation: "",
    department: departments[0] ?? "Service",
    branchId: branches[0]?.id ?? "",
    reportingManagerId: "",
    dateOfJoining: "",
    employmentType: "PERMANENT" as (typeof EMPLOYMENT_TYPES)[number],
    workLocationType: "OFFICE" as "OFFICE" | "FIELD",
    phone: "",
    email: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    pfLast4: "",
    esicLast4: "",
    uanLast4: "",
    dailyCapacity: "0",
    certs: [] as OEMPrincipal[],
    appointmentLetter: true,
  });
  const [touched, setTouched] = React.useState(false);

  const errors = {
    name: form.name.trim().length < 3 ? "Full name is required." : null,
    designation: form.designation.trim().length < 3 ? "Designation is required." : null,
    dateOfJoining: !form.dateOfJoining ? "Date of joining is required." : null,
    phone: !/^\d{10}$/.test(form.phone.replace(/\D/g, "")) ? "A 10-digit mobile number is required." : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "A valid email address is required." : null,
    emergencyContactName: form.emergencyContactName.trim().length < 3 ? "Emergency contact name is required." : null,
    emergencyContactPhone: !/^\d{10}$/.test(form.emergencyContactPhone.replace(/\D/g, ""))
      ? "A 10-digit emergency contact number is required."
      : null,
  };
  const valid = Object.values(errors).every((e) => e === null);

  function submit() {
    setTouched(true);
    if (!valid) return;
    const id = `EMP-NEW-${Date.now().toString(36).toUpperCase()}`;
    const doj = new Date(`${form.dateOfJoining}T00:00:00`).toISOString();
    const employee: Employee = {
      id,
      code: nextCode,
      name: form.name.trim(),
      designation: form.designation.trim(),
      department: form.department,
      branchId: form.branchId,
      reportingManagerId: form.reportingManagerId || null,
      dateOfJoining: doj,
      employmentType: form.employmentType,
      workLocationType: form.workLocationType,
      phone: form.phone.replace(/\D/g, ""),
      email: form.email.trim(),
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactPhone: form.emergencyContactPhone.replace(/\D/g, ""),
      pfNumberMasked: form.pfLast4 ? `BR/PAT/••••${form.pfLast4}` : "Not on record",
      esicNumberMasked: form.esicLast4 ? `••••••${form.esicLast4}` : "Not on record",
      uanMasked: form.uanLast4 ? `1002••••${form.uanLast4}` : "Not on record",
      oemCertifications: form.certs,
      dailyCapacity: Number(form.dailyCapacity) || 0,
      active: true,
    };
    const documents: EmployeeDocument[] = form.appointmentLetter
      ? [
          {
            id: `EMD-NEW-${Date.now().toString(36).toUpperCase()}`,
            employeeId: id,
            type: "APPOINTMENT_LETTER",
            title: "Appointment Letter",
            issuedOn: doj,
            expiresOn: null,
            documentId: null,
          },
        ]
      : [];
    onCreate(employee, documents);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New employee record"
      sub="Every field below is captured on submission; masked statutory identifiers store only the last four digits."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={submit} disabled={!valid}>
            Create record
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Employee code">
          <TextInput value={nextCode} readOnly className="t-mono" />
        </Field>
        <Field label="Full name" required error={touched ? errors.name : null}>
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Designation" required error={touched ? errors.designation : null}>
          <TextInput
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="e.g. Field Service Engineer"
          />
        </Field>
        <Field label="Department" required>
          <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Branch" required>
          <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reporting manager">
          <Select
            value={form.reportingManagerId}
            onChange={(e) => setForm({ ...form, reportingManagerId: e.target.value })}
          >
            <option value="">Not assigned</option>
            {employees
              .filter((e) => e.branchId === form.branchId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.designation}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Date of joining" required error={touched ? errors.dateOfJoining : null}>
          <TextInput
            type="date"
            value={form.dateOfJoining}
            onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
          />
        </Field>
        <Field label="Employment type" required>
          <Select
            value={form.employmentType}
            onChange={(e) =>
              setForm({ ...form, employmentType: e.target.value as (typeof EMPLOYMENT_TYPES)[number] })
            }
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Work location type" required>
          <Select
            value={form.workLocationType}
            onChange={(e) => setForm({ ...form, workLocationType: e.target.value as "OFFICE" | "FIELD" })}
          >
            <option value="OFFICE">Office</option>
            <option value="FIELD">Field</option>
          </Select>
        </Field>
        <Field label="Daily visit capacity" hint="Field staff only — drives dispatch load.">
          <TextInput
            type="number"
            min={0}
            max={8}
            value={form.dailyCapacity}
            onChange={(e) => setForm({ ...form, dailyCapacity: e.target.value })}
          />
        </Field>
        <Field label="Mobile" required error={touched ? errors.phone : null}>
          <TextInput
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="10 digits"
          />
        </Field>
        <Field label="Email" required error={touched ? errors.email : null}>
          <TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Emergency contact name" required error={touched ? errors.emergencyContactName : null}>
          <TextInput
            value={form.emergencyContactName}
            onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
          />
        </Field>
        <Field label="Emergency contact number" required error={touched ? errors.emergencyContactPhone : null}>
          <TextInput
            value={form.emergencyContactPhone}
            onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
          />
        </Field>
        <Field label="EPF number — last 4" hint="Stored masked; the full number is never held.">
          <TextInput
            maxLength={4}
            value={form.pfLast4}
            onChange={(e) => setForm({ ...form, pfLast4: e.target.value.replace(/\D/g, "") })}
            className="t-mono"
          />
        </Field>
        <Field label="ESIC number — last 5" hint="Stored masked.">
          <TextInput
            maxLength={5}
            value={form.esicLast4}
            onChange={(e) => setForm({ ...form, esicLast4: e.target.value.replace(/\D/g, "") })}
            className="t-mono"
          />
        </Field>
        <Field label="UAN — last 4" hint="Stored masked.">
          <TextInput
            maxLength={4}
            value={form.uanLast4}
            onChange={(e) => setForm({ ...form, uanLast4: e.target.value.replace(/\D/g, "") })}
            className="t-mono"
          />
        </Field>
      </div>

      {form.workLocationType === "FIELD" ? (
        <div className="mt-4">
          <Overline>OEM certification tags</Overline>
          <p className="t-body-sm mt-0.5 text-text-lo">
            These tags drive skill-based assignment on the dispatch board.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OEM_OPTIONS.map((o) => {
              const on = form.certs.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      certs: on ? form.certs.filter((c) => c !== o) : [...form.certs, o],
                    })
                  }
                  className={cn(
                    "t-body-sm rounded-md border px-2.5 py-1",
                    on
                      ? "border-primary-500 bg-primary-100 text-text-hi"
                      : "border-line text-text-mid hover:border-line-strong",
                  )}
                >
                  {OEM_LABEL[o]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <RuleNote title="Appointment letter is required" tone="warn" icon={FileWarning}>
          The appointment letter is the one statutory document every record must carry. Leaving it
          off creates a visible gap on the document dashboard until it is filed.
        </RuleNote>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.appointmentLetter}
            onChange={(e) => setForm({ ...form, appointmentLetter: e.target.checked })}
            className="size-4 accent-[var(--primary-600)]"
          />
          <span className="t-body-sm text-text-mid">Appointment letter is on file</span>
        </label>
      </div>
    </Modal>
  );
}
