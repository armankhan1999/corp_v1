"use client";

import { useCallback, useEffect, useState } from "react";
import { addMonths } from "@/lib/format";
import type { AssetStatus, CommissioningSubmission, CoverageState } from "@/lib/schemas/enums";
import type {
  AmcRow,
  AmcVisitRow,
  AssetRow,
  CommissioningDetail,
  CommissioningRow,
  RentalAgreementRow,
} from "./types";

/**
 * AR-5 — the browser overlay. Every mutation Epic E5 offers is written here,
 * versioned and schema-guarded, under the `pravaah.v1.*` namespace. The seeded
 * dataset object is never mutated; it stays the reproducible baseline (SD-1).
 */

const NS = "pravaah.v1";
export const OVERLAY_VERSION = 1;

export const OVERLAY_KEYS = {
  assets: `${NS}.assets`,
  commissioning: `${NS}.commissioning`,
  amc: `${NS}.amc`,
  renewals: `${NS}.renewals`,
  rental: `${NS}.rental`,
} as const;

interface Versioned {
  v: number;
}

/* --------------------------------------------------------------- shapes */

export interface AssetsOverlay extends Versioned {
  /** Field-level edits against a seeded asset, keyed by asset id. */
  patches: Record<string, Partial<AssetRow>>;
  /** Assets created in the browser. */
  created: AssetRow[];
}

export interface CommissioningOverlay extends Versioned {
  /** Simulated OEM submissions, keyed by report id. */
  submissions: Record<string, { submittedAt: string; acknowledgementRef: string }>;
  /** Reports written from the field form, keyed by report id. */
  created: CommissioningDetail[];
}

export interface AmcOverlay extends Versioned {
  created: AmcRow[];
  patches: Record<string, Partial<AmcRow>>;
  /** Preventive-visit schedules generated on activation, keyed by contract id. */
  visits: Record<string, AmcVisitRow[]>;
  /** Visits converted to a ticket in one action, keyed by visit id. */
  converted: Record<string, { ticketNumber: string; at: string }>;
}

export interface RenewalAction {
  status: "IDENTIFIED" | "QUOTED" | "WON" | "LOST";
  lastAction: string;
  at: string;
  quotationNumber: string | null;
  quotationValue: number | null;
  sourceContractId: string | null;
}

export interface RenewalsOverlay extends Versioned {
  /** Keyed by AMC contract id or `asset:<id>` for warranty conversions. */
  actions: Record<string, RenewalAction>;
}

export interface RentalOverlay extends Versioned {
  created: RentalAgreementRow[];
  returns: Record<string, { actualReturn: string; returnCondition: string; damageNote: string }>;
  /** Overdue notifications already dispatched, keyed by agreement id. */
  notified: Record<string, string>;
}

export const EMPTY_ASSETS: AssetsOverlay = { v: OVERLAY_VERSION, patches: {}, created: [] };
export const EMPTY_COMMISSIONING: CommissioningOverlay = { v: OVERLAY_VERSION, submissions: {}, created: [] };
export const EMPTY_AMC: AmcOverlay = { v: OVERLAY_VERSION, created: [], patches: {}, visits: {}, converted: {} };
export const EMPTY_RENEWALS: RenewalsOverlay = { v: OVERLAY_VERSION, actions: {} };
export const EMPTY_RENTAL: RentalOverlay = { v: OVERLAY_VERSION, created: [], returns: {}, notified: {} };

/* ------------------------------------------------------------ the hook */

function read<T extends Versioned>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    // A version mismatch resets cleanly rather than throwing. AR-5.
    if (!parsed || parsed.v !== OVERLAY_VERSION) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/**
 * Reads on mount only, so the server and first client render agree and
 * hydration never mismatches. `ready` lets a surface hold its skeleton until
 * the overlay has been applied.
 */
export function useOverlay<T extends Versioned>(
  key: string,
  fallback: T,
): { state: T; ready: boolean; update: (fn: (prev: T) => T) => void; reset: () => void } {
  const [state, setState] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read(key, fallback));
    setReady(true);
    // `fallback` is a module-level constant per key; re-reading on identity
    // changes would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (fn: (prev: T) => T) => {
      setState((prev) => {
        const next = fn(prev);
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* quota or private mode — the session simply stays in memory */
        }
        return next;
      });
    },
    [key],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setState(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { state, ready, update, reset };
}

/* ------------------------------------------------- derivation mirrors */

/**
 * Client-side mirrors of `D.warrantyEnd`, `D.coverageState` and
 * `D.commissioningSubmissionState`, used only to re-derive rows the overlay has
 * changed. Identical rules, identical precedence: warranty wins, a concurrent
 * AMC is additional, a decommissioned unit is out of coverage.
 */
export function warrantyEndOf(row: Pick<AssetRow, "commissioningDate" | "warrantyMonths">): Date | null {
  if (!row.commissioningDate) return null;
  return addMonths(new Date(row.commissioningDate), row.warrantyMonths);
}

export function coverageOf(row: AssetRow, now: Date): CoverageState {
  if (row.status === "DECOMMISSIONED") return "OUT_OF_COVERAGE";
  const end = warrantyEndOf(row);
  if (end && end > now) return "IN_WARRANTY";
  if (
    row.amcId &&
    row.amcStart &&
    row.amcEnd &&
    new Date(row.amcStart) <= now &&
    new Date(row.amcEnd) >= now
  ) {
    return "UNDER_AMC";
  }
  return "OUT_OF_COVERAGE";
}

/** True when a live AMC also covers a machine that is still in warranty. */
export function amcAdditionallyInForce(row: AssetRow, now: Date): boolean {
  if (row.status === "DECOMMISSIONED") return false;
  if (!row.amcId || !row.amcStart || !row.amcEnd) return false;
  const live = new Date(row.amcStart) <= now && new Date(row.amcEnd) >= now;
  return live && coverageOf(row, now) === "IN_WARRANTY";
}

export function submissionStateOf(
  submittedAt: string | null,
  deadline: string,
  now: Date,
): CommissioningSubmission {
  if (!submittedAt) return now > new Date(deadline) ? "OVERDUE" : "NOT_SUBMITTED";
  return new Date(submittedAt) <= new Date(deadline) ? "SUBMITTED_IN_WINDOW" : "SUBMITTED_LATE";
}

/* --------------------------------------------------------- appliers */

export function applyAssetOverlay(rows: AssetRow[], overlay: AssetsOverlay, now: Date): AssetRow[] {
  const merged = [
    ...rows.map((r) => {
      const patch = overlay.patches[r.id];
      if (!patch) return r;
      const next = { ...r, ...patch };
      const end = warrantyEndOf(next);
      next.warrantyEnd = end ? end.toISOString() : null;
      next.coverage = coverageOf(next, now);
      return next;
    }),
    ...overlay.created.map((r) => {
      const end = warrantyEndOf(r);
      return { ...r, warrantyEnd: end ? end.toISOString() : null, coverage: coverageOf(r, now) };
    }),
  ];
  return merged;
}

export function applyCommissioningOverlay(
  rows: CommissioningRow[],
  overlay: CommissioningOverlay,
  now: Date,
): CommissioningRow[] {
  const base = rows.map((r) => {
    const sub = overlay.submissions[r.id];
    if (!sub) return r;
    return {
      ...r,
      submittedAt: sub.submittedAt,
      acknowledgementRef: sub.acknowledgementRef,
      submission: submissionStateOf(sub.submittedAt, r.deadline, now),
    };
  });
  const created = overlay.created.map((r) => {
    const sub = overlay.submissions[r.id];
    const submittedAt = sub?.submittedAt ?? r.submittedAt;
    return {
      ...r,
      submittedAt,
      acknowledgementRef: sub?.acknowledgementRef ?? r.acknowledgementRef,
      submission: submissionStateOf(submittedAt, r.deadline, now),
    };
  });
  const seen = new Set(base.map((r) => r.id));
  return [...base, ...created.filter((r) => !seen.has(r.id))];
}

export function applyAmcOverlay(rows: AmcRow[], overlay: AmcOverlay): AmcRow[] {
  return [
    ...rows.map((r) => (overlay.patches[r.id] ? { ...r, ...overlay.patches[r.id] } : r)),
    ...overlay.created.map((r) => (overlay.patches[r.id] ? { ...r, ...overlay.patches[r.id] } : r)),
  ];
}

export function applyRentalOverlay(
  rows: RentalAgreementRow[],
  overlay: RentalOverlay,
): RentalAgreementRow[] {
  const withReturns = (r: RentalAgreementRow): RentalAgreementRow => {
    const ret = overlay.returns[r.id];
    return ret
      ? {
          ...r,
          actualReturn: ret.actualReturn,
          returnCondition: ret.returnCondition,
          damageNote: ret.damageNote,
        }
      : r;
  };
  return [...rows.map(withReturns), ...overlay.created.map(withReturns)];
}

/* ------------------------------------------------------------ helpers */

/** Deterministic-looking local identifiers, distinct from seeded series. */
export function localId(prefix: string): string {
  const n = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, "0");
  return `${prefix}-L${n}`;
}

export function localNumber(prefix: string): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}/${n}`;
}

/** INT-11 — the simulated OEM channel acknowledgement. */
export function simulatedAckRef(): string {
  const n = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .toUpperCase()
    .padStart(8, "0");
  return `OEM-ACK-${n}`;
}

/**
 * E5-S6 — activation generates the committed preventive visits across the whole
 * contract period at even intervals, one set per covered machine. Same interval
 * formula the seeded contracts were built with, so a new contract and a seeded
 * one read identically.
 */
export function generateVisitSchedule(contract: AmcRow): AmcVisitRow[] {
  const start = new Date(contract.startDate).getTime();
  const end = new Date(contract.endDate).getTime();
  const span = end - start;
  const out: AmcVisitRow[] = [];
  let n = 0;
  for (let v = 0; v < contract.visitsPerYear; v++) {
    const due = new Date(start + (span * (v + 1)) / (contract.visitsPerYear + 1));
    contract.assetIds.forEach((assetId, i) => {
      n += 1;
      out.push({
        id: `${contract.id}-SV-${String(n).padStart(3, "0")}`,
        assetId,
        serial: contract.assetSerials[i] ?? assetId,
        sequence: v + 1,
        dueDate: due.toISOString(),
        completedAt: null,
        ticketId: null,
        ticketNumber: null,
        local: true,
      });
    });
  }
  return out;
}

export const DECOMMISSION_REASONS = [
  "Machine scrapped at end of economic life",
  "Replaced under buy-back against a new unit",
  "Sold on by the customer to a third party",
  "Site closed permanently",
  "Damaged beyond economic repair",
  "Returned to OEM under a technical recall",
] as const;

export function isDecommissioned(status: AssetStatus): boolean {
  return status === "DECOMMISSIONED";
}
