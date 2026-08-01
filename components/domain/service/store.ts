"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { JobOutcome, RootCause, TicketStatus } from "@/lib/schemas/enums";
import type { JobCardView, PartLineView, SignatureStroke, TicketView } from "./types";

/**
 * E4 mutation overlay.
 *
 * The seeded dataset in `/lib/seed` is never mutated — it is shared by six
 * concurrent build agents and by the reconciliation validator. Everything the
 * user does in a session is written here instead, versioned under
 * `pravaah.v1.service`, and merged over the seed at render time.
 *
 * A schema-version mismatch resets cleanly rather than throwing (AR-5).
 */

export const STORE_KEY = "pravaah.v1.service";
export const STORE_VERSION = 1;

/* ------------------------------------------------------------------ types */

export type TrailKind =
  | "CREATED" | "ASSIGNED" | "STATUS" | "VISIT" | "PARTS" | "STOCK"
  | "COMMUNICATION" | "ESCALATION" | "BREACH" | "PAUSE" | "RESUME"
  | "CLOSURE" | "DOCUMENT" | "INVOICE" | "REQUEST";

export interface TrailEvent {
  id: string;
  ticketId: string | null;
  jobCardId: string | null;
  atMs: number;
  kind: TrailKind;
  title: string;
  detail: string;
  actor: string;
}

export interface TicketPatch {
  status?: TicketStatus;
  engineerId?: string | null;
  engineerName?: string | null;
  assignmentOverrideReason?: string | null;
  pausedMs?: number;
  pauseStartedAtMs?: number | null;
  breachedAtMs?: number | null;
  breachReasonCode?: string | null;
  firstResponseAtMs?: number | null;
  restoredAtMs?: number | null;
  closedAtMs?: number | null;
}

export interface JobCardPatch {
  checkInAtMs?: number | null;
  checkOutAtMs?: number | null;
  checkInPlace?: string | null;
  observations?: string;
  rootCause?: RootCause | null;
  workPerformed?: string;
  runningHoursReading?: number | null;
  meterReplacementNote?: string | null;
  nextVisitRecommendation?: string;
  outcome?: JobOutcome | null;
  customerAckName?: string | null;
  customerAckDesignation?: string | null;
  signatureStrokes?: SignatureStroke[] | null;
  photos?: { caption: string; tone: string }[];
  labourAmount?: number;
  travelAmount?: number;
  submittedAtMs?: number | null;
  tapCount?: number | null;
  /** Held on the device because connectivity was simulated as unavailable. */
  pendingSync?: boolean;
}

export interface PauseWindow {
  id: string;
  ticketId: string;
  status: TicketStatus;
  fromMs: number;
  toMs: number | null;
  reason: string;
}

export interface MovementRow {
  id: string;
  type: "ISSUE" | "RETURN";
  itemId: string;
  itemCode: string;
  description: string;
  qty: number;
  rate: number;
  locationId: string;
  locationName: string;
  sourceType: "JOB_CARD";
  sourceId: string;
  sourceLabel: string;
  atMs: number;
  byUser: string;
}

export interface PartsRequestRow {
  id: string;
  number: string;
  jobCardId: string;
  ticketId: string;
  itemId: string;
  itemCode: string;
  description: string;
  qtyRequested: number;
  qtyAvailable: number;
  locationId: string;
  locationName: string;
  serviceCritical: boolean;
  raisedAtMs: number;
  notified: string[];
  status: "PENDING";
}

export interface NotificationRow {
  id: string;
  role: string;
  channel: string;
  type: string;
  title: string;
  body: string;
  href: string;
  atMs: number;
  entityId: string;
}

export interface ServiceInvoiceRow {
  id: string;
  number: string;
  jobCardId: string;
  jobCardNumber: string;
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  placeOfSupply: string;
  dateMs: number;
  lines: { description: string; hsnSac: string; uom: string; qty: number; rate: number; gstRate: number }[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface ServiceOverlay {
  v: number;
  offline: boolean;
  tickets: Record<string, TicketPatch>;
  newTickets: TicketView[];
  jobCards: Record<string, JobCardPatch>;
  newJobCards: JobCardView[];
  parts: PartLineView[];
  removedParts: string[];
  movements: MovementRow[];
  partsRequests: PartsRequestRow[];
  serviceCriticalItems: string[];
  pauses: PauseWindow[];
  events: TrailEvent[];
  notifications: NotificationRow[];
  invoices: ServiceInvoiceRow[];
  /** Job cards captured while the simulated connection was down. */
  queued: string[];
  exports: { id: string; jobCardId: string; kind: string; atMs: number }[];
}

export function blankOverlay(): ServiceOverlay {
  return {
    v: STORE_VERSION,
    offline: false,
    tickets: {},
    newTickets: [],
    jobCards: {},
    newJobCards: [],
    parts: [],
    removedParts: [],
    movements: [],
    partsRequests: [],
    serviceCriticalItems: [],
    pauses: [],
    events: [],
    notifications: [],
    invoices: [],
    queued: [],
    exports: [],
  };
}

const EMPTY: ServiceOverlay = Object.freeze(blankOverlay());

/* ------------------------------------------------------------------ store */

let cache: ServiceOverlay | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOverlay(): ServiceOverlay {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      cache = blankOverlay();
      return cache;
    }
    const parsed = JSON.parse(raw) as Partial<ServiceOverlay>;
    cache = parsed.v === STORE_VERSION ? { ...blankOverlay(), ...parsed } : blankOverlay();
  } catch {
    cache = blankOverlay();
  }
  return cache;
}

function commit(next: ServiceOverlay) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* quota or private mode — the session still works from memory */
    }
  }
  emit();
}

export function updateOverlay(fn: (current: ServiceOverlay) => ServiceOverlay): void {
  commit(fn(getOverlay()));
}

export function resetOverlay(): void {
  commit(blankOverlay());
}

export function useOverlay(): ServiceOverlay {
  return useSyncExternalStore(subscribe, getOverlay, () => EMPTY);
}

/** True once the client has hydrated — used to gate localStorage-derived UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${counter.toString(36).toUpperCase()}`;
}

/* -------------------------------------------------------------- mutations */

export function logEvent(e: Omit<TrailEvent, "id">): void {
  updateOverlay((o) => ({ ...o, events: [...o.events, { ...e, id: uid("EVT") }] }));
}

export function notify(rows: Omit<NotificationRow, "id">[]): void {
  if (!rows.length) return;
  updateOverlay((o) => ({
    ...o,
    notifications: [...o.notifications, ...rows.map((r) => ({ ...r, id: uid("NTF") }))],
  }));
}

export function patchTicket(id: string, patch: TicketPatch): void {
  updateOverlay((o) => ({
    ...o,
    tickets: { ...o.tickets, [id]: { ...(o.tickets[id] ?? {}), ...patch } },
  }));
}

export function addTicket(t: TicketView): void {
  updateOverlay((o) => ({ ...o, newTickets: [...o.newTickets, { ...t, sessionCreated: true }] }));
}

export function patchJobCard(id: string, patch: JobCardPatch): void {
  updateOverlay((o) => ({
    ...o,
    jobCards: { ...o.jobCards, [id]: { ...(o.jobCards[id] ?? {}), ...patch } },
  }));
}

export function addJobCard(j: JobCardView): void {
  updateOverlay((o) => ({ ...o, newJobCards: [...o.newJobCards, { ...j, sessionCreated: true }] }));
}

export function addPart(line: Omit<PartLineView, "id">): string {
  const id = uid("PCN");
  updateOverlay((o) => ({
    ...o,
    parts: [...o.parts, { ...line, id, sessionAdded: true }],
  }));
  return id;
}

export function setPartQty(id: string, qty: number): void {
  updateOverlay((o) => ({
    ...o,
    parts: o.parts.map((p) => (p.id === id ? { ...p, qty } : p)),
  }));
}

export function dropPart(id: string): void {
  updateOverlay((o) => ({
    ...o,
    parts: o.parts.filter((p) => p.id !== id),
    removedParts: [...o.removedParts, id],
  }));
}

export function markPartReturned(id: string, returned: boolean): void {
  updateOverlay((o) => ({
    ...o,
    parts: o.parts.map((p) => (p.id === id ? { ...p, returned } : p)),
  }));
}

export function writeMovements(rows: Omit<MovementRow, "id">[]): void {
  if (!rows.length) return;
  updateOverlay((o) => ({
    ...o,
    movements: [...o.movements, ...rows.map((r) => ({ ...r, id: uid("STM") }))],
  }));
}

export function raisePartsRequest(row: Omit<PartsRequestRow, "id">): void {
  updateOverlay((o) => ({
    ...o,
    partsRequests: [...o.partsRequests, { ...row, id: uid("PRQ") }],
    serviceCriticalItems: o.serviceCriticalItems.includes(row.itemId)
      ? o.serviceCriticalItems
      : [...o.serviceCriticalItems, row.itemId],
  }));
}

export function openPause(w: Omit<PauseWindow, "id">): void {
  updateOverlay((o) => ({ ...o, pauses: [...o.pauses, { ...w, id: uid("PAU") }] }));
}

export function closePause(ticketId: string, atMs: number): void {
  updateOverlay((o) => ({
    ...o,
    pauses: o.pauses.map((p) => (p.ticketId === ticketId && p.toMs === null ? { ...p, toMs: atMs } : p)),
  }));
}

export function setOffline(offline: boolean): void {
  updateOverlay((o) => ({ ...o, offline }));
}

export function queueForSync(jobCardId: string): void {
  updateOverlay((o) => ({
    ...o,
    queued: o.queued.includes(jobCardId) ? o.queued : [...o.queued, jobCardId],
  }));
}

export function flushQueue(): string[] {
  const pending = getOverlay().queued;
  if (pending.length) {
    updateOverlay((o) => ({
      ...o,
      queued: [],
      jobCards: Object.fromEntries(
        Object.entries(o.jobCards).map(([k, v]) => [k, pending.includes(k) ? { ...v, pendingSync: false } : v]),
      ),
    }));
  }
  return pending;
}

export function createInvoice(row: Omit<ServiceInvoiceRow, "id">): string {
  const id = uid("INV");
  updateOverlay((o) => ({ ...o, invoices: [...o.invoices, { ...row, id }] }));
  return id;
}

export function recordExport(jobCardId: string, kind: string, atMs: number): void {
  updateOverlay((o) => ({
    ...o,
    exports: [...o.exports, { id: uid("EXP"), jobCardId, kind, atMs }],
  }));
}

/* --------------------------------------------------------------- selectors */

export function useTicketPatch(id: string): TicketPatch | undefined {
  const o = useOverlay();
  return o.tickets[id];
}

export function useJobCardPatch(id: string): JobCardPatch | undefined {
  const o = useOverlay();
  return o.jobCards[id];
}

export function useTrail(ticketId: string): TrailEvent[] {
  const o = useOverlay();
  return o.events.filter((e) => e.ticketId === ticketId);
}

/** Stable callback that merges a ticket patch over a projected ticket. */
export function useApplyTicketPatch(): (t: TicketView, patch: TicketPatch | undefined) => TicketView {
  return useCallback((t, patch) => (patch ? mergeTicket(t, patch) : t), []);
}

export function mergeTicket(t: TicketView, patch: TicketPatch | undefined): TicketView {
  if (!patch) return t;
  return {
    ...t,
    status: patch.status ?? t.status,
    engineerId: patch.engineerId !== undefined ? patch.engineerId : t.engineerId,
    engineerName: patch.engineerName !== undefined ? patch.engineerName : t.engineerName,
    assignmentOverrideReason:
      patch.assignmentOverrideReason !== undefined
        ? patch.assignmentOverrideReason
        : t.assignmentOverrideReason,
    pausedMs: patch.pausedMs ?? t.pausedMs,
    pauseStartedAtMs:
      patch.pauseStartedAtMs !== undefined ? patch.pauseStartedAtMs : t.pauseStartedAtMs,
    breachedAtMs: patch.breachedAtMs !== undefined ? patch.breachedAtMs : t.breachedAtMs,
    breachReasonCode:
      patch.breachReasonCode !== undefined ? patch.breachReasonCode : t.breachReasonCode,
    firstResponseAtMs:
      patch.firstResponseAtMs !== undefined ? patch.firstResponseAtMs : t.firstResponseAtMs,
    restoredAtMs: patch.restoredAtMs !== undefined ? patch.restoredAtMs : t.restoredAtMs,
    closedAtMs: patch.closedAtMs !== undefined ? patch.closedAtMs : t.closedAtMs,
  };
}

export function mergeJobCard(j: JobCardView, patch: JobCardPatch | undefined): JobCardView {
  if (!patch) return j;
  return {
    ...j,
    checkInAtMs: patch.checkInAtMs !== undefined ? patch.checkInAtMs : j.checkInAtMs,
    checkOutAtMs: patch.checkOutAtMs !== undefined ? patch.checkOutAtMs : j.checkOutAtMs,
    checkInPlace: patch.checkInPlace !== undefined ? patch.checkInPlace : j.checkInPlace,
    observations: patch.observations ?? j.observations,
    rootCause: patch.rootCause !== undefined ? patch.rootCause : j.rootCause,
    workPerformed: patch.workPerformed ?? j.workPerformed,
    runningHoursReading:
      patch.runningHoursReading !== undefined ? patch.runningHoursReading : j.runningHoursReading,
    meterReplacementNote:
      patch.meterReplacementNote !== undefined ? patch.meterReplacementNote : j.meterReplacementNote,
    nextVisitRecommendation: patch.nextVisitRecommendation ?? j.nextVisitRecommendation,
    outcome: patch.outcome !== undefined ? patch.outcome : j.outcome,
    customerAckName: patch.customerAckName !== undefined ? patch.customerAckName : j.customerAckName,
    customerAckDesignation:
      patch.customerAckDesignation !== undefined
        ? patch.customerAckDesignation
        : j.customerAckDesignation,
    signatureStrokes:
      patch.signatureStrokes !== undefined ? patch.signatureStrokes : j.signatureStrokes,
    photos: patch.photos ?? j.photos,
    labourAmount: patch.labourAmount ?? j.labourAmount,
    travelAmount: patch.travelAmount ?? j.travelAmount,
    submittedAtMs: patch.submittedAtMs !== undefined ? patch.submittedAtMs : j.submittedAtMs,
    tapCount: patch.tapCount !== undefined ? patch.tapCount : j.tapCount,
  };
}

/** E4-S4: first-visit resolution is derived, never entered. */
export function firstVisitResolved(j: Pick<JobCardView, "outcome" | "visitSequence">): boolean {
  return j.outcome === "RESOLVED" && j.visitSequence === 1;
}
