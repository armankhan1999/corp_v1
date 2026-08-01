"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import type { AuditAction, Role } from "@/lib/schemas/enums";
import { writeState, snoozeUntil, readState, SNOOZE_OPTIONS } from "./exception-state";

/**
 * E2-S4 — Acknowledge / Assign / Snooze.
 *
 * Every one of the three writes an entry through the same path, so the audit
 * trail cannot be bypassed by adding a fourth control later (AR-9).
 */

interface Actor {
  userId: string;
  name: string;
  role: Role;
}

async function currentActor(): Promise<Actor> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  return {
    userId: session?.userId ?? "USR-00",
    name: session?.name ?? "Unknown",
    role: (session?.role ?? "DIRECTOR_BUSINESS") as Role,
  };
}

function audit(actor: Actor, action: AuditAction, exceptionId: string, label: string, summary: string) {
  const ds = getDataset();
  const seq = ds.auditLog.length ? Math.max(...ds.auditLog.map((a) => a.seq)) + 1 : 1;
  ds.auditLog.push({
    id: `AUD-EX-${String(seq).padStart(6, "0")}`,
    seq,
    actorUserId: actor.userId,
    actorName: actor.name,
    actorRole: actor.role,
    impersonatedBy: null,
    action,
    entityType: "Exception",
    entityId: exceptionId,
    entityLabel: label,
    summary,
    before: null,
    after: null,
    at: new Date(ds.meta.today).toISOString(),
    ip: "10.0.0.1",
  });
}

function refresh() {
  revalidatePath("/command/exceptions");
  revalidatePath("/command");
}

export async function acknowledgeException(formData: FormData): Promise<void> {
  const id = String(formData.get("exceptionId") ?? "");
  const label = String(formData.get("label") ?? id);
  if (!id) return;
  const actor = await currentActor();
  const now = new Date(getDataset().meta.today);
  writeState(id, {
    state: "ACKNOWLEDGED",
    atIso: now.toISOString(),
    byUserId: actor.userId,
    byName: actor.name,
    assignedToUserId: readState(id)?.assignedToUserId ?? null,
    assignedToName: readState(id)?.assignedToName ?? null,
    snoozeUntilIso: null,
    note: null,
  });
  audit(actor, "STATE_TRANSITION", id, label, `Exception acknowledged by ${actor.name}`);
  refresh();
}

export async function assignException(formData: FormData): Promise<void> {
  const id = String(formData.get("exceptionId") ?? "");
  const label = String(formData.get("label") ?? id);
  const toUserId = String(formData.get("assignTo") ?? "");
  if (!id || !toUserId) return;
  const ds = getDataset();
  const actor = await currentActor();
  const target = ds.users.find((u) => u.id === toUserId);
  const now = new Date(ds.meta.today);
  writeState(id, {
    state: "ASSIGNED",
    atIso: now.toISOString(),
    byUserId: actor.userId,
    byName: actor.name,
    assignedToUserId: toUserId,
    assignedToName: target?.name ?? toUserId,
    snoozeUntilIso: null,
    note: null,
  });
  audit(actor, "STATE_TRANSITION", id, label, `Exception assigned to ${target?.name ?? toUserId} by ${actor.name}`);
  refresh();
}

export async function snoozeException(formData: FormData): Promise<void> {
  const id = String(formData.get("exceptionId") ?? "");
  const label = String(formData.get("label") ?? id);
  const interval = String(formData.get("interval") ?? "1d");
  if (!id) return;
  const ds = getDataset();
  const actor = await currentActor();
  const now = new Date(ds.meta.today);
  const until = snoozeUntil(interval, now);
  const optLabel = SNOOZE_OPTIONS.find((o) => o.value === interval)?.label ?? interval;
  writeState(id, {
    state: "SNOOZED",
    atIso: now.toISOString(),
    byUserId: actor.userId,
    byName: actor.name,
    assignedToUserId: readState(id)?.assignedToUserId ?? null,
    assignedToName: readState(id)?.assignedToName ?? null,
    snoozeUntilIso: until.toISOString(),
    note: null,
  });
  audit(actor, "STATE_TRANSITION", id, label, `Exception snoozed for ${optLabel} by ${actor.name}; returns to the feed on expiry`);
  refresh();
}

export async function reopenException(formData: FormData): Promise<void> {
  const id = String(formData.get("exceptionId") ?? "");
  const label = String(formData.get("label") ?? id);
  if (!id) return;
  const actor = await currentActor();
  const now = new Date(getDataset().meta.today);
  writeState(id, {
    state: "OPEN",
    atIso: now.toISOString(),
    byUserId: actor.userId,
    byName: actor.name,
    assignedToUserId: null,
    assignedToName: null,
    snoozeUntilIso: null,
    note: null,
  });
  audit(actor, "STATE_TRANSITION", id, label, `Exception returned to the open feed by ${actor.name}`);
  refresh();
}
