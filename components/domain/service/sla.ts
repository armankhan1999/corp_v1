import * as D from "@/lib/derive";
import { formatDate } from "@/lib/format";
import type * as T from "@/lib/schemas/entities";
import type { CoverageState, SLAState, TicketSeverity, TicketStatus } from "@/lib/schemas/enums";
import type { CoverageDerivation, SlaLadderRung, SlaResolution } from "./types";

/**
 * E4-S1 / E4-S2 — SLA resolution, the business-hours calendar and the pause
 * policy.
 *
 * The four-state banding is NOT reimplemented here. Every path funnels through
 * `D.slaClock` so the dispatch board, the ticket, the field screens and the
 * Command Centre cannot disagree about what "Imminent" means (AR-1).
 * The business-hours case reuses the same function by expressing the clock in
 * business-millisecond space before handing it over.
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

/* --------------------------------------------------------- branch calendar */

/** Bhushan Corp field-service day. Masters holds the calendar; PD-007 the hours. */
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 18;
/** Monday–Saturday. Sunday is the weekly off across all four branches. */
export const WORK_DAYS = [1, 2, 3, 4, 5, 6];
export const BUSINESS_HOURS_LABEL = "Business hours · 09:00–18:00, Mon–Sat, branch holiday calendar";
export const ELAPSED_HOURS_LABEL = "Elapsed hours · clock runs continuously";

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function isWorkingDay(d: Date, holidays: ReadonlySet<string>): boolean {
  return WORK_DAYS.includes(d.getDay()) && !holidays.has(dayKey(d));
}

function windowFor(d: Date): { open: number; close: number } {
  const open = new Date(d);
  open.setHours(WORK_START_HOUR, 0, 0, 0);
  const close = new Date(d);
  close.setHours(WORK_END_HOUR, 0, 0, 0);
  return { open: open.getTime(), close: close.getTime() };
}

/**
 * Working milliseconds between two instants. Negative when `to` precedes
 * `from`, so an overrun measures in working time too.
 */
export function businessMsBetween(from: number, to: number, holidays: ReadonlySet<string>): number {
  if (to === from) return 0;
  const sign = to > from ? 1 : -1;
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  let total = 0;
  const cursor = new Date(a);
  cursor.setHours(0, 0, 0, 0);
  // 3 years of guard rail: no SLA in the platform runs longer than a week.
  for (let guard = 0; guard < 1100 && cursor.getTime() <= b; guard++) {
    if (isWorkingDay(cursor, holidays)) {
      const { open, close } = windowFor(cursor);
      const lo = Math.max(open, a);
      const hi = Math.min(close, b);
      if (hi > lo) total += hi - lo;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return total * sign;
}

/** Add working milliseconds to an instant, skipping closed hours entirely. */
export function addBusinessMs(from: number, ms: number, holidays: ReadonlySet<string>): number {
  let remaining = ms;
  const cursor = new Date(from);
  for (let guard = 0; guard < 1100; guard++) {
    if (isWorkingDay(cursor, holidays)) {
      const { open, close } = windowFor(cursor);
      const start = Math.max(cursor.getTime(), open);
      if (start < close) {
        const available = close - start;
        if (available >= remaining) return start + remaining;
        remaining -= available;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START_HOUR, 0, 0, 0);
  }
  return from + ms;
}

/* --------------------------------------------------------------- the clock */

export interface ServiceClock {
  state: SLAState;
  remainingMs: number;
  elapsedMs: number;
  totalMs: number;
  fractionRemaining: number;
  breached: boolean;
  overrunMs: number;
  dueAtMs: number;
  /** Pause already banked plus any pause currently running. */
  pausedMsEffective: number;
  paused: boolean;
  basis: "BUSINESS" | "ELAPSED";
  basisLabel: string;
}

export interface ClockInput {
  loggedAtMs: number;
  dueAtMs: number;
  stoppedAtMs: number | null;
  pausedMs: number;
  pauseStartedAtMs: number | null;
  businessHours: boolean;
}

type ClockShape = Pick<T.ServiceTicket, "loggedAt" | "restorationDue" | "restoredAt" | "pausedMs">;

/**
 * `D.slaClock` reads exactly these four fields. The assertion is legal because
 * ServiceTicket is assignable to ClockShape; it exists so the single banding
 * implementation can be reused without inventing a second one.
 */
function band(shape: ClockShape, now: Date) {
  return D.slaClock(shape as T.ServiceTicket, now);
}

export function computeClock(
  input: ClockInput,
  nowMs: number,
  holidays: ReadonlySet<string>,
): ServiceClock {
  const running = input.pauseStartedAtMs !== null && input.stoppedAtMs === null;
  const pausedEffective =
    input.pausedMs + (running ? Math.max(0, nowMs - (input.pauseStartedAtMs ?? nowMs)) : 0);
  const stop = input.stoppedAtMs ?? nowMs;

  if (!input.businessHours) {
    const c = band(
      {
        loggedAt: new Date(input.loggedAtMs).toISOString(),
        restorationDue: new Date(input.dueAtMs).toISOString(),
        restoredAt: input.stoppedAtMs === null ? null : new Date(input.stoppedAtMs).toISOString(),
        pausedMs: pausedEffective,
      },
      new Date(nowMs),
    );
    return {
      state: c.state,
      remainingMs: c.remainingMs,
      elapsedMs: c.elapsedMs,
      totalMs: c.totalMs,
      fractionRemaining: c.fractionRemaining,
      breached: c.breached,
      overrunMs: c.overrunMs,
      dueAtMs: c.dueAt.getTime(),
      pausedMsEffective: pausedEffective,
      paused: running,
      basis: "ELAPSED",
      basisLabel: ELAPSED_HOURS_LABEL,
    };
  }

  // Business-hours basis: express the whole clock in working milliseconds and
  // hand that to the same banding function.
  const totalBusiness = Math.max(1, businessMsBetween(input.loggedAtMs, input.dueAtMs, holidays));
  const elapsedBusiness = Math.max(
    0,
    businessMsBetween(input.loggedAtMs, stop, holidays) - pausedEffective,
  );
  const c = band(
    {
      loggedAt: new Date(0).toISOString(),
      restorationDue: new Date(totalBusiness).toISOString(),
      restoredAt: new Date(elapsedBusiness).toISOString(),
      pausedMs: 0,
    },
    new Date(nowMs),
  );
  const dueAt = addBusinessMs(input.loggedAtMs, totalBusiness + pausedEffective, holidays);
  return {
    state: c.state,
    remainingMs: c.remainingMs,
    elapsedMs: elapsedBusiness,
    totalMs: totalBusiness,
    fractionRemaining: c.fractionRemaining,
    breached: c.breached,
    overrunMs: c.overrunMs,
    dueAtMs: dueAt,
    pausedMsEffective: pausedEffective,
    paused: running,
    basis: "BUSINESS",
    basisLabel: BUSINESS_HOURS_LABEL,
  };
}

/** Non-working time skipped by a business-hours clock, for the disclosure line. */
export function excludedMs(input: ClockInput, nowMs: number, holidays: ReadonlySet<string>): number {
  const stop = input.stoppedAtMs ?? nowMs;
  const wall = Math.max(0, stop - input.loggedAtMs);
  return Math.max(0, wall - businessMsBetween(input.loggedAtMs, stop, holidays));
}

/* ---------------------------------------------------------------- coverage */

export interface CoverageAmcFacts {
  id: string;
  number: string;
  coverage: "COMPREHENSIVE" | "NON_COMPREHENSIVE";
  startMs: number;
  endMs: number;
  responseHours: number;
  restorationHours: number;
}

export interface CoverageFacts {
  assetStatus: string;
  commissioningDateMs: number | null;
  warrantyMonths: number;
  warrantyEndMs: number | null;
  amc: CoverageAmcFacts | null;
  nowMs: number;
}

/**
 * FR-M4-03 / E4-S1 — the *presentation* of the coverage derivation. The state
 * itself always arrives from `D.coverageState`; this function only renders the
 * evidence that produced it, so a screen can show the working rather than
 * asserting an answer.
 */
export function coverageFrom(f: CoverageFacts, state: CoverageState): CoverageDerivation {
  const steps: CoverageDerivation["steps"] = [
    {
      test: "Asset status is not Decommissioned",
      outcome:
        f.assetStatus === "DECOMMISSIONED"
          ? "Decommissioned — excluded from coverage"
          : `Status ${f.assetStatus.toLowerCase()}`,
      passed: f.assetStatus !== "DECOMMISSIONED",
    },
    {
      test: "Commissioning date on record",
      outcome: f.commissioningDateMs
        ? `Commissioned ${formatDate(f.commissioningDateMs)}`
        : "No commissioning date — warranty cannot start",
      passed: Boolean(f.commissioningDateMs),
    },
    {
      test: `Warranty term (${f.warrantyMonths} months from commissioning)`,
      outcome: f.warrantyEndMs
        ? `Warranty ends ${formatDate(f.warrantyEndMs)} — ${f.warrantyEndMs > f.nowMs ? "still running" : "expired"}`
        : "Not applicable",
      passed: Boolean(f.warrantyEndMs && f.warrantyEndMs > f.nowMs),
    },
    {
      test: "Live AMC contract covering this serial",
      outcome: f.amc
        ? `${f.amc.number} · ${f.amc.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"} · ${formatDate(f.amc.startMs)} to ${formatDate(f.amc.endMs)}`
        : "No contract in force on today's date",
      passed: Boolean(f.amc),
    },
  ];

  const coverage = state === "OUT_OF_COVERAGE" ? "CHARGEABLE" : state;
  const basis =
    state === "IN_WARRANTY"
      ? `Warranty runs to ${f.warrantyEndMs ? formatDate(f.warrantyEndMs) : "—"} (commissioning + ${f.warrantyMonths} months)`
      : state === "UNDER_AMC" && f.amc
        ? `Live ${f.amc.coverage === "COMPREHENSIVE" ? "comprehensive" : "non-comprehensive"} AMC ${f.amc.number}`
        : "No live warranty or AMC on this serial";

  return {
    coverage,
    basis,
    steps,
    amcContractId: f.amc?.id ?? null,
    amcNumber: f.amc?.number ?? null,
    amcCoverage: f.amc?.coverage ?? null,
    warrantyEndMs: f.warrantyEndMs,
    requiresApproval: coverage === "CHARGEABLE",
  };
}

/* ------------------------------------------------------------- precedence */

export interface SlaSourceData {
  severity: TicketSeverity;
  productLine: string;
  amc: {
    id: string;
    number: string;
    responseHours: number;
    restorationHours: number;
    coverage: "COMPREHENSIVE" | "NON_COMPREHENSIVE";
  } | null;
  /** Masters rows, already narrowed to this product line / severity. */
  oemDefinition: T.SLADefinition | null;
  severityDefinition: T.SLADefinition | null;
}

/**
 * FR-M4-05 / E4-S1 — precedence is AMC contract terms, then the OEM commitment
 * for the product line, then the severity default. Every rung is returned, not
 * just the winner, so the screen can show why the others lost.
 */
export function resolveSla(src: SlaSourceData): SlaResolution {
  const ladder: SlaLadderRung[] = [];

  ladder.push({
    source: "AMC",
    label: src.amc ? `AMC contract terms — ${src.amc.number}` : "AMC contract terms",
    responseHours: src.amc?.responseHours ?? null,
    restorationHours: src.amc?.restorationHours ?? null,
    applies: Boolean(src.amc),
    reason: src.amc
      ? `Live ${src.amc.coverage === "COMPREHENSIVE" ? "comprehensive" : "non-comprehensive"} AMC covers this serial, so its committed response and restoration hours take precedence.`
      : "No live AMC contract covers this serial on the logging date.",
    definitionId: src.amc?.id ?? null,
    businessHoursOnly: false,
    pauseOnAwaitingParts: true,
    pauseOnAwaitingCustomer: true,
  });

  const oem = src.oemDefinition;
  ladder.push({
    source: "OEM",
    label: oem ? `OEM commitment — ${oem.label}` : "OEM commitment for the product line",
    responseHours: oem?.responseHours ?? null,
    restorationHours: oem?.restorationHours ?? null,
    applies: Boolean(oem) && !src.amc,
    reason: !oem
      ? `Masters holds no OEM commitment for ${src.productLine} at ${src.severity.toLowerCase()} severity.`
      : src.amc
        ? "An AMC contract outranks the OEM commitment."
        : `The OEM programme covers ${src.productLine} at ${src.severity.toLowerCase()} severity.`,
    definitionId: oem?.id ?? null,
    businessHoursOnly: oem?.businessHoursOnly ?? false,
    pauseOnAwaitingParts: oem?.pauseOnAwaitingParts ?? true,
    pauseOnAwaitingCustomer: oem?.pauseOnAwaitingCustomer ?? true,
  });

  const sev = src.severityDefinition;
  ladder.push({
    source: "SEVERITY",
    label: sev ? `Default by severity — ${src.severity}` : `Default by severity (${src.severity})`,
    responseHours: sev?.responseHours ?? DEFAULT_SEVERITY_HOURS[src.severity][0],
    restorationHours: sev?.restorationHours ?? DEFAULT_SEVERITY_HOURS[src.severity][1],
    applies: !src.amc && !oem,
    reason:
      !src.amc && !oem
        ? "No contract and no OEM commitment apply, so the severity default governs."
        : "Outranked by a higher rung.",
    definitionId: sev?.id ?? null,
    businessHoursOnly: sev?.businessHoursOnly ?? false,
    pauseOnAwaitingParts: sev?.pauseOnAwaitingParts ?? true,
    pauseOnAwaitingCustomer: sev?.pauseOnAwaitingCustomer ?? true,
  });

  const winner = ladder.find((r) => r.applies) ?? ladder[ladder.length - 1]!;
  return {
    ladder,
    appliedSource: winner.source,
    ruleApplied:
      winner.source === "AMC"
        ? winner.label
        : winner.source === "OEM"
          ? `OEM commitment — ${oem?.label ?? "product line programme"}`
          : `Default by severity (${src.severity})`,
    responseHours: winner.responseHours ?? DEFAULT_SEVERITY_HOURS[src.severity][0],
    restorationHours: winner.restorationHours ?? DEFAULT_SEVERITY_HOURS[src.severity][1],
    businessHoursOnly: winner.businessHoursOnly,
    pauseOnAwaitingParts: winner.pauseOnAwaitingParts,
    pauseOnAwaitingCustomer: winner.pauseOnAwaitingCustomer,
    definitionId: winner.definitionId,
  };
}

/** PD-007 fallbacks, used only where Masters holds no row. */
export const DEFAULT_SEVERITY_HOURS: Record<TicketSeverity, [number, number]> = {
  CRITICAL: [4, 24],
  HIGH: [8, 48],
  NORMAL: [24, 96],
  LOW: [48, 168],
};

export function dueTimestamps(
  loggedAtMs: number,
  responseHours: number,
  restorationHours: number,
  businessHours: boolean,
  holidays: ReadonlySet<string>,
): { responseDueMs: number; restorationDueMs: number } {
  if (!businessHours) {
    return {
      responseDueMs: loggedAtMs + responseHours * HOUR,
      restorationDueMs: loggedAtMs + restorationHours * HOUR,
    };
  }
  return {
    responseDueMs: addBusinessMs(loggedAtMs, responseHours * HOUR, holidays),
    restorationDueMs: addBusinessMs(loggedAtMs, restorationHours * HOUR, holidays),
  };
}

/* -------------------------------------------------------------- pause policy */

export const PAUSING_STATUSES: TicketStatus[] = ["AWAITING_PARTS", "AWAITING_CUSTOMER"];

export function pausePolicyFor(
  status: TicketStatus,
  onParts: boolean,
  onCustomer: boolean,
): { pauses: boolean; label: string } {
  if (status === "AWAITING_PARTS") {
    return {
      pauses: onParts,
      label: onParts
        ? "Masters enables the pause policy for Awaiting parts."
        : "Masters has the pause policy disabled for Awaiting parts, so the clock keeps running.",
    };
  }
  if (status === "AWAITING_CUSTOMER") {
    return {
      pauses: onCustomer,
      label: onCustomer
        ? "Masters enables the pause policy for Awaiting customer."
        : "Masters has the pause policy disabled for Awaiting customer, so the clock keeps running.",
    };
  }
  return { pauses: false, label: "This status does not pause the restoration clock." };
}

/* ----------------------------------------------------------- breach reasons */

export const BREACH_REASONS: { code: string; label: string }[] = [
  { code: "PARTS_UNAVAILABLE", label: "Part unavailable at the issuing location" },
  { code: "SITE_ACCESS_DENIED", label: "Site access denied or plant shut" },
  { code: "ENGINEER_UNAVAILABLE", label: "No certified engineer available" },
  { code: "CUSTOMER_DEFERRED", label: "Customer deferred the visit" },
  { code: "OEM_SUPPORT_PENDING", label: "Awaiting OEM technical support" },
  { code: "TRANSPORT_DISRUPTION", label: "Transport or weather disruption" },
];

export function breachReasonLabel(code: string | null): string {
  if (!code) return "Not recorded";
  return BREACH_REASONS.find((r) => r.code === code)?.label ?? code;
}

/* ------------------------------------------------------- escalation matrix */

export interface EscalationRule {
  state: SLAState;
  roles: string[];
  note: string;
}

/**
 * Notification matrix rows for the SLA clock. E4-S2: imminent notifies the
 * Service Manager; a breach additionally notifies the Director – Business.
 */
export const ESCALATION_MATRIX: EscalationRule[] = [
  {
    state: "APPROACHING",
    roles: ["SERVICE_MANAGER"],
    note: "Below 25% remaining — the owning Service Manager is put on watch.",
  },
  {
    state: "IMMINENT",
    roles: ["SERVICE_MANAGER"],
    note: "Below 10% remaining — the Service Manager is notified to intervene.",
  },
  {
    state: "BREACHED",
    roles: ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"],
    note: "Commitment missed — the Director – Business is notified in addition, and the ticket enters the exception feed.",
  },
];

export function escalationFor(state: SLAState): EscalationRule | null {
  return ESCALATION_MATRIX.find((r) => r.state === state) ?? null;
}

/* ------------------------------------------------------------------ misc */

export const dayMs = DAY;

/** Working days between two instants, for "engineer next available" copy. */
export function workingDaysBetween(from: number, to: number, holidays: ReadonlySet<string>): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  for (let guard = 0; guard < 400 && cursor.getTime() <= to; guard++) {
    if (isWorkingDay(cursor, holidays)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
