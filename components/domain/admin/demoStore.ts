"use client";

/**
 * E14-S6 / FR-M1-18 — the demonstration control state.
 *
 * One localStorage key, `pravaah.v1.demo`, shared with the workflow epic. That
 * store reads it as `{ ...EMPTY_DEMO, ...parsed }` and discards any object whose
 * `v` field is not 1, so this module deliberately writes **no `v` field**:
 * adding one would silently blank the WhatsApp failure switch for
 * `components/domain/workflow/WhatsAppPreview.tsx`. Extra fields are safe, which
 * is why the clock and the three additional scenario flags live on the same key
 * rather than in a namespace of their own.
 *
 * Nothing here contacts a real system. Every function is a localStorage write
 * plus, at the caller, an audit entry.
 */

import { useCallback, useEffect, useState } from "react";

export const DEMO_KEY = "pravaah.v1.demo";

/** Append-only. Never cleared by the reset — the reset is recorded inside it. */
export const AUDIT_KEY = "pravaah.v1.audit";
/** Clearing this would sign the operator out mid-demonstration. */
export const SESSION_KEY = "pravaah.v1.session";

/**
 * Every browser overlay namespace the reset removes, listed in full so the
 * action can be read before it is taken rather than trusted afterwards.
 */
export const RESET_KEYS: readonly { key: string; what: string }[] = [
  { key: "pravaah.v1.inventory", what: "Stock movements, counts, reorder decisions and purchase orders raised this session" },
  { key: "pravaah.v1.people", what: "Attendance marks, leave decisions and employee-record edits" },
  { key: "pravaah.v1.workflow", what: "Approval decisions, chain revisions, delegations and simulated messages" },
  { key: "pravaah.v1.service", what: "Ticket transitions, job cards and dispatch assignments" },
  { key: "pravaah.v1.projects", what: "DPRs, RA-bills, milestones and retention actions" },
  { key: "pravaah.v1.assets", what: "Installed-asset edits and coverage overrides" },
  { key: "pravaah.v1.commercial", what: "Invoices, receipts, allocations, credit notes and e-way bills" },
  { key: "pravaah.v1.vault", what: "Document views, uploads and knowledge-base questions" },
  { key: "pravaah.v1.amc", what: "AMC contracts, visits and renewal quotations" },
  { key: "pravaah.v1.commissioning", what: "Commissioning reports and principal submissions" },
  { key: "pravaah.v1.field", what: "Field check-ins, mobile job cards and captured evidence" },
  { key: "pravaah.v1.masters", what: "Reference-data edits, additions, deactivations and issued numbers" },
  { key: "pravaah.v1.users", what: "User accounts created, edited, deactivated or reassigned" },
  { key: "pravaah.v1.compliance", what: "Data-principal requests, retention periods and the breach checklist" },
  { key: "pravaah.v1.recents", what: "The five most recently visited records offered by the command palette" },
  { key: "pravaah.v1.demo", what: "The simulated clock and the four scenario switches on this screen" },
];

/** Deliberately survives the reset, and why. */
export const PRESERVED_KEYS: readonly { key: string; why: string }[] = [
  {
    key: AUDIT_KEY,
    why: "The audit log is append-only and immutable — E1-S6. Clearing it would make the log a convenience rather than a record, so the reset is written into it and the entries stay.",
  },
  {
    key: SESSION_KEY,
    why: "The session cookie mirror. Removing it would sign you out and end the demonstration you are resetting.",
  },
  {
    key: "pravaah.v1.rail",
    why: "The navigation rail collapse preference. It is an interface preference, not world state, so a reset leaves it where you put it.",
  },
];

/* --------------------------------------------------------------- state */

export interface DemoFlags {
  /** E11-S5 — read today by the workflow notification preview. */
  whatsappFailure: boolean;
  slaBreach: boolean;
  stockOut: boolean;
  upiPaid: boolean;
  /** Full ISO string, or null when the world is on its seeded today. */
  simulatedToday: string | null;
}

export const EMPTY_DEMO_FLAGS: DemoFlags = {
  whatsappFailure: false,
  slaBreach: false,
  stockOut: false,
  upiPaid: false,
  simulatedToday: null,
};

function coerce(raw: unknown): DemoFlags {
  if (typeof raw !== "object" || raw === null) return EMPTY_DEMO_FLAGS;
  const o = raw as Record<string, unknown>;
  return {
    whatsappFailure: o.whatsappFailure === true,
    slaBreach: o.slaBreach === true,
    stockOut: o.stockOut === true,
    upiPaid: o.upiPaid === true,
    simulatedToday: typeof o.simulatedToday === "string" ? o.simulatedToday : null,
  };
}

export function readDemoFlags(): DemoFlags {
  if (typeof window === "undefined") return EMPTY_DEMO_FLAGS;
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) return EMPTY_DEMO_FLAGS;
    return coerce(JSON.parse(raw));
  } catch {
    return EMPTY_DEMO_FLAGS;
  }
}

/**
 * Writes the shared shape. Returns false when the browser refuses the write —
 * private mode or a full quota — so the screen can say so instead of pretending
 * the control took effect.
 */
export function writeDemoFlags(next: DemoFlags): boolean {
  try {
    // No `v` field: see the module note.
    window.localStorage.setItem(
      DEMO_KEY,
      JSON.stringify({
        whatsappFailure: next.whatsappFailure,
        slaBreach: next.slaBreach,
        stockOut: next.stockOut,
        upiPaid: next.upiPaid,
        simulatedToday: next.simulatedToday,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Which of the reset namespaces currently hold anything. */
export function occupiedKeys(): string[] {
  if (typeof window === "undefined") return [];
  const out: string[] = [];
  for (const k of RESET_KEYS) {
    try {
      if (window.localStorage.getItem(k.key) !== null) out.push(k.key);
    } catch {
      /* an unreadable store is reported by the caller's write path instead */
    }
  }
  return out;
}

export interface ClearResult {
  cleared: string[];
  failed: string[];
  /** True when the append-only audit overlay survived, as it must. */
  auditIntact: boolean;
}

/**
 * Removes exactly the enumerated namespaces. The audit and session keys are not
 * in the list and are never touched; `auditIntact` proves it to the caller.
 */
export function clearOverlays(): ClearResult {
  const cleared: string[] = [];
  const failed: string[] = [];
  for (const k of RESET_KEYS) {
    if (k.key === AUDIT_KEY || k.key === SESSION_KEY) continue;
    try {
      const had = window.localStorage.getItem(k.key) !== null;
      window.localStorage.removeItem(k.key);
      if (had) cleared.push(k.key);
    } catch {
      failed.push(k.key);
    }
  }
  let auditIntact = true;
  try {
    auditIntact = window.localStorage.getItem(AUDIT_KEY) !== null;
  } catch {
    auditIntact = false;
  }
  return { cleared, failed, auditIntact };
}

/* ---------------------------------------------------------------- hook */

/**
 * Reads on mount only, so the server render and the first client render agree
 * and hydration never mismatches. `ready` holds the skeleton until then.
 */
export function useDemoFlags(): {
  flags: DemoFlags;
  ready: boolean;
  occupied: string[];
  setFlags: (next: DemoFlags) => void;
  rescan: () => void;
} {
  const [flags, setFlagsState] = useState<DemoFlags>(EMPTY_DEMO_FLAGS);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFlagsState(readDemoFlags());
    setOccupied(occupiedKeys());
    setReady(true);
  }, []);

  const rescan = useCallback(() => {
    setFlagsState(readDemoFlags());
    setOccupied(occupiedKeys());
  }, []);

  const setFlags = useCallback((next: DemoFlags) => {
    setFlagsState(next);
    setOccupied(occupiedKeys());
  }, []);

  return { flags, ready, occupied, setFlags, rescan };
}
