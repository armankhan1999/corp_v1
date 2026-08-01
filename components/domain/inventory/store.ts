"use client";

/**
 * E7 — inventory mutation overlay.
 *
 * The seeded dataset is immutable: `getDataset()` returns the one deterministic
 * world and nothing here ever writes into it. Every mutation this epic performs
 * is recorded in a versioned overlay persisted to `localStorage` under
 * `pravaah.v1.inventory`, and `model.ts` folds the overlay over the seed to
 * produce the view every inventory screen renders from.
 *
 * The rule that matters most: `appendMovement` is the ONLY way a balance can
 * change, it always allocates the next `seq`, and there is no update or delete
 * counterpart. That is what makes the ledger append-only in fact rather than by
 * convention — the seed validator asserts the same property.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type * as T from "@/lib/schemas/entities";
import type { AuditAction, ItemCategory, Role } from "@/lib/schemas/enums";
import { SESSION_COOKIE, decodeSession, type Session } from "@/lib/rbac/session";

export const STORAGE_KEY = "pravaah.v1.inventory";
export const OVERLAY_VERSION = 1;

/** FR-M6-12 — the configured threshold above which a PO needs approval first. */
export const PO_APPROVAL_THRESHOLD = 200_000;
/** E7-S6 — the report's default trailing window. */
export const DEFAULT_TRAILING_DAYS = 180;

/* ------------------------------------------------------------------ types */

export interface InvAudit {
  id: string;
  at: string;
  actorUserId: string;
  actorName: string;
  actorRole: Role;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
}

/** Notification treatment is part of the AC, so it is modelled, not implied. */
export interface InvNotice {
  id: string;
  at: string;
  toUserId: string;
  toLabel: string;
  channel: "IN_APP" | "WHATSAPP" | "EMAIL";
  /** false = sent immediately; true = batched into the daily digest. */
  digest: boolean;
  title: string;
  body: string;
  href: string | null;
}

/** E7-S3 / E7-S5 — a shortfall that stopped a repair, carried onto the reorder list. */
export interface CriticalFlag {
  itemId: string;
  jobCardId: string | null;
  jobCardNumber: string;
  shortfall: number;
  reason: string;
  at: string;
}

export interface RequestPatch {
  status: T.PartsRequest["status"];
  lines: { itemId: string; qtyRequested: number; qtyIssued: number }[];
  issuedAt: string | null;
}

export interface Overlay {
  v: number;
  itemPatches: Record<string, Partial<T.Item>>;
  newItems: T.Item[];
  movements: T.StockMovement[];
  requestPatches: Record<string, RequestPatch>;
  newRequests: T.PartsRequest[];
  newLocations: T.StockLocation[];
  newSuppliers: T.Supplier[];
  supplierPatches: Record<string, Partial<T.Supplier>>;
  newPOs: T.PurchaseOrder[];
  newPOLines: T.POLine[];
  poPatches: Record<string, Partial<T.PurchaseOrder>>;
  poLinePatches: Record<string, { qtyReceived: number }>;
  newGRNs: T.GoodsReceipt[];
  stockCounts: T.StockCount[];
  criticalFlags: CriticalFlag[];
  audit: InvAudit[];
  notices: InvNotice[];
  /** RBAC-3 — the location set a STORE_INCHARGE is assigned to act on. */
  storeScope: string[] | null;
  counters: Record<string, number>;
}

export const EMPTY_OVERLAY: Overlay = {
  v: OVERLAY_VERSION,
  itemPatches: {},
  newItems: [],
  movements: [],
  requestPatches: {},
  newRequests: [],
  newLocations: [],
  newSuppliers: [],
  supplierPatches: {},
  newPOs: [],
  newPOLines: [],
  poPatches: {},
  poLinePatches: {},
  newGRNs: [],
  stockCounts: [],
  criticalFlags: [],
  audit: [],
  notices: [],
  storeScope: null,
  counters: {},
};

/* ------------------------------------------------------------- the store */

let overlay: Overlay = EMPTY_OVERLAY;
let revision = 0;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  revision += 1;
  for (const l of listeners) l();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    /* Quota or private mode — the session still works, it just will not survive
       a reload. Surfaced by the caller as a non-blocking warning. */
  }
}

/** AR-5 — a version mismatch resets cleanly rather than throwing. */
export function hydrateOverlay(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Overlay;
    if (!parsed || parsed.v !== OVERLAY_VERSION) return;
    overlay = { ...EMPTY_OVERLAY, ...parsed };
    emit();
  } catch {
    overlay = EMPTY_OVERLAY;
  }
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getRevision(): number {
  return revision;
}

export function getServerRevision(): number {
  return 0;
}

export function getOverlay(): Overlay {
  return overlay;
}

/** Every mutation goes through here: clone, apply, persist, notify. */
export function mutate(fn: (draft: Overlay) => void): void {
  const draft: Overlay = JSON.parse(JSON.stringify(overlay)) as Overlay;
  fn(draft);
  overlay = draft;
  persist();
  emit();
}

export function resetOverlay(): void {
  overlay = EMPTY_OVERLAY;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
  emit();
}

export function nextCounter(draft: Overlay, key: string, from: number): number {
  const current = draft.counters[key] ?? from;
  const next = current + 1;
  draft.counters[key] = next;
  return next;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/* ------------------------------------------------------------------ actor */

export interface Actor {
  userId: string;
  name: string;
  role: Role;
  branchId: string;
}

export const FALLBACK_ACTOR: Actor = {
  userId: "USR-10",
  name: "Store In-charge",
  role: "STORE_INCHARGE",
  branchId: "BR-01",
};

export function readSession(): Session | null {
  if (typeof document === "undefined") return null;
  const prefix = `${SESSION_COOKIE}=`;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  return decodeSession(raw ? raw.slice(prefix.length) : null);
}

export function actorOf(session: Session | null): Actor {
  if (!session) return FALLBACK_ACTOR;
  return {
    userId: session.userId,
    name: session.name,
    role: session.role,
    branchId: session.branchId,
  };
}

/* ------------------------------------------------------- append-only write */

export interface MovementDraft {
  itemId: string;
  type: T.StockMovement["type"];
  qty: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  sourceType: T.StockMovement["sourceType"];
  sourceId: string | null;
  sourceLabel: string;
  rate: number;
  reason: string | null;
  at?: string;
}

/**
 * The single write path into the ledger. There is deliberately no
 * `editMovement` and no `deleteMovement` anywhere in this epic — a correction
 * is another call to this function carrying a stated reason (E7-S2).
 */
export function appendMovements(
  draft: Overlay,
  baseMaxSeq: number,
  actor: Actor,
  drafts: MovementDraft[],
  at: string,
): T.StockMovement[] {
  const written: T.StockMovement[] = [];
  let seq = Math.max(baseMaxSeq, ...draft.movements.map((m) => m.seq), 0);
  for (const d of drafts) {
    seq += 1;
    written.push({
      id: `STM-${pad(seq, 5)}`,
      seq,
      itemId: d.itemId,
      type: d.type,
      qty: d.qty,
      fromLocationId: d.fromLocationId,
      toLocationId: d.toLocationId,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      sourceLabel: d.sourceLabel,
      rate: d.rate,
      byUserId: actor.userId,
      at: d.at ?? at,
      reason: d.reason,
    });
  }
  draft.movements.push(...written);
  return written;
}

/* ------------------------------------------------------------ audit trail */

export function writeAudit(
  draft: Overlay,
  actor: Actor,
  entry: Omit<InvAudit, "id" | "at" | "actorUserId" | "actorName" | "actorRole"> & { at: string },
): void {
  const n = nextCounter(draft, "audit", 0);
  draft.audit.push({
    id: `INV-AUD-${pad(n, 4)}`,
    actorUserId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    ...entry,
  });
}

export function notify(
  draft: Overlay,
  entry: Omit<InvNotice, "id">,
): void {
  const n = nextCounter(draft, "notice", 0);
  draft.notices.push({ id: `INV-NTF-${pad(n, 4)}`, ...entry });
}

/* --------------------------------------------------------------- factories */

export interface ItemDraft {
  code: string;
  description: string;
  category: ItemCategory;
  principal: T.Item["principal"];
  productLine: T.Item["productLine"];
  oemPartNumber: string;
  uom: string;
  hsnSac: string;
  gstRate: number;
  standardCost: number;
  standardPrice: number;
  reorderLevel: number;
  reorderQty: number;
  leadTimeDays: number;
  storageLocation: string;
  active: boolean;
}

export function createItem(draft: Overlay, base: ItemDraft, baseCount: number): T.Item {
  const n = nextCounter(draft, "item", baseCount);
  const item: T.Item = { id: `ITM-${pad(n, 4)}`, ...base };
  draft.newItems.push(item);
  return item;
}

/* ------------------------------------------------------------- React glue */

/**
 * Hydration contract: the server render and the first client render both see an
 * empty overlay, so markup matches. `ready` flips after mount, at which point
 * the persisted overlay and the (browser-side) dataset are folded in. Screens
 * render their skeleton until then, which is also the loading state E14-S2 asks
 * for — the same geometry, no reflow.
 */
export function useOverlay(): { overlay: Overlay; revision: number; ready: boolean } {
  const [ready, setReady] = useState(false);
  const rev = useSyncExternalStore(subscribe, getRevision, getServerRevision);

  useEffect(() => {
    hydrateOverlay();
    setReady(true);
  }, []);

  return {
    overlay: ready ? getOverlay() : EMPTY_OVERLAY,
    revision: ready ? rev : -1,
    ready,
  };
}

export function useActor(): Actor {
  const [actor, setActor] = useState<Actor>(FALLBACK_ACTOR);
  useEffect(() => {
    setActor(actorOf(readSession()));
  }, []);
  return actor;
}

/** Small helper so screens can express "apply this change" in one line. */
export function useMutate(): (fn: (draft: Overlay) => void) => void {
  return useCallback((fn: (draft: Overlay) => void) => mutate(fn), []);
}

export function useStorageWarning(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem("pravaah.v1.probe", "1");
      window.localStorage.removeItem("pravaah.v1.probe");
      return false;
    } catch {
      return true;
    }
  }, []);
}
