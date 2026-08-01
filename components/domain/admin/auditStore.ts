"use client";

/**
 * AR-9 / FR-M1-10 — the single audit writer surface.
 *
 * Every feature in the platform appends here and nowhere else. The module
 * exports exactly one mutating function, `appendAudit`. There is deliberately
 * no update and no delete: the store is append-only by construction, not by
 * convention, which is what makes E1-S6's immutability claim true rather than
 * asserted. The seeded `ds.auditLog` is the immutable historical baseline; this
 * overlay is everything the running session adds on top of it.
 *
 *   import { appendAudit } from "@/components/domain/admin/auditStore";
 *
 *   appendAudit({
 *     actor,                       // who, with role and any impersonation
 *     action: "UPDATE",
 *     entityType: "SLADefinition",
 *     entityId: "SLA-01",
 *     entityLabel: "Default — CRITICAL",
 *     summary: "Restoration hours changed",
 *     before: "24 h", after: "18 h",
 *   });
 */

import { useCallback, useEffect, useState } from "react";
import type { AuditAction, Role } from "@/lib/schemas/enums";
import type { ActorInfo } from "./types";

export const AUDIT_KEY = "pravaah.v1.audit";
export const AUDIT_VERSION = 1;
export const AUDIT_EVENT = "pravaah:audit";

export interface AuditWrite {
  actor: ActorInfo;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before?: string | null;
  after?: string | null;
  /** Defaults to the wall clock; supplied only by the demo clock controls. */
  at?: string;
}

export interface LocalAuditEntry {
  /** 1-based position within the session overlay. */
  n: number;
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole: Role;
  impersonatedBy: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
  at: string;
  ip: string;
}

interface AuditOverlay {
  v: number;
  entries: LocalAuditEntry[];
}

const EMPTY: AuditOverlay = { v: AUDIT_VERSION, entries: [] };

/**
 * A stable simulated source address per user, derived from the user id so the
 * same persona always shows the same address across a demonstration. Marked
 * simulated everywhere it is rendered — no request IP is available client-side.
 */
export function simulatedIp(userId: string): string {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 24) % 5;
  const b = (h >>> 12) % 250;
  const c = (h >>> 2) % 248;
  return `10.${a}.${b + 1}.${c + 2}`;
}

function readOverlay(): AuditOverlay {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AuditOverlay;
    if (!parsed || parsed.v !== AUDIT_VERSION || !Array.isArray(parsed.entries)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

/** Every entry written this session, oldest first. Read-only by design. */
export function readAudit(): LocalAuditEntry[] {
  return readOverlay().entries;
}

/**
 * The one and only mutation. Appends and returns the written entry.
 * There is no counterpart that edits or removes an entry.
 */
export function appendAudit(w: AuditWrite): LocalAuditEntry {
  const prev = readOverlay();
  const entry: LocalAuditEntry = {
    n: prev.entries.length + 1,
    id: `AUD-L${String(prev.entries.length + 1).padStart(5, "0")}`,
    actorUserId: w.actor.userId,
    actorName: w.actor.name,
    actorRole: w.actor.role,
    impersonatedBy: w.actor.impersonatedBy ?? null,
    action: w.action,
    entityType: w.entityType,
    entityId: w.entityId,
    entityLabel: w.entityLabel,
    summary: w.summary,
    before: w.before ?? null,
    after: w.after ?? null,
    at: w.at ?? new Date().toISOString(),
    ip: simulatedIp(w.actor.userId),
  };
  const next: AuditOverlay = { v: AUDIT_VERSION, entries: [...prev.entries, entry] };
  try {
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode — the entry still reaches listeners in memory */
  }
  window.dispatchEvent(new CustomEvent<LocalAuditEntry>(AUDIT_EVENT, { detail: entry }));
  return entry;
}

/** Convenience for the very common "field changed" shape. */
export function describeChange(
  changes: { label: string; before: string; after: string }[],
): { summary: string; before: string; after: string } {
  return {
    summary: changes.map((c) => c.label).join(", "),
    before: changes.map((c) => `${c.label}: ${c.before}`).join(" · "),
    after: changes.map((c) => `${c.label}: ${c.after}`).join(" · "),
  };
}

/** Live view of the session overlay, kept in step across every surface. */
export function useAuditOverlay(): { entries: LocalAuditEntry[]; ready: boolean } {
  const [entries, setEntries] = useState<LocalAuditEntry[]>([]);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => setEntries(readAudit()), []);

  useEffect(() => {
    sync();
    setReady(true);
    window.addEventListener(AUDIT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUDIT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  return { entries, ready };
}
