"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, Download, ExternalLink, History, Link2, Trash2, TriangleAlert,
} from "lucide-react";
import { getDataset } from "@/lib/seed";
import { canDelete } from "@/lib/rbac/matrix";
import type { Session } from "@/lib/rbac/session";
import { daysBetween, enumLabel, formatCount, formatDate, formatDateTime } from "@/lib/format";
import { Panel, PanelHeader, Overline, KeyValue, StatusBadge, Mono , Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import {
  ACCESS_LEVEL_LABEL, CATEGORY_LABEL, buildAccessIndex, documentAccess, notFoundDenial, viewerOf,
} from "./access";
import { linkedEntityLabel, materiality } from "./expiry";
import { currentVersion, nextVersionNumber, versionHistory } from "./versions";
import {
  auditForDocument, deletions, recordAudit, recordDeletion, addUploadedVersion, uploadedVersions,
  createdDocuments, useVaultStore,
} from "./store";
import { DenialPanel, Highlight, useHydrated } from "./ui";
import { tokenise } from "./search";

interface Props {
  session: Session;
  documentId: string;
  passageId?: string;
  fromQuestion?: string;
  query?: string;
  versionRef?: string;
}

export function DocumentDetail({ session, documentId, passageId, fromQuestion, query, versionRef }: Props) {
  const hydrated = useHydrated();
  useVaultStore();

  const ds = React.useMemo(() => getDataset(), []);
  const now = React.useMemo(() => new Date(ds.meta.today), [ds]);
  const viewer = React.useMemo(() => viewerOf(session, ds), [session, ds]);
  const index = React.useMemo(() => buildAccessIndex(ds, viewer), [ds, viewer]);

  const local = hydrated ? createdDocuments() : [];
  const doc = React.useMemo(
    () => ds.documents.find((d) => d.id === documentId) ?? local.find((d) => d.id === documentId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ds, documentId, local.length],
  );
  const verdict = doc ? documentAccess(index, doc) : { allowed: false, denial: notFoundDenial() };

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [versionOpen, setVersionOpen] = React.useState(false);
  const [versionNote, setVersionNote] = React.useState("");
  const logged = React.useRef(false);

  /* E10-S1 AC5 — opening is recorded; AC4 — a denial is recorded too. */
  React.useEffect(() => {
    if (!hydrated || logged.current) return;
    logged.current = true;
    if (verdict.allowed && doc) {
      recordAudit({
        actorUserId: viewer.userId, actorName: viewer.name, actorRole: viewer.role,
        action: "VIEW_DOCUMENT", documentId: doc.id, documentTitle: doc.title,
        summary: fromQuestion
          ? `Opened from an Ask the Vault citation${passageId ? " at the cited passage" : ""}.`
          : "Opened from the vault.",
      });
    } else {
      recordAudit({
        actorUserId: viewer.userId, actorName: viewer.name, actorRole: viewer.role,
        action: "ACCESS_DENIED", documentId, documentTitle: null,
        summary: `Access denied — ${verdict.denial?.reason ?? "not permitted"} No metadata disclosed.`,
      });
    }
  }, [hydrated, verdict.allowed, verdict.denial, doc, documentId, viewer, fromQuestion, passageId]);

  if (!verdict.allowed || !doc) {
    return (
      <DenialPanel
        denial={verdict.denial ?? notFoundDenial()}
        extra={
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/vault" className="t-body-sm rounded-md border border-line-strong px-3 py-1.5 text-text-hi hover:bg-surface-2">
              Back to the vault
            </Link>
            {fromQuestion ? (
              <Link href={`/vault/ask?q=${fromQuestion}`} className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:text-text-hi">
                Return to the answer
              </Link>
            ) : null}
          </div>
        }
      />
    );
  }

  const uploads = hydrated ? (uploadedVersions()[doc.id] ?? []) : [];
  const history = versionHistory(doc, ds, uploads);
  const current = currentVersion(history);
  const viewing = versionRef ? history.find((v) => v.ref === versionRef) ?? current : current;
  const deletion = hydrated ? deletions()[doc.id] ?? null : null;
  const trail = hydrated ? auditForDocument(doc.id) : [];
  const linked = linkedEntityLabel(doc, ds);
  const owner = ds.users.find((u) => u.id === doc.ownerUserId);
  const days = doc.expiresOn ? daysBetween(now, doc.expiresOn) : null;
  const mat = materiality(doc, ds);
  const terms = query ? tokenise(query) : [];

  function log(action: "DOWNLOAD" | "EXPORT", summary: string) {
    recordAudit({
      actorUserId: viewer.userId, actorName: viewer.name, actorRole: viewer.role,
      action, documentId: doc!.id, documentTitle: doc!.title, summary,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {fromQuestion ? (
        <Link
          href={`/vault/ask?q=${fromQuestion}`}
          className="t-body-sm inline-flex w-fit items-center gap-1.5 rounded-md border border-primary-600 bg-primary-100 px-3 py-1.5 text-text-hi hover:border-primary-500"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Return to the answer — it is held exactly as you left it
        </Link>
      ) : null}

      {deletion ? (
        <Panel className="border-danger/50 bg-danger-bg p-4">
          <div className="flex items-start gap-2">
            <Trash2 className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="t-heading-md text-text-hi">This document is deleted</p>
              <p className="t-body-sm mt-1 text-text-mid">
                Deleted by {deletion.byName} on {formatDateTime(deletion.at)}. Reason: {deletion.reason}. The record is
                retained rather than removed, and the deletion is in the activity log.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title={doc.title}
          sub={`${CATEGORY_LABEL[doc.category]} · ${enumLabel(doc.type)} · version ${viewing.version} of ${history.length}`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => log("DOWNLOAD", `Downloaded ${doc.mime}, ${formatCount(doc.sizeKb)} KB.`)}
                className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <Download className="size-3.5" aria-hidden /> Download
              </button>
              <button
                type="button"
                onClick={() => {
                  log("EXPORT", "Share link generated for this document.");
                  setShared(true);
                  window.setTimeout(() => setShared(false), 2400);
                }}
                className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                {shared ? <Check className="size-3.5 text-ok" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
                {shared ? "Share recorded" : "Share"}
              </button>
              {canDelete(session.role, "vault") && !deletion ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-danger/50 px-2.5 py-1.5 text-danger hover:bg-danger-bg"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Delete
                </button>
              ) : null}
            </div>
          }
        />

        {deleteOpen ? (
          <div className="border-b border-line bg-danger-bg/60 p-4">
            <p className="t-heading-md text-text-hi">Confirm deletion</p>
            <Explainer className="mt-1 text-text-mid">
              The document will be retained as a deleted record with your name and the reason you give. It is not
              removed, and the action is written to the audit log. A reason is required.
            </Explainer>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for deletion"
                aria-label="Reason for deletion"
                className="h-8 min-w-64 flex-1 rounded-md border border-line bg-surface-1 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo"
              />
              <button
                type="button"
                disabled={reason.trim().length < 4}
                onClick={() => {
                  recordDeletion({
                    documentId: doc.id, documentTitle: doc.title, at: new Date().toISOString(),
                    byUserId: viewer.userId, byName: viewer.name, byRole: viewer.role, reason: reason.trim(),
                  });
                  setDeleteOpen(false);
                }}
                className="t-body-sm rounded-md bg-danger px-3 py-1.5 text-white disabled:opacity-40"
              >
                Delete and retain the record
              </button>
              <button type="button" onClick={() => setDeleteOpen(false)} className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:text-text-hi">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="Document id"><Mono>{doc.id}</Mono></KeyValue>
          <KeyValue label="Branch">{CATEGORY_LABEL[doc.category]}</KeyValue>
          <KeyValue label="Type">{enumLabel(doc.type)}</KeyValue>
          <KeyValue label="Linked entity">
            {linked.href ? (
              <Link href={linked.href} className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-500">
                {linked.label} <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : linked.label}
          </KeyValue>
          <KeyValue label="Owner">{owner?.name ?? doc.ownerUserId}</KeyValue>
          <KeyValue label="Uploaded">{formatDate(doc.uploadedAt)}</KeyValue>
          <KeyValue label="Effective from">{doc.effectiveFrom ? formatDate(doc.effectiveFrom) : "Not recorded"}</KeyValue>
          <KeyValue label="Expires on">
            {doc.expiresOn ? (
              <span className="flex items-center gap-2">
                {formatDate(doc.expiresOn)}
                {days !== null && days <= 60 ? (
                  <StatusBadge tone={days < 0 ? "danger" : days <= 30 ? "warn" : "info"}>
                    {days < 0 ? `Expired ${-days}d ago` : `${days} days left`}
                  </StatusBadge>
                ) : null}
              </span>
            ) : "No expiry"}
          </KeyValue>
          <KeyValue label="Access level">{ACCESS_LEVEL_LABEL[doc.accessLevel]}</KeyValue>
          <KeyValue label="Version">{viewing.version} {viewing.current ? "(current)" : "(superseded)"}</KeyValue>
          <KeyValue label="Revision">{doc.revision ?? "Not applicable"}</KeyValue>
          <KeyValue label="Approval state">{doc.approvalState ? enumLabel(doc.approvalState) : "Not applicable"}</KeyValue>
          <KeyValue label="File">
            <span className="t-mono text-[0.8125rem]">{doc.mime} · {formatCount(doc.sizeKb)} KB · {formatCount(doc.pageCount)} pages</span>
          </KeyValue>
          <KeyValue label="Tags">
            {doc.tags.length ? (
              <span className="flex flex-wrap gap-1">
                {doc.tags.map((t) => (
                  <span key={t} className="t-body-sm rounded-md border border-line bg-surface-2 px-1.5 text-text-mid">{t}</span>
                ))}
              </span>
            ) : "None"}
          </KeyValue>
        </div>

        {mat.material && days !== null && days <= 60 ? (
          <div className="flex items-start gap-2 border-t border-line bg-warn-bg px-4 py-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
            <p className="t-body-sm text-text-mid">
              <span className="text-text-hi">Materially operational.</span> {mat.reason}. An approaching expiry on this
              document raises a Command Centre exception, not only a notification.{" "}
              <Link href="/command/exceptions" className="text-primary-400 hover:text-primary-500">Open the exception feed</Link>.
            </p>
          </div>
        ) : null}
      </Panel>

      {/* Document body — the passages the retrieval layer cites and highlights */}
      <Panel>
        <PanelHeader
          title="Document text"
          sub={passageId ? "The cited passage is highlighted below." : "The indexed passages of this document."}
        />
        <div className="flex flex-col gap-3 p-4">
          {doc.passages.map((p) => {
            const cited = p.id === passageId;
            return (
              <div
                key={p.id}
                id={`passage-${p.id}`}
                className={cn(
                  "rounded-lg border p-3",
                  cited ? "border-info bg-info-bg" : "border-line bg-surface-0/40",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <Overline className={cited ? "text-info" : undefined}>{p.heading}</Overline>
                  {cited ? <StatusBadge tone="info">Cited passage</StatusBadge> : null}
                </div>
                <p className="t-body-lg mt-1.5 text-text-hi">
                  <Highlight text={p.text} terms={terms} />
                </p>
              </div>
            );
          })}
          {!viewing.current ? (
            <Explainer className="text-text-lo">
              You are viewing version {viewing.version}, superseded on {formatDate(current.uploadedAt)}. The text shown
              is the retained content of this document; the current version is version {current.version}.
            </Explainer>
          ) : null}
        </div>
      </Panel>

      {/* E10-S1 AC3 — version history */}
      <Panel>
        <PanelHeader
          title="Version history"
          sub={`${formatCount(history.length)} version${history.length === 1 ? "" : "s"} · every prior version stays retrievable`}
          right={
            <button
              type="button"
              onClick={() => setVersionOpen((s) => !s)}
              className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <History className="size-3.5" aria-hidden /> Upload a new version
            </button>
          }
        />
        {versionOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 p-3">
            <input
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder="What changed in this version?"
              aria-label="Version note"
              className="h-8 min-w-64 flex-1 rounded-md border border-line bg-surface-1 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo"
            />
            <button
              type="button"
              onClick={() => {
                const v = nextVersionNumber(doc, uploads);
                addUploadedVersion({
                  documentId: doc.id, version: v, at: new Date().toISOString(),
                  byUserId: viewer.userId, byName: viewer.name,
                  note: versionNote.trim() || "New version uploaded in this session.",
                });
                recordAudit({
                  actorUserId: viewer.userId, actorName: viewer.name, actorRole: viewer.role,
                  action: "UPDATE", documentId: doc.id, documentTitle: doc.title,
                  summary: `Version ${v} uploaded; version ${current.version} superseded and retained.`,
                });
                setVersionNote("");
                setVersionOpen(false);
              }}
              className="t-body-sm rounded-md bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-500"
            >
              Supersede current version
            </button>
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {history.map((v) => (
            <li
              key={v.ref}
              className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2", v.current && "bg-surface-2")}
            >
              <span className="t-mono w-14 shrink-0 text-text-hi" data-numeric>v{v.version}</span>
              {v.current ? (
                <StatusBadge tone="ok">Current version</StatusBadge>
              ) : (
                <StatusBadge tone="neutral" icon={false}>Superseded</StatusBadge>
              )}
              <span className="t-body-sm text-text-mid">{formatDate(v.uploadedAt)}</span>
              <span className="t-body-sm text-text-mid">{v.authorName}</span>
              <span className="t-body-sm min-w-0 flex-1 truncate text-text-lo">{v.note}</span>
              {v.current ? (
                <span className="t-body-sm text-text-lo">Viewing</span>
              ) : (
                <Link
                  href={`/vault/${doc.id}?v=${encodeURIComponent(v.ref)}`}
                  className="t-body-sm text-primary-400 hover:text-primary-500"
                >
                  Open this version
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {/* E10-S1 AC5 — the trail against this document */}
      <Panel>
        <PanelHeader
          title="Activity on this document"
          sub="Every open, download, share, version change, deletion and denial is recorded against both the document and the acting user."
        />
        {trail.length === 0 ? (
          <p className="t-body-sm px-4 py-6 text-text-lo">No activity recorded in this browser session yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...trail].reverse().map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <Mono className="text-[0.75rem]">{e.id}</Mono>
                <StatusBadge tone={e.action === "ACCESS_DENIED" || e.action === "DELETE" ? "danger" : "neutral"} icon={false}>
                  {enumLabel(e.action)}
                </StatusBadge>
                <span className="t-body-sm text-text-mid">{formatDateTime(e.at)}</span>
                <span className="t-body-sm text-text-hi">{e.actorName}</span>
                <span className="t-body-sm min-w-0 flex-1 text-text-lo">{e.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
