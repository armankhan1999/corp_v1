"use client";

/**
 * AR-5 — the browser overlay for every Admin mutation. Versioned, schema-guarded
 * and namespaced under `pravaah.v1.*`. The seeded dataset object is never
 * mutated; it remains the reproducible baseline (SD-1), and each screen merges
 * the overlay over it at render time.
 */

import { useCallback, useEffect, useState } from "react";
import type { Role } from "@/lib/schemas/enums";
import type { DsrStatus, DsrType, MasterValue } from "./types";

const NS = "pravaah.v1";
export const OVERLAY_VERSION = 1;

export const ADMIN_KEYS = {
  masters: `${NS}.masters`,
  users: `${NS}.users`,
  compliance: `${NS}.compliance`,
} as const;

interface Versioned {
  v: number;
}

/* ------------------------------------------------------------- shapes */

export interface MastersOverlay extends Versioned {
  /** `${setKey}:${rowId}` → changed fields. */
  patches: Record<string, Record<string, MasterValue>>;
  /** `setKey` → rows created in the browser. */
  created: Record<string, { id: string; values: Record<string, MasterValue> }[]>;
  /** `${setKey}:${rowId}` → false once deactivated. */
  active: Record<string, boolean>;
  /** `${setKey}:${rowId}` → removed. Only reachable at zero references. */
  deleted: Record<string, true>;
  /** Numbering-series id → the sequence numbers issued this session, in order. */
  issued: Record<string, number[]>;
}

export interface UserPatch {
  name?: string;
  role?: Role;
  branchId?: string;
  email?: string;
  phone?: string;
  designation?: string;
  active?: boolean;
}

export interface CreatedUser {
  id: string;
  name: string;
  role: Role;
  branchId: string;
  email: string;
  phone: string;
  designation: string;
  active: boolean;
}

export interface UsersOverlay extends Versioned {
  patches: Record<string, UserPatch>;
  created: CreatedUser[];
}

export interface DsrPatch {
  status?: DsrStatus;
  closedOn?: string | null;
  note?: string;
}

export interface CreatedDsr {
  id: string;
  number: string;
  requestType: DsrType;
  requester: string;
  receivedOn: string;
  status: DsrStatus;
  closedOn: string | null;
  note: string;
}

export interface RetentionAction {
  id: string;
  policyId: string;
  entityClass: string;
  kind: "REVIEW" | "PURGE_ELIGIBLE";
  at: string;
  note: string;
}

export interface ComplianceOverlay extends Versioned {
  dsrPatches: Record<string, DsrPatch>;
  dsrCreated: CreatedDsr[];
  /** Retention policy id → months. */
  retention: Record<string, number>;
  retentionActions: RetentionAction[];
  /** Breach checklist item id → completed. */
  breach: Record<string, boolean>;
  breachReport: string;
  breachDetectedAt: string;
}

export const EMPTY_MASTERS: MastersOverlay = {
  v: OVERLAY_VERSION,
  patches: {},
  created: {},
  active: {},
  deleted: {},
  issued: {},
};

export const EMPTY_USERS: UsersOverlay = { v: OVERLAY_VERSION, patches: {}, created: [] };

export const EMPTY_COMPLIANCE: ComplianceOverlay = {
  v: OVERLAY_VERSION,
  dsrPatches: {},
  dsrCreated: [],
  retention: {},
  retentionActions: [],
  breach: {},
  breachReport: "",
  breachDetectedAt: "",
};

/* ---------------------------------------------------------------- hook */

function read<T extends Versioned>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    // A schema-version mismatch resets cleanly rather than throwing. AR-5.
    if (!parsed || parsed.v !== OVERLAY_VERSION) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/**
 * Reads on mount only, so the server render and the first client render agree
 * and hydration never mismatches. `ready` lets a surface hold its skeleton
 * until the overlay has been applied.
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

/* -------------------------------------------------------------- helpers */

export function rowKey(setKey: string, rowId: string): string {
  return `${setKey}:${rowId}`;
}

/** Local identifiers are visibly distinct from seeded series. */
export function localId(prefix: string): string {
  const n = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, "0");
  return `${prefix}-L${n}`;
}

/** CSV that survives Excel: quoted fields, CRLF rows, UTF-8 BOM. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    "﻿" + [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n")
  );
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
