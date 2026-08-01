"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type {
  AttendanceRecord,
  Employee,
  EmployeeDocument,
  Holiday,
  LeaveRequest,
} from "@/lib/schemas/entities";
import type { AttendanceState, OEMPrincipal, Role } from "@/lib/schemas/enums";
import {
  EMPTY_OVERLAY,
  dayKey,
  type AttendancePatch,
  type AuditEntry,
  type LeaveDecision,
  type PayrollExport,
  type PeopleOverlay,
} from "./derive";

/**
 * AR-5 / AR-9 — every E9 mutation lands in one versioned localStorage overlay
 * and writes one audit entry through `push`. The seed object is never touched;
 * a reset restores the seeded world exactly.
 */

const STORAGE_KEY = "pravaah.v1.people";
const SCHEMA_VERSION = 1;

interface Snapshot {
  overlay: PeopleOverlay;
  hydrated: boolean;
}

const SERVER_SNAPSHOT: Snapshot = { overlay: EMPTY_OVERLAY, hydrated: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let hydrateStarted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

function persist(overlay: PeopleOverlay) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    /* storage unavailable — the session simply does not survive a reload */
  }
}

function hydrate() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  let overlay = EMPTY_OVERLAY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PeopleOverlay>;
      // AR-5 — a schema-version mismatch resets cleanly rather than throwing.
      if (parsed && parsed.v === SCHEMA_VERSION) {
        overlay = { ...EMPTY_OVERLAY, ...parsed, v: SCHEMA_VERSION };
      }
    }
  } catch {
    overlay = EMPTY_OVERLAY;
  }
  snapshot = { overlay, hydrated: true };
  emit();
}

function commit(next: PeopleOverlay) {
  snapshot = { overlay: next, hydrated: true };
  persist(next);
  emit();
}

export function resetPeopleOverlay() {
  commit(EMPTY_OVERLAY);
}

export interface Actor {
  userId: string;
  name: string;
  role: Role;
  branchId: string;
  employeeId: string | null;
}

let auditCounter = 0;
function auditId(): string {
  auditCounter += 1;
  return `PAU-${Date.now().toString(36).toUpperCase()}-${String(auditCounter).padStart(3, "0")}`;
}

function withAudit(
  overlay: PeopleOverlay,
  actor: Actor,
  entry: Omit<AuditEntry, "id" | "at" | "actorUserId" | "actorName" | "actorRole">,
): PeopleOverlay {
  const audit: AuditEntry = {
    id: auditId(),
    at: new Date().toISOString(),
    actorUserId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    ...entry,
  };
  return { ...overlay, audit: [audit, ...overlay.audit] };
}

export interface CheckInPayload {
  employee: Employee;
  key: string;
  mode: "OFFICE" | "FIELD";
  lat: number | null;
  lng: number | null;
  placeLabel: string | null;
  jobCardId: string | null;
  selfieCaptured: boolean;
  geofenceBreachKm: number | null;
  deviceLabel: string;
  minutesOfDay: number;
}

function recordAt(key: string, minutes: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  dt.setMinutes(minutes);
  return dt.toISOString();
}

function dayAnchor(key: string): string {
  return recordAt(key, 0);
}

export function usePeopleStore(actor: Actor) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    hydrate();
  }, []);

  const update = useCallback((fn: (prev: PeopleOverlay) => PeopleOverlay) => {
    commit(fn(snapshot.overlay));
  }, []);

  const actions = useMemo(
    () => ({
      /* ------------------------------------------------ E9-S3 regularise */
      regularise(record: AttendanceRecord, state: AttendanceState, reason: string) {
        update((prev) => {
          const patch: AttendancePatch = {
            state,
            reason,
            byUserId: actor.userId,
            byName: actor.name,
            byRole: actor.role,
            at: new Date().toISOString(),
            original: record,
          };
          const next: PeopleOverlay = {
            ...prev,
            patches: { ...prev.patches, [record.id]: patch },
          };
          return withAudit(next, actor, {
            action: "UPDATE",
            entityType: "AttendanceRecord",
            entityId: record.id,
            entityLabel: `${record.employeeId} · ${dayKey(record.date)}`,
            summary: `Attendance regularised to ${state}. Reason: ${reason}`,
            before: record.state,
            after: state,
          });
        });
      },

      undoRegularisation(recordId: string) {
        update((prev) => {
          const patch = prev.patches[recordId];
          if (!patch) return prev;
          const patches = { ...prev.patches };
          delete patches[recordId];
          return withAudit({ ...prev, patches }, actor, {
            action: "UPDATE",
            entityType: "AttendanceRecord",
            entityId: recordId,
            entityLabel: recordId,
            summary: "Regularisation withdrawn; the original record stands.",
            before: patch.state,
            after: patch.original.state,
          });
        });
      },

      /* -------------------------------------------------- E9-S2 capture */
      checkIn(payload: CheckInPayload) {
        update((prev) => {
          const record: AttendanceRecord = {
            id: `ATT-APP-${payload.key}-${payload.employee.id}`,
            employeeId: payload.employee.id,
            date: dayAnchor(payload.key),
            state: payload.mode === "FIELD" ? "ON_FIELD" : "PRESENT",
            checkInAt: recordAt(payload.key, payload.minutesOfDay),
            checkOutAt: null,
            lat: payload.lat,
            lng: payload.lng,
            placeLabel: payload.placeLabel,
            jobCardId: payload.jobCardId,
            source: "APP",
            selfieCaptured: payload.selfieCaptured,
            geofenceBreachKm: payload.geofenceBreachKm,
            lateMark: false,
            missingCheckOut: false,
            regularisedByUserId: null,
            regularisationReason: null,
            originalState: null,
          };
          const created = [...prev.created.filter((r) => r.id !== record.id), record];
          return withAudit({ ...prev, created }, actor, {
            action: "CREATE",
            entityType: "AttendanceRecord",
            entityId: record.id,
            entityLabel: `${payload.employee.code} · ${payload.key}`,
            summary:
              payload.mode === "FIELD"
                ? `Field check-in at ${payload.placeLabel ?? "unmapped location"}${payload.jobCardId ? ` linked to ${payload.jobCardId}` : ""}${payload.geofenceBreachKm !== null ? ` — ${payload.geofenceBreachKm} km outside the geofence` : ""}`
                : `Office check-in recorded from ${payload.deviceLabel}`,
            before: null,
            after: record.state,
          });
        });
      },

      checkOut(record: AttendanceRecord, minutes: number) {
        update((prev) => {
          const updated: AttendanceRecord = {
            ...record,
            id: record.id.startsWith("ATT-APP-") ? record.id : `ATT-APP-${dayKey(record.date)}-${record.employeeId}`,
            checkOutAt: recordAt(dayKey(record.date), minutes),
            missingCheckOut: false,
          };
          const created = [...prev.created.filter((r) => r.id !== updated.id), updated];
          return withAudit({ ...prev, created }, actor, {
            action: "UPDATE",
            entityType: "AttendanceRecord",
            entityId: updated.id,
            entityLabel: `${record.employeeId} · ${dayKey(record.date)}`,
            summary: "Check-out recorded from the mobile app.",
            before: "no check-out",
            after: recordAt(dayKey(record.date), minutes),
          });
        });
      },

      /** E9-S2 — simulated biometric device batch (Demo Controls, INT-10). */
      injectDeviceBatch(employees: Employee[], key: string, deviceLabel: string) {
        update((prev) => {
          const records: AttendanceRecord[] = employees.map((e, i) => ({
            id: `ATT-DEV-${key}-${e.id}`,
            employeeId: e.id,
            date: dayAnchor(key),
            state: "PRESENT",
            checkInAt: recordAt(key, 9 * 60 + 44 + (i % 26)),
            checkOutAt: recordAt(key, 18 * 60 + 32 + (i % 31)),
            lat: null,
            lng: null,
            placeLabel: deviceLabel,
            jobCardId: null,
            source: "DEVICE",
            selfieCaptured: false,
            geofenceBreachKm: null,
            lateMark: false,
            missingCheckOut: false,
            regularisedByUserId: null,
            regularisationReason: null,
            originalState: null,
          }));
          const ids = records.map((r) => r.id);
          const created = [...prev.created.filter((r) => !ids.includes(r.id)), ...records];
          const simulatedIds = [...new Set([...prev.simulatedIds, ...ids])];
          return withAudit({ ...prev, created, simulatedIds }, actor, {
            action: "SIMULATED_INTEGRATION",
            entityType: "AttendanceRecord",
            entityId: key,
            entityLabel: `${deviceLabel} · ${key}`,
            summary: `Simulated biometric device batch injected — ${records.length} device-sourced records.`,
            before: null,
            after: `${records.length} records`,
          });
        });
      },

      /* ----------------------------------------------------- E9-S4 leave */
      submitLeave(request: LeaveRequest, coverageWarning: string | null, routedTo: string) {
        update((prev) => {
          const next: PeopleOverlay = {
            ...prev,
            leaveRequests: [{ ...request, coverageWarning }, ...prev.leaveRequests],
          };
          return withAudit(next, actor, {
            action: "CREATE",
            entityType: "LeaveRequest",
            entityId: request.id,
            entityLabel: request.number,
            summary: `Leave requested (${request.days} ${request.days === 1 ? "day" : "days"}) and routed to ${routedTo}${coverageWarning ? " with a coverage warning" : ""}.`,
            before: null,
            after: "PENDING",
          });
        });
      },

      decideLeave(request: LeaveRequest, decision: LeaveDecision) {
        update((prev) => {
          const next: PeopleOverlay = {
            ...prev,
            leaveDecisions: { ...prev.leaveDecisions, [request.id]: decision },
          };
          return withAudit(next, actor, {
            action: decision.status === "APPROVED" ? "APPROVE" : "REJECT",
            entityType: "LeaveRequest",
            entityId: request.id,
            entityLabel: request.number,
            summary: `${decision.status === "APPROVED" ? "Approved" : "Rejected"}${decision.coverageAcknowledged ? " with the coverage shortfall acknowledged" : ""}. ${decision.note}`.trim(),
            before: request.status,
            after: decision.status,
          });
        });
      },

      /* -------------------------------------------------- X-16g holidays */
      addHoliday(holiday: Holiday, branchLabel: string) {
        update((prev) =>
          withAudit({ ...prev, holidaysAdded: [...prev.holidaysAdded, holiday] }, actor, {
            action: "CREATE",
            entityType: "Holiday",
            entityId: holiday.id,
            entityLabel: holiday.name,
            summary: `Holiday added to the ${branchLabel} calendar for ${dayKey(holiday.date)}.`,
            before: null,
            after: holiday.name,
          }),
        );
      },

      removeHoliday(holiday: Holiday, branchLabel: string) {
        update((prev) =>
          withAudit(
            {
              ...prev,
              holidaysRemoved: [...prev.holidaysRemoved, holiday.id],
              holidaysAdded: prev.holidaysAdded.filter((h) => h.id !== holiday.id),
            },
            actor,
            {
              action: "DELETE",
              entityType: "Holiday",
              entityId: holiday.id,
              entityLabel: holiday.name,
              summary: `Holiday removed from the ${branchLabel} calendar (${dayKey(holiday.date)}).`,
              before: holiday.name,
              after: null,
            },
          ),
        );
      },

      /* -------------------------------------------------- E9-S5 payroll */
      recordExport(exportRow: PayrollExport) {
        update((prev) =>
          withAudit({ ...prev, exports: [exportRow, ...prev.exports] }, actor, {
            action: "EXPORT",
            entityType: "PayrollInput",
            entityId: exportRow.id,
            entityLabel: exportRow.filename,
            summary: `Payroll input exported for ${exportRow.month} — ${exportRow.employees} employees, ${exportRow.rows} rows, ${exportRow.unregularisedExceptions} unregularised exceptions at the time of export.`,
            before: null,
            after: exportRow.filename,
          }),
        );
      },

      /* ------------------------------------------------ E9-S1 documents */
      notifyExpiry(documentId: string, employeeId: string, label: string, threshold: number) {
        update((prev) =>
          withAudit(
            {
              ...prev,
              notices: [
                {
                  id: `EXN-${Date.now().toString(36)}`,
                  documentId,
                  employeeId,
                  threshold,
                  at: new Date().toISOString(),
                  recipients: ["Document owner", "HR & Admin"],
                },
                ...prev.notices,
              ],
            },
            actor,
            {
              action: "CREATE",
              entityType: "Notification",
              entityId: documentId,
              entityLabel: label,
              summary: `${threshold}-day expiry notice sent to the document owner and HR & Admin.`,
              before: null,
              after: `${threshold}-day notice`,
            },
          ),
        );
      },

      addEmployee(employee: Employee, documents: EmployeeDocument[]) {
        update((prev) =>
          withAudit(
            {
              ...prev,
              employees: [...prev.employees, employee],
              documentsAdded: [...prev.documentsAdded, ...documents],
            },
            actor,
            {
              action: "CREATE",
              entityType: "Employee",
              entityId: employee.id,
              entityLabel: `${employee.code} · ${employee.name}`,
              summary: `Employee record created — ${employee.designation}, ${employee.department}.`,
              before: null,
              after: employee.code,
            },
          ),
        );
      },

      setCertifications(employee: Employee, certifications: OEMPrincipal[]) {
        update((prev) =>
          withAudit(
            { ...prev, certifications: { ...prev.certifications, [employee.id]: certifications } },
            actor,
            {
              action: "UPDATE",
              entityType: "Employee",
              entityId: employee.id,
              entityLabel: `${employee.code} · ${employee.name}`,
              summary: "OEM certification tags updated; skill-based dispatch eligibility recalculated.",
              before: employee.oemCertifications.join(", ") || "none",
              after: certifications.join(", ") || "none",
            },
          ),
        );
      },

      /* ------------------------------ E9-S1 denial is itself audit-logged */
      logDenial(what: string, entityId: string, entityLabel: string) {
        update((prev) => {
          const already = prev.audit.some(
            (a) => a.action === "ACCESS_DENIED" && a.entityId === entityId && a.summary === what,
          );
          if (already) return prev;
          return withAudit(prev, actor, {
            action: "ACCESS_DENIED",
            entityType: "Employee",
            entityId,
            entityLabel,
            summary: what,
            before: null,
            after: null,
          });
        });
      },
    }),
    [actor, update],
  );

  return { overlay: state.overlay, hydrated: state.hydrated, actions };
}

export type PeopleActions = ReturnType<typeof usePeopleStore>["actions"];
