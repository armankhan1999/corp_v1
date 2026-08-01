"use client";

/**
 * E1-S6 — the immutable audit log.
 *
 * Newest first, virtualised over the whole register, filterable by actor, role,
 * action type, entity type and date range. There is no edit control and no
 * delete control anywhere on this screen or behind it: `auditStore` exports one
 * mutating function and it only appends. Export writes its own audit entry.
 */

import * as React from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Download, ExternalLink, Lock, ScrollText, ShieldCheck, X } from "lucide-react";
import { Panel, PanelHeader, Overline, StatusBadge } from "@/components/patterns/primitives";
import { formatCount, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { ROLE_LABEL, type AuditAction, type Role } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { appendAudit, useAuditOverlay, type LocalAuditEntry } from "./auditStore";
import { downloadCsv, toCsv } from "./store";
import { resolveLink, type LinkTable } from "./links";
import { Btn, DateInput, Field, FilteredEmpty, Modal, Select, TextInput, Td, Th } from "./ui";
import type { ActorInfo, AuditFacets, AuditRow } from "./types";

const ACTION_TONE: Partial<Record<AuditAction, "ok" | "warn" | "danger" | "info" | "neutral" | "sim">> = {
  CREATE: "ok",
  UPDATE: "info",
  DELETE: "danger",
  STATE_TRANSITION: "info",
  APPROVE: "ok",
  REJECT: "danger",
  RETURN: "warn",
  EXPORT: "warn",
  LOGIN: "neutral",
  LOGOUT: "neutral",
  ACCESS_DENIED: "danger",
  SESSION_IMPERSONATION: "warn",
  VIEW_DOCUMENT: "neutral",
  DOWNLOAD: "warn",
  SIMULATED_INTEGRATION: "sim",
  DEMO_RESET: "warn",
  CLOCK_ADVANCE: "warn",
};

function actionLabel(a: AuditAction): string {
  return a.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const GRID = "grid-cols-[76px_150px_170px_92px_150px_210px_minmax(220px,1fr)_120px]";

interface Filters {
  actor: string;
  role: string;
  action: string;
  entityType: string;
  from: string;
  to: string;
  q: string;
}

const EMPTY_FILTERS: Filters = { actor: "", role: "", action: "", entityType: "", from: "", to: "", q: "" };

function toRow(e: LocalAuditEntry, baseSeq: number): AuditRow {
  return {
    id: e.id,
    seq: baseSeq + e.n,
    actorUserId: e.actorUserId,
    actorName: e.actorName,
    actorRole: e.actorRole,
    impersonatedBy: e.impersonatedBy,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    entityLabel: e.entityLabel,
    summary: e.summary,
    before: e.before,
    after: e.after,
    at: e.at,
    ip: e.ip,
  };
}

export function AuditClient({
  rows,
  facets,
  links,
  actor,
  baseSeq,
  today,
}: {
  /** Seeded register, already sorted newest first. */
  rows: AuditRow[];
  facets: AuditFacets;
  links: LinkTable;
  actor: ActorInfo;
  baseSeq: number;
  today: string;
}) {
  const { entries, ready } = useAuditOverlay();
  const [f, setF] = React.useState<Filters>(EMPTY_FILTERS);
  const [detail, setDetail] = React.useState<AuditRow | null>(null);
  const [exported, setExported] = React.useState<{ count: number; at: string } | null>(null);
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const now = React.useMemo(() => new Date(today), [today]);

  const all = React.useMemo(() => {
    if (entries.length === 0) return rows;
    const local = entries.map((e) => toRow(e, baseSeq)).reverse();
    return [...local, ...rows];
  }, [entries, rows, baseSeq]);

  const filtered = React.useMemo(() => {
    const fromMs = f.from ? new Date(`${f.from}T00:00:00`).getTime() : null;
    const toMs = f.to ? new Date(`${f.to}T23:59:59.999`).getTime() : null;
    const q = f.q.trim().toLowerCase();
    return all.filter((r) => {
      if (f.actor && r.actorUserId !== f.actor) return false;
      if (f.role && r.actorRole !== f.role) return false;
      if (f.action && r.action !== f.action) return false;
      if (f.entityType && r.entityType !== f.entityType) return false;
      if (fromMs !== null || toMs !== null) {
        const t = new Date(r.at).getTime();
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
      }
      if (q) {
        const hay = `${r.entityLabel} ${r.summary} ${r.entityId} ${r.actorName} ${r.ip}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, f]);

  const activeFilters = React.useMemo(() => {
    const out: string[] = [];
    if (f.actor) out.push(`actor ${facets.actors.find((a) => a.id === f.actor)?.name ?? f.actor}`);
    if (f.role) out.push(`role ${ROLE_LABEL[f.role as Role]}`);
    if (f.action) out.push(`action ${actionLabel(f.action as AuditAction)}`);
    if (f.entityType) out.push(`entity ${f.entityType}`);
    if (f.from) out.push(`from ${formatDate(f.from)}`);
    if (f.to) out.push(`to ${formatDate(f.to)}`);
    if (f.q) out.push(`text “${f.q}”`);
    return out;
  }, [f, facets.actors]);

  const [rowH, setRowH] = React.useState(36);
  React.useEffect(() => {
    const d = document.documentElement.dataset.density;
    setRowH(d === "comfortable" ? 44 : 36);
  }, []);

  const virtual = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowH,
    overscan: 14,
  });

  function clearFilters() {
    setF(EMPTY_FILTERS);
  }

  function exportCsv() {
    const stamp = new Date();
    const csv = toCsv(
      [
        "Sequence",
        "Audit ID",
        "Timestamp (IST)",
        "Actor",
        "Actor ID",
        "Role",
        "Impersonated by",
        "Action",
        "Entity type",
        "Entity ID",
        "Entity label",
        "Summary",
        "Before",
        "After",
        "Source IP (simulated)",
      ],
      filtered.map((r) => [
        r.seq,
        r.id,
        formatDateTime(r.at),
        r.actorName,
        r.actorUserId,
        ROLE_LABEL[r.actorRole],
        r.impersonatedBy ?? "",
        actionLabel(r.action),
        r.entityType,
        r.entityId,
        r.entityLabel,
        r.summary,
        r.before ?? "",
        r.after ?? "",
        r.ip,
      ]),
    );
    downloadCsv(
      `pravaah-audit-${stamp.toISOString().slice(0, 19).replace(/[:T]/g, "")}.csv`,
      csv,
    );
    // The export is itself an auditable event. E1-S6.
    appendAudit({
      actor,
      action: "EXPORT",
      entityType: "AuditLog",
      entityId: "audit-log",
      entityLabel: `Audit log export — ${filtered.length} rows`,
      summary: `Exported ${filtered.length} of ${all.length} audit rows to CSV`,
      after: activeFilters.length > 0 ? `Filters: ${activeFilters.join("; ")}` : "Filters: none (full register)",
    });
    setExported({ count: filtered.length, at: stamp.toISOString() });
  }

  const items = virtual.getVirtualItems();

  return (
    <div className="flex flex-col gap-4">
      {/* The immutability statement, on screen, not in a footnote. */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex min-w-72 flex-1 items-start gap-2.5 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] px-3 py-2.5">
          <Lock className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <div>
            <p className="t-body font-medium text-text-hi">Append-only store</p>
            <p className="t-body-sm mt-0.5 text-text-mid">
              Entries are written once and never changed. No edit or delete control exists on this
              screen, in any row menu, or on any route behind it — the writer exposes a single
              append function and nothing else. Corrections are made by writing a new entry.
            </p>
          </div>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          <Stat label="Seeded history" value={formatCount(rows.length)} sub="entries" />
          <Stat label="This session" value={formatCount(entries.length)} sub="appended" />
          <Stat label="In view" value={formatCount(filtered.length)} sub="after filters" />
        </dl>
      </div>

      {exported ? (
        <div className="flex items-center gap-2 rounded-lg border border-ok/40 bg-ok-bg px-3 py-2">
          <ShieldCheck className="size-4 shrink-0 text-ok" aria-hidden />
          <p className="t-body-sm text-text-mid">
            <span className="text-ok">Exported {formatCount(exported.count)} rows.</span> The export
            was recorded as an <span className="t-mono">EXPORT</span> entry at the top of this
            register.
          </p>
          <button
            type="button"
            onClick={() => setExported(null)}
            aria-label="Dismiss"
            className="ml-auto text-text-lo hover:text-text-hi"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <Panel>
        <PanelHeader
          title="Audit register"
          sub="Newest first. Every row carries actor, role, action, entity, before/after and a simulated source address."
          right={
            <Btn icon={Download} onClick={exportCsv} disabled={filtered.length === 0}>
              Export {formatCount(filtered.length)} filtered rows
            </Btn>
          }
        />

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 border-b border-line p-3 md:grid-cols-4 xl:grid-cols-7">
          <Field label="Actor">
            <Select value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })}>
              <option value="">All actors</option>
              {facets.actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="">All roles</option>
              {facets.roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Action type">
            <Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>
              <option value="">All actions</option>
              {facets.actions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Entity type">
            <Select value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })}>
              <option value="">All entities</option>
              {facets.entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From date">
            <DateInput value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="To date">
            <DateInput value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
          <Field label="Text">
            <TextInput
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              placeholder="Number, summary, IP…"
            />
          </Field>
        </div>

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <Overline>Filtering by</Overline>
            {activeFilters.map((a) => (
              <span
                key={a}
                className="t-body-sm rounded-md border border-line bg-surface-1 px-1.5 py-0.5 text-text-mid"
              >
                {a}
              </span>
            ))}
            <Btn tone="ghost" icon={X} onClick={clearFilters} className="ml-auto">
              Clear filters
            </Btn>
          </div>
        ) : null}

        {/* Header row */}
        <div
          role="table"
          aria-label="Audit register"
          aria-rowcount={filtered.length}
          className="min-w-0"
        >
          <div className="overflow-x-auto">
            <div className="min-w-[1180px]">
              <div
                role="row"
                className={cn(
                  "t-overline grid items-center gap-0 border-b border-line bg-surface-1/95 px-3 py-2.5 text-text-lo backdrop-blur-sm",
                  GRID,
                )}
              >
                <span role="columnheader">Seq</span>
                <span role="columnheader">When</span>
                <span role="columnheader">Actor</span>
                <span role="columnheader">Role</span>
                <span role="columnheader">Action</span>
                <span role="columnheader">Entity</span>
                <span role="columnheader">Summary</span>
                <span role="columnheader">Source IP</span>
              </div>

              {!ready ? (
                <div className="flex flex-col gap-px bg-line">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="bg-surface-1" style={{ height: rowH }}>
                      <div className="pv-skeleton m-2 h-4 rounded-md" aria-hidden />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                activeFilters.length > 0 ? (
                  <FilteredEmpty active={activeFilters} onClear={clearFilters} />
                ) : (
                  <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                    <ScrollText className="size-8 text-text-lo" aria-hidden />
                    <div>
                      <p className="t-heading-md text-text-hi">The register is empty</p>
                      <p className="t-body-sm mt-1 text-text-mid">
                        Nothing has been recorded yet. Every create, update, state transition,
                        approval, export, login and access denial writes here automatically.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div ref={scroller} className="max-h-[62vh] overflow-y-auto">
                  <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
                    {items.map((vi) => {
                      const r = filtered[vi.index]!;
                      const link = resolveLink(links, r.entityType, r.entityId);
                      const local = r.id.startsWith("AUD-L");
                      return (
                        <div
                          key={r.id}
                          role="row"
                          aria-rowindex={vi.index + 1}
                          className={cn(
                            "absolute left-0 top-0 grid w-full items-center border-b border-line px-3",
                            GRID,
                            local ? "bg-surface-2" : "bg-surface-1",
                            "hover:bg-surface-3",
                          )}
                          style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
                        >
                          <span role="cell" className="t-mono truncate text-text-lo">
                            {r.seq}
                          </span>
                          <span role="cell" className="t-mono truncate text-text-mid" title={formatDateTime(r.at)}>
                            {formatRelative(r.at, now)}
                          </span>
                          <span role="cell" className="t-body-sm truncate text-text-hi" title={r.actorUserId}>
                            {r.actorName}
                          </span>
                          <span role="cell" className="t-body-sm truncate text-text-lo">
                            {ROLE_LABEL[r.actorRole]}
                          </span>
                          <span role="cell" className="truncate">
                            <StatusBadge tone={ACTION_TONE[r.action] ?? "neutral"} icon={false}>
                              {actionLabel(r.action)}
                            </StatusBadge>
                          </span>
                          <span role="cell" className="min-w-0 truncate">
                            {link.href ? (
                              <Link
                                href={link.href}
                                className="t-mono inline-flex max-w-full items-center gap-1 truncate text-info hover:underline"
                                title={`${r.entityType} ${r.entityId}`}
                              >
                                <span className="truncate">{r.entityLabel}</span>
                                <ExternalLink className="size-3 shrink-0" aria-hidden />
                              </Link>
                            ) : (
                              <span
                                className="t-mono truncate text-text-lo"
                                title={link.blocked ?? "Not reachable"}
                              >
                                {r.entityLabel}
                              </span>
                            )}
                          </span>
                          <span role="cell" className="t-body-sm truncate text-text-mid">
                            <button
                              type="button"
                              onClick={() => setDetail(r)}
                              className="max-w-full truncate text-left hover:text-text-hi hover:underline"
                            >
                              {r.summary}
                            </button>
                          </span>
                          <span role="cell" className="t-mono truncate text-text-lo">
                            {r.ip}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2">
          <p className="t-body-sm text-text-lo">
            {formatCount(filtered.length)} of {formatCount(all.length)} entries rendered through a
            virtualised window — the register never mounts more rows than the viewport needs.
          </p>
          <p className="t-body-sm ml-auto text-text-lo">
            Source addresses are simulated; no request address is available in a browser-only
            prototype.
          </p>
        </div>
      </Panel>

      <AuditDetail row={detail} links={links} onClose={() => setDetail(null)} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface-1 px-3 py-2">
      <dt className="t-overline text-text-lo">{label}</dt>
      <dd className="t-heading-lg text-text-hi tabular-nums">{value}</dd>
      <dd className="t-body-sm text-text-lo">{sub}</dd>
    </div>
  );
}

function AuditDetail({
  row,
  links,
  onClose,
}: {
  row: AuditRow | null;
  links: LinkTable;
  onClose: () => void;
}) {
  if (!row) return null;
  const link = resolveLink(links, row.entityType, row.entityId);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Audit entry ${row.id}`}
      sub={`Sequence ${row.seq} · recorded ${formatDateTime(row.at)} IST`}
      width={620}
      footer={
        <>
          {link.href ? (
            <Link
              href={link.href}
              className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open {row.entityType}
            </Link>
          ) : null}
          <Btn onClick={onClose}>Close</Btn>
        </>
      }
    >
      <table className="w-full">
        <tbody>
          <Row label="Actor">
            {row.actorName} <span className="t-mono text-text-lo">({row.actorUserId})</span>
          </Row>
          <Row label="Role">{ROLE_LABEL[row.actorRole]}</Row>
          {row.impersonatedBy ? (
            <Row label="Impersonated by">
              <span className="t-mono">{row.impersonatedBy}</span>
            </Row>
          ) : null}
          <Row label="Action">
            <StatusBadge tone={ACTION_TONE[row.action] ?? "neutral"}>{actionLabel(row.action)}</StatusBadge>
          </Row>
          <Row label="Entity type">{row.entityType}</Row>
          <Row label="Entity ID">
            <span className="t-mono">{row.entityId}</span>
          </Row>
          <Row label="Entity">
            <span className="t-mono">{row.entityLabel}</span>
          </Row>
          <Row label="Summary">{row.summary}</Row>
          <Row label="Before">
            {row.before ? (
              <span className="t-mono text-danger">{row.before}</span>
            ) : (
              <span className="text-text-lo">Not applicable — this action created or read state.</span>
            )}
          </Row>
          <Row label="After">
            {row.after ? (
              <span className="t-mono text-ok">{row.after}</span>
            ) : (
              <span className="text-text-lo">Not applicable.</span>
            )}
          </Row>
          <Row label="Timestamp">
            <span className="t-mono">{formatDateTime(row.at)} IST</span>
          </Row>
          <Row label="Source IP">
            <span className="t-mono">{row.ip}</span>{" "}
            <span className="t-body-sm text-text-lo">simulated</span>
          </Row>
        </tbody>
      </table>
      {!link.href ? (
        <p className="t-body-sm mt-3 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-text-mid">
          {link.blocked}
        </p>
      ) : null}
      <p className="t-body-sm mt-3 flex items-start gap-2 text-text-lo">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        This entry cannot be edited or deleted. There is no control for it here, and no route
        accepts a mutation against an audit record.
      </p>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <Th className="w-40 bg-transparent align-top" scope="row">
        {label}
      </Th>
      <Td className="align-top text-text-hi">{children}</Td>
    </tr>
  );
}
