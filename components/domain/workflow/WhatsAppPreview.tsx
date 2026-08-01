"use client";

/**
 * E11-S5 / FR-M10-09, FR-M10-10 / INT-04 — the simulated WhatsApp channel.
 *
 * This is the one surface in Pravaah permitted a different visual register: it
 * must read as a phone message. Everything is nevertheless built from the token
 * set — no screenshot, no stock art, no gradient, no emoji. Bubble geometry,
 * tick states and the interactive button rail are reconstructed, not borrowed.
 *
 * BRD R-04 is the governing risk: simulated messaging must never be mistaken
 * for live messaging. A persistent "Simulated" chip sits in the chat header AND
 * on every bubble, links to /admin/integrations, and is never hover-only.
 */

import * as React from "react";
import {
  AlertCircle, ArrowLeft, Check, CheckCheck, Clock, MoreVertical, Phone, Send, Video, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhone, formatTime, formatDateTime, abbreviateINR } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import type { MessageState, NotificationChannel } from "@/lib/schemas/enums";
import { Panel, PanelHeader, Overline, SimulatedBadge, StatusBadge } from "@/components/patterns/primitives";
import { Btn, Field, Note, Select, TextInput, Segmented } from "./ui";
import { parseRich, renderTemplate, TEMPLATES, TEMPLATE_BY_ID, type MessageTemplate } from "./templates";
import { REQUEST_TYPE_META } from "./engine";
import type { WorkflowApi } from "./store";

/* ------------------------------------------------------------ tick states */

const TICK: Record<MessageState, { label: string; className: string }> = {
  QUEUED: { label: "Queued", className: "text-text-lo" },
  SENT: { label: "Sent", className: "text-text-lo" },
  DELIVERED: { label: "Delivered", className: "text-text-lo" },
  READ: { label: "Read", className: "text-info" },
  FAILED: { label: "Not delivered", className: "text-danger" },
};

export function DeliveryTicks({ state, withLabel = true }: { state: MessageState; withLabel?: boolean }) {
  const t = TICK[state];
  const Icon =
    state === "QUEUED" ? Clock : state === "SENT" ? Check : state === "FAILED" ? AlertCircle : CheckCheck;
  return (
    <span className={cn("inline-flex items-center gap-1", t.className)}>
      {withLabel ? <span className="t-overline">{t.label}</span> : null}
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{t.label}</span>
    </span>
  );
}

/* ----------------------------------------------------------------- bubble */

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <br /> : null}
          {parseRich(line).map((tok, k) => {
            if (tok.kind === "bold") return <strong key={k} className="font-semibold text-text-hi">{tok.value}</strong>;
            if (tok.kind === "italic") return <em key={k}>{tok.value}</em>;
            if (tok.kind === "strike") return <s key={k}>{tok.value}</s>;
            if (tok.kind === "mono") return <code key={k} className="t-mono">{tok.value}</code>;
            return <React.Fragment key={k}>{tok.value}</React.Fragment>;
          })}
        </React.Fragment>
      ))}
    </>
  );
}

export interface BubbleButton {
  id: "APPROVE" | "REJECT" | "OPEN";
  label: string;
  disabled?: boolean;
}

export function WhatsAppBubble({
  direction, text, at, state, buttons, onButton, footerNote,
}: {
  direction: "out" | "in";
  text: string;
  at: string;
  state?: MessageState;
  buttons?: BubbleButton[];
  onButton?: (id: BubbleButton["id"]) => void;
  footerNote?: string;
}) {
  const out = direction === "out";
  return (
    <div className={cn("flex w-full flex-col", out ? "items-end" : "items-start")}>
      {out ? (
        // Persistent, never behind hover. BRD R-04 / FR-M1-16.
        <SimulatedBadge what="WhatsApp Business API (INT-04)" className="mb-1" />
      ) : null}
      <div
        className={cn(
          "max-w-[22rem] min-w-[10rem] border px-2.5 py-2",
          out
            ? "rounded-md rounded-tr-[3px] border-line-strong bg-surface-3"
            : "rounded-md rounded-tl-[3px] border-line bg-surface-2",
        )}
      >
        <p className="t-body-sm whitespace-pre-wrap break-words text-text-mid">
          <RichText text={text} />
        </p>
        <div className="mt-1 flex items-center justify-end gap-1.5">
          <span className="t-mono text-[0.6875rem] text-text-lo">{formatTime(at)}</span>
          {out && state ? <DeliveryTicks state={state} /> : null}
        </div>
      </div>

      {buttons && buttons.length > 0 ? (
        <div
          className={cn(
            "mt-px flex w-[22rem] max-w-full flex-col overflow-hidden rounded-b-[8px] border border-t-0",
            out ? "border-line-strong bg-surface-3" : "border-line bg-surface-2",
          )}
        >
          {buttons.map((b, i) => (
            <button
              key={b.id}
              type="button"
              disabled={b.disabled}
              onClick={() => onButton?.(b.id)}
              className={cn(
                "h-9 w-full text-center text-[0.8125rem] font-medium text-info transition-colors duration-150",
                "hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-text-lo",
                i > 0 && "border-t border-line",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}

      {footerNote ? <p className="t-body-sm mt-1 max-w-[22rem] text-text-lo">{footerNote}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------ chat frame */

export interface ThreadEntry {
  id: string;
  direction: "out" | "in";
  text: string;
  at: string;
  state?: MessageState;
  buttons?: BubbleButton[];
  footerNote?: string;
}

export function WhatsAppPreview({
  recipientName, recipientPhone, thread, onButton, reply, dayLabel,
}: {
  recipientName: string;
  recipientPhone: string;
  thread: ThreadEntry[];
  onButton?: (entryId: string, id: BubbleButton["id"]) => void;
  reply?: React.ReactNode;
  dayLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-inset">
      {/* Chat header — reconstructed from tokens, not a screenshot. */}
      <div className="flex h-14 items-center gap-2 border-b border-line bg-surface-2 px-3">
        <ArrowLeft className="size-4 shrink-0 text-text-lo" aria-hidden />
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.6875rem] text-text-mid"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          BC
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-body-sm truncate font-medium text-text-hi">Pravaah · Bhushancorp</p>
          <p className="t-body-sm truncate text-text-lo">
            Business account · to {recipientName} {formatPhone(recipientPhone)}
          </p>
        </div>
        <SimulatedBadge what="WhatsApp Business API (INT-04)" />
        <Phone className="size-4 shrink-0 text-text-lo" aria-hidden />
        <Video className="size-4 shrink-0 text-text-lo" aria-hidden />
        <MoreVertical className="size-4 shrink-0 text-text-lo" aria-hidden />
      </div>

      {/* Chat pane — flat surface, no wallpaper artwork. */}
      <div className="flex min-h-[16rem] flex-col gap-3 p-3">
        <div className="flex justify-center">
          <span className="t-overline rounded-full border border-line bg-surface-2 px-2 py-0.5 text-text-lo">
            {dayLabel}
          </span>
        </div>
        {thread.map((m) => (
          <WhatsAppBubble
            key={m.id}
            direction={m.direction}
            text={m.text}
            at={m.at}
            state={m.state}
            buttons={m.buttons}
            footerNote={m.footerNote}
            onButton={(id) => onButton?.(m.id, id)}
          />
        ))}
      </div>

      {reply ? <div className="border-t border-line bg-surface-2 p-2">{reply}</div> : null}
    </div>
  );
}

/* ------------------------------------------------- delivery-state timeline */

const STATE_ORDER: MessageState[] = ["QUEUED", "SENT", "DELIVERED", "READ"];

export function DeliveryTimeline({ state }: { state: MessageState }) {
  const failed = state === "FAILED";
  const reached = failed ? 1 : STATE_ORDER.indexOf(state);
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {STATE_ORDER.map((s, i) => {
        const done = i <= reached;
        return (
          <li key={s} className="flex items-center gap-1.5">
            {i > 0 ? <span className="h-px w-4 bg-line" aria-hidden /> : null}
            <span
              className={cn(
                "t-overline rounded-md border px-1.5 py-0.5",
                done ? "border-line-strong bg-surface-3 text-text-hi" : "border-line bg-surface-1 text-text-lo",
              )}
            >
              {TICK[s].label}
            </span>
          </li>
        );
      })}
      {failed ? (
        <li className="flex items-center gap-1.5">
          <span className="h-px w-4 bg-line" aria-hidden />
          <StatusBadge tone="danger">Failed</StatusBadge>
        </li>
      ) : null}
    </ol>
  );
}

/* -------------------------------------------------------- channel panel */

interface PanelProps {
  api: WorkflowApi;
  /** Approval the composer is bound to; drives auto-fill and the button rail. */
  requestId: string | null;
  onDecided?: (summary: string) => void;
  compact?: boolean;
}

function autoFill(api: WorkflowApi, template: MessageTemplate, requestId: string | null): Record<string, string> {
  const values: Record<string, string> = {};
  const req = requestId ? api.requests.find((r) => r.id === requestId) : null;
  const evaluation = requestId ? api.evaluations.get(requestId) : null;
  const requester = req ? api.snapshot.users.find((u) => u.id === req.requesterUserId) : null;
  const ctx = req ? api.snapshot.contexts[req.id] : undefined;

  for (const v of template.variables) {
    switch (v.key) {
      case "subject": values[v.key] = req?.subjectLabel ?? v.example; break;
      case "requestType": values[v.key] = req ? REQUEST_TYPE_META[req.type].label : v.example; break;
      case "value": values[v.key] = req ? (req.value > 0 ? abbreviateINR(req.value) : "Not value-bearing") : v.example; break;
      case "requester": values[v.key] = requester?.name ?? v.example; break;
      case "number": values[v.key] = req?.number ?? v.example; break;
      case "step": values[v.key] = evaluation?.currentStepOrder ? String(evaluation.currentStepOrder) : v.example; break;
      case "steps": values[v.key] = req ? String(req.resolvedSteps.length) : v.example; break;
      case "sla": values[v.key] = evaluation ? String(evaluation.slaHours) : v.example; break;
      case "age": values[v.key] = evaluation ? String(Math.round(evaluation.stepElapsedMs / 3_600_000)) : v.example; break;
      case "originalApprover": values[v.key] = evaluation?.currentStepRole ? ROLE_LABEL[evaluation.currentStepRole] : v.example; break;
      case "escalatedTo": values[v.key] = evaluation?.escalatedToRole ? ROLE_LABEL[evaluation.escalatedToRole] : v.example; break;
      case "employee": values[v.key] = ctx && ctx.kind === "LEAVE" ? ctx.employeeName : v.example; break;
      case "days": values[v.key] = ctx && ctx.kind === "LEAVE" ? String(ctx.days) : v.example; break;
      case "fromDate": values[v.key] = ctx && ctx.kind === "LEAVE" ? ctx.fromDate.slice(0, 10) : v.example; break;
      case "toDate": values[v.key] = ctx && ctx.kind === "LEAVE" ? ctx.toDate.slice(0, 10) : v.example; break;
      case "leaveType": values[v.key] = ctx && ctx.kind === "LEAVE" ? ctx.leaveTypeName : v.example; break;
      case "coverage": values[v.key] = ctx && ctx.kind === "LEAVE" ? ctx.coverageArrangement : v.example; break;
      default: values[v.key] = v.example;
    }
  }
  return values;
}

export function WhatsAppChannelPanel({ api, requestId, onDecided, compact }: PanelProps) {
  const { snapshot, now } = api;
  const request = requestId ? api.requests.find((r) => r.id === requestId) ?? null : null;
  const evaluation = requestId ? api.evaluations.get(requestId) ?? null : null;
  const rights = requestId ? api.rightsOf(requestId) : null;

  const defaultTemplate =
    request?.type === "LEAVE" ? "leave_request_v1"
      : evaluation?.escalated ? "approval_escalation_v1"
        : "approval_request_v1";

  const [templateId, setTemplateId] = React.useState(defaultTemplate);
  const [channel, setChannel] = React.useState<NotificationChannel>("WHATSAPP");
  const [recipientId, setRecipientId] = React.useState(() => {
    const role = evaluation?.escalatedToRole ?? evaluation?.currentStepRole ?? snapshot.viewer.role;
    return snapshot.users.find((u) => u.role === role)?.id ?? snapshot.viewer.userId;
  });
  const template = TEMPLATE_BY_ID[templateId] ?? TEMPLATES[0]!;
  const [values, setValues] = React.useState<Record<string, string>>(() => autoFill(api, template, requestId));
  const [dispatched, setDispatched] = React.useState<{ messageId: string; at: string } | null>(null);
  const [thread, setThread] = React.useState<ThreadEntry[]>([]);
  const [replyText, setReplyText] = React.useState("");
  const [rejecting, setRejecting] = React.useState(false);
  const [view, setView] = React.useState<"preview" | "variables">("preview");

  // Re-fill when the bound request or template changes.
  const fillKey = `${templateId}|${requestId ?? ""}`;
  const lastFill = React.useRef(fillKey);
  React.useEffect(() => {
    if (lastFill.current === fillKey) return;
    lastFill.current = fillKey;
    setValues(autoFill(api, TEMPLATE_BY_ID[templateId] ?? TEMPLATES[0]!, requestId));
    setDispatched(null);
    setThread([]);
    setRejecting(false);
  }, [fillKey, api, templateId, requestId]);

  const rendered = renderTemplate(template, values);
  const recipient = snapshot.users.find((u) => u.id === recipientId) ?? snapshot.users[0]!;
  const liveMessage = dispatched ? api.messages.find((m) => m.id === dispatched.messageId) ?? null : null;
  const state: MessageState = liveMessage?.state ?? "QUEUED";
  const failureMode = api.demo.whatsappFailure;

  /* Delivery state advances on a timer: Queued → Sent → Delivered → Read.
     With the demo failure toggle on, it stops at Failed instead. */
  React.useEffect(() => {
    if (!dispatched) return;
    const id = dispatched.messageId;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => api.actions.setMessageState(id, "SENT"), 900));
    if (failureMode) {
      timers.push(window.setTimeout(() => api.actions.setMessageState(id, "FAILED"), 2100));
    } else {
      timers.push(window.setTimeout(() => api.actions.setMessageState(id, "DELIVERED"), 2300));
      timers.push(window.setTimeout(() => api.actions.setMessageState(id, "READ"), 4200));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatched?.messageId, failureMode]);

  const actionable = template.buttons.some((b) => b.id === "APPROVE") && Boolean(request) && Boolean(rights?.canDecide);

  function dispatch() {
    const at = now.toISOString();
    const record = api.actions.logMessage({
      channel,
      recipientUserId: recipient.id,
      recipientContactId: null,
      recipientLabel: recipient.name,
      recipientPhone: recipient.phone,
      template: template.id,
      content: rendered.text,
      approvalRequestId: request?.id ?? null,
      entityType: request ? "APPROVAL" : null,
      entityId: request?.id ?? null,
      state: "QUEUED",
      at,
    });
    setDispatched({ messageId: record.id, at });
    setThread([
      {
        id: record.id,
        direction: "out",
        text: rendered.text,
        at,
        state: "QUEUED",
        buttons: actionable
          ? template.buttons
            .filter((b) => b.id !== "OPEN")
            .map((b) => ({ id: b.id, label: b.label }))
          : undefined,
        footerNote: template.footer,
      },
    ]);
    setRejecting(false);
  }

  function recordDecision(decision: "APPROVED" | "REJECTED", comment: string) {
    if (!request) return;
    const result = api.actions.decide({
      requestId: request.id,
      decision,
      comment,
      // FR-M10-10 — the decision is stamped with the channel it arrived on.
      channel: "WHATSAPP",
    });
    const at = now.toISOString();
    setThread((t) => [
      ...t.map((m) => ({ ...m, buttons: undefined })),
      {
        id: `${request.id}-reply-${t.length}`,
        direction: "in",
        text: decision === "APPROVED" ? "Approve" : `Reject\n${comment}`,
        at,
      },
      {
        id: `${request.id}-ack-${t.length}`,
        direction: "out",
        text: result.ok
          ? `*Recorded in Pravaah*\n${decision === "APPROVED" ? "Approved" : "Rejected"} by ${snapshot.viewer.name} (${ROLE_LABEL[snapshot.viewer.role]}).\n${result.message}\nChannel noted: WhatsApp.`
          : `*Not recorded*\n${result.message}`,
        at,
        state: result.ok ? "READ" : "FAILED",
      },
    ]);
    setRejecting(false);
    setReplyText("");
    if (result.ok) onDecided?.(result.message);
  }

  function onButton(_entryId: string, id: BubbleButton["id"]) {
    if (id === "APPROVE") {
      recordDecision("APPROVED", "Approved from the WhatsApp preview.");
      return;
    }
    if (id === "REJECT") {
      // Rejection requires a reason — the composer becomes the reason field.
      setRejecting(true);
    }
  }

  const replyBar = (
    <div className="flex items-end gap-2">
      <TextInput
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder={rejecting ? "Type the reason for rejection — it is mandatory and the requester sees it" : "Message"}
        aria-label={rejecting ? "Rejection reason" : "Reply"}
        className="flex-1"
      />
      <Btn
        variant={rejecting ? "danger" : "default"}
        disabled={!rejecting || replyText.trim().length < 8}
        onClick={() => recordDecision("REJECTED", replyText)}
        aria-label="Send reply"
      >
        <Send className="size-3.5" aria-hidden />
        {rejecting ? "Send rejection" : "Send"}
      </Btn>
    </div>
  );

  return (
    <Panel>
      <PanelHeader
        title="WhatsApp channel"
        sub="Composer, template preview and the actionable approval rail. Nothing leaves this machine."
        right={<SimulatedBadge what="WhatsApp Business API (INT-04)" />}
      />

      <div className={cn("grid gap-4 p-3", compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem]")}>
        {/* ---------------------------------------------------- composer */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Template" htmlFor="wa-template" hint={`${template.category} · ${template.variables.length} variables`}>
              <Select
                id="wa-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                options={TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
              />
            </Field>
            <Field label="Channel" htmlFor="wa-channel">
              <Select
                id="wa-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                options={template.channels.map((c) => ({ value: c, label: c === "IN_APP" ? "In-app" : c === "WHATSAPP" ? "WhatsApp" : c === "SMS" ? "SMS" : "Email" }))}
              />
            </Field>
            <Field label="Recipient" htmlFor="wa-recipient">
              <Select
                id="wa-recipient"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                options={snapshot.users.map((u) => ({ value: u.id, label: `${u.name} — ${ROLE_LABEL[u.role]}` }))}
              />
            </Field>
          </div>

          <Segmented
            ariaLabel="Composer view"
            value={view}
            onChange={setView}
            options={[
              { value: "preview", label: "Preview" },
              { value: "variables", label: "Variables", count: template.variables.length },
            ]}
          />

          {view === "variables" ? (
            <div className="overflow-hidden rounded-md border border-line">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="t-overline px-2 py-1.5 text-left text-text-lo">Variable</th>
                    <th className="t-overline px-2 py-1.5 text-left text-text-lo">Bound to</th>
                    <th className="t-overline px-2 py-1.5 text-left text-text-lo">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {template.variables.map((v) => (
                    <tr key={v.key} className="border-b border-line last:border-0">
                      <td className="px-2 py-1.5 align-top">
                        <span className="t-mono text-text-hi">{`{{${v.key}}}`}</span>
                        <p className="t-body-sm text-text-lo">{v.label}</p>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <span className="t-body-sm text-text-mid">{v.source}</span>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <TextInput
                          value={values[v.key] ?? ""}
                          onChange={(e) => setValues((s) => ({ ...s, [v.key]: e.target.value }))}
                          aria-label={`Value for ${v.label}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <WhatsAppPreview
              recipientName={recipient.name}
              recipientPhone={recipient.phone}
              dayLabel={formatDateTime(now).split(",")[0] ?? "Today"}
              thread={
                thread.length
                  ? thread.map((m) => (m.id === dispatched?.messageId ? { ...m, state } : m))
                  : [{
                    id: "draft",
                    direction: "out" as const,
                    text: rendered.text,
                    at: now.toISOString(),
                    state: "QUEUED" as MessageState,
                    buttons: actionable
                      ? template.buttons.filter((b) => b.id !== "OPEN").map((b) => ({ id: b.id, label: b.label, disabled: true }))
                      : undefined,
                    footerNote: `${template.footer} · Draft — not yet dispatched`,
                  }]
              }
              onButton={onButton}
              reply={dispatched ? replyBar : undefined}
            />
          )}

          {rendered.missing.length ? (
            <Note tone="warn">
              {rendered.missing.length} variable{rendered.missing.length === 1 ? "" : "s"} unresolved:{" "}
              <span className="t-mono">{rendered.missing.join(", ")}</span>. Meta rejects a template submitted with an
              empty parameter, so the composer shows the gap rather than sending a blank.
            </Note>
          ) : null}
        </div>

        {/* ------------------------------------------------------ side rail */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="rounded-md border border-line">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <Overline className="text-text-mid">Delivery state</Overline>
              <DeliveryTicks state={state} />
            </div>
            <div className="flex flex-col gap-2 p-3">
              <DeliveryTimeline state={state} />
              <p className="t-body-sm text-text-lo">
                {dispatched
                  ? `Dispatched at ${formatTime(dispatched.at)} to ${formatPhone(recipient.phone)}. States advance on a timer; no gateway is contacted.`
                  : "Nothing dispatched yet. The preview above is a draft."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Btn variant="primary" onClick={dispatch}>
                  <Send className="size-3.5" aria-hidden /> {dispatched ? "Dispatch again" : "Dispatch"}
                </Btn>
                {dispatched ? (
                  <Btn onClick={() => api.actions.setMessageState(dispatched.messageId, "READ")}>Mark read</Btn>
                ) : null}
              </div>
            </div>
          </div>

          {/* Demo Controls — the reachable failure state E11-S5 requires. */}
          <div className="rounded-md border border-line">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <Overline className="text-text-mid">Demo controls</Overline>
              <Zap className="size-3.5 text-sim" aria-hidden />
            </div>
            <div className="flex flex-col gap-2 p-3">
              <label className="flex items-start gap-2 text-[0.8125rem] text-text-mid">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-[var(--danger)]"
                  checked={failureMode}
                  onChange={(e) => api.actions.setWhatsappFailure(e.target.checked)}
                />
                <span>
                  Force delivery failure
                  <span className="block text-text-lo">
                    The next dispatch stops at <strong className="text-danger">Not delivered</strong> after Sent, so
                    failure handling is demonstrable. Shared with the Demo Controls screen via{" "}
                    <span className="t-mono">pravaah.v1.demo</span>.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {request ? (
            <div className="rounded-md border border-line">
              <div className="border-b border-line px-3 py-2">
                <Overline className="text-text-mid">Bound approval</Overline>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="t-mono text-text-hi">{request.number}</p>
                <p className="t-body-sm text-text-mid">{request.subjectLabel}</p>
                {rights?.canDecide ? (
                  <Note tone="info" className="mt-1">
                    The Approve and Reject buttons perform the real in-platform decision, stamped with channel
                    WhatsApp, and the queue reflects it immediately.
                  </Note>
                ) : (
                  <Note tone="neutral" className="mt-1">
                    Buttons are inert for this request: {rights?.message ?? "no approval authority in this session."}
                  </Note>
                )}
              </div>
            </div>
          ) : null}

          <Note tone="sim">
            INT-04 is simulated end to end. Phase 2 needs Meta Business verification, a WABA and phone number,
            template approval and a BSP. DLT registration is <strong>not</strong> required for WhatsApp.
          </Note>

          {rejecting ? (
            <Note tone="warn">
              A rejection reason is mandatory. Type it in the reply bar and send — it is written to the decision
              record and shown to the requester.
            </Note>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------- read-only mini preview */

export function WhatsAppMiniPreview({
  recipientLabel, recipientPhone, content, at, state,
}: {
  recipientLabel: string; recipientPhone: string; content: string; at: string; state: MessageState;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-inset">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-2 py-1.5">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-full bg-surface-3 text-[0.625rem] text-text-mid"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          BC
        </span>
        <span className="t-body-sm min-w-0 flex-1 truncate text-text-mid">
          {recipientLabel} · <span className="t-mono">{formatPhone(recipientPhone)}</span>
        </span>
        <SimulatedBadge what="WhatsApp Business API (INT-04)" />
      </div>
      <div className="p-2">
        <WhatsAppBubble direction="out" text={content} at={at} state={state} />
      </div>
    </div>
  );
}
