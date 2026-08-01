import type { AttendanceState } from "@/lib/schemas/enums";
import type { Holiday } from "@/lib/schemas/entities";

/**
 * E9 — configuration-driven HR rules.
 *
 * BRD CN-001 says the Labour Code central rules are still settling, so every
 * statutory-adjacent threshold in this epic is configuration rather than code.
 * Each constant below is surfaced on the screen that depends on it, so a figure
 * can never be argued with in a demonstration — the rule is printed beside it.
 */

/* ------------------------------------------------------------------ shift */

/**
 * Standard office shift. 10:00–18:30 IST with a 15-minute grace; a check-in
 * after 10:15 is a late mark.
 *
 * Late marks are DERIVED from this rule on every surface rather than read from
 * the stored `attendance.lateMark` flag — AR-1/AR-2 require one implementation
 * per derived value, and a late mark is a rule applied to a timestamp, not a
 * fact anyone entered.
 */
export const SHIFT = {
  startMinutes: 10 * 60,
  endMinutes: 18 * 60 + 30,
  graceMinutes: 15,
  /** Paid hours in a standard working day — the payroll-input denominator. */
  standardHours: 8.5,
} as const;

export const SHIFT_LABEL = "10:00 – 18:30 IST, 15-minute grace";
export const LATE_RULE_LABEL = "A check-in after 10:15 IST is a late mark.";

/* --------------------------------------------------------------- geofence */

/** Configured site geofence. A field check-in beyond this is accepted but flagged. */
export const GEOFENCE_RADIUS_KM = 1.5;

/* --------------------------------------------------------- field coverage */

/**
 * Minimum available field engineers per branch, configured against the
 * committed AMC preventive-visit plan. Bhushan Corp runs its field team at
 * full commitment (PLAN.md C-12: ~4.6 visits per engineer per week), so each
 * branch's minimum equals its engineer complement: any field-engineer absence
 * needs a named cover and an acknowledged coverage exception.
 */
export const MIN_FIELD_ENGINEERS: Record<string, number> = {
  "BR-01": 4,
  "BR-02": 2,
  "BR-03": 2,
  "BR-04": 1,
};

export const COVERAGE_RULE_LABEL =
  "Minimum available field engineers per branch, configured in Masters against the committed AMC preventive-visit plan.";

/* ------------------------------------------------------------ utilisation */

/** Configured healthy utilisation band. Outside it, the engineer is flagged with direction. */
export const UTILISATION_BAND = { low: 55, high: 85 } as const;

/** Below this share of expected records, a utilisation figure carries a data-completeness caveat. */
export const UTILISATION_COMPLETENESS_FLOOR = 90;

export const PRODUCTIVE_HOURS_DEFINITION =
  "Productive hours are the sum of job-card durations (check-out minus check-in) for job cards the engineer checked into during the period. Travel between sites, branch time, training and idle time are not productive hours. A job card without both timestamps contributes nothing and reduces data completeness.";

export const UTILISATION_FORMULA =
  "Utilisation % = productive field hours ÷ available hours × 100, where available hours = engineers × working days × 8, and working days = calendar days in the period × 6 ÷ 7.";

/* -------------------------------------------------------------- documents */

export type DocRequirement = "REQUIRED" | "RECOMMENDED";

export interface DocSpec {
  /** Matched against EmployeeDocument.title — the seed stores the human title. */
  title: string;
  requirement: DocRequirement;
  /** FIELD-only documents do not count against office staff. */
  appliesTo: "ALL" | "FIELD";
  statutory: boolean;
  note: string;
}

/**
 * E9-S1 — the appointment letter is the required statutory document and carries
 * a visible present-or-missing state. The rest of the file is presented
 * alongside it so a gap is legible without opening a cabinet in Exhibition Road.
 */
export const DOCUMENT_SET: DocSpec[] = [
  {
    title: "Appointment Letter",
    requirement: "REQUIRED",
    appliesTo: "ALL",
    statutory: true,
    note: "Statutory. Evidence of the employment contract; required for every employee on the register.",
  },
  {
    title: "Offer Letter",
    requirement: "RECOMMENDED",
    appliesTo: "ALL",
    statutory: false,
    note: "Pre-joining record. Retained for reference against the appointment terms.",
  },
  {
    title: "Identity Proof Reference",
    requirement: "RECOMMENDED",
    appliesTo: "ALL",
    statutory: false,
    note: "Reference only — the identity number itself is never stored in the platform.",
  },
  {
    title: "Qualification Certificate",
    requirement: "RECOMMENDED",
    appliesTo: "ALL",
    statutory: false,
    note: "Highest qualification on record, verified at joining.",
  },
  {
    title: "OEM Training Certificate",
    requirement: "REQUIRED",
    appliesTo: "FIELD",
    statutory: true,
    note: "Principal-issued competence certificate. Drives skill-based dispatch; expiry withdraws the engineer from that principal's queue.",
  },
];

/** E9-S1 — expiry notices to the document owner and HR. */
export const EXPIRY_NOTICE_DAYS = [60, 30] as const;

/* -------------------------------------------------- holiday master (X-16g) */

/**
 * FR-M8-12 — the holiday calendar is maintained per branch so regional
 * observances are respected. The organisation-wide list is seeded; these are
 * the branch-scoped regional entries that the seed leaves to the master.
 */
export const DEFAULT_BRANCH_HOLIDAYS: Holiday[] = [
  {
    id: "HOL-BR-001",
    branchId: "BR-03",
    date: "2026-07-27T00:00:00.000+05:30",
    name: "Shrawani Mela (Sultanganj–Deoghar)",
  },
  {
    id: "HOL-BR-002",
    branchId: "BR-04",
    date: "2026-09-28T00:00:00.000+05:30",
    name: "Pitru Paksha Mela",
  },
  {
    id: "HOL-BR-003",
    branchId: "BR-02",
    date: "2026-03-22T00:00:00.000+05:30",
    name: "Bihar Diwas — regional observance",
  },
];

/* ------------------------------------------------------------ state meta */

export const ATTENDANCE_STATE_LABEL: Record<AttendanceState, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  ON_LEAVE: "On leave",
  ON_FIELD: "On field",
  HALF_DAY: "Half day",
  WEEK_OFF: "Week off",
  HOLIDAY: "Holiday",
};

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "sim";

export const ATTENDANCE_STATE_TONE: Record<AttendanceState, Tone> = {
  PRESENT: "ok",
  ABSENT: "danger",
  ON_LEAVE: "info",
  ON_FIELD: "info",
  HALF_DAY: "warn",
  WEEK_OFF: "neutral",
  HOLIDAY: "neutral",
};

export const ATTENDANCE_STATES: AttendanceState[] = [
  "PRESENT",
  "ON_FIELD",
  "ON_LEAVE",
  "HALF_DAY",
  "ABSENT",
  "WEEK_OFF",
  "HOLIDAY",
];

export const SOURCE_LABEL: Record<"APP" | "DEVICE" | "MANUAL", string> = {
  APP: "Mobile app",
  DEVICE: "Biometric device",
  MANUAL: "Manual entry",
};

/* ------------------------------------------------------------ scope notes */

export const PAYROLL_SCOPE_STATEMENT =
  "Pravaah produces the attendance input for payroll. It does not compute salary, does not calculate EPF, ESIC or professional-tax deductions, does not file statutory returns or Form 16, and does not generate payslips. Those remain with the payroll provider and the accounting package, which stay the statutory book of record.";

export const PRIVACY_STATEMENT =
  "Statutory identifiers are stored masked and are never revealed in full. Employee personal data and HR documents are excluded from the global search index for any role without HR & Admin access, and each denied request is written to the audit log.";
