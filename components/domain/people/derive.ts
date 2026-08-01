import type {
  AttendanceRecord,
  Branch,
  Employee,
  EmployeeDocument,
  Holiday,
  JobCard,
  LeaveRequest,
  LeaveType,
  Site,
} from "@/lib/schemas/entities";
import type { AttendanceState, OEMPrincipal, Role } from "@/lib/schemas/enums";
import {
  DOCUMENT_SET,
  EXPIRY_NOTICE_DAYS,
  GEOFENCE_RADIUS_KM,
  MIN_FIELD_ENGINEERS,
  SHIFT,
  UTILISATION_BAND,
  UTILISATION_COMPLETENESS_FLOOR,
  type DocSpec,
} from "./config";

/**
 * E9 derivations. Everything the HR surfaces display is computed here once and
 * imported by both the server pages and the client boards, so the attendance
 * board, the payroll input and the utilisation view can never disagree.
 *
 * The one place this module reaches past the seed is the wall-clock
 * normalisation below; the reason is documented against `wallClock`.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/* --------------------------------------------------------------- day keys */

/** Local calendar key — YYYY-MM-DD. Never slice an ISO string; that is UTC. */
export function dayKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKey(value: string | Date): string {
  return dayKey(value).slice(0, 7);
}

export function startOfLocalDay(value: string | Date): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function addDaysKey(key: string, days: number): string {
  const d = dayKeyToDate(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** Every calendar day key in a month, e.g. "2026-07". */
export function daysInMonthKeys(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  const d = new Date(y!, (m ?? 1) - 1, 1);
  while (d.getMonth() === (m ?? 1) - 1) {
    out.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* ------------------------------------------------------------- wall clock */

/**
 * The attendance seed anchors each record's `date` at the roster-day anchor and
 * stores the clock as an offset from it, so `checkInAt − date` is the intended
 * time of day. Rendering the raw instant would put a morning check-in at 19:03.
 * This restores the wall-clock reading: day midnight + the stored offset.
 *
 * Records this epic writes use the same convention (`date` = local midnight),
 * so for those the transform is the identity and one rule covers both.
 */
export function wallClock(record: AttendanceRecord, iso: string | null): Date | null {
  if (!iso) return null;
  const anchor = new Date(record.date).getTime();
  const offset = new Date(iso).getTime() - anchor;
  return new Date(startOfLocalDay(record.date).getTime() + offset);
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function lateMinutesOf(checkIn: Date | null): number {
  if (!checkIn) return 0;
  const over = minutesOfDay(checkIn) - (SHIFT.startMinutes + SHIFT.graceMinutes);
  return over > 0 ? over : 0;
}

/* -------------------------------------------------------------- geography */

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

/** INT-11 simulated reverse geocode — nearest known site or branch, never a live call. */
export function reverseGeocode(
  point: { lat: number; lng: number },
  sites: Site[],
  branches: Branch[],
): string {
  let best: { label: string; km: number } | null = null;
  for (const s of sites) {
    const km = haversineKm(point, s);
    if (!best || km < best.km) best = { label: `${s.name}, ${s.district}`, km };
  }
  for (const b of branches) {
    const km = haversineKm(point, b);
    if (!best || km < best.km) best = { label: `${b.name} Branch, ${b.city}`, km };
  }
  if (!best) return "Unmapped location, Bihar";
  return best.km <= 3 ? best.label : `Near ${best.label} (${best.km} km)`;
}

/* ----------------------------------------------------------------- people */

export const FIELD_ENGINEER_DESIGNATION = "Field Service Engineer";

export function isFieldEngineer(e: Employee): boolean {
  return e.designation === FIELD_ENGINEER_DESIGNATION;
}

export function fieldEngineersOf(employees: Employee[], branchId?: string): Employee[] {
  return employees.filter(
    (e) => e.active && isFieldEngineer(e) && (!branchId || e.branchId === branchId),
  );
}

/* ---------------------------------------------------------------- overlay */

export interface AttendancePatch {
  /** Corrected state. */
  state: AttendanceState;
  reason: string;
  byUserId: string;
  byName: string;
  byRole: Role;
  at: string;
  /** The record exactly as it stood before correction — retained, never overwritten. */
  original: AttendanceRecord;
}

export interface LeaveDecision {
  status: "APPROVED" | "REJECTED";
  byUserId: string;
  byName: string;
  byRole: Role;
  at: string;
  note: string;
  /** E9-S4 — an approval over a coverage shortfall must carry the acknowledgement. */
  coverageAcknowledged: boolean;
}

export interface PayrollExport {
  id: string;
  month: string;
  rows: number;
  employees: number;
  generatedAt: string;
  byUserId: string;
  byName: string;
  unregularisedExceptions: number;
  filename: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorUserId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
}

export interface ExpiryNotice {
  id: string;
  documentId: string;
  employeeId: string;
  threshold: number;
  at: string;
  recipients: string[];
}

export interface PeopleOverlay {
  v: 1;
  /** Records created in-session: app check-ins, check-outs, device batches. */
  created: AttendanceRecord[];
  /** Regularisations keyed by attendance record id. */
  patches: Record<string, AttendancePatch>;
  /** Attendance ids injected by the simulated biometric batch. */
  simulatedIds: string[];
  employees: Employee[];
  leaveRequests: LeaveRequest[];
  leaveDecisions: Record<string, LeaveDecision>;
  holidaysAdded: Holiday[];
  holidaysRemoved: string[];
  exports: PayrollExport[];
  notices: ExpiryNotice[];
  audit: AuditEntry[];
  documentsAdded: EmployeeDocument[];
  certifications: Record<string, OEMPrincipal[]>;
}

export const EMPTY_OVERLAY: PeopleOverlay = {
  v: 1,
  created: [],
  patches: {},
  simulatedIds: [],
  employees: [],
  leaveRequests: [],
  leaveDecisions: {},
  holidaysAdded: [],
  holidaysRemoved: [],
  exports: [],
  notices: [],
  audit: [],
  documentsAdded: [],
  certifications: {},
};

/** Seed employees plus any added in-session, with in-session certification edits applied. */
export function allEmployees(seeded: Employee[], overlay: PeopleOverlay): Employee[] {
  const merged = [...seeded, ...overlay.employees];
  return merged.map((e) =>
    overlay.certifications[e.id]
      ? { ...e, oemCertifications: overlay.certifications[e.id]! }
      : e,
  );
}

export function allHolidays(seeded: Holiday[], extra: Holiday[], overlay: PeopleOverlay): Holiday[] {
  const removed = new Set(overlay.holidaysRemoved);
  return [...seeded, ...extra, ...overlay.holidaysAdded].filter((h) => !removed.has(h.id));
}

export function allLeaveRequests(seeded: LeaveRequest[], overlay: PeopleOverlay): LeaveRequest[] {
  const merged = [...seeded, ...overlay.leaveRequests];
  return merged.map((l) => {
    const d = overlay.leaveDecisions[l.id];
    return d ? { ...l, status: d.status, decidedAt: d.at } : l;
  });
}

/* ----------------------------------------------------------------- roster */

export interface RosterRow {
  employee: Employee;
  record: AttendanceRecord;
  origin: "SEED" | "SYNTHETIC" | "OVERLAY";
  state: AttendanceState;
  checkIn: Date | null;
  checkOut: Date | null;
  late: boolean;
  lateMinutes: number;
  missingCheckOut: boolean;
  geofenceBreachKm: number | null;
  jobCardId: string | null;
  placeLabel: string | null;
  simulated: boolean;
  patch: AttendancePatch | null;
  holiday: Holiday | null;
  leave: LeaveRequest | null;
}

export function holidayFor(holidays: Holiday[], key: string, branchId: string): Holiday | null {
  return (
    holidays.find((h) => dayKey(h.date) === key && (h.branchId === null || h.branchId === branchId)) ??
    null
  );
}

export function approvedLeaveOn(
  requests: LeaveRequest[],
  employeeId: string,
  key: string,
): LeaveRequest | null {
  return (
    requests.find(
      (l) =>
        l.employeeId === employeeId &&
        l.status === "APPROVED" &&
        dayKey(l.fromDate) <= key &&
        dayKey(l.toDate) >= key,
    ) ?? null
  );
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

function isoAt(key: string, minutes: number): string {
  const d = dayKeyToDate(key);
  d.setMinutes(minutes);
  return d.toISOString();
}

export interface RosterInput {
  employees: Employee[];
  seedRecords: AttendanceRecord[];
  jobCards: JobCard[];
  sites: Site[];
  holidays: Holiday[];
  leaveRequests: LeaveRequest[];
  overlay: PeopleOverlay;
  key: string;
  todayKey: string;
}

/**
 * The live day. Attendance for a date in the past is seeded; today's board is
 * assembled from the day's job cards, the holiday master and approved leave,
 * and is then superseded record-by-record as check-ins arrive from the app or
 * the biometric device. Nothing here is written back to the seed.
 */
function synthesiseToday(input: RosterInput): AttendanceRecord[] {
  const { employees, jobCards, sites, holidays, leaveRequests, key } = input;
  const cardsByEngineer = new Map<string, JobCard[]>();
  for (const j of jobCards) {
    if (!j.checkInAt || dayKey(j.checkInAt) !== key) continue;
    const list = cardsByEngineer.get(j.engineerUserId) ?? [];
    list.push(j);
    cardsByEngineer.set(j.engineerUserId, list);
  }

  const working = employees.filter((e) => {
    if (!e.active) return false;
    if (holidayFor(holidays, key, e.branchId)) return false;
    if (dayKeyToDate(key).getDay() === 0) return false;
    return !approvedLeaveOn(leaveRequests, e.id, key);
  });

  // Deterministic exception selection — one of each, stable for a given date.
  const fieldWithOpenCard = working
    .filter((e) => (cardsByEngineer.get(e.id) ?? []).some((c) => !c.checkOutAt))
    .sort((a, b) => a.code.localeCompare(b.code));
  const missingOutId = fieldWithOpenCard[0]?.id ?? null;
  const fieldWithCards = working
    .filter((e) => cardsByEngineer.has(e.id) && e.id !== missingOutId)
    .sort((a, b) => a.code.localeCompare(b.code));
  const geofenceId = fieldWithCards[0]?.id ?? null;
  const officePool = working
    .filter((e) => e.workLocationType === "OFFICE")
    .sort((a, b) => a.code.localeCompare(b.code));
  const lateId = officePool.length
    ? officePool[hash32(key) % officePool.length]!.id
    : null;

  return employees
    .filter((e) => e.active)
    .map((e, index) => {
      const holiday = holidayFor(holidays, key, e.branchId);
      const leave = approvedLeaveOn(leaveRequests, e.id, key);
      const cards = (cardsByEngineer.get(e.id) ?? []).sort((a, b) =>
        (a.checkInAt ?? "").localeCompare(b.checkInAt ?? ""),
      );
      let state: AttendanceState = "PRESENT";
      if (holiday) state = "HOLIDAY";
      else if (dayKeyToDate(key).getDay() === 0) state = "WEEK_OFF";
      else if (leave) state = "ON_LEAVE";
      else if (cards.length) state = "ON_FIELD";

      const isWorking = state === "PRESENT" || state === "ON_FIELD";
      const h = hash32(`${key}:${e.code}`);
      const inMin = e.id === lateId ? 10 * 60 + 41 : 9 * 60 + 38 + (h % 30);
      const outMin = 18 * 60 + 20 + ((h >> 5) % 45);
      const card = cards[0] ?? null;
      const ticketSite = card
        ? sites.find(
            (s) => Math.abs(s.lat - (card.checkInLat ?? 0)) < 0.02 && Math.abs(s.lng - (card.checkInLng ?? 0)) < 0.02,
          ) ?? null
        : null;

      let lat: number | null = null;
      let lng: number | null = null;
      let breach: number | null = null;
      if (card && card.checkInLat !== null && card.checkInLng !== null) {
        lat = card.checkInLat;
        lng = card.checkInLng;
        if (e.id === geofenceId) {
          // Accepted, but recorded away from the expected site — E9-S2.
          lat = Math.round((lat + 0.021) * 100000) / 100000;
          breach = haversineKm(
            { lat, lng },
            { lat: card.checkInLat, lng: card.checkInLng },
          );
        }
      }

      return {
        id: `ATT-LIVE-${key}-${String(index + 1).padStart(3, "0")}`,
        employeeId: e.id,
        date: isoAt(key, 0),
        state,
        checkInAt: isWorking ? isoAt(key, inMin) : null,
        checkOutAt: isWorking && e.id !== missingOutId ? isoAt(key, outMin) : null,
        lat,
        lng,
        placeLabel: card?.checkInPlace ?? (ticketSite ? `${ticketSite.name}, ${ticketSite.district}` : null),
        jobCardId: card?.id ?? null,
        source: state === "ON_FIELD" ? "APP" : h % 3 === 0 ? "DEVICE" : "APP",
        selfieCaptured: state === "ON_FIELD",
        geofenceBreachKm: breach,
        lateMark: isWorking && inMin > SHIFT.startMinutes + SHIFT.graceMinutes,
        missingCheckOut: isWorking && e.id === missingOutId,
        regularisedByUserId: null,
        regularisationReason: null,
        originalState: null,
      } satisfies AttendanceRecord;
    });
}

export function rosterFor(input: RosterInput): RosterRow[] {
  const { employees, seedRecords, holidays, leaveRequests, overlay, key, todayKey } = input;
  const base: AttendanceRecord[] =
    seedRecords.length > 0 ? seedRecords : key === todayKey ? synthesiseToday(input) : [];

  const byEmployee = new Map<string, { rec: AttendanceRecord; origin: RosterRow["origin"] }>();
  for (const r of base) {
    byEmployee.set(r.employeeId, {
      rec: r,
      origin: seedRecords.length > 0 ? "SEED" : "SYNTHETIC",
    });
  }
  for (const r of overlay.created) {
    if (dayKey(r.date) !== key) continue;
    byEmployee.set(r.employeeId, { rec: r, origin: "OVERLAY" });
  }

  const simulated = new Set(overlay.simulatedIds);
  const rows: RosterRow[] = [];

  for (const employee of employees) {
    if (!employee.active) continue;
    const hit = byEmployee.get(employee.id);
    const holiday = holidayFor(holidays, key, employee.branchId);
    const leave = approvedLeaveOn(leaveRequests, employee.id, key);

    const fallback: AttendanceRecord = {
      id: `ATT-NIL-${key}-${employee.id}`,
      employeeId: employee.id,
      date: isoAt(key, 0),
      state: holiday
        ? "HOLIDAY"
        : dayKeyToDate(key).getDay() === 0
          ? "WEEK_OFF"
          : leave
            ? "ON_LEAVE"
            : "ABSENT",
      checkInAt: null,
      checkOutAt: null,
      lat: null,
      lng: null,
      placeLabel: null,
      jobCardId: null,
      source: "MANUAL",
      selfieCaptured: false,
      geofenceBreachKm: null,
      lateMark: false,
      missingCheckOut: false,
      regularisedByUserId: null,
      regularisationReason: null,
      originalState: null,
    };

    const record = hit?.rec ?? fallback;
    const patch = overlay.patches[record.id] ?? null;
    const checkIn = wallClock(record, record.checkInAt);
    const checkOut = wallClock(record, record.checkOutAt);
    const lateMinutes = record.state === "WEEK_OFF" || record.state === "HOLIDAY" ? 0 : lateMinutesOf(checkIn);

    // The holiday master overrides a recorded state for that branch. E9-S3.
    let state: AttendanceState = patch ? patch.state : record.state;
    if (holiday && !patch) state = "HOLIDAY";
    if (leave && !patch && state !== "HOLIDAY") state = "ON_LEAVE";

    const working = state === "PRESENT" || state === "ON_FIELD" || state === "HALF_DAY";

    rows.push({
      employee,
      record,
      origin: hit?.origin ?? "SYNTHETIC",
      state,
      checkIn: working ? checkIn : null,
      checkOut: working ? checkOut : null,
      late: working && lateMinutes > 0 && !patch,
      lateMinutes: working && !patch ? lateMinutes : 0,
      missingCheckOut: working && !!checkIn && !checkOut && !patch,
      geofenceBreachKm: patch ? null : record.geofenceBreachKm,
      jobCardId: record.jobCardId,
      placeLabel: record.placeLabel,
      simulated: simulated.has(record.id),
      patch,
      holiday,
      leave,
    });
  }

  return rows.sort(
    (a, b) =>
      a.employee.branchId.localeCompare(b.employee.branchId) ||
      a.employee.department.localeCompare(b.employee.department) ||
      a.employee.code.localeCompare(b.employee.code),
  );
}

export type ExceptionKind = "LATE" | "MISSING_CHECKOUT" | "GEOFENCE";

export interface AttendanceException {
  kind: ExceptionKind;
  row: RosterRow;
  detail: string;
}

export function exceptionsOf(rows: RosterRow[]): AttendanceException[] {
  const out: AttendanceException[] = [];
  for (const row of rows) {
    if (row.late) {
      out.push({
        kind: "LATE",
        row,
        detail: `${row.lateMinutes} min past the 10:15 grace`,
      });
    }
    if (row.missingCheckOut) {
      out.push({
        kind: "MISSING_CHECKOUT",
        row,
        detail: "Checked in, no check-out recorded by end of day",
      });
    }
    if (row.geofenceBreachKm !== null) {
      out.push({
        kind: "GEOFENCE",
        row,
        detail: `${row.geofenceBreachKm} km from the expected site — geofence is ${GEOFENCE_RADIUS_KM} km`,
      });
    }
  }
  return out;
}

export function countsByState(rows: RosterRow[]): Record<AttendanceState, number> {
  const out: Record<AttendanceState, number> = {
    PRESENT: 0,
    ABSENT: 0,
    ON_LEAVE: 0,
    ON_FIELD: 0,
    HALF_DAY: 0,
    WEEK_OFF: 0,
    HOLIDAY: 0,
  };
  for (const r of rows) out[r.state] += 1;
  return out;
}

/* ------------------------------------------------------------------ leave */

export interface LeaveBalance {
  type: LeaveType;
  entitlement: number;
  accrued: number;
  taken: number;
  available: number;
}

export function financialYearStart(now: Date): Date {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 3, 1);
}

export function monthsElapsedInFy(now: Date): number {
  const start = financialYearStart(now);
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
}

export function leaveBalances(
  leaveTypes: LeaveType[],
  requests: LeaveRequest[],
  employeeId: string,
  now: Date,
): LeaveBalance[] {
  const fyStart = financialYearStart(now);
  const months = monthsElapsedInFy(now);
  return leaveTypes.map((type) => {
    const accrued = Math.min(type.annualEntitlement, Math.round(type.accrualPerMonth * months * 10) / 10);
    const taken = requests
      .filter(
        (l) =>
          l.employeeId === employeeId &&
          l.leaveTypeId === type.id &&
          l.status === "APPROVED" &&
          new Date(l.fromDate) >= fyStart,
      )
      .reduce((s, l) => s + l.days, 0);
    return {
      type,
      entitlement: type.annualEntitlement,
      accrued,
      taken,
      available: Math.round((accrued - taken) * 10) / 10,
    };
  });
}

export interface CoverageImpact {
  branchId: string;
  branchName: string;
  complement: number;
  minimum: number;
  availableAfter: number;
  shortfall: number;
  overlapping: { employee: Employee; request: LeaveRequest }[];
  message: string;
}

/**
 * E9-S4 — would approving this request drop the branch below its configured
 * minimum available field engineers over the requested dates?
 */
export function coverageImpact(
  employees: Employee[],
  branches: Branch[],
  requests: LeaveRequest[],
  request: { employeeId: string; fromDate: string; toDate: string; id?: string },
): CoverageImpact | null {
  const employee = employees.find((e) => e.id === request.employeeId);
  if (!employee || !isFieldEngineer(employee)) return null;

  const branch = branches.find((b) => b.id === employee.branchId);
  const complement = fieldEngineersOf(employees, employee.branchId).length;
  const minimum = MIN_FIELD_ENGINEERS[employee.branchId] ?? 1;

  const from = dayKey(request.fromDate);
  const to = dayKey(request.toDate);
  const overlapping = requests
    .filter(
      (l) =>
        l.id !== request.id &&
        l.status === "APPROVED" &&
        l.employeeId !== employee.id &&
        dayKey(l.fromDate) <= to &&
        dayKey(l.toDate) >= from,
    )
    .map((l) => ({ employee: employees.find((e) => e.id === l.employeeId)!, request: l }))
    .filter((x) => x.employee && isFieldEngineer(x.employee) && x.employee.branchId === employee.branchId);

  const availableAfter = complement - overlapping.length - 1;
  const shortfall = minimum - availableAfter;
  if (shortfall <= 0) return null;

  const branchName = branch?.city ?? employee.branchId;
  return {
    branchId: employee.branchId,
    branchName,
    complement,
    minimum,
    availableAfter,
    overlapping,
    shortfall,
    message: `Approving this request leaves ${branchName} with ${availableAfter} of ${complement} field ${availableAfter === 1 ? "engineer" : "engineers"} available against a configured minimum of ${minimum}. Shortfall: ${shortfall} ${shortfall === 1 ? "engineer" : "engineers"}.`,
  };
}

/** Working days between two dates, excluding Sundays and applicable holidays. */
export function leaveDaysBetween(
  fromKey: string,
  toKey: string,
  holidays: Holiday[],
  branchId: string,
): number {
  if (toKey < fromKey) return 0;
  let count = 0;
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard < 400) {
    const d = dayKeyToDate(cursor);
    if (d.getDay() !== 0 && !holidayFor(holidays, cursor, branchId)) count += 1;
    cursor = addDaysKey(cursor, 1);
    guard += 1;
  }
  return count;
}

/* -------------------------------------------------- payroll input (E9-S5) */

export interface PayrollRow {
  employee: Employee;
  present: number;
  field: number;
  halfDay: number;
  absent: number;
  weekOff: number;
  holiday: number;
  lateMarks: number;
  leaveByType: Record<string, number>;
  leaveTotal: number;
  payableDays: number;
  openExceptions: number;
}

export interface PayrollSummaryResult {
  rows: PayrollRow[];
  exceptions: { key: string; exception: AttendanceException }[];
  daysCovered: number;
  calendarDays: number;
}

export function payrollSummary(
  month: string,
  employees: Employee[],
  recordsByDay: Record<string, AttendanceRecord[]>,
  input: Omit<RosterInput, "key" | "seedRecords">,
  leaveTypes: LeaveType[],
): PayrollSummaryResult {
  const keys = daysInMonthKeys(month).filter((k) => k <= input.todayKey);
  const rows = new Map<string, PayrollRow>();
  for (const e of employees) {
    if (!e.active) continue;
    rows.set(e.id, {
      employee: e,
      present: 0,
      field: 0,
      halfDay: 0,
      absent: 0,
      weekOff: 0,
      holiday: 0,
      lateMarks: 0,
      leaveByType: Object.fromEntries(leaveTypes.map((t) => [t.id, 0])),
      leaveTotal: 0,
      payableDays: 0,
      openExceptions: 0,
    });
  }

  const exceptions: { key: string; exception: AttendanceException }[] = [];
  let daysCovered = 0;

  for (const key of keys) {
    const seedRecords = recordsByDay[key] ?? [];
    if (!seedRecords.length && key !== input.todayKey) continue;
    daysCovered += 1;
    const roster = rosterFor({ ...input, key, seedRecords });
    for (const r of roster) {
      const row = rows.get(r.employee.id);
      if (!row) continue;
      switch (r.state) {
        case "PRESENT":
          row.present += 1;
          break;
        case "ON_FIELD":
          row.present += 1;
          row.field += 1;
          break;
        case "HALF_DAY":
          row.halfDay += 1;
          break;
        case "ABSENT":
          row.absent += 1;
          break;
        case "WEEK_OFF":
          row.weekOff += 1;
          break;
        case "HOLIDAY":
          row.holiday += 1;
          break;
        case "ON_LEAVE": {
          row.leaveTotal += 1;
          const typeId = r.leave?.leaveTypeId ?? "UNSPECIFIED";
          row.leaveByType[typeId] = (row.leaveByType[typeId] ?? 0) + 1;
          break;
        }
      }
      if (r.late) row.lateMarks += 1;
    }
    for (const ex of exceptionsOf(roster)) {
      exceptions.push({ key, exception: ex });
      const row = rows.get(ex.row.employee.id);
      if (row) row.openExceptions += 1;
    }
  }

  for (const row of rows.values()) {
    row.payableDays = Math.round((row.present + row.halfDay * 0.5 + row.weekOff + row.holiday) * 10) / 10;
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.employee.code.localeCompare(b.employee.code)),
    exceptions,
    daysCovered,
    calendarDays: keys.length,
  };
}

export function payrollCsv(
  month: string,
  result: PayrollSummaryResult,
  leaveTypes: LeaveType[],
  branches: Branch[],
): string {
  const branchName = (id: string) => branches.find((b) => b.id === id)?.city ?? id;
  const header = [
    "Employee code",
    "Employee name",
    "Branch",
    "Department",
    "Employment type",
    "Days present",
    "Field days",
    "Half days",
    "Days absent",
    "Week-offs",
    "Holidays",
    "Late marks",
    ...leaveTypes.map((t) => `Leave — ${t.code}`),
    "Leave total",
    "Payable days",
    "Unregularised exceptions",
  ];
  const lines = [header.join(",")];
  for (const r of result.rows) {
    lines.push(
      [
        r.employee.code,
        `"${r.employee.name}"`,
        `"${branchName(r.employee.branchId)}"`,
        `"${r.employee.department}"`,
        r.employee.employmentType,
        r.present,
        r.field,
        r.halfDay,
        r.absent,
        r.weekOff,
        r.holiday,
        r.lateMarks,
        ...leaveTypes.map((t) => r.leaveByType[t.id] ?? 0),
        r.leaveTotal,
        r.payableDays,
        r.openExceptions,
      ].join(","),
    );
  }
  lines.push("");
  lines.push(`"Period","${month}"`);
  lines.push(`"Days covered","${result.daysCovered} of ${result.calendarDays}"`);
  lines.push(
    '"Scope","Attendance input only. Payroll computation, statutory deductions and payslips are outside this platform (BRD X-03)."',
  );
  return lines.join("\n");
}

/* -------------------------------------------------- utilisation (E9-S6) */

export interface UtilisationRow {
  employee: Employee;
  productiveHours: number;
  availableHours: number;
  pct: number;
  cards: JobCard[];
  cardsMissingTimestamps: number;
  attendanceDays: number;
  expectedDays: number;
  completenessPct: number;
  flag: "UNDER" | "OVER" | null;
}

export function workingDaysInPeriod(from: Date, to: Date): number {
  return Math.max(1, Math.round(((to.getTime() - from.getTime()) / DAY_MS) * (6 / 7)));
}

/** Mirrors lib/derive technicianUtilisation (K-08) exactly — same numerator, same denominator. */
export function utilisationFor(
  employee: Employee,
  jobCards: JobCard[],
  from: Date,
  to: Date,
  attendanceDays: number,
): UtilisationRow {
  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };
  const mine = jobCards.filter((j) => j.engineerUserId === employee.id && j.checkInAt && inPeriod(j.checkInAt));
  const complete = mine.filter((j) => j.checkInAt && j.checkOutAt);
  const productiveHours =
    Math.round(
      complete.reduce(
        (s, j) => s + (new Date(j.checkOutAt!).getTime() - new Date(j.checkInAt!).getTime()) / HOUR_MS,
        0,
      ) * 10,
    ) / 10;
  const workingDays = workingDaysInPeriod(from, to);
  const availableHours = workingDays * 8;
  const pct = availableHours ? Math.round((productiveHours / availableHours) * 1000) / 10 : 0;
  const cardCompleteness = mine.length ? (complete.length / mine.length) * 100 : 0;
  const dayCompleteness = workingDays ? (attendanceDays / workingDays) * 100 : 0;
  const completenessPct = Math.round(Math.min(cardCompleteness || 0, dayCompleteness) * 10) / 10;
  return {
    employee,
    productiveHours,
    availableHours,
    pct,
    cards: complete.sort((a, b) => (b.checkInAt ?? "").localeCompare(a.checkInAt ?? "")),
    cardsMissingTimestamps: mine.length - complete.length,
    attendanceDays,
    expectedDays: workingDays,
    completenessPct,
    flag: pct < UTILISATION_BAND.low ? "UNDER" : pct > UTILISATION_BAND.high ? "OVER" : null,
  };
}

export function utilisationIsReliable(row: UtilisationRow): boolean {
  return row.cards.length > 0 && row.completenessPct >= UTILISATION_COMPLETENESS_FLOOR;
}

/* ---------------------------------------------------- documents (E9-S1) */

export interface DocSlot {
  spec: DocSpec;
  document: EmployeeDocument | null;
  present: boolean;
  expiresOn: Date | null;
  daysToExpiry: number | null;
  expiryState: "NONE" | "VALID" | "DUE_60" | "DUE_30" | "EXPIRED";
}

export interface DocFile {
  employee: Employee;
  slots: DocSlot[];
  requiredTotal: number;
  requiredPresent: number;
  statutoryPct: number;
  filePct: number;
  appointmentLetter: DocSlot;
  gaps: DocSlot[];
}

export function documentFile(
  employee: Employee,
  documents: EmployeeDocument[],
  now: Date,
): DocFile {
  const mine = documents.filter((d) => d.employeeId === employee.id);
  const applicable = DOCUMENT_SET.filter(
    (s) => s.appliesTo === "ALL" || employee.workLocationType === "FIELD",
  );
  const slots: DocSlot[] = applicable.map((spec) => {
    const document = mine.find((d) => d.title === spec.title) ?? null;
    const expiresOn = document?.expiresOn ? new Date(document.expiresOn) : null;
    const daysToExpiry = expiresOn
      ? Math.round((expiresOn.getTime() - now.getTime()) / DAY_MS)
      : null;
    let expiryState: DocSlot["expiryState"] = "NONE";
    if (daysToExpiry !== null) {
      if (daysToExpiry < 0) expiryState = "EXPIRED";
      else if (daysToExpiry <= EXPIRY_NOTICE_DAYS[1]) expiryState = "DUE_30";
      else if (daysToExpiry <= EXPIRY_NOTICE_DAYS[0]) expiryState = "DUE_60";
      else expiryState = "VALID";
    }
    return { spec, document, present: !!document, expiresOn, daysToExpiry, expiryState };
  });

  const required = slots.filter((s) => s.spec.requirement === "REQUIRED");
  const requiredPresent = required.filter((s) => s.present).length;
  const present = slots.filter((s) => s.present).length;

  return {
    employee,
    slots,
    requiredTotal: required.length,
    requiredPresent,
    statutoryPct: required.length ? Math.round((requiredPresent / required.length) * 100) : 100,
    filePct: slots.length ? Math.round((present / slots.length) * 100) : 100,
    appointmentLetter: slots.find((s) => s.spec.title === "Appointment Letter")!,
    gaps: slots.filter((s) => !s.present),
  };
}

/* ------------------------------------------------------------------ RBAC */

/**
 * E9-S1 — employee personal data and HR documents are held behind the HR
 * capability. A role without it is denied, the denial is audit-logged, and the
 * same predicate excludes those records from that role's search results.
 */
export function personalDataVisible(role: Role, can: (r: Role, c: "hrDocuments") => boolean): boolean {
  return can(role, "hrDocuments");
}
