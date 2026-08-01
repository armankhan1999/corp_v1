"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing, Check, FileCheck2, FileWarning, Minus, ShieldCheck } from "lucide-react";
import type { Branch, Employee, EmployeeDocument } from "@/lib/schemas/entities";
import { formatCount, formatDate, formatPercent } from "@/lib/format";
import { Panel, PanelHeader, Overline, Mono } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { DOCUMENT_SET, EXPIRY_NOTICE_DAYS } from "./config";
import { allEmployees, documentFile, type DocFile } from "./derive";
import { usePeopleStore, type Actor } from "./store";
import { AuditTrail, Button, Field, FilteredEmpty, MetricChip, RuleNote, Select, Td, TextInput, Th } from "./ui";

export interface DocumentDashboardProps {
  actor: Actor;
  employees: Employee[];
  branches: Branch[];
  documents: EmployeeDocument[];
  canNotify: boolean;
  nowIso: string;
}

export function DocumentDashboard(props: DocumentDashboardProps) {
  const { overlay, actions } = usePeopleStore(props.actor);
  const now = React.useMemo(() => new Date(props.nowIso), [props.nowIso]);

  const employees = React.useMemo(
    () => allEmployees(props.employees, overlay).filter((e) => e.active),
    [props.employees, overlay],
  );
  const documents = React.useMemo(
    () => [...props.documents, ...overlay.documentsAdded],
    [props.documents, overlay.documentsAdded],
  );

  const files: DocFile[] = React.useMemo(
    () => employees.map((e) => documentFile(e, documents, now)),
    [employees, documents, now],
  );

  const appointmentPresent = files.filter((f) => f.appointmentLetter.present).length;
  const withGaps = files.filter((f) => f.statutoryPct !== 100);
  const expiring60 = files.flatMap((f) => f.slots.filter((s) => s.expiryState === "DUE_60"));
  const expiring30 = files.flatMap((f) => f.slots.filter((s) => s.expiryState === "DUE_30"));
  const expired = files.flatMap((f) =>
    f.slots.filter((s) => s.expiryState === "EXPIRED").map((s) => ({ file: f, slot: s })),
  );

  const [branch, setBranch] = React.useState("ALL");
  const [view, setView] = React.useState<"ALL" | "GAPS" | "EXPIRY">("ALL");
  const [query, setQuery] = React.useState("");

  const filtered = files.filter((f) => {
    if (branch !== "ALL" && f.employee.branchId !== branch) return false;
    if (view === "GAPS" && f.statutoryPct === 100) return false;
    if (view === "EXPIRY" && !f.slots.some((s) => s.expiryState === "EXPIRED" || s.expiryState === "DUE_30" || s.expiryState === "DUE_60")) {
      return false;
    }
    if (query) {
      const q = query.trim().toLowerCase();
      if (!f.employee.name.toLowerCase().includes(q) && !f.employee.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeFilters: string[] = [];
  if (branch !== "ALL") activeFilters.push(`Branch: ${props.branches.find((b) => b.id === branch)?.city}`);
  if (view === "GAPS") activeFilters.push("Statutory gaps only");
  if (view === "EXPIRY") activeFilters.push("Expiring or expired only");
  if (query) activeFilters.push(`Search: “${query}”`);

  function clearFilters() {
    setBranch("ALL");
    setView("ALL");
    setQuery("");
  }

  const docAudit = overlay.audit.filter(
    (a) => a.entityType === "Notification" || a.entityType === "Employee",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <MetricChip
          label="Appointment letters"
          value={`${appointmentPresent}/${files.length}`}
          tone={appointmentPresent === files.length ? "ok" : "danger"}
        />
        <MetricChip
          label="Coverage"
          value={formatPercent(files.length ? (appointmentPresent / files.length) * 100 : 100)}
          tone={appointmentPresent === files.length ? "ok" : "danger"}
        />
        <MetricChip
          label="Records with gaps"
          value={formatCount(withGaps.length)}
          tone={withGaps.length ? "danger" : "ok"}
          onClick={() => setView(view === "GAPS" ? "ALL" : "GAPS")}
          active={view === "GAPS"}
        />
        <MetricChip label="Expiring ≤ 60 days" value={formatCount(expiring60.length)} tone={expiring60.length ? "warn" : "neutral"} />
        <MetricChip label="Expiring ≤ 30 days" value={formatCount(expiring30.length)} tone={expiring30.length ? "warn" : "neutral"} />
        <MetricChip
          label="Expired"
          value={formatCount(expired.length)}
          tone={expired.length ? "danger" : "ok"}
          onClick={() => setView(view === "EXPIRY" ? "ALL" : "EXPIRY")}
          active={view === "EXPIRY"}
        />
      </div>

      <RuleNote title="What counts as complete" tone="neutral" icon={ShieldCheck}>
        Statutory completeness counts only the documents marked{" "}
        <span className="text-text-hi">Required</span> — the appointment letter for every employee,
        and the OEM training certificate for field staff. Recommended documents are shown so a thin
        file is visible, but they do not fail the statutory figure. A document carrying an expiry
        date raises a notice to the document owner and to HR at {EXPIRY_NOTICE_DAYS.join(" and ")}{" "}
        days.
      </RuleNote>

      {expired.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Expired statutory documents"
            sub="Both the 60-day and the 30-day notices have fallen due on these."
            right={<span className="t-heading-md tabular-nums text-danger">{expired.length}</span>}
          />
          <ul className="divide-y divide-[var(--line)]">
            {expired.map(({ file, slot }) => {
              const sent = overlay.notices.filter((n) => n.documentId === (slot.document?.id ?? ""));
              return (
                <li
                  key={`${file.employee.id}-${slot.spec.title}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
                >
                  <FileWarning className="size-4 shrink-0 text-danger" aria-hidden />
                  <Link
                    href={`/people/employees/${file.employee.id}`}
                    className="t-body-sm font-medium text-text-hi hover:underline"
                  >
                    {file.employee.name}
                  </Link>
                  <Mono className="text-[0.6875rem] text-text-lo">{file.employee.code}</Mono>
                  <span className="t-body-sm text-text-mid">{slot.spec.title}</span>
                  <span className="t-body-sm text-danger">
                    Expired {slot.expiresOn ? formatDate(slot.expiresOn) : "—"} ·{" "}
                    {slot.daysToExpiry !== null ? `${Math.abs(slot.daysToExpiry)} days ago` : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {sent.length > 0 ? (
                      <span className="t-body-sm text-ok">Notice sent</span>
                    ) : props.canNotify ? (
                      <Button
                        onClick={() =>
                          actions.notifyExpiry(
                            slot.document?.id ?? `${file.employee.id}-${slot.spec.title}`,
                            file.employee.id,
                            `${file.employee.code} · ${slot.spec.title}`,
                            30,
                          )
                        }
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
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2.5">
          <Field label="Search" className="w-48">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or employee code"
            />
          </Field>
          <Field label="Branch" className="w-40">
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="ALL">All branches</option>
              {props.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="View" className="w-44">
            <Select value={view} onChange={(e) => setView(e.target.value as "ALL" | "GAPS" | "EXPIRY")}>
              <option value="ALL">Every record</option>
              <option value="GAPS">Statutory gaps only</option>
              <option value="EXPIRY">Expiring or expired</option>
            </Select>
          </Field>
          <div className="ml-auto flex items-center gap-2">
            {activeFilters.length ? <Button onClick={clearFilters}>Clear filters</Button> : null}
            <span className="t-body-sm text-text-lo">
              {formatCount(filtered.length)} of {formatCount(files.length)} records
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <FilteredEmpty filters={activeFilters} onClear={clearFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse">
              <caption className="sr-only">Statutory document completeness per employee</caption>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Branch</Th>
                  {DOCUMENT_SET.map((s) => (
                    <Th key={s.title} className="whitespace-normal">
                      {s.title}
                      {s.requirement === "REQUIRED" ? <span className="ml-1 text-danger">*</span> : null}
                    </Th>
                  ))}
                  <Th numeric>Statutory</Th>
                  <Th numeric>Whole file</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.employee.id} className="hover:bg-surface-2">
                    <Td>
                      <Link
                        href={`/people/employees/${f.employee.id}`}
                        className="flex flex-col hover:underline"
                      >
                        <span className="font-medium text-text-hi">{f.employee.name}</span>
                        <span className="t-mono text-[0.6875rem] text-text-lo">{f.employee.code}</span>
                      </Link>
                    </Td>
                    <Td>{props.branches.find((b) => b.id === f.employee.branchId)?.city}</Td>
                    {DOCUMENT_SET.map((spec) => {
                      const slot = f.slots.find((s) => s.spec.title === spec.title);
                      if (!slot) {
                        return (
                          <Td key={spec.title}>
                            <span className="flex items-center gap-1 text-text-lo">
                              <Minus className="size-3.5" aria-hidden />
                              <span className="t-body-sm">n/a</span>
                            </span>
                          </Td>
                        );
                      }
                      const bad = !slot.present && slot.spec.requirement === "REQUIRED";
                      const expiredSlot = slot.expiryState === "EXPIRED";
                      return (
                        <Td key={spec.title}>
                          <span
                            className={cn(
                              "flex items-center gap-1",
                              expiredSlot ? "text-danger" : bad ? "text-danger" : slot.present ? "text-ok" : "text-text-lo",
                            )}
                          >
                            {slot.present ? (
                              expiredSlot ? (
                                <FileWarning className="size-3.5" aria-hidden />
                              ) : (
                                <Check className="size-3.5" aria-hidden />
                              )
                            ) : (
                              <FileWarning className="size-3.5" aria-hidden />
                            )}
                            <span className="t-body-sm">
                              {slot.present ? (expiredSlot ? "Expired" : "Present") : "Missing"}
                            </span>
                          </span>
                        </Td>
                      );
                    })}
                    <Td numeric>
                      <span className={f.statutoryPct === 100 ? "text-ok" : "text-danger"}>
                        {f.statutoryPct}%
                      </span>
                    </Td>
                    <Td numeric>
                      <span className={f.filePct === 100 ? "text-ok" : "text-text-mid"}>{f.filePct}%</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="t-body-sm flex items-center gap-1.5 border-t border-line px-4 py-2 text-text-lo">
          <FileCheck2 className="size-3.5 shrink-0" aria-hidden />
          <span className="text-danger">*</span> Required for statutory completeness. OEM training
          certificates apply to field staff only and read <span className="text-text-mid">n/a</span>{" "}
          for office records.
        </p>
      </Panel>

      <div>
        <Overline>Notices and record changes</Overline>
        <div className="mt-1.5">
          <AuditTrail
            entries={docAudit}
            title="Document audit trail"
            empty="No expiry notice has been sent and no record has been changed in this session."
          />
        </div>
      </div>
    </div>
  );
}
