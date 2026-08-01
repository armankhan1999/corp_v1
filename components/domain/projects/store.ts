"use client";

import { useSyncExternalStore } from "react";

/**
 * Projects overlay — E6 mutations.
 *
 * AR-5: the seeded dataset is never mutated. Every write this epic performs is
 * layered on top of it here and persisted to localStorage under `pravaah.v1.*`,
 * so a reload keeps the demonstration and a reset restores the seeded baseline.
 * AR-9: every mutation also appends an audit entry, written to its own key so
 * the trail is inspectable independently of the state it describes.
 */

export const OVERLAY_KEY = "pravaah.v1.projects";
export const AUDIT_KEY = "pravaah.v1.projects.audit";
export const OVERLAY_VERSION = 1;

/* ------------------------------------------------------------------ types */

export type HindranceCause =
  | "WEATHER" | "MATERIAL" | "CLIENT_APPROVAL" | "LABOUR" | "DRAWING" | "ACCESS" | "OTHER";

export interface OverlayDPR {
  id: string;
  number: string;
  projectId: string;
  date: string;
  weather: string;
  manpower: { trade: string; count: number }[];
  plant: { name: string; count: number }[];
  execution: { boqLineId: string; qty: number }[];
  materialsReceived: string;
  siteInstructions: string;
  hindrance: string | null;
  hindranceCause: HindranceCause | null;
  safetyObservations: string;
  photos: { caption: string; tone: string }[];
  byUserId: string;
  byUserName: string;
  supersedesId: string | null;
  supersedesNumber: string | null;
  supersedeReason: string | null;
  /**
   * Set only when the superseded record came from the seeded dataset, whose
   * quantities are already inside `D.boqExecutedQty`. Carrying them here lets
   * the correction net the original out without touching the seed.
   */
  replacesSeedExecution: { boqLineId: string; qty: number }[];
  submittedAt: string;
}

export interface OverlayVariation {
  boqLineId: string;
  projectId: string;
  variationQty: number;
  variationRef: string;
  approvedValue: number;
  recordedAt: string;
}

export interface OverlayBill {
  id: string;
  number: string;
  projectId: string;
  sequence: number;
  periodFrom: string;
  periodTo: string;
  cumulativeValue: number;
  previousCumulative: number;
  frozenExecution: { boqLineId: string; cumulativeQty: number }[];
  mobilisationRecovery: number;
  retentionPct: number;
  tdsPct: number;
  labourCessPct: number;
  otherDeductions: number;
  otherDeductionsNote: string;
  claimedValue: number;
  certifiedValue: number | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_CERTIFICATION" | "CERTIFIED" | "PAID";
  submittedAt: string | null;
  certifiedAt: string | null;
  paidAt: string | null;
  invoiceRef: string | null;
  createdAt: string;
}

/** Patch applied over a seeded RA-bill. Only the fields E6-S5 can move. */
export interface BillPatch {
  status?: OverlayBill["status"];
  certifiedValue?: number | null;
  submittedAt?: string | null;
  certifiedAt?: string | null;
  frozenExecution?: { boqLineId: string; cumulativeQty: number }[];
  invoiceRef?: string | null;
  otherDeductions?: number;
  otherDeductionsNote?: string;
  mobilisationRecovery?: number;
}

export interface RetentionRelease {
  entryId: string;
  amount: number;
  date: string;
  reference: string;
  recordedAt: string;
}

/** Posted to the retention register when a bill is certified. E6-S5 → E6-S6. */
export interface OverlayRetentionEntry {
  id: string;
  projectId: string;
  raBillId: string;
  raBillNumber: string;
  amount: number;
  withheldOn: string;
  eligibleFrom: string;
}

export interface OverlayProject {
  id: string;
  code: string;
  name: string;
  customerId: string;
  clientType: string;
  siteLocation: string;
  district: string;
  scopeSummary: string;
  contractType: string;
  workOrderRef: string;
  workOrderDate: string;
  contractValue: number;
  startDate: string;
  contractualCompletion: string;
  revisedCompletion: string | null;
  actualCompletion: string | null;
  defectLiabilityMonths: number;
  retentionPct: number;
  mobilisationAdvance: number;
  priceVariationClause: boolean;
  liquidatedDamagesTerms: string;
  managerUserId: string;
  branchId: string;
  status: string;
  varianceTolerancePct: number;
  createdAt: string;
}

export interface ProjectPatch {
  status?: string;
  revisedCompletion?: string | null;
  actualCompletion?: string | null;
  /** Computed when the project enters DLP — the basis for release eligibility. */
  dlpExpiry?: string | null;
}

export interface CostPatch {
  committed: number;
  incurred: number;
  note: string;
  asOf: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: "CREATE" | "UPDATE" | "STATE_TRANSITION" | "BLOCKED" | "ACCESS_DENIED" | "NOTIFY";
  entity: string;
  entityId: string;
  detail: string;
}

export interface ProjectsOverlay {
  v: number;
  dprs: OverlayDPR[];
  variations: Record<string, OverlayVariation>;
  bills: OverlayBill[];
  billPatches: Record<string, BillPatch>;
  retentionEntries: OverlayRetentionEntry[];
  releases: Record<string, RetentionRelease>;
  claims: Record<string, string>;
  projects: OverlayProject[];
  projectPatches: Record<string, ProjectPatch>;
  costs: Record<string, CostPatch>;
  audit: AuditEntry[];
}

export const EMPTY_OVERLAY: ProjectsOverlay = {
  v: OVERLAY_VERSION,
  dprs: [],
  variations: {},
  bills: [],
  billPatches: {},
  retentionEntries: [],
  releases: {},
  claims: {},
  projects: [],
  projectPatches: {},
  costs: {},
  audit: [],
};

/* ------------------------------------------------------------------ store */

let cache: ProjectsOverlay = EMPTY_OVERLAY;
let hydrated = false;
const listeners = new Set<() => void>();

function readFromStorage(): ProjectsOverlay {
  if (typeof window === "undefined") return EMPTY_OVERLAY;
  try {
    const rawState = window.localStorage.getItem(OVERLAY_KEY);
    const rawAudit = window.localStorage.getItem(AUDIT_KEY);
    const state = rawState ? (JSON.parse(rawState) as Partial<ProjectsOverlay>) : null;
    const audit = rawAudit ? (JSON.parse(rawAudit) as AuditEntry[]) : [];
    // AR-5 — a version mismatch resets cleanly rather than throwing.
    if (!state || state.v !== OVERLAY_VERSION) return { ...EMPTY_OVERLAY, audit: [] };
    return {
      ...EMPTY_OVERLAY,
      ...state,
      v: OVERLAY_VERSION,
      audit: Array.isArray(audit) ? audit : [],
    };
  } catch {
    return EMPTY_OVERLAY;
  }
}

function persist(next: ProjectsOverlay) {
  if (typeof window === "undefined") return;
  try {
    const { audit, ...state } = next;
    window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(state));
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(-400)));
  } catch {
    /* quota or private mode — the in-memory overlay still holds for the session */
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): ProjectsOverlay {
  if (!hydrated) {
    cache = readFromStorage();
    hydrated = true;
  }
  return cache;
}

function getServerSnapshot(): ProjectsOverlay {
  return EMPTY_OVERLAY;
}

export function useProjectsOverlay(): ProjectsOverlay {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Every write funnels through here, so persistence and audit cannot be skipped. */
export function mutate(
  apply: (current: ProjectsOverlay) => ProjectsOverlay,
  audit?: Omit<AuditEntry, "id" | "at">,
): void {
  const current = getSnapshot();
  let next = apply(current);
  if (audit) {
    next = {
      ...next,
      audit: [
        ...next.audit,
        { ...audit, id: `AUD-L-${next.audit.length + 1}`, at: new Date().toISOString() },
      ],
    };
  }
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

/** Records an event that changed nothing — a blocked action or a denial. */
export function logOnly(audit: Omit<AuditEntry, "id" | "at">): void {
  mutate((o) => o, audit);
}

export function resetOverlay(): void {
  mutate(() => ({ ...EMPTY_OVERLAY, audit: [] }), {
    actorId: "-", actorName: "-", action: "UPDATE",
    entity: "OVERLAY", entityId: "-", detail: "Projects overlay reset to the seeded baseline",
  });
}

/* --------------------------------------------------------------- mutators */

export function addDPR(dpr: OverlayDPR, actor: { id: string; name: string }): void {
  mutate((o) => ({ ...o, dprs: [...o.dprs, dpr] }), {
    actorId: actor.id, actorName: actor.name, action: "CREATE",
    entity: "DPR", entityId: dpr.id,
    detail: dpr.supersedesId
      ? `Superseding DPR ${dpr.number} filed against ${dpr.supersedesId} — ${dpr.supersedeReason}`
      : `DPR ${dpr.number} submitted for ${dpr.date.slice(0, 10)} — ${dpr.execution.length} BOQ line(s) progressed`,
  });
}

export function recordVariation(v: OverlayVariation, actor: { id: string; name: string }): void {
  mutate((o) => ({ ...o, variations: { ...o.variations, [v.boqLineId]: v } }), {
    actorId: actor.id, actorName: actor.name, action: "UPDATE",
    entity: "BOQ_LINE", entityId: v.boqLineId,
    detail: `Variation ${v.variationRef} recorded — ${v.variationQty} additional qty, approved value ${v.approvedValue}`,
  });
}

export function createBill(bill: OverlayBill, actor: { id: string; name: string }): void {
  mutate((o) => ({ ...o, bills: [...o.bills, bill] }), {
    actorId: actor.id, actorName: actor.name, action: "CREATE",
    entity: "RA_BILL", entityId: bill.id,
    detail: `RA-bill ${bill.number} created as Draft — sequence ${bill.sequence}`,
  });
}

export function patchBill(
  billId: string, patch: BillPatch, actor: { id: string; name: string }, detail: string,
): void {
  mutate(
    (o) => ({
      ...o,
      bills: o.bills.map((b) => (b.id === billId ? { ...b, ...patch } : b)),
      billPatches: { ...o.billPatches, [billId]: { ...o.billPatches[billId], ...patch } },
    }),
    {
      actorId: actor.id, actorName: actor.name, action: "STATE_TRANSITION",
      entity: "RA_BILL", entityId: billId, detail,
    },
  );
}

/**
 * E6-S5 — certification is one transaction: the certified value is recorded
 * alongside the claim, and retention at the project's percentage on that
 * certified value is posted to the retention register in the same step.
 */
export function certifyBill(
  billId: string,
  patch: BillPatch,
  entry: OverlayRetentionEntry,
  actor: { id: string; name: string },
  detail: string,
): void {
  mutate(
    (o) => ({
      ...o,
      bills: o.bills.map((b) => (b.id === billId ? { ...b, ...patch } : b)),
      billPatches: { ...o.billPatches, [billId]: { ...o.billPatches[billId], ...patch } },
      retentionEntries: [...o.retentionEntries.filter((e) => e.raBillId !== billId), entry],
    }),
    {
      actorId: actor.id, actorName: actor.name, action: "STATE_TRANSITION",
      entity: "RA_BILL", entityId: billId, detail,
    },
  );
}

export function recordRelease(rel: RetentionRelease, actor: { id: string; name: string }): void {
  mutate((o) => ({ ...o, releases: { ...o.releases, [rel.entryId]: rel } }), {
    actorId: actor.id, actorName: actor.name, action: "UPDATE",
    entity: "RETENTION_ENTRY", entityId: rel.entryId,
    detail: `Retention release captured — ${rel.amount} on ${rel.date.slice(0, 10)}, reference ${rel.reference}`,
  });
}

export function raiseClaim(entryId: string, at: string, actor: { id: string; name: string }): void {
  mutate((o) => ({ ...o, claims: { ...o.claims, [entryId]: at } }), {
    actorId: actor.id, actorName: actor.name, action: "STATE_TRANSITION",
    entity: "RETENTION_ENTRY", entityId: entryId,
    detail: "Retention release claim raised with the client",
  });
}

export function addProject(p: OverlayProject, actor: { id: string; name: string }): void {
  mutate((o) => ({ ...o, projects: [...o.projects, p] }), {
    actorId: actor.id, actorName: actor.name, action: "CREATE",
    entity: "PROJECT", entityId: p.id,
    detail: `Project ${p.code} — ${p.name} recorded at contract value ${p.contractValue}`,
  });
}

export function patchProject(
  projectId: string, patch: ProjectPatch, actor: { id: string; name: string }, detail: string,
): void {
  mutate(
    (o) => ({
      ...o,
      projects: o.projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)),
      projectPatches: { ...o.projectPatches, [projectId]: { ...o.projectPatches[projectId], ...patch } },
    }),
    {
      actorId: actor.id, actorName: actor.name, action: "STATE_TRANSITION",
      entity: "PROJECT", entityId: projectId, detail,
    },
  );
}

export function patchCost(
  key: string, patch: CostPatch, actor: { id: string; name: string }, detail: string,
): void {
  mutate((o) => ({ ...o, costs: { ...o.costs, [key]: patch } }), {
    actorId: actor.id, actorName: actor.name, action: "UPDATE",
    entity: "PROJECT_COST", entityId: key, detail,
  });
}
