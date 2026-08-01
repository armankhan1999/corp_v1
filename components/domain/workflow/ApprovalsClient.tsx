"use client";

/**
 * E11-S2 — My Approvals with inline decision context.
 *
 * The story this screen has to make true: an approval takes seconds, because
 * everything needed to decide is already on screen. Pending requests carry the
 * type, requester, subject, value and age against the *step's* escalation SLA,
 * ordered by age descending; expanding one reveals the real supporting records;
 * a decision writes immediately and the list re-sorts without a reload.
 */

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronRight, CircleCheck, CircleX, CornerUpLeft, Inbox, ListChecks,
  MessageSquare, Search, ShieldAlert, TriangleAlert, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  abbreviateINR, formatCount, formatDateTime, formatRelative, formatPercent,
} from "@/lib/format";
import { ROLE_LABEL, type ApprovalRequestType, type ApprovalStatus } from "@/lib/schemas/enums";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState } from "@/components/patterns/primitives";
import {
  AuthorityNote, Btn, Checkbox, Field, FilteredEmpty, Note, SectionTitle, Segmented, Select,
  SlaMeter, Stat, TextArea, TextInput, ToastStack, useToasts,
} from "./ui";
import {
  describeSla, REQUEST_TYPE_META, slaTone, STATUS_TONE, validateComment, type Evaluation,
} from "./engine";
import { InlineContext } from "./InlineContext";
import { WhatsAppChannelPanel } from "./WhatsAppPreview";
import { useWorkflow } from "./store";
import type { WorkflowSnapshot } from "./types";

type Scope = "MINE" | "OPEN" | "ESCALATED" | "DECIDED";

const SCOPE_LABEL: Record<Scope, string> = {
  MINE: "On me",
  OPEN: "All open",
  ESCALATED: "Escalated",
  DECIDED: "Decided",
};

export function ApprovalsClient({
  snapshot, initialRequestId,
}: { snapshot: WorkflowSnapshot; initialRequestId?: string | null }) {
  const api = useWorkflow(snapshot);
  const { now } = api;
  const viewer = snapshot.viewer;
  const toasts = useToasts();

  const [scope, setScope] = React.useState<Scope>(viewer.hasApprovalAuthority ? "MINE" : "OPEN");
  const [typeFilter, setTypeFilter] = React.useState<"ALL" | ApprovalRequestType>("ALL");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(initialRequestId ?? null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkComment, setBulkComment] = React.useState("");
  const [bulkResult, setBulkResult] = React.useState<{ applied: string[]; excluded: { requestId: string; reason: string }[] } | null>(null);
  const [whatsappFor, setWhatsappFor] = React.useState<string | null>(null);

  const all = React.useMemo(
    () => [...api.evaluations.values()].sort((a, b) => b.ageMs - a.ageMs),
    [api.evaluations],
  );

  const counts = React.useMemo(() => ({
    MINE: all.filter((e) => !e.terminal && api.rightsOf(e.request.id).canDecide).length,
    OPEN: all.filter((e) => !e.terminal).length,
    ESCALATED: all.filter((e) => e.escalated).length,
    DECIDED: all.filter((e) => e.terminal).length,
  }), [all, api]);

  const scoped = React.useMemo(() => {
    switch (scope) {
      case "MINE": return all.filter((e) => !e.terminal && api.rightsOf(e.request.id).canDecide);
      case "ESCALATED": return all.filter((e) => e.escalated);
      case "DECIDED": return all.filter((e) => e.terminal);
      default: return all.filter((e) => !e.terminal);
    }
  }, [all, scope, api]);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () => scoped.filter((e) => {
      if (typeFilter !== "ALL" && e.request.type !== typeFilter) return false;
      if (!q) return true;
      const requester = api.snapshot.users.find((u) => u.id === e.request.requesterUserId)?.name ?? "";
      return (
        e.request.number.toLowerCase().includes(q) ||
        e.request.subjectLabel.toLowerCase().includes(q) ||
        requester.toLowerCase().includes(q) ||
        REQUEST_TYPE_META[e.request.type].label.toLowerCase().includes(q)
      );
    }),
    [scoped, typeFilter, q, api.snapshot.users],
  );

  const activeFilters = [
    scope !== "OPEN" ? SCOPE_LABEL[scope] : null,
    typeFilter !== "ALL" ? REQUEST_TYPE_META[typeFilter].label : null,
    q ? `Search “${query.trim()}”` : null,
  ].filter((x): x is string => Boolean(x));

  function clearFilters() {
    setScope("OPEN");
    setTypeFilter("ALL");
    setQuery("");
  }

  const selectable = filtered.filter((e) => !e.terminal);
  const eligibleIds = selectable.filter((e) => api.rightsOf(e.request.id).canDecide).map((e) => e.request.id);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk() {
    const ids = [...selected];
    if (!ids.length) return;
    const result = api.actions.bulkApprove(ids, bulkComment.trim() || "Bulk approval — reviewed in list view.");
    setBulkResult(result);
    setSelected(new Set());
    setBulkComment("");
    toasts.push(
      result.excluded.length ? "warn" : "ok",
      `${result.applied.length} approved, ${result.excluded.length} excluded`,
      "Each approval was recorded as its own decision with its own audit entry.",
    );
  }

  const decidedToday = all.filter(
    (e) => e.request.decidedAt && e.request.decidedAt.slice(0, 10) === api.snapshot.today.slice(0, 10),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">My Approvals</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
            Everything waiting on you, oldest first, with the records needed to decide already on screen. Age is
            measured against the current step&rsquo;s escalation SLA, not against the age of the request.
          </p>
        </div>
        <p className="t-body-sm text-text-lo">
          As at <span className="t-mono text-text-mid">{formatDateTime(now)}</span> IST
        </p>
      </div>

      {/* Metrics strip */}
      <Panel>
        <ul className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          <li className="bg-surface-1">
            <Stat
              label="Waiting on you"
              value={formatCount(counts.MINE)}
              sub={viewer.hasApprovalAuthority ? "actionable now" : "no approval authority in this role"}
              tone={counts.MINE > 0 ? "warn" : "ok"}
            />
          </li>
          <li className="bg-surface-1">
            <Stat
              label="Escalated"
              value={formatCount(counts.ESCALATED)}
              sub="step SLA elapsed"
              tone={counts.ESCALATED > 0 ? "danger" : "ok"}
            />
          </li>
          <li className="bg-surface-1">
            <Stat
              label="Median turnaround"
              value={`${api.medianTurnaroundHours.toFixed(1)} h`}
              sub="K-21 · target ≤ 4 working hours"
              tone={api.medianTurnaroundHours > 0 && api.medianTurnaroundHours <= 4 ? "ok" : "hi"}
            />
          </li>
          <li className="bg-surface-1">
            <Stat label="Decided today" value={formatCount(decidedToday)} sub="each with its own audit entry" />
          </li>
        </ul>
      </Panel>

      {!viewer.hasApprovalAuthority ? (
        <AuthorityNote
          icon="shield"
          message={`${ROLE_LABEL[viewer.role]} has read access to the approval queue but holds no approval authority — RBAC-4 separates the two. Decision controls are not rendered for any request below.`}
          authorityLabel={approversInMatrix(api).join(" · ")}
        />
      ) : null}

      {/* Toolbar */}
      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          <Segmented
            ariaLabel="Approval scope"
            value={scope}
            onChange={setScope}
            options={(["MINE", "OPEN", "ESCALATED", "DECIDED"] as Scope[]).map((s) => ({
              value: s, label: SCOPE_LABEL[s], count: counts[s],
            }))}
          />
          <Field label="Request type" htmlFor="ap-type" className="w-56">
            <Select
              id="ap-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "ALL" | ApprovalRequestType)}
              options={[
                { value: "ALL", label: "All request types" },
                ...(Object.keys(REQUEST_TYPE_META) as ApprovalRequestType[]).map((t) => ({
                  value: t, label: REQUEST_TYPE_META[t].label,
                })),
              ]}
            />
          </Field>
          <Field label="Search" htmlFor="ap-q" className="min-w-52 flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" aria-hidden />
              <TextInput
                id="ap-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Reference, subject or requester"
                className="pl-7"
              />
            </div>
          </Field>
        </div>

        {/* Bulk bar */}
        {viewer.hasApprovalAuthority && selectable.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-3 py-2">
            <Checkbox
              id="ap-all"
              label={`Select all actionable (${eligibleIds.length})`}
              checked={eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id))}
              onChange={(v) => setSelected(v ? new Set(eligibleIds) : new Set())}
              disabled={eligibleIds.length === 0}
            />
            <span className="t-body-sm text-text-lo">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <TextInput
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                placeholder="Optional note recorded on every decision"
                aria-label="Bulk approval note"
                className="w-64"
              />
              <Btn variant="primary" disabled={selected.size === 0} onClick={runBulk}>
                <ListChecks className="size-3.5" aria-hidden />
                Approve {selected.size || ""} selected
              </Btn>
            </div>
          </div>
        ) : null}

        {bulkResult ? (
          <div className="border-b border-line px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <Overline className="text-text-mid">Bulk result</Overline>
              <Btn size="sm" variant="ghost" onClick={() => setBulkResult(null)}>Dismiss</Btn>
            </div>
            <p className="t-body-sm mt-1 text-text-mid">
              {bulkResult.applied.length} approved as {bulkResult.applied.length === 1 ? "an individual decision" : "individual decisions"}, each with its own audit entry.
              {bulkResult.excluded.length ? ` ${bulkResult.excluded.length} excluded by inline validation:` : ""}
            </p>
            {bulkResult.excluded.length ? (
              <ul className="mt-1 flex flex-col gap-1">
                {bulkResult.excluded.map((x) => {
                  const r = api.requests.find((rr) => rr.id === x.requestId);
                  return (
                    <li key={x.requestId} className="t-body-sm flex items-start gap-2 text-text-mid">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0 text-warn" aria-hidden />
                      <span>
                        <span className="t-mono text-text-hi">{r?.number ?? x.requestId}</span> — {x.reason}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* List */}
        {filtered.length === 0 ? (
          activeFilters.length ? (
            <FilteredEmpty filters={activeFilters} onClear={clearFilters} what="approval requests" />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No approvals waiting on you"
              body="Nothing in the queue carries your authority right now. Requests appear here the moment a chain step resolves to your role, or when an earlier step's escalation timer elapses."
              action={
                <Link
                  href="/workflow/chains"
                  className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
                >
                  Review the approval chains
                </Link>
              }
            />
          )
        ) : (
          <ul className="flex flex-col">
            {filtered.map((e) => (
              <ApprovalRow
                key={e.request.id}
                api={api}
                evaluation={e}
                expanded={expanded === e.request.id}
                onToggle={() => setExpanded((cur) => (cur === e.request.id ? null : e.request.id))}
                selected={selected.has(e.request.id)}
                onSelect={() => toggleSelect(e.request.id)}
                selectable={viewer.hasApprovalAuthority && !e.terminal}
                onToast={toasts.push}
                whatsappOpen={whatsappFor === e.request.id}
                onWhatsapp={() => setWhatsappFor((cur) => (cur === e.request.id ? null : e.request.id))}
              />
            ))}
          </ul>
        )}
      </Panel>

      <p className="t-body-sm text-text-lo">
        Decisions are held in <span className="t-mono">pravaah.v1.workflow</span> and the audit trail in{" "}
        <span className="t-mono">pravaah.v1.audit</span>. The seeded dataset is never mutated — clearing those keys
        restores the baseline exactly.
      </p>

      <ToastStack items={toasts.items} dismiss={toasts.dismiss} />
    </div>
  );
}

function approversInMatrix(api: ReturnType<typeof useWorkflow>): string[] {
  const roles = new Set<string>();
  for (const e of api.evaluations.values()) {
    for (const r of e.actionableRoles) roles.add(ROLE_LABEL[r]);
  }
  return roles.size ? [...roles] : ["Director – Business"];
}

/* ------------------------------------------------------------------- row */

function ApprovalRow({
  api, evaluation, expanded, onToggle, selected, onSelect, selectable, onToast, whatsappOpen, onWhatsapp,
}: {
  api: ReturnType<typeof useWorkflow>;
  evaluation: Evaluation;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
  selectable: boolean;
  onToast: (tone: "ok" | "danger" | "warn" | "info", title: string, body?: string) => void;
  whatsappOpen: boolean;
  onWhatsapp: () => void;
}) {
  const req = evaluation.request;
  const meta = REQUEST_TYPE_META[req.type];
  const rights = api.rightsOf(req.id);
  const requester = api.snapshot.users.find((u) => u.id === req.requesterUserId);
  const context = api.snapshot.contexts[req.id];
  const tone = slaTone(evaluation);
  const fraction = evaluation.slaHours > 0
    ? Math.max(0, Math.min(1, evaluation.stepElapsedMs / (evaluation.slaHours * 3_600_000)))
    : 1;

  const [mode, setMode] = React.useState<null | "REJECTED" | "RETURNED">(null);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function submit(decision: "APPROVED" | "REJECTED" | "RETURNED") {
    const validation = validateComment(decision, comment);
    if (validation) {
      setError(validation);
      return;
    }
    const result = api.actions.decide({ requestId: req.id, decision, comment, channel: "IN_APP" });
    if (!result.ok) {
      setError(result.message);
      onToast("danger", "Decision not recorded", result.message);
      return;
    }
    setError(null);
    setComment("");
    setMode(null);
    onToast(
      decision === "APPROVED" ? "ok" : decision === "REJECTED" ? "danger" : "warn",
      `${req.number} — ${decision.toLowerCase()}`,
      result.message,
    );
  }

  return (
    <li className="border-b border-line last:border-0">
      {/* Summary row — 36px dense at compact density */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition-colors duration-150 hover:bg-surface-2",
          expanded && "bg-surface-2",
        )}
      >
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            disabled={!rights.canDecide}
            aria-label={`Select ${req.number} for bulk approval`}
            title={rights.canDecide ? undefined : rights.message}
            className="size-3.5 shrink-0 accent-[var(--primary-600)] disabled:opacity-40"
          />
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {expanded
            ? <ChevronDown className="size-4 shrink-0 text-text-lo" aria-hidden />
            : <ChevronRight className="size-4 shrink-0 text-text-lo" aria-hidden />}

          <span className="w-40 shrink-0">
            <span className="t-overline block text-text-lo">{meta.label}</span>
            <span className="t-mono block truncate text-text-hi">{req.number}</span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="t-body block truncate text-text-hi">{req.subjectLabel}</span>
            <span className="t-body-sm block truncate text-text-lo">
              {requester?.name ?? "Unknown"} · {requester ? ROLE_LABEL[requester.role] : "—"} ·{" "}
              {api.snapshot.branches.find((b) => b.id === req.branchId)?.name ?? "—"}
            </span>
          </span>

          <span className="w-28 shrink-0 text-right">
            <span className="t-body block tabular-nums text-text-hi">
              {req.value > 0 ? abbreviateINR(req.value) : "—"}
            </span>
            <span className="t-body-sm block text-text-lo">
              {req.value > 0 ? "value" : "not value-bearing"}
            </span>
          </span>

          <span className="hidden w-52 shrink-0 lg:block">
            <SlaMeter tone={tone} fraction={fraction} caption={describeSla(evaluation)} compact />
          </span>

          <span className="w-28 shrink-0 text-right">
            <StatusBadge tone={STATUS_TONE[evaluation.status as ApprovalStatus]}>
              {evaluation.status}
            </StatusBadge>
            <span className="t-body-sm mt-0.5 block text-text-lo">
              {formatRelative(req.raisedAt, api.now)}
            </span>
          </span>
        </button>
      </div>

      {evaluation.escalated && !expanded ? (
        <p className="t-body-sm flex items-start gap-1.5 border-t border-line bg-danger-bg px-3 py-1.5 text-danger">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          Escalated to {evaluation.escalatedToRole ? ROLE_LABEL[evaluation.escalatedToRole] : "the next authority"} —
          the {evaluation.slaHours} h step SLA elapsed. Both the original approver and the requester were notified,
          and it is carried into the Command Centre exception feed as APPROVAL_OVERDUE.
        </p>
      ) : null}

      {/* -------------------------------------------------------- expansion */}
      {expanded ? (
        <div className="flex flex-col gap-4 border-t border-line bg-surface-0 p-3">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            {/* Inline context — the point of the story */}
            <div className="min-w-0">
              {context ? (
                <InlineContext context={context} now={api.now} />
              ) : (
                <Note tone="warn">
                  No inline context was assembled for this request. Open {meta.subjectEntity.toLowerCase()}{" "}
                  <span className="t-mono">{req.subjectId}</span> before deciding.
                </Note>
              )}
            </div>

            {/* Chain, history, decision */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="rounded-md border border-line">
                <SectionTitle
                  right={
                    <span className="t-body-sm text-text-lo">
                      {api.chains.find((c) => c.id === req.resolvedChainId)?.name ?? "Chain removed"}
                    </span>
                  }
                >
                  Resolved chain — frozen at raise
                </SectionTitle>
                <ol className="flex flex-col">
                  {evaluation.steps.map((s) => {
                    const isCurrent = s.state === "CURRENT";
                    return (
                      <li
                        key={s.order}
                        className={cn(
                          "flex items-start gap-2 border-b border-line px-3 py-2 last:border-0",
                          isCurrent && "bg-surface-2",
                        )}
                      >
                        <span
                          className={cn(
                            "t-mono mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[0.6875rem]",
                            s.state === "APPROVED" ? "border-ok/50 bg-ok-bg text-ok"
                              : s.state === "REJECTED" ? "border-danger/50 bg-danger-bg text-danger"
                                : s.state === "RETURNED" ? "border-warn/50 bg-warn-bg text-warn"
                                  : isCurrent ? "border-info/50 bg-info-bg text-info"
                                    : "border-line bg-surface-2 text-text-lo",
                          )}
                        >
                          {s.order}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="t-body-sm block text-text-hi">{ROLE_LABEL[s.approverRole]}</span>
                          <span className="t-body-sm block text-text-lo">
                            {s.escalationHours} h escalation timer
                            {s.startedAt ? ` · started ${formatDateTime(s.startedAt)}` : ""}
                          </span>
                          {s.decision ? (
                            <span className="t-body-sm mt-0.5 block text-text-mid">
                              {s.decision.decision} by{" "}
                              {api.snapshot.users.find((u) => u.id === s.decision!.approverUserId)?.name ?? "—"}
                              {s.decision.onBehalfOfUserId ? " (delegated)" : ""} via {s.decision.channel}
                              {s.decision.comment ? ` — “${s.decision.comment}”` : ""}
                            </span>
                          ) : null}
                        </span>
                        {isCurrent ? <StatusBadge tone="info">Current</StatusBadge> : null}
                        {s.state === "APPROVED" ? <StatusBadge tone="ok">Done</StatusBadge> : null}
                      </li>
                    );
                  })}
                </ol>
                <p className="t-body-sm border-t border-line px-3 py-1.5 text-text-lo">
                  Sequential chain — only the current approver may act. An earlier approver cannot re-decide.
                  {meta.basis !== "NONE" ? ` Band basis: ${meta.basis === "PERCENT" ? "discount percentage" : "rupee value"}.` : ""}
                </p>
              </div>

              <SlaMeter tone={tone} fraction={fraction} caption={describeSla(evaluation)} />

              {evaluation.history.length ? (
                <div className="rounded-md border border-line">
                  <SectionTitle>
                    <History className="mr-1 inline size-3" aria-hidden /> Decision history
                  </SectionTitle>
                  <ul className="flex flex-col">
                    {evaluation.history.map((d) => (
                      <li key={d.id} className="border-b border-line px-3 py-1.5 last:border-0">
                        <p className="t-body-sm text-text-hi">
                          Step {d.stepOrder} · {d.decision} ·{" "}
                          {api.snapshot.users.find((u) => u.id === d.approverUserId)?.name ?? d.approverUserId}
                        </p>
                        <p className="t-body-sm text-text-lo">
                          {formatDateTime(d.at)} · channel {d.channel}
                          {d.onBehalfOfUserId ? " · recorded as delegated" : ""}
                        </p>
                        {d.comment ? <p className="t-body-sm mt-0.5 text-text-mid">“{d.comment}”</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Decision controls — rendered only where authority exists */}
              {rights.canDecide ? (
                <div className="rounded-md border border-line-strong bg-surface-1">
                  <SectionTitle right={<span className="t-body-sm text-text-lo">{rights.message}</span>}>
                    Decision
                  </SectionTitle>
                  <div className="flex flex-col gap-2 p-3">
                    {mode ? (
                      <Field
                        label={mode === "REJECTED" ? "Rejection reason (mandatory)" : "What must the requester clarify? (mandatory)"}
                        htmlFor={`reason-${req.id}`}
                        error={error}
                        hint={
                          mode === "REJECTED"
                            ? "The requester sees this text on the returned request."
                            : "The request goes back to the requester with this note visible."
                        }
                      >
                        <TextArea
                          id={`reason-${req.id}`}
                          value={comment}
                          onChange={(e) => { setComment(e.target.value); setError(null); }}
                          placeholder={
                            mode === "REJECTED"
                              ? "e.g. Discount exceeds what the margin on this configuration can carry."
                              : "e.g. Attach the certified measurement sheet for the period."
                          }
                        />
                      </Field>
                    ) : (
                      <Field label="Comment (optional on approve)" htmlFor={`c-${req.id}`} error={error}>
                        <TextArea
                          id={`c-${req.id}`}
                          value={comment}
                          onChange={(e) => { setComment(e.target.value); setError(null); }}
                          placeholder="Recorded with the decision in the audit log."
                        />
                      </Field>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {mode === null ? (
                        <>
                          <Btn variant="primary" onClick={() => submit("APPROVED")}>
                            <CircleCheck className="size-3.5" aria-hidden /> Approve
                          </Btn>
                          <Btn variant="danger" onClick={() => { setMode("REJECTED"); setError(null); }}>
                            <CircleX className="size-3.5" aria-hidden /> Reject
                          </Btn>
                          <Btn variant="warn" onClick={() => { setMode("RETURNED"); setError(null); }}>
                            <CornerUpLeft className="size-3.5" aria-hidden /> Return for clarification
                          </Btn>
                          <Btn onClick={onWhatsapp} className="ml-auto">
                            <MessageSquare className="size-3.5" aria-hidden />
                            {whatsappOpen ? "Hide WhatsApp" : "Send via WhatsApp"}
                          </Btn>
                        </>
                      ) : (
                        <>
                          <Btn
                            variant={mode === "REJECTED" ? "danger" : "warn"}
                            onClick={() => submit(mode)}
                          >
                            Confirm {mode === "REJECTED" ? "rejection" : "return"}
                          </Btn>
                          <Btn variant="ghost" onClick={() => { setMode(null); setError(null); }}>Cancel</Btn>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <AuthorityNote
                    icon={rights.reason === "NO_APPROVAL_AUTHORITY" ? "shield" : "lock"}
                    message={rights.message}
                    authorityLabel={
                      rights.authorityRole
                        ? `${ROLE_LABEL[rights.authorityRole]}${rights.authorityUserName ? ` — ${rights.authorityUserName}` : ""}`
                        : null
                    }
                  />
                  {!evaluation.terminal ? (
                    <Btn onClick={onWhatsapp}>
                      <MessageSquare className="size-3.5" aria-hidden />
                      {whatsappOpen ? "Hide WhatsApp preview" : "Preview the WhatsApp message"}
                    </Btn>
                  ) : null}
                </>
              )}

              <div className="rounded-md border border-line">
                <SectionTitle>Where this came from</SectionTitle>
                <div className="flex flex-col gap-1 px-3 py-2">
                  <p className="t-body-sm text-text-mid">{meta.origin}</p>
                  <p className="t-body-sm text-text-lo">
                    Subject: {meta.subjectEntity} <span className="t-mono">{req.subjectId}</span> · raised{" "}
                    {formatDateTime(req.raisedAt)}
                  </p>
                  {Object.entries(req.context).length ? (
                    <p className="t-body-sm text-text-lo">
                      {Object.entries(req.context).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {whatsappOpen ? (
            <WhatsAppChannelPanel
              api={api}
              requestId={req.id}
              onDecided={(summary) => onToast("ok", `${req.number} decided from WhatsApp`, summary)}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------ permission-denied screen */

export function ApprovalsDenied({ role, landing }: { role: string; landing: string }) {
  return (
    <Panel>
      <PanelHeader title="My Approvals" sub="Approval authority is granted separately from data access." />
      <EmptyState
        icon={ShieldAlert}
        title="This role holds no approval authority"
        body={`${role} cannot decide approval requests. Authority sits with the roles named in the permission matrix.`}
        action={
          <Link
            href={landing}
            className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to your landing screen
          </Link>
        }
      />
    </Panel>
  );
}

/** Small helper used by the workflow hub. */
export function pctLabel(v: number): string {
  return formatPercent(v);
}
