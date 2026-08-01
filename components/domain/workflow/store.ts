"use client";

/**
 * Workflow mutation overlay.
 *
 * AR-5 / the prototype's data rule: the seeded dataset is never mutated. Every
 * decision, chain revision, delegation, read-receipt and simulated message is
 * written to `localStorage` under `pravaah.v1.*` as a patch layer, and merged
 * over the immutable snapshot at read time. Clearing the keys restores the
 * seeded baseline exactly.
 *
 * The store is a plain external store so several panels on the same screen
 * (list, drawer, WhatsApp preview) observe one source of truth without prop
 * drilling or a full page reload — which is what E11-S2 requires of the list.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type * as T from "@/lib/schemas/entities";
import type { AuditAction, NotificationChannel, Role } from "@/lib/schemas/enums";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import {
  applyDecision, bulkEligibility, decisionRights, evaluate, REQUEST_TYPE_META,
  type DecisionRights, type Evaluation,
} from "./engine";
import { deliverable } from "./matrix";
import type { WorkflowSnapshot } from "./types";

export const OVERLAY_KEY = "pravaah.v1.workflow";
export const AUDIT_KEY = "pravaah.v1.audit";
export const DEMO_KEY = "pravaah.v1.demo";

export interface WorkflowOverlay {
  v: 1;
  seq: number;
  requestPatches: Record<string, Partial<T.ApprovalRequest>>;
  newRequests: T.ApprovalRequest[];
  decisions: T.ApprovalDecision[];
  notificationPatches: Record<string, Partial<T.Notification>>;
  newNotifications: T.Notification[];
  messagePatches: Record<string, Partial<T.MessageLog>>;
  newMessages: T.MessageLog[];
  chains: T.ApprovalChain[] | null;
  chainSteps: T.ApprovalChainStep[] | null;
  delegations: T.Delegation[] | null;
  channelPreferences: T.ChannelPreference[] | null;
}

export interface DemoState {
  /** E11-S5 — the reachable failure state for the simulated WhatsApp channel. */
  whatsappFailure: boolean;
}

export const EMPTY_OVERLAY: WorkflowOverlay = {
  v: 1,
  seq: 0,
  requestPatches: {},
  newRequests: [],
  decisions: [],
  notificationPatches: {},
  newNotifications: [],
  messagePatches: {},
  newMessages: [],
  chains: null,
  chainSteps: null,
  delegations: null,
  channelPreferences: null,
};

const EMPTY_DEMO: DemoState = { whatsappFailure: false };

/* --------------------------------------------------------- external store */

type Listener = () => void;
const listeners = new Set<Listener>();

let overlayCache: WorkflowOverlay = EMPTY_OVERLAY;
let demoCache: DemoState = EMPTY_DEMO;
let hydrated = false;

function readRaw<V>(key: string, fallback: V): V {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as V & { v?: number };
    // AR-5 — a schema-version mismatch resets cleanly rather than throwing.
    if (typeof parsed === "object" && parsed !== null && "v" in parsed && parsed.v !== 1) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  overlayCache = { ...EMPTY_OVERLAY, ...readRaw<WorkflowOverlay>(OVERLAY_KEY, EMPTY_OVERLAY) };
  demoCache = { ...EMPTY_DEMO, ...readRaw<DemoState>(DEMO_KEY, EMPTY_DEMO) };
  hydrated = true;
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: Listener): () => void {
  hydrate();
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OVERLAY_KEY || e.key === DEMO_KEY) {
      hydrated = false;
      hydrate();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

function getOverlay(): WorkflowOverlay {
  hydrate();
  return overlayCache;
}
function getServerOverlay(): WorkflowOverlay {
  return EMPTY_OVERLAY;
}
function getDemo(): DemoState {
  hydrate();
  return demoCache;
}
function getServerDemo(): DemoState {
  return EMPTY_DEMO;
}

function writeOverlay(next: WorkflowOverlay) {
  overlayCache = next;
  try {
    window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode — the in-memory overlay still holds for this session */
  }
  emit();
}

function writeDemo(next: DemoState) {
  demoCache = next;
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(next));
  } catch {
    /* ignored — see writeOverlay */
  }
  emit();
}

function mutate(fn: (o: WorkflowOverlay) => WorkflowOverlay) {
  const cur = getOverlay();
  writeOverlay(fn({ ...cur, seq: cur.seq + 1 }));
}

export function resetWorkflowOverlay() {
  try {
    window.localStorage.removeItem(OVERLAY_KEY);
    window.localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignored */
  }
  overlayCache = EMPTY_OVERLAY;
  demoCache = EMPTY_DEMO;
  emit();
}

/* ------------------------------------------------------------- audit sink */

export interface AuditEntry {
  id: string;
  seq: number;
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

export function readAudit(): AuditEntry[] {
  return readRaw<AuditEntry[]>(AUDIT_KEY, []);
}

/** AR-9 — every mutation in this epic routes through here. */
export function writeAudit(entries: Omit<AuditEntry, "id" | "seq" | "ip">[]) {
  if (typeof window === "undefined" || entries.length === 0) return;
  const existing = readAudit();
  let seq = existing.length ? Math.max(...existing.map((e) => e.seq)) + 1 : 900_001;
  const next = [
    ...existing,
    ...entries.map((e) => ({
      ...e,
      id: `AUD-W${String(seq).padStart(6, "0")}`,
      seq: seq++,
      ip: "10.0.0.1",
    })),
  ];
  try {
    window.localStorage.setItem(AUDIT_KEY, JSON.stringify(next));
  } catch {
    /* ignored */
  }
}

/* --------------------------------------------------------------- merging */

export interface WorkflowState {
  now: Date;
  snapshot: WorkflowSnapshot;
  overlay: WorkflowOverlay;
  demo: DemoState;
  requests: T.ApprovalRequest[];
  decisions: T.ApprovalDecision[];
  chains: T.ApprovalChain[];
  chainSteps: T.ApprovalChainStep[];
  delegations: T.Delegation[];
  notifications: T.Notification[];
  messages: T.MessageLog[];
  channelPreferences: T.ChannelPreference[];
  evaluations: Map<string, Evaluation>;
  /** Requests the viewer may act on right now, oldest first. */
  myQueue: Evaluation[];
  rightsOf: (requestId: string) => DecisionRights;
  medianTurnaroundHours: number;
  dirty: boolean;
}

function mergePatched<R extends { id: string }>(
  base: R[],
  patches: Record<string, Partial<R>>,
  added: R[],
): R[] {
  const out = base.map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r));
  for (const a of added) {
    const i = out.findIndex((r) => r.id === a.id);
    if (i >= 0) out[i] = { ...out[i]!, ...a };
    else out.push(a);
  }
  return out;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  return Math.round(v * 100) / 100;
}

/* ------------------------------------------------------------ the hook */

export function useWorkflow(snapshot: WorkflowSnapshot) {
  const overlay = useSyncExternalStore(subscribe, getOverlay, getServerOverlay);
  const demo = useSyncExternalStore(subscribe, getDemo, getServerDemo);

  const state: WorkflowState = useMemo(() => {
    const now = new Date(snapshot.today);
    const requests = mergePatched(snapshot.requests, overlay.requestPatches, overlay.newRequests);
    const decisions = [...snapshot.decisions, ...overlay.decisions];
    const chains = overlay.chains ?? snapshot.chains;
    const chainSteps = overlay.chainSteps ?? snapshot.chainSteps;
    const delegations = overlay.delegations ?? snapshot.delegations;
    const notifications = mergePatched(
      snapshot.notifications, overlay.notificationPatches, overlay.newNotifications,
    );
    const messages = mergePatched(snapshot.messages, overlay.messagePatches, overlay.newMessages);
    const channelPreferences = overlay.channelPreferences ?? snapshot.channelPreferences;

    const evaluations = new Map<string, Evaluation>();
    for (const r of requests) evaluations.set(r.id, evaluate(r, decisions, now));

    const users = snapshot.users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
    const viewer = snapshot.viewer;

    const rightsOf = (requestId: string): DecisionRights => {
      const e = evaluations.get(requestId);
      if (!e) {
        return {
          canDecide: false, reason: "TERMINAL", authorityRole: null, authorityUserName: null,
          viaDelegation: null, delegatedForUserId: null,
          message: "This request is no longer present in the working set.",
        };
      }
      const meta = REQUEST_TYPE_META[e.request.type];
      const ctx = snapshot.contexts[e.request.id];
      const limitBasisValue =
        meta.basis === "PERCENT" && ctx && ctx.kind === "QUOTATION_DISCOUNT"
          ? ctx.weightedDiscountPct
          : meta.basis === "MONEY"
            ? e.request.value
            : undefined;
      return decisionRights({
        evaluation: e,
        viewer: {
          userId: viewer.userId,
          role: viewer.role,
          hasApprovalAuthority: viewer.hasApprovalAuthority,
          approveLimit: viewer.approveLimit,
          readOnly: viewer.readOnly,
        },
        users,
        delegations,
        now,
        limitBasisValue,
      });
    };

    const open = [...evaluations.values()].filter((e) => !e.terminal);
    const myQueue = open
      .filter((e) => rightsOf(e.request.id).canDecide)
      .sort((a, b) => b.ageMs - a.ageMs);

    const decided = requests.filter((r) => r.decidedAt);
    const medianTurnaroundHours = median(
      decided.map((r) => (new Date(r.decidedAt!).getTime() - new Date(r.raisedAt).getTime()) / 3_600_000),
    );

    return {
      now, snapshot, overlay, demo,
      requests, decisions, chains, chainSteps, delegations,
      notifications, messages, channelPreferences,
      evaluations, myQueue, rightsOf, medianTurnaroundHours,
      dirty: overlay.seq > 0,
    };
  }, [snapshot, overlay, demo]);

  /* ------------------------------------------------------------ actions */

  const nowIso = state.now.toISOString();
  const viewer = snapshot.viewer;

  const audit = useCallback(
    (action: AuditAction, entityType: string, entityId: string, entityLabel: string, summary: string, before?: string, after?: string) => {
      writeAudit([{
        actorUserId: viewer.userId,
        actorName: viewer.name,
        actorRole: viewer.role,
        impersonatedBy: null,
        action, entityType, entityId, entityLabel, summary,
        before: before ?? null,
        after: after ?? null,
        at: nowIso,
      }]);
    },
    [viewer, nowIso],
  );

  /** One decision → one audit entry, always. Bulk simply calls this repeatedly. */
  const decide = useCallback(
    (opts: {
      requestId: string;
      decision: "APPROVED" | "REJECTED" | "RETURNED";
      comment: string;
      channel: NotificationChannel;
    }): { ok: boolean; message: string } => {
      const e = state.evaluations.get(opts.requestId);
      if (!e) return { ok: false, message: "Request not found." };
      const rights = state.rightsOf(opts.requestId);
      if (!rights.canDecide) return { ok: false, message: rights.message };

      const seq = getOverlay().seq + 1;
      const result = applyDecision({
        request: e.request,
        evaluation: e,
        decision: opts.decision,
        comment: opts.comment,
        channel: opts.channel,
        actorUserId: viewer.userId,
        onBehalfOfUserId: rights.delegatedForUserId,
        now: state.now,
        decisionId: `APD-W${String(seq).padStart(4, "0")}`,
      });

      const requester = snapshot.users.find((u) => u.id === e.request.requesterUserId);
      const nextRole = result.advancedToStep
        ? e.request.resolvedSteps.find((s) => s.order === result.advancedToStep)?.approverRole ?? null
        : null;
      const nextUser = nextRole ? snapshot.users.find((u) => u.role === nextRole) ?? null : null;

      const newNotifications: T.Notification[] = [];
      let nSeq = seq * 10;
      const push = (userId: string | undefined, type: string, title: string, body: string) => {
        if (!userId) return;
        const role = snapshot.users.find((u) => u.id === userId)?.role;
        // E11-S4 — never delivered where the role cannot read the entity.
        if (role && !deliverable(role, type)) return;
        newNotifications.push({
          id: `NTF-W${String(++nSeq).padStart(4, "0")}`,
          userId, type, title, body,
          entityType: "APPROVAL", entityId: e.request.id,
          href: `/workflow/approvals?request=${e.request.id}`,
          read: false, at: nowIso, digest: false,
        });
      };

      push(
        requester?.id,
        "APPROVAL_PENDING",
        `${e.request.number} ${result.finalStatus.toLowerCase()}`,
        opts.decision === "APPROVED" && result.advancedToStep
          ? `Approved at step ${e.currentStepOrder} by ${viewer.name}. Now with ${nextRole ? ROLE_LABEL[nextRole] : "the next approver"}.`
          : `${viewer.name} recorded ${result.finalStatus.toLowerCase()}${opts.comment.trim() ? `: ${opts.comment.trim()}` : "."}`,
      );
      if (nextUser) {
        push(
          nextUser.id,
          "DISCOUNT_APPROVAL_REQUIRED",
          `${e.request.number} is with you`,
          `${e.request.subjectLabel}. Step ${result.advancedToStep} of ${e.request.resolvedSteps.length}.`,
        );
      }

      mutate((o) => ({
        ...o,
        requestPatches: { ...o.requestPatches, [e.request.id]: { ...(o.requestPatches[e.request.id] ?? {}), ...result.patch } },
        decisions: [...o.decisions, result.decision],
        newNotifications: [...o.newNotifications, ...newNotifications],
      }));

      // AR-9 / E11-S1 AC — actor, role, decision, comment and timestamp.
      audit(
        opts.decision === "APPROVED" ? "APPROVE" : opts.decision === "REJECTED" ? "REJECT" : "RETURN",
        "ApprovalRequest",
        e.request.id,
        e.request.number,
        `${opts.decision} at step ${e.currentStepOrder} by ${ROLE_LABEL[viewer.role]}${rights.viaDelegation ? " (delegated)" : ""} via ${opts.channel}. ${result.summary}.${opts.comment.trim() ? ` Comment: ${opts.comment.trim()}` : ""}`,
        `status=${e.request.status}, step=${e.request.currentStep}`,
        `status=${result.finalStatus}, step=${result.patch.currentStep ?? e.request.currentStep}`,
      );

      return { ok: true, message: result.summary };
    },
    [state, viewer, snapshot.users, nowIso, audit],
  );

  const bulkApprove = useCallback(
    (requestIds: string[], comment: string) => {
      const evals = requestIds
        .map((id) => state.evaluations.get(id))
        .filter((e): e is Evaluation => Boolean(e));
      const eligibility = bulkEligibility(evals, (e) => state.rightsOf(e.request.id), state.chains);
      const applied: string[] = [];
      const excluded: { requestId: string; reason: string }[] = [];
      for (const c of eligibility) {
        if (!c.eligible) {
          excluded.push({ requestId: c.requestId, reason: c.reason ?? "Inline validation failed." });
          continue;
        }
        const r = decide({ requestId: c.requestId, decision: "APPROVED", comment, channel: "IN_APP" });
        if (r.ok) applied.push(c.requestId);
        else excluded.push({ requestId: c.requestId, reason: r.message });
      }
      return { applied, excluded };
    },
    [state, decide],
  );

  /**
   * E11-S1 — raising records the resolved chain on the request. The overlay
   * stores the whole record, so the frozen ladder survives a later revision.
   */
  /** Reserved: raise a request with its resolved chain frozen onto the record. */
  const _raiseRequest = useCallback(
    (request: T.ApprovalRequest, resolvedChainName: string) => {
      mutate((o) => ({ ...o, newRequests: [...o.newRequests, request] }));
      audit(
        "CREATE", "ApprovalRequest", request.id, request.number,
        `${REQUEST_TYPE_META[request.type].label} raised at value ${request.value}. Resolved to "${resolvedChainName}" and the ${request.resolvedSteps.length}-step ladder was recorded on the request so a later chain revision cannot change it.`,
      );
      return request;
    },
    [audit],
  );

  const saveChains = useCallback(
    (requestType: string, chains: T.ApprovalChain[], steps: T.ApprovalChainStep[]) => {
      const baseChains = state.chains.filter((c) => c.requestType !== requestType);
      const baseSteps = state.chainSteps.filter((s) => !state.chains.some((c) => c.id === s.chainId && c.requestType === requestType));
      mutate((o) => ({
        ...o,
        chains: [...baseChains, ...chains],
        chainSteps: [...baseSteps, ...steps],
      }));
      audit(
        "UPDATE", "ApprovalChain", requestType, REQUEST_TYPE_META[requestType as keyof typeof REQUEST_TYPE_META]?.label ?? requestType,
        `Chain revision saved: ${chains.length} band(s), ${steps.length} step(s). Requests already in flight retain their originally resolved chain.`,
      );
    },
    [state.chains, state.chainSteps, audit],
  );

  const addDelegation = useCallback(
    (d: Omit<T.Delegation, "id">) => {
      const seq = getOverlay().seq + 1;
      const record: T.Delegation = { ...d, id: `DLG-W${String(seq).padStart(3, "0")}` };
      mutate((o) => ({ ...o, delegations: [...(o.delegations ?? state.delegations), record] }));
      const principal = snapshot.users.find((u) => u.id === d.approverUserId);
      const delegate = snapshot.users.find((u) => u.id === d.delegateUserId);
      audit(
        "CREATE", "Delegation", record.id, `${principal?.name ?? d.approverUserId} → ${delegate?.name ?? d.delegateUserId}`,
        `Delegation nominated from ${d.fromDate.slice(0, 10)} to ${d.toDate.slice(0, 10)}. Requests routed to ${principal?.name ?? "the approver"} during the range become additionally actionable by ${delegate?.name ?? "the delegate"}.`,
      );
      return record;
    },
    [state.delegations, snapshot.users, audit],
  );

  const removeDelegation = useCallback(
    (id: string) => {
      const gone = state.delegations.find((d) => d.id === id);
      mutate((o) => ({ ...o, delegations: (o.delegations ?? state.delegations).filter((d) => d.id !== id) }));
      if (gone) audit("DELETE", "Delegation", id, id, "Delegation withdrawn.");
    },
    [state.delegations, audit],
  );

  const markRead = useCallback(
    (ids: string[], read = true) => {
      if (!ids.length) return;
      mutate((o) => {
        const patches = { ...o.notificationPatches };
        for (const id of ids) patches[id] = { ...(patches[id] ?? {}), read };
        return { ...o, notificationPatches: patches };
      });
    },
    [],
  );

  const setChannelPreference = useCallback(
    (notificationType: string, role: Role, channels: NotificationChannel[]) => {
      const base = state.channelPreferences;
      const i = base.findIndex((p) => p.notificationType === notificationType && p.role === role);
      const next = i >= 0
        ? base.map((p, k) => (k === i ? { ...p, channels } : p))
        : [...base, { id: `CHP-W${notificationType}-${role}`, notificationType, role, channels }];
      mutate((o) => ({ ...o, channelPreferences: next }));
      audit(
        "UPDATE", "ChannelPreference", `${notificationType}:${role}`, `${notificationType} · ${ROLE_LABEL[role]}`,
        `Channels set to ${channels.length ? channels.join(", ") : "none"}.`,
      );
    },
    [state.channelPreferences, audit],
  );

  const logMessage = useCallback(
    (msg: Omit<T.MessageLog, "id" | "simulated">) => {
      const seq = getOverlay().seq + 1;
      const record: T.MessageLog = { ...msg, id: `MSG-W${String(seq).padStart(4, "0")}`, simulated: true };
      mutate((o) => ({ ...o, newMessages: [...o.newMessages, record] }));
      audit(
        "SIMULATED_INTEGRATION", "MessageLog", record.id, record.template,
        `Simulated ${record.channel} message composed to ${record.recipientLabel}. INT-04/INT-05 — no live gateway is contacted.`,
      );
      return record;
    },
    [audit],
  );

  const setMessageState = useCallback((id: string, msgState: T.MessageLog["state"]) => {
    mutate((o) => ({
      ...o,
      messagePatches: { ...o.messagePatches, [id]: { ...(o.messagePatches[id] ?? {}), state: msgState } },
    }));
  }, []);

  const setWhatsappFailure = useCallback((on: boolean) => {
    writeDemo({ ...getDemo(), whatsappFailure: on });
  }, []);

  const exportCsv = useCallback(
    (filename: string, rows: string[][], description: string) => {
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      audit("EXPORT", "MessageLog", filename, filename, description);
    },
    [audit],
  );

  const reset = useCallback(() => resetWorkflowOverlay(), []);

  return {
    ...state,
    actions: {
      decide, bulkApprove, saveChains, addDelegation, removeDelegation,
      markRead, setChannelPreference, logMessage, setMessageState,
      setWhatsappFailure, exportCsv, audit, reset,
    },
  };
}

export type WorkflowApi = ReturnType<typeof useWorkflow>;
