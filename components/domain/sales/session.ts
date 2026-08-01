"use client";

import { useEffect, useState } from "react";
import { decodeSession, SESSION_COOKIE, type Session } from "@/lib/rbac/session";
import type { Role } from "@/lib/schemas/enums";
import { can, canCreate, canWrite, scopeFor, type Capability, type Scope } from "@/lib/rbac/matrix";
import type { Actor } from "./store";

/**
 * C-06 mirrors the session into a cookie so route handlers can deny a guessed
 * URL. The sales surfaces read the same cookie on the client to decide which
 * sections exist at all (E3-S2 AC-6 omits, never greys out).
 */
export function useSalesSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    setSession(decodeSession(raw));
  }, []);
  return session;
}

export interface SalesPermissions {
  role: Role;
  actor: Actor;
  branchId: string;
  userId: string;
  can: (cap: Capability) => boolean;
  canWrite: (cap: Capability) => boolean;
  canCreate: (cap: Capability) => boolean;
  scope: (cap: Capability) => Scope;
  /** RBAC-2 — branch and own-record scoping applied to every sales list. */
  visibleBranchIds: string[] | null;
  ownOnly: boolean;
}

/**
 * RBAC-2 / RBAC-3 applied at the row. A branch-scoped role never sees another
 * branch's records; an own-scoped role never sees another executive's.
 */
export function inScope(
  perms: SalesPermissions,
  cap: Capability,
  row: { branchId?: string | null; ownerUserId?: string | null },
): boolean {
  switch (perms.scope(cap)) {
    case "BRANCH":
      return row.branchId === perms.branchId;
    case "OWN":
    case "SELF":
      return row.ownerUserId === perms.userId;
    case "ASSIGNED":
      return row.ownerUserId === perms.userId || row.branchId === perms.branchId;
    default:
      return true;
  }
}

export function scopeNoteFor(perms: SalesPermissions, cap: Capability, branchName: string): string | null {
  switch (perms.scope(cap)) {
    case "BRANCH":
      return `Branch-scoped session — ${branchName} only.`;
    case "OWN":
      return "Own-records session — only what you own is returned.";
    case "ASSIGNED":
      return "Assigned-records session.";
    default:
      return null;
  }
}

export function permissionsOf(session: Session): SalesPermissions {
  const role = session.role;
  const scope = (cap: Capability) => scopeFor(role, cap);
  const s = scope("enquiries");
  return {
    role,
    actor: { userId: session.userId, name: session.name, role },
    branchId: session.branchId,
    userId: session.userId,
    can: (cap) => can(role, cap),
    canWrite: (cap) => canWrite(role, cap),
    canCreate: (cap) => canCreate(role, cap),
    scope,
    visibleBranchIds: s === "BRANCH" ? [session.branchId] : null,
    ownOnly: s === "OWN",
  };
}
