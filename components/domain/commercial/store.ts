"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  type ChallanRow, type CommercialSettings, type EwayRow, type FollowUpRow,
  type InvoiceRow, type LineRow, type NoteRow, type ReceiptRow, type SourceRef,
} from "./types";

/**
 * The commercial overlay (AR-5).
 *
 * Nothing here mutates the seeded dataset. Every mutation this epic performs —
 * a challan raised, an invoice issued, a receipt allocated, a credit note
 * passed, a follow-up logged, a setting changed in Masters — is written to
 * `localStorage` under the `pravaah.v1.*` namespace and layered over the seed
 * at read time. Clearing the key returns the demonstration to its baseline.
 */

export const STORE_KEY = "pravaah.v1.commercial";
export const STORE_VERSION = 1;

/* ------------------------------------------------------------------ shapes */

export interface OverlayInvoice { row: InvoiceRow; lines: LineRow[] }

export interface OverlayAllocation {
  id: string;
  receiptId: string;
  invoiceId: string;
  amount: number;
  at: string;
}

export type UpiState = "GENERATED" | "SENT" | "VIEWED" | "PAID";

export const UPI_FLOW: UpiState[] = ["GENERATED", "SENT", "VIEWED", "PAID"];

export interface UpiLink {
  invoiceId: string;
  invoiceNumber: string;
  linkId: string;
  vpa: string;
  amount: number;
  state: UpiState;
  history: { state: UpiState; at: string }[];
  receiptId: string | null;
}

export interface HandoffExport {
  id: string;
  periodLabel: string;
  from: string;
  to: string;
  counts: { invoices: number; receipts: number; challans: number; notes: number };
  values: { invoices: number; receipts: number; challans: number; notes: number };
  succeeded: number;
  failed: number;
  failures: { number: string; reason: string }[];
  actorName: string;
  actorRole: string;
  at: string;
}

export interface CommercialAudit {
  id: string;
  seq: number;
  action: "CREATE" | "UPDATE" | "EXPORT" | "SIMULATED_INTEGRATION" | "STATE_TRANSITION";
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  at: string;
}

export interface CommercialOverlay {
  v: number;
  settings: CommercialSettings;
  challans: ChallanRow[];
  invoices: OverlayInvoice[];
  ewayBills: EwayRow[];
  receipts: ReceiptRow[];
  allocations: OverlayAllocation[];
  notes: NoteRow[];
  followUps: FollowUpRow[];
  /** Invoice ids whose outstanding promise a receipt has since honoured. */
  promisesSettled: string[];
  /** Simulated IRP reporting timestamps keyed by invoice id. */
  irpReported: Record<string, string>;
  /** Bidirectional source links added to invoices raised before the link existed. */
  sourceLinks: Record<string, SourceRef>;
  upiLinks: Record<string, UpiLink>;
  exports: HandoffExport[];
  audit: CommercialAudit[];
  /** Sequence numbers consumed this session, per document type. */
  consumed: Record<string, number>;
}

export function emptyOverlay(): CommercialOverlay {
  return {
    v: STORE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    challans: [], invoices: [], ewayBills: [], receipts: [], allocations: [],
    notes: [], followUps: [], promisesSettled: [], irpReported: {}, sourceLinks: {},
    upiLinks: {}, exports: [], audit: [], consumed: {},
  };
}

/* ------------------------------------------------------------------ engine */

let state: CommercialOverlay = emptyOverlay();
let hydrated = false;
const listeners = new Set<() => void>();

function read(): CommercialOverlay {
  if (typeof window === "undefined") return emptyOverlay();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as CommercialOverlay;
    // AR-5 — a version mismatch resets cleanly rather than throwing.
    if (!parsed || parsed.v !== STORE_VERSION) return emptyOverlay();
    return { ...emptyOverlay(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    return emptyOverlay();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* Quota or private browsing — the session continues in memory. */
  }
}

function emit() { for (const l of listeners) l(); }

function subscribe(listener: () => void) {
  if (!hydrated) { state = read(); hydrated = true; }
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) { state = read(); emit(); }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): CommercialOverlay { return state; }

const SERVER_SNAPSHOT = emptyOverlay();
function serverSnapshot(): CommercialOverlay { return SERVER_SNAPSHOT; }

function commit(next: CommercialOverlay) {
  state = next;
  persist();
  emit();
}

/** Every mutation routes through here, so nothing changes without an entry. AR-9. */
function withAudit(
  next: CommercialOverlay,
  entry: Omit<CommercialAudit, "id" | "seq" | "at">,
  at?: string,
): CommercialOverlay {
  const seq = next.audit.length + 1;
  return {
    ...next,
    audit: [
      ...next.audit,
      { ...entry, id: `CAUD-${String(seq).padStart(4, "0")}`, seq, at: at ?? new Date().toISOString() },
    ],
  };
}

/* ------------------------------------------------------------------- hooks */

export function useCommercialOverlay(): CommercialOverlay {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/* ----------------------------------------------------------------- actions */

export interface ActorInput { userId: string; name: string; role: string }

function bump(consumed: Record<string, number>, docType: string): Record<string, number> {
  return { ...consumed, [docType]: (consumed[docType] ?? 0) + 1 };
}

/**
 * E8-S5 — a receipt allocated against an invoice discharges any payment
 * promise standing against it, and the invoice leaves the broken-promise list.
 */
function settle(next: CommercialOverlay, invoiceIds: string[]): CommercialOverlay {
  if (!invoiceIds.length) return next;
  return { ...next, promisesSettled: [...new Set([...next.promisesSettled, ...invoiceIds])] };
}

export const actions = {
  reset() { commit(emptyOverlay()); },

  updateSettings(patch: Partial<CommercialSettings>, actor: ActorInput) {
    const before = state.settings;
    const settings = { ...before, ...patch };
    const changed = (Object.keys(patch) as (keyof CommercialSettings)[])
      .filter((k) => before[k] !== settings[k])
      .map((k) => `${SETTING_LABEL[k]} ${before[k]} → ${settings[k]}`);
    if (!changed.length) return;
    commit(withAudit({ ...state, settings }, {
      action: "UPDATE", entityType: "CommercialSettings", entityId: "MASTERS-COMMERCIAL",
      entityLabel: "Masters — Commercial",
      summary: `Configuration changed. ${changed.join("; ")}.`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  addChallan(row: ChallanRow, actor: ActorInput) {
    commit(withAudit(
      { ...state, challans: [...state.challans, row], consumed: bump(state.consumed, "CHALLAN") },
      {
        action: "CREATE", entityType: "DeliveryChallan", entityId: row.id, entityLabel: row.number,
        summary: `Delivery challan raised against ${row.sourceLabel} for despatch to ${row.customerName} by ${row.transportMode.toLowerCase()}, vehicle ${row.vehicleNumber}.`,
        actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
      },
    ));
  },

  addInvoice(entry: OverlayInvoice, actor: ActorInput) {
    commit(withAudit(
      { ...state, invoices: [...state.invoices, entry], consumed: bump(state.consumed, "INVOICE") },
      {
        action: "CREATE", entityType: "Invoice", entityId: entry.row.id, entityLabel: entry.row.number,
        summary:
          `Tax invoice issued to ${entry.row.customerName} (${entry.row.taxTreatment}).` +
          (entry.row.source ? ` Raised from ${entry.row.source.label}.` : "") +
          (entry.row.irn ? " IRN generated." : " No IRN — e-invoicing does not apply."),
        actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
      },
    ));
  },

  reportToIrp(invoiceId: string, number: string, at: string, actor: ActorInput) {
    commit(withAudit({ ...state, irpReported: { ...state.irpReported, [invoiceId]: at } }, {
      action: "SIMULATED_INTEGRATION", entityType: "Invoice", entityId: invoiceId, entityLabel: number,
      summary: "Reported to the Invoice Registration Portal (simulated — INT-02).",
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  linkSource(invoiceId: string, number: string, ref: SourceRef, actor: ActorInput) {
    commit(withAudit(
      { ...state, sourceLinks: { ...state.sourceLinks, [invoiceId]: { ...ref, linkedHere: true } } },
      {
        action: "UPDATE", entityType: "Invoice", entityId: invoiceId, entityLabel: number,
        summary: `Source document linked: ${ref.label}. The link resolves from either side.`,
        actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
      },
    ));
  },

  addEway(row: EwayRow, actor: ActorInput) {
    commit(withAudit({ ...state, ewayBills: [...state.ewayBills, row] }, {
      action: "SIMULATED_INTEGRATION", entityType: "EWayBill", entityId: row.id, entityLabel: row.ebn,
      summary: `E-way bill generated against ${row.baseDocNumber} for ${row.distanceKm} km, valid to ${row.validUntil.slice(0, 10)} (simulated — INT-03).`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  addReceipt(row: ReceiptRow, allocations: OverlayAllocation[], actor: ActorInput) {
    let next: CommercialOverlay = {
      ...state,
      receipts: [...state.receipts, row],
      allocations: [...state.allocations, ...allocations],
      consumed: bump(state.consumed, "RECEIPT"),
    };
    next = settle(next, allocations.map((a) => a.invoiceId));
    commit(withAudit(next, {
      action: "CREATE", entityType: "Receipt", entityId: row.id, entityLabel: row.number,
      summary:
        `Receipt of ${row.amount} recorded from ${row.customerName} via ${row.mode}` +
        (allocations.length
          ? `, allocated across ${allocations.length} invoice${allocations.length === 1 ? "" : "s"}.`
          : ", left wholly unallocated."),
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  allocate(receiptId: string, receiptNumber: string, allocations: OverlayAllocation[], actor: ActorInput) {
    let next: CommercialOverlay = { ...state, allocations: [...state.allocations, ...allocations] };
    next = settle(next, allocations.map((a) => a.invoiceId));
    commit(withAudit(next, {
      action: "UPDATE", entityType: "Receipt", entityId: receiptId, entityLabel: receiptNumber,
      summary: `Allocated across ${allocations.length} invoice${allocations.length === 1 ? "" : "s"}.`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  addNote(row: NoteRow, actor: ActorInput) {
    commit(withAudit(
      { ...state, notes: [...state.notes, row], consumed: bump(state.consumed, "CREDIT_NOTE") },
      {
        action: "CREATE", entityType: "CreditNote", entityId: row.id, entityLabel: row.number,
        summary: `${row.kind === "CREDIT" ? "Credit" : "Debit"} note passed against ${row.invoiceNumber}: ${row.reason}.`,
        actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
      },
    ));
  },

  addFollowUp(row: FollowUpRow, invoiceNumber: string, actor: ActorInput) {
    commit(withAudit({ ...state, followUps: [...state.followUps, row] }, {
      action: "CREATE", entityType: "CollectionFollowUp", entityId: row.id, entityLabel: invoiceNumber,
      summary: `Follow-up logged — ${row.mode.toLowerCase()} with ${row.personSpokenTo}. ${row.outcome}`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  setUpiState(link: UpiLink, actor: ActorInput) {
    commit(withAudit({ ...state, upiLinks: { ...state.upiLinks, [link.invoiceId]: link } }, {
      action: "STATE_TRANSITION", entityType: "UpiCollectionLink", entityId: link.linkId,
      entityLabel: `${link.linkId} · ${link.invoiceNumber}`,
      summary: `Collection link moved to ${link.state} (simulated — INT-06).`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  /** A paid link creates a receipt and allocates it, in one audited step. */
  settleUpi(link: UpiLink, receipt: ReceiptRow, allocation: OverlayAllocation, actor: ActorInput) {
    let next: CommercialOverlay = {
      ...state,
      upiLinks: { ...state.upiLinks, [link.invoiceId]: { ...link, state: "PAID", receiptId: receipt.id } },
      receipts: [...state.receipts, receipt],
      allocations: [...state.allocations, allocation],
      consumed: bump(state.consumed, "RECEIPT"),
    };
    next = settle(next, [allocation.invoiceId]);
    commit(withAudit(next, {
      action: "SIMULATED_INTEGRATION", entityType: "Receipt", entityId: receipt.id, entityLabel: receipt.number,
      summary: `UPI collection link paid; receipt created and allocated to ${link.invoiceNumber} (simulated — INT-06).`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }));
  },

  recordExport(entry: HandoffExport, actor: ActorInput) {
    commit(withAudit({ ...state, exports: [...state.exports, entry] }, {
      action: "EXPORT", entityType: "LedgerHandoff", entityId: entry.id, entityLabel: entry.periodLabel,
      summary:
        `Ledger hand-off exported for ${entry.periodLabel} — ` +
        `${entry.counts.invoices} invoices, ${entry.counts.receipts} receipts, ` +
        `${entry.counts.challans} challans, ${entry.counts.notes} credit and debit notes; ` +
        `${entry.succeeded} accepted, ${entry.failed} rejected (simulated).`,
      actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    }, entry.at));
  },
};

const SETTING_LABEL: Record<keyof CommercialSettings, string> = {
  eInvoiceWindowDays: "E-invoice reporting window (days)",
  ewayThreshold: "E-way bill threshold (₹)",
  ewayMaxBaseAgeDays: "Maximum base-document age (days)",
  ewayKmPerValidityDay: "Kilometres per day of Part-B validity",
  eInvoiceWarnDays: "Days before deadline at which an invoice is flagged",
};

export { SETTING_LABEL };

/* --------------------------------------------------------------- numbering */

/**
 * E8-S7 / FR-M7-19. The next number is the highest sequence the seed issued
 * plus everything this session consumed, plus one. Because the counter is
 * derived from what exists rather than stored beside it, a series cannot
 * silently skip a number or hand the same one out twice.
 */
export function nextSeriesNumber(
  overlay: CommercialOverlay,
  docType: string,
  prefix: string,
  fySegment: string,
  width: number,
  seededHighest: number,
): { seq: number; number: string } {
  const seq = seededHighest + (overlay.consumed[docType] ?? 0) + 1;
  return { seq, number: `${prefix}/${fySegment}/${String(seq).padStart(width, "0")}` };
}

export function nextEntityId(prefix: string, overlay: CommercialOverlay, docType: string, seededCount: number): string {
  return `${prefix}-${String(seededCount + (overlay.consumed[docType] ?? 0) + 1).padStart(4, "0")}`;
}
