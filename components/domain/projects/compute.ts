import { addMonths, daysBetween } from "@/lib/format";
import type { ProjectsOverlay } from "./store";

/**
 * Composition layer for E6.
 *
 * Nothing here re-derives what `/lib/derive` already owns. Server pages call
 * `D.boqExecutedQty`, `D.projectProgress`, `D.scheduleVariancePct`,
 * `D.retention` and friends and hand the results down as the `seed*` fields
 * below; these functions only add the localStorage overlay on top of them.
 */

/** E6-S5 — a bill in Submitted beyond this appears in the exception feed. */
export const CERTIFICATION_THRESHOLD_DAYS = 45;
/** E6-S3 — missed working days before the project manager is notified. */
export const DPR_GAP_NOTIFY_DAYS = 2;
/** E6-S3 — missed working days before escalation to Director – Business. */
export const DPR_GAP_ESCALATE_DAYS = 5;
/** E6-S7 — documents expiring inside this window are notified and listed. */
export const DOCUMENT_EXPIRY_WINDOW_DAYS = 60;

/* -------------------------------------------------------------------- BOQ */

export interface BoqLineSeed {
  id: string;
  section: string;
  sortOrder: number;
  code: string;
  description: string;
  uom: string;
  contractedQty: number;
  rate: number;
  variationQty: number;
  variationRef: string | null;
  /** D.boqExecutedQty(ds, line.id) — computed on the server from seeded DPRs. */
  seedExecutedQty: number;
}

export interface BoqLineComputed extends BoqLineSeed {
  variationQtyTotal: number;
  variationRefAll: string | null;
  variationValue: number;
  contractedAmount: number;
  effectiveQty: number;
  executedQty: number;
  executedValue: number;
  balanceQty: number;
  balanceValue: number;
  executedPct: number;
  /** True when a variation was captured through this workspace, not the seed. */
  variationFromOverlay: boolean;
}

export interface BoqSection {
  section: string;
  lines: BoqLineComputed[];
  contractedAmount: number;
  variationValue: number;
  executedValue: number;
  balanceValue: number;
  pct: number;
}

export interface BoqTotals {
  contractedAmount: number;
  variationValue: number;
  pricedValue: number;
  executedValue: number;
  balanceValue: number;
  pct: number;
}

/**
 * Overlay contribution to a line's cumulative executed quantity.
 *
 * A superseded overlay entry drops out entirely. A superseded *seed* entry
 * cannot be removed from `D.boqExecutedQty`, so the correction carries the
 * original's quantities and nets them off here — the seed object is never
 * mutated and both records stay visible in the log.
 */
export function overlayExecutedQty(overlay: ProjectsOverlay, boqLineId: string): number {
  let qty = 0;
  const superseded = new Set(overlay.dprs.map((d) => d.supersedesId).filter(Boolean) as string[]);
  for (const d of overlay.dprs) {
    if (superseded.has(d.id)) continue;
    for (const e of d.execution) if (e.boqLineId === boqLineId) qty += e.qty;
    for (const e of d.replacesSeedExecution) if (e.boqLineId === boqLineId) qty -= e.qty;
  }
  return Math.round(qty * 100) / 100;
}

/** Overlay DPR ids that have been replaced by a later superseding entry. */
export function supersededOverlayIds(overlay: ProjectsOverlay): Set<string> {
  return new Set(overlay.dprs.map((d) => d.supersedesId).filter(Boolean) as string[]);
}

export function computeBoqLine(line: BoqLineSeed, overlay: ProjectsOverlay): BoqLineComputed {
  const ov = overlay.variations[line.id];
  const variationQtyTotal = line.variationQty + (ov?.variationQty ?? 0);
  const effectiveQty = line.contractedQty + variationQtyTotal;
  const executedQty = Math.round((line.seedExecutedQty + overlayExecutedQty(overlay, line.id)) * 100) / 100;
  const contractedAmount = Math.round(line.contractedQty * line.rate);
  const variationValue = Math.round(variationQtyTotal * line.rate);
  const executedValue = Math.round(executedQty * line.rate);
  const balanceQty = Math.round((effectiveQty - executedQty) * 100) / 100;
  return {
    ...line,
    variationQtyTotal,
    variationRefAll: ov?.variationRef ?? line.variationRef,
    variationValue,
    contractedAmount,
    effectiveQty,
    executedQty,
    executedValue,
    balanceQty,
    balanceValue: Math.round(balanceQty * line.rate),
    executedPct: effectiveQty > 0 ? Math.min(999, (executedQty / effectiveQty) * 100) : 0,
    variationFromOverlay: Boolean(ov),
  };
}

export function groupBoq(lines: BoqLineComputed[], sectionOrder: readonly string[]): BoqSection[] {
  const byName = new Map<string, BoqLineComputed[]>();
  for (const l of lines) {
    const bucket = byName.get(l.section);
    if (bucket) bucket.push(l);
    else byName.set(l.section, [l]);
  }
  const names = [
    ...sectionOrder.filter((s) => byName.has(s)),
    ...[...byName.keys()].filter((s) => !sectionOrder.includes(s)),
  ];
  return names.map((section) => {
    const group = (byName.get(section) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const contractedAmount = group.reduce((s, l) => s + l.contractedAmount, 0);
    const variationValue = group.reduce((s, l) => s + l.variationValue, 0);
    const executedValue = group.reduce((s, l) => s + l.executedValue, 0);
    const priced = contractedAmount + variationValue;
    return {
      section,
      lines: group,
      contractedAmount,
      variationValue,
      executedValue,
      balanceValue: group.reduce((s, l) => s + l.balanceValue, 0),
      pct: priced > 0 ? (executedValue / priced) * 100 : 0,
    };
  });
}

export function boqTotals(sections: BoqSection[]): BoqTotals {
  const contractedAmount = sections.reduce((s, x) => s + x.contractedAmount, 0);
  const variationValue = sections.reduce((s, x) => s + x.variationValue, 0);
  const executedValue = sections.reduce((s, x) => s + x.executedValue, 0);
  const pricedValue = contractedAmount + variationValue;
  return {
    contractedAmount,
    variationValue,
    pricedValue,
    executedValue,
    balanceValue: sections.reduce((s, x) => s + x.balanceValue, 0),
    pct: pricedValue > 0 ? (executedValue / pricedValue) * 100 : 0,
  };
}

/* ---------------------------------------------------- defect-liability period */

export interface ProjectDates {
  contractualCompletion: string;
  revisedCompletion: string | null;
  actualCompletion: string | null;
  defectLiabilityMonths: number;
}

/**
 * E6-S1 — the defect-liability expiry, which E6-S6 uses as the basis for
 * retention release eligibility. Actual completion governs where it exists;
 * otherwise the revised date, otherwise the contractual date.
 */
export function dlpBaseDate(p: ProjectDates): string {
  return p.actualCompletion ?? p.revisedCompletion ?? p.contractualCompletion;
}

export function dlpExpiry(p: ProjectDates): Date {
  return addMonths(dlpBaseDate(p), p.defectLiabilityMonths);
}

/* ------------------------------------------------------------- RA-bill maths */

export interface BillInputs {
  cumulativeValue: number;
  previousCumulative: number;
  mobilisationRecovery: number;
  retentionPct: number;
  tdsPct: number;
  labourCessPct: number;
  otherDeductions: number;
  certifiedValue: number | null;
}

export interface BillFigures {
  currentPeriodValue: number;
  grossForDeduction: number;
  retention: number;
  tds: number;
  labourCess: number;
  mobilisationRecovery: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayable: number;
  varianceAmount: number | null;
  variancePct: number | null;
}

/**
 * E6-S5. Deductions bite on the current-period value, which is the difference
 * between this bill's cumulative value and the previous bill's. Once a certified
 * value exists it replaces the claim as the base, and the variance against the
 * claim is carried as both an amount and a percentage.
 */
export function billFigures(b: BillInputs): BillFigures {
  const currentPeriodValue = b.cumulativeValue - b.previousCumulative;
  const grossForDeduction = b.certifiedValue ?? currentPeriodValue;
  const retention = Math.round((grossForDeduction * b.retentionPct) / 100);
  const tds = Math.round((grossForDeduction * b.tdsPct) / 100);
  const labourCess = Math.round((grossForDeduction * b.labourCessPct) / 100);
  const totalDeductions = retention + tds + labourCess + b.mobilisationRecovery + b.otherDeductions;
  const varianceAmount = b.certifiedValue === null ? null : b.certifiedValue - currentPeriodValue;
  return {
    currentPeriodValue,
    grossForDeduction,
    retention,
    tds,
    labourCess,
    mobilisationRecovery: b.mobilisationRecovery,
    otherDeductions: b.otherDeductions,
    totalDeductions,
    netPayable: grossForDeduction - totalDeductions,
    varianceAmount,
    variancePct:
      varianceAmount === null || currentPeriodValue === 0
        ? null
        : (varianceAmount / currentPeriodValue) * 100,
  };
}

/* -------------------------------------------------------------- DPR cadence */

const DAY = 86_400_000;

function isWorkingDay(d: Date, holidays: Set<string>): boolean {
  if (d.getDay() === 0) return false; // Sunday — site shut
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return !holidays.has(key);
}

export interface DprGap {
  missedWorkingDays: number;
  lastDprDate: string | null;
  notify: boolean;
  escalate: boolean;
}

/**
 * E6-S3 — two consecutive working days without a DPR notifies the project
 * manager; five escalates to Director – Business. Sundays and the branch
 * holiday calendar are excluded, so a festival week is not read as a lapse.
 */
export function dprGap(lastDprDate: string | null, today: Date, holidayIsoDates: string[]): DprGap {
  const holidays = new Set(holidayIsoDates.map((h) => h.slice(0, 10)));
  if (!lastDprDate) {
    return { missedWorkingDays: 0, lastDprDate: null, notify: false, escalate: false };
  }
  const last = new Date(lastDprDate);
  let missed = 0;
  for (let t = last.getTime() + DAY; t <= today.getTime(); t += DAY) {
    if (isWorkingDay(new Date(t), holidays)) missed++;
  }
  return {
    missedWorkingDays: missed,
    lastDprDate,
    notify: missed >= DPR_GAP_NOTIFY_DAYS,
    escalate: missed >= DPR_GAP_ESCALATE_DAYS,
  };
}

/* --------------------------------------------------------------- S-curve */

export interface MilestonePoint {
  name: string;
  plannedDate: string;
  actualDate: string | null;
  weightage: number;
  status: string;
}

export interface CurvePoint {
  date: string;
  label: string;
  planned: number | null;
  actual: number | null;
}

/**
 * E6-S4 — cumulative planned against cumulative actual, both weightage-based,
 * plotted on a shared date axis. The actual series stops at today; drawing it
 * into the future would imply progress that has not been recorded.
 */
export function sCurve(milestones: MilestonePoint[], today: Date): CurvePoint[] {
  const dates = new Set<number>();
  for (const m of milestones) {
    dates.add(new Date(m.plannedDate).getTime());
    if (m.actualDate) dates.add(new Date(m.actualDate).getTime());
  }
  dates.add(today.getTime());
  const ordered = [...dates].sort((a, b) => a - b);
  return ordered.map((t) => {
    const planned = milestones
      .filter((m) => new Date(m.plannedDate).getTime() <= t)
      .reduce((s, m) => s + m.weightage, 0);
    const actual = milestones
      .filter((m) => m.actualDate && new Date(m.actualDate).getTime() <= t)
      .reduce((s, m) => s + m.weightage, 0);
    const d = new Date(t);
    return {
      date: d.toISOString(),
      label: `${String(d.getDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      planned,
      actual: t <= today.getTime() ? actual : null,
    };
  });
}

/* ------------------------------------------------- O&M phase (X-16d / FR-M5-20) */

export interface OmVisit {
  index: number;
  dueDate: string;
  state: "COMPLETED" | "DUE" | "SCHEDULED";
}

export interface OmPhase {
  contracted: boolean;
  termMonths: number;
  omValue: number;
  commencement: string | null;
  expiry: string | null;
  visits: OmVisit[];
  completedVisits: number;
  elapsedMonths: number;
}

/**
 * X-16d / FR-M5-20 — where the BOQ carries an Operation & Maintenance section
 * priced in months, the project has a post-completion O&M phase with a monthly
 * visit schedule that behaves exactly like an AMC preventive-maintenance plan.
 * The term is the longest single O&M line; the shorter lines run inside it.
 */
export function omPhase(
  omLines: { uom: string; contractedQty: number; rate: number }[],
  completionDate: string | null,
  today: Date,
): OmPhase {
  const monthLines = omLines.filter((l) => l.uom.toLowerCase() === "month");
  const omValue = Math.round(omLines.reduce((s, l) => s + l.contractedQty * l.rate, 0));
  const termMonths = monthLines.length
    ? Math.max(1, Math.round(Math.max(...monthLines.map((l) => l.contractedQty))))
    : 0;
  if (!termMonths || !completionDate) {
    return {
      contracted: monthLines.length > 0,
      termMonths, omValue, commencement: null, expiry: null,
      visits: [], completedVisits: 0, elapsedMonths: 0,
    };
  }
  const start = new Date(completionDate);
  const visits: OmVisit[] = [];
  for (let i = 1; i <= termMonths; i++) {
    const due = addMonths(start, i);
    const diff = daysBetween(today, due);
    visits.push({
      index: i,
      dueDate: due.toISOString(),
      state: diff < 0 ? "COMPLETED" : diff <= 30 ? "DUE" : "SCHEDULED",
    });
  }
  return {
    contracted: true,
    termMonths,
    omValue,
    commencement: start.toISOString(),
    expiry: addMonths(start, termMonths).toISOString(),
    visits,
    completedVisits: visits.filter((v) => v.state === "COMPLETED").length,
    elapsedMonths: Math.max(0, Math.min(termMonths, Math.round(daysBetween(start, today) / 30.44))),
  };
}

/* ----------------------------------------------------------------- sorting */

export function compareBy<T>(a: T, b: T, key: keyof T, dir: "asc" | "desc"): number {
  const av = a[key];
  const bv = b[key];
  let cmp = 0;
  if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
  return dir === "asc" ? cmp : -cmp;
}
