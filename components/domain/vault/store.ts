"use client";

import { useSyncExternalStore } from "react";
import type { PravaahDocument } from "@/lib/schemas";
import type { AuditAction, ConfidenceState, Role } from "@/lib/schemas/enums";

/**
 * The vault mutation overlay. AR-5 / NFR-14 — every key is namespaced
 * `pravaah.v1.*` and schema-versioned; a version mismatch resets that key
 * cleanly and raises a notice rather than throwing. The seeded dataset is
 * never mutated: this overlay is applied on top of it at read time.
 */

const NS = "pravaah.v1.vault";
export const VAULT_SCHEMA_VERSION = 1;

const KEY = {
  audit: `${NS}.audit`,
  deleted: `${NS}.deleted`,
  created: `${NS}.created`,
  versions: `${NS}.versions`,
  feedback: `${NS}.feedback`,
  answers: `${NS}.answers`,
  exceptions: `${NS}.exceptions`,
} as const;

/* ------------------------------------------------------------------ types */

export interface VaultAuditEntry {
  id: string;
  seq: number;
  at: string;
  actorUserId: string;
  actorName: string;
  actorRole: Role;
  action: AuditAction;
  documentId: string;
  /** Omitted on a denial — a denied request discloses no document metadata. */
  documentTitle: string | null;
  summary: string;
}

export interface DeletionRecord {
  documentId: string;
  documentTitle: string;
  at: string;
  byUserId: string;
  byName: string;
  byRole: Role;
  reason: string;
}

export interface UploadedVersion {
  documentId: string;
  version: number;
  at: string;
  byUserId: string;
  byName: string;
  note: string;
}

export interface StoredCitation {
  marker: number;
  documentId: string | null;
  passageId: string | null;
  recordSetKey: string | null;
  label: string;
  type: string;
  date: string | null;
  href: string;
}

export interface StoredAnswer {
  answerId: string;
  questionId: string;
  question: string;
  role: Role;
  body: string;
  confidence: ConfidenceState;
  confidenceBasis: string;
  citations: StoredCitation[];
  searchedCount: number;
  readCount: number;
  refusal: boolean;
  at: string;
}

export interface VaultFeedback {
  id: string;
  answerId: string;
  question: string;
  answerBody: string;
  citations: StoredCitation[];
  confidence: ConfidenceState;
  helpful: boolean;
  comment: string;
  byUserId: string;
  byName: string;
  byRole: Role;
  at: string;
}

export interface DocumentException {
  id: string;
  documentId: string;
  documentTitle: string;
  type: "DOCUMENT_EXPIRED";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  daysRemaining: number;
  reason: string;
  linkedLabel: string;
  ownerName: string;
  raisedAt: string;
}

interface Envelope<T> { v: number; data: T }

/* ---------------------------------------------------------------- plumbing */

let resetNotice: string | null = null;
export function takeResetNotice(): string | null {
  const n = resetNotice;
  resetNotice = null;
  return n;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || parsed.v !== VAULT_SCHEMA_VERSION) {
      window.localStorage.removeItem(key);
      resetNotice = "Locally stored vault activity was written by an earlier schema version and has been cleared.";
      return fallback;
    }
    return parsed.data;
  } catch {
    window.localStorage.removeItem(key);
    resetNotice = "Locally stored vault activity could not be read and has been cleared.";
    return fallback;
  }
}

function write<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify({ v: VAULT_SCHEMA_VERSION, data } satisfies Envelope<T>));
  emit();
}

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  for (const l of listeners) l();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function snapshot() { return version; }
function serverSnapshot() { return 0; }

/** Re-renders any component that reads the overlay whenever it changes. */
export function useVaultStore(): number {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/* ------------------------------------------------------------------ audit */

export function auditEntries(): VaultAuditEntry[] {
  return read<VaultAuditEntry[]>(KEY.audit, []);
}

/**
 * E10-S1 AC5/AC6 — opening, downloading, sharing, deleting and every denied
 * request is written against both the document and the acting user.
 */
export function recordAudit(entry: Omit<VaultAuditEntry, "id" | "seq" | "at"> & { at?: string }): VaultAuditEntry {
  const existing = auditEntries();
  const seq = (existing[existing.length - 1]?.seq ?? 0) + 1;
  const full: VaultAuditEntry = {
    ...entry,
    at: entry.at ?? new Date().toISOString(),
    seq,
    id: `VAU-${String(seq).padStart(5, "0")}`,
  };
  write(KEY.audit, [...existing, full]);
  return full;
}

export function auditForDocument(documentId: string): VaultAuditEntry[] {
  return auditEntries().filter((e) => e.documentId === documentId);
}

/* --------------------------------------------------------------- deletion */

export function deletions(): Record<string, DeletionRecord> {
  return read<Record<string, DeletionRecord>>(KEY.deleted, {});
}

export function deletedIds(): Set<string> {
  return new Set(Object.keys(deletions()));
}

export function recordDeletion(rec: DeletionRecord): void {
  write(KEY.deleted, { ...deletions(), [rec.documentId]: rec });
  recordAudit({
    actorUserId: rec.byUserId, actorName: rec.byName, actorRole: rec.byRole,
    action: "DELETE", documentId: rec.documentId, documentTitle: rec.documentTitle,
    summary: `Marked deleted — retained as a deleted record. Reason: ${rec.reason}`,
    at: rec.at,
  });
}

export function restoreDeletion(documentId: string): void {
  const all = deletions();
  delete all[documentId];
  write(KEY.deleted, all);
}

/* ---------------------------------------------------------------- created */

export function createdDocuments(): PravaahDocument[] {
  return read<PravaahDocument[]>(KEY.created, []);
}

export function addCreatedDocument(doc: PravaahDocument): void {
  write(KEY.created, [...createdDocuments(), doc]);
}

/* --------------------------------------------------------------- versions */

export function uploadedVersions(): Record<string, UploadedVersion[]> {
  return read<Record<string, UploadedVersion[]>>(KEY.versions, {});
}

export function addUploadedVersion(v: UploadedVersion): void {
  const all = uploadedVersions();
  write(KEY.versions, { ...all, [v.documentId]: [...(all[v.documentId] ?? []), v] });
}

/* ---------------------------------------------------------------- answers */

export function storedAnswers(): Record<string, StoredAnswer> {
  return read<Record<string, StoredAnswer>>(KEY.answers, {});
}

export function storeAnswer(a: StoredAnswer): void {
  write(KEY.answers, { ...storedAnswers(), [a.answerId]: a });
}

export function storedAnswer(answerId: string): StoredAnswer | null {
  return storedAnswers()[answerId] ?? null;
}

/* --------------------------------------------------------------- feedback */

export function feedbackEntries(): VaultFeedback[] {
  return read<VaultFeedback[]>(KEY.feedback, []);
}

/** E10-S5 — one rating per answer; re-rating replaces it and is not duplicated. */
export function upsertFeedback(fb: VaultFeedback): void {
  const existing = feedbackEntries().filter((f) => f.answerId !== fb.answerId);
  write(KEY.feedback, [...existing, fb]);
}

export function feedbackFor(answerId: string): VaultFeedback | null {
  return feedbackEntries().find((f) => f.answerId === answerId) ?? null;
}

/* ------------------------------------------------------------- exceptions */

export function documentExceptions(): DocumentException[] {
  return read<DocumentException[]>(KEY.exceptions, []);
}

/** E10-S2 AC4 — posted for the Command Centre exception feed to consume. */
export function publishExceptions(list: DocumentException[]): void {
  const current = documentExceptions();
  const same = current.length === list.length &&
    current.every((c, i) => c.id === list[i]?.id && c.daysRemaining === list[i]?.daysRemaining);
  if (same) return;
  write(KEY.exceptions, list);
}

export function clearVaultOverlay(): void {
  if (typeof window === "undefined") return;
  for (const k of Object.values(KEY)) window.localStorage.removeItem(k);
  emit();
}
