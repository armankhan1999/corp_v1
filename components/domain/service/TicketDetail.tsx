"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, BadgeCheck, Ban, CalendarClock, CircleCheck, ClipboardList, MapPin, Pause,
  Phone, Play, Plus, Send, ShieldAlert, Siren, UserRoundCheck,
} from "lucide-react";
import type { JobOutcome, RootCause, TicketStatus } from "@/lib/schemas/enums";
import { OEM_LABEL, PRODUCT_LINE_LABEL } from "@/lib/schemas/enums";
import {
  formatCount, formatDate, formatDateTime, formatINR, formatOverrun, formatPhone,
} from "@/lib/format";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { SlaClock, useSimNow } from "./SlaClock";
import { AssignDialog, type AssignTarget } from "./AssignDialog";
import { computeClock, escalationFor, pausePolicyFor, BREACH_REASONS, breachReasonLabel } from "./sla";
import {
  addJobCard, closePause, logEvent, mergeTicket, notify, openPause, patchTicket,
  useOverlay, type TrailEvent,
} from "./store";
import { Btn, btnClass, Callout, Field, Modal, Row, Select, Serial, TextArea } from "./ui";
import {
  COVERAGE_LABEL, COVERAGE_TONE, OUTCOME_LABEL, OUTCOME_TONE, ROOT_CAUSE_LABEL,
  SEVERITY_LABEL, SEVERITY_TONE, TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL,
  type CoverageDerivation, type EngineerView, type JobCardView, type PartLineView,
  type SlaLadderRung, type TicketView,
} from "./types";

export interface JobCardSummary {
  id: string;
  number: string;
  visitSequence: number;
  visitType: string;
  scheduledDateMs: number;
  checkInAtMs: number | null;
  checkOutAtMs: number | null;
  engineerName: string;
  outcome: JobOutcome | null;
  rootCause: RootCause | null;
  workPerformed: string;
  submittedAtMs: number | null;
}

export interface SeedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  atMs: number;
  recipient: string;
}

const STATUS_TONE: Record<TicketStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  LOGGED: "neutral", ASSIGNED: "info", EN_ROUTE: "info", ON_SITE: "info",
  AWAITING_PARTS: "warn", AWAITING_CUSTOMER: "warn",
  RESOLVED: "ok", CLOSED: "neutral", CANCELLED: "neutral",
};

const NEXT_STATUS: TicketStatus[] = [
  "LOGGED", "ASSIGNED", "EN_ROUTE", "ON_SITE", "AWAITING_PARTS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED",
];

const TRAIL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATED: Plus, ASSIGNED: UserRoundCheck, STATUS: Activity, VISIT: ClipboardList,
  PARTS: BadgeCheck, STOCK: BadgeCheck, COMMUNICATION: Send, ESCALATION: Siren,
  BREACH: ShieldAlert, PAUSE: Pause, RESUME: Play, CLOSURE: CircleCheck,
  DOCUMENT: ClipboardList, INVOICE: BadgeCheck, REQUEST: Send,
};

export function TicketDetail({
  ticket: base, ladder, liveCoverage, jobCards: seededCards, parts, seededEvents,
  engineers, seededNotifications, nowMs, holidays, canWrite, actorName, nextJobCardSeq,
}: {
  ticket: TicketView;
  ladder: SlaLadderRung[];
  liveCoverage: CoverageDerivation;
  jobCards: JobCardSummary[];
  parts: PartLineView[];
  seededEvents: TrailEvent[];
  engineers: EngineerView[];
  seededNotifications: SeedNotification[];
  nowMs: number;
  holidays: string[];
  canWrite: boolean;
  actorName: string;
  nextJobCardSeq: number;
}) {
  const now = useSimNow(nowMs);
  const overlay = useOverlay();
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const ticket = useMemo(() => mergeTicket(base, overlay.tickets[base.id]), [base, overlay]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [breachOpen, setBreachOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<TicketStatus>("EN_ROUTE");
  const [statusNote, setStatusNote] = useState("");
  const [breachCode, setBreachCode] = useState(BREACH_REASONS[0]!.code);
  const [visitEngineer, setVisitEngineer] = useState(ticket.engineerId ?? engineers[0]?.id ?? "");
  const [visitType, setVisitType] = useState("BREAKDOWN");

  const restorationInput = {
    loggedAtMs: ticket.loggedAtMs,
    dueAtMs: ticket.restorationDueMs,
    stoppedAtMs: ticket.restoredAtMs,
    pausedMs: ticket.pausedMs,
    pauseStartedAtMs: ticket.pauseStartedAtMs,
    businessHours: ticket.slaBusinessHours,
  };
  const responseInput = {
    loggedAtMs: ticket.loggedAtMs,
    dueAtMs: ticket.responseDueMs,
    stoppedAtMs: ticket.firstResponseAtMs,
    pausedMs: 0,
    pauseStartedAtMs: null,
    businessHours: ticket.slaBusinessHours,
  };
  const clock = computeClock(restorationInput, now, holidaySet);

  /**
   * E4-S2 — escalation without intervention. Crossing into imminent or breached
   * dispatches the matrix rows once, and a breach permanently stamps its
   * timestamp on the ticket.
   */
  useEffect(() => {
    if (clock.state !== "IMMINENT" && clock.state !== "BREACHED") return;
    const key = `${base.id}:${clock.state}`;
    const already = overlay.notifications.some((n) => `${n.entityId}:${n.type.replace("SLA_", "")}` === key);
    if (already) return;
    const rule = escalationFor(clock.state);
    if (!rule) return;
    notify(
      rule.roles.map((role) => ({
        role,
        channel: "IN_APP",
        type: `SLA_${clock.state}`,
        title: `${base.number} — SLA ${clock.state.toLowerCase()}`,
        body: `${base.customerName} · ${base.asset.serial}. ${rule.note}`,
        href: `/service/tickets/${base.id}`,
        atMs: now,
        entityId: base.id,
      })),
    );
    logEvent({
      ticketId: base.id,
      jobCardId: null,
      atMs: now,
      kind: "ESCALATION",
      title: `Escalated — SLA ${clock.state.toLowerCase()}`,
      detail: `${rule.note} Recipients: ${rule.roles.join(", ")}.`,
      actor: "Pravaah",
    });
    if (clock.state === "BREACHED" && !ticket.breachedAtMs) {
      patchTicket(base.id, { breachedAtMs: clock.dueAtMs });
      logEvent({
        ticketId: base.id,
        jobCardId: null,
        atMs: clock.dueAtMs,
        kind: "BREACH",
        title: "Restoration commitment breached",
        detail: "Breach timestamp stored permanently. A reason code is now required from the Service Manager.",
        actor: "Pravaah",
      });
    }
  }, [clock.state, clock.dueAtMs, base, overlay.notifications, now, ticket.breachedAtMs]);

  const trail: TrailEvent[] = useMemo(
    () =>
      [...seededEvents, ...overlay.events.filter((e) => e.ticketId === base.id)].sort(
        (a, b) => a.atMs - b.atMs,
      ),
    [seededEvents, overlay.events, base.id],
  );

  const sessionCards = overlay.newJobCards.filter((j) => j.ticketId === base.id);
  const cards: JobCardSummary[] = [
    ...seededCards,
    ...sessionCards.map((j) => ({
      id: j.id,
      number: j.number,
      visitSequence: j.visitSequence,
      visitType: j.visitType,
      scheduledDateMs: j.scheduledDateMs,
      checkInAtMs: j.checkInAtMs,
      checkOutAtMs: j.checkOutAtMs,
      engineerName: j.engineerName,
      outcome: j.outcome,
      rootCause: j.rootCause,
      workPerformed: j.workPerformed,
      submittedAtMs: j.submittedAtMs,
    })),
  ].sort((a, b) => a.visitSequence - b.visitSequence);

  const cardIds = new Set(cards.map((c) => c.id));
  const sessionParts = overlay.parts.filter((p) => cardIds.has(p.jobCardId));
  const allParts: PartLineView[] = [...parts, ...sessionParts];

  const pauseWindows = overlay.pauses.filter((p) => p.ticketId === base.id);
  const escalations = overlay.notifications.filter((n) => n.entityId === base.id);

  const pausePolicy = pausePolicyFor(
    ticket.status,
    ticket.pauseOnAwaitingParts,
    ticket.pauseOnAwaitingCustomer,
  );
  const nextPolicy = pausePolicyFor(nextStatus, ticket.pauseOnAwaitingParts, ticket.pauseOnAwaitingCustomer);

  const target: AssignTarget = {
    id: ticket.id,
    number: ticket.number,
    customerName: ticket.customerName,
    assetSerial: ticket.asset.serial,
    assetPrincipal: ticket.asset.principal,
    branchId: ticket.branchId,
    severityLabel: SEVERITY_LABEL[ticket.severity],
  };

  function applyStatus() {
    const from = ticket.status;
    if (from === nextStatus) {
      setStatusOpen(false);
      return;
    }
    const patch: Parameters<typeof patchTicket>[1] = { status: nextStatus };

    // Leaving a paused status banks the window.
    if (ticket.pauseStartedAtMs !== null) {
      const banked = ticket.pausedMs + Math.max(0, now - ticket.pauseStartedAtMs);
      patch.pausedMs = banked;
      patch.pauseStartedAtMs = null;
      closePause(base.id, now);
      logEvent({
        ticketId: base.id, jobCardId: null, atMs: now, kind: "RESUME",
        title: "Restoration clock resumed",
        detail: `Paused window closed at ${formatDateTime(now)}. ${formatOverrun(banked - ticket.pausedMs)} banked; ${formatOverrun(banked)} excluded in total.`,
        actor: actorName,
      });
    }

    if (nextPolicy.pauses) {
      patch.pauseStartedAtMs = now;
      openPause({
        ticketId: base.id,
        status: nextStatus,
        fromMs: now,
        toMs: null,
        reason: statusNote.trim() || TICKET_STATUS_LABEL[nextStatus],
      });
      logEvent({
        ticketId: base.id, jobCardId: null, atMs: now, kind: "PAUSE",
        title: `Restoration clock paused — ${TICKET_STATUS_LABEL[nextStatus]}`,
        detail: nextPolicy.label,
        actor: actorName,
      });
    }

    if (nextStatus === "RESOLVED" && !ticket.restoredAtMs) patch.restoredAtMs = now;
    if (nextStatus === "CLOSED") {
      patch.closedAtMs = now;
      if (!ticket.restoredAtMs) patch.restoredAtMs = now;
    }
    if (!ticket.firstResponseAtMs && nextStatus !== "LOGGED") patch.firstResponseAtMs = now;

    patchTicket(base.id, patch);
    logEvent({
      ticketId: base.id, jobCardId: null, atMs: now, kind: "STATUS",
      title: `${TICKET_STATUS_LABEL[from]} → ${TICKET_STATUS_LABEL[nextStatus]}`,
      detail: statusNote.trim() || "No note recorded.",
      actor: actorName,
    });
    setStatusNote("");
    setStatusOpen(false);
  }

  function createVisit() {
    const engineer = engineers.find((e) => e.id === visitEngineer);
    if (!engineer) return;
    const seq = cards.length + 1;
    const id = `JC-S${nextJobCardSeq}`;
    const card: JobCardView = {
      id,
      number: `BC/JC/2627/${String(nextJobCardSeq).padStart(4, "0")}`,
      ticketId: base.id,
      ticketNumber: ticket.number,
      assetId: ticket.asset.id,
      assetSerial: ticket.asset.serial,
      assetModel: ticket.asset.model,
      assetProductLine: ticket.asset.productLine,
      assetPrincipal: ticket.asset.principal,
      customerId: ticket.customerId,
      customerName: ticket.customerName,
      siteName: ticket.site.name,
      siteAddress: `${ticket.site.address}, ${ticket.site.district} ${ticket.site.pincode}`,
      branchName: ticket.branchName,
      engineerId: engineer.id,
      engineerName: engineer.name,
      visitSequence: seq,
      visitType,
      scheduledDateMs: now,
      checkInAtMs: null,
      checkOutAtMs: null,
      checkInPlace: null,
      checkInLat: null,
      checkInLng: null,
      observations: "",
      rootCause: null,
      workPerformed: "",
      runningHoursReading: null,
      meterReplacementNote: null,
      nextVisitRecommendation: "",
      outcome: null,
      customerAckName: null,
      customerAckDesignation: null,
      signatureStrokes: null,
      signatureRef: null,
      photos: [],
      labourAmount: 0,
      travelAmount: 0,
      submittedAtMs: null,
      tapCount: null,
      coverage: ticket.coverage,
      coverageBasis: ticket.coverageBasis,
      amcCoverage: ticket.amcCoverage,
      previousReading: ticket.asset.runningHours,
      previousReadingAtMs: ticket.asset.runningHoursAtMs,
      previousReadingSource: "Asset register",
    };
    addJobCard(card);
    logEvent({
      ticketId: base.id, jobCardId: id, atMs: now, kind: "VISIT",
      title: `Visit ${seq} scheduled — ${card.number}`,
      detail: `${engineer.name} · ${visitType.toLowerCase()} · ${formatDate(now)}.`,
      actor: actorName,
    });
    setVisitOpen(false);
  }

  const breachPending = Boolean(ticket.breachedAtMs) && !ticket.breachReasonCode;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Serial className="text-base">{ticket.number}</Serial>
            <StatusBadge tone={STATUS_TONE[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</StatusBadge>
            <StatusBadge tone={SEVERITY_TONE[ticket.severity]}>{SEVERITY_LABEL[ticket.severity]}</StatusBadge>
            <StatusBadge tone={COVERAGE_TONE[ticket.coverage]}>{COVERAGE_LABEL[ticket.coverage]}</StatusBadge>
            {ticket.sessionCreated ? <StatusBadge tone="info">Raised this session</StatusBadge> : null}
          </div>
          <h1 className="t-display-md mt-1 text-text-hi">{ticket.customerName}</h1>
          <p className="t-body mt-0.5 max-w-3xl text-text-mid">{ticket.problem}</p>
          <p className="t-body-sm mt-1 text-text-lo">
            {TICKET_CATEGORY_LABEL[ticket.category]} · logged{" "}
            <span className="t-mono">{formatDateTime(ticket.loggedAtMs)}</span> via{" "}
            {ticket.channel.toLowerCase().replace(/_/g, " ")} · {ticket.branchName}
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setAssignOpen(true)}>
              <UserRoundCheck className="size-4" aria-hidden />
              {ticket.engineerId ? "Reassign" : "Assign engineer"}
            </Btn>
            <Btn
              onClick={() => {
                setNextStatus(ticket.status);
                setStatusOpen(true);
              }}
            >
              <Activity className="size-4" aria-hidden />
              Change status
            </Btn>
            <Btn variant="primary" onClick={() => setVisitOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Create job card
            </Btn>
          </div>
        ) : (
          <p className="t-body-sm text-text-lo">Read-only for this role.</p>
        )}
      </div>

      {breachPending ? (
        <Callout
          tone="danger"
          title="Breach recorded without a reason code"
          icon={ShieldAlert}
          action={
            canWrite ? (
              <Btn variant="danger" size="sm" onClick={() => setBreachOpen(true)}>
                Record reason
              </Btn>
            ) : undefined
          }
        >
          The breach timestamp is stored and cannot be removed. A reason code is required before the
          ticket can be closed, because SLA compliance reporting attributes every miss to a cause.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-4">
          {/* SLA */}
          <Panel>
            <PanelHeader
              title="Commitment clocks"
              sub={`Rule applied — ${ticket.slaRuleApplied}`}
              right={
                <span className="t-overline text-text-lo">
                  {ticket.slaResponseHours} h response · {ticket.slaRestorationHours} h restoration
                </span>
              }
            />
            <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
              <SlaClock
                input={responseInput}
                nowMs={now}
                holidays={holidays}
                size="md"
                caption="Response"
                hideBasis
              />
              <SlaClock
                input={restorationInput}
                nowMs={now}
                holidays={holidays}
                size="lg"
                caption="Restoration"
                breachedAtMs={ticket.breachedAtMs}
                breachReasonCode={ticket.breachReasonCode}
              />
            </div>

            <div className="border-t border-line px-4 py-3">
              <Overline>Precedence — why this rule</Overline>
              <ol className="mt-1.5 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
                {ladder.map((rung, i) => (
                  <li
                    key={rung.source}
                    className={cn("bg-surface-1 px-3 py-2", rung.applies && "border-l-2 border-l-primary-500")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="t-body-sm font-medium text-text-hi">
                        {i + 1}. {rung.label}
                      </span>
                      {rung.applies ? (
                        <StatusBadge tone="info">Applied</StatusBadge>
                      ) : (
                        <span className="t-overline text-text-lo">Not applied</span>
                      )}
                    </div>
                    <p className="t-body-sm text-text-lo">{rung.reason}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-line px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Overline>Pause policy &amp; log</Overline>
                <span className="t-body-sm text-text-lo">
                  Awaiting parts {ticket.pauseOnAwaitingParts ? "pauses" : "does not pause"} · Awaiting
                  customer {ticket.pauseOnAwaitingCustomer ? "pauses" : "does not pause"}
                </span>
              </div>
              {ticket.pauseStartedAtMs ? (
                <Callout tone="warn" title="Clock is paused now" icon={Pause} className="mt-2">
                  Paused since <span className="t-mono">{formatDateTime(ticket.pauseStartedAtMs)}</span> —{" "}
                  {formatOverrun(now - ticket.pauseStartedAtMs)} so far. {pausePolicy.label}
                </Callout>
              ) : null}
              {pauseWindows.length ? (
                <ul className="mt-2 flex flex-col divide-y divide-line rounded-md border border-line">
                  {pauseWindows.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                      <span className="t-body-sm text-text-hi">{TICKET_STATUS_LABEL[p.status]}</span>
                      <span className="t-mono text-text-mid">
                        {formatDateTime(p.fromMs)} → {p.toMs ? formatDateTime(p.toMs) : "running"}
                      </span>
                      <span className="t-mono text-warn">
                        {formatOverrun((p.toMs ?? now) - p.fromMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="t-body-sm mt-1.5 text-text-lo">
                  No pause window has been opened on this ticket.
                  {ticket.pausedMs > 0
                    ? ` ${formatOverrun(ticket.pausedMs)} of paused time is banked from earlier handling.`
                    : ""}
                </p>
              )}
            </div>
          </Panel>

          {/* Visits */}
          <Panel>
            <PanelHeader
              title="Visits"
              sub="One job card per site visit. Repeat visits accumulate against the same ticket."
              right={<span className="t-overline text-text-lo">{cards.length} recorded</span>}
            />
            {cards.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No visit recorded yet"
                body="A job card carries what happened on site — observations, root cause, parts and the customer's acknowledgement. Create one when the visit is scheduled."
                action={
                  canWrite ? (
                    <Btn variant="primary" onClick={() => setVisitOpen(true)}>
                      <Plus className="size-4" aria-hidden />
                      Create job card
                    </Btn>
                  ) : undefined
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {cards.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/service/job-cards/${c.id}`} className="t-mono text-text-hi hover:text-primary-400">
                          {c.number}
                        </Link>
                        <span className="t-overline text-text-lo">Visit {c.visitSequence}</span>
                        <span className="t-overline text-text-lo">{c.visitType.toLowerCase()}</span>
                        {c.outcome ? (
                          <StatusBadge tone={OUTCOME_TONE[c.outcome]}>{OUTCOME_LABEL[c.outcome]}</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">In progress</StatusBadge>
                        )}
                        {c.outcome === "RESOLVED" && c.visitSequence === 1 ? (
                          <StatusBadge tone="ok">First-visit fix</StatusBadge>
                        ) : null}
                      </div>
                      <p className="t-body-sm mt-0.5 text-text-mid">
                        {c.engineerName} · {c.checkInAtMs ? formatDateTime(c.checkInAtMs) : `scheduled ${formatDate(c.scheduledDateMs)}`}
                        {c.rootCause ? ` · root cause ${ROOT_CAUSE_LABEL[c.rootCause]}` : ""}
                      </p>
                      {c.workPerformed ? (
                        <p className="t-body-sm text-text-lo">{c.workPerformed}</p>
                      ) : null}
                    </div>
                    <Link href={`/service/job-cards/${c.id}`} className={btnClass("ghost", "sm")}>
                      Open job card
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Parts */}
          <Panel>
            <PanelHeader
              title="Parts consumed"
              sub="Written as Issue movements against the job card, and priced only where coverage makes them billable."
            />
            {allParts.length === 0 ? (
              <p className="t-body-sm px-4 py-6 text-center text-text-lo">
                No parts have been consumed on this ticket.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line text-left">
                    {["Item", "Qty", "Rate", "GST", "Billable", "Issued from"].map((h) => (
                      <th key={h} className="t-overline px-4 py-1.5 text-text-lo">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allParts.map((p) => (
                    <tr key={p.id} className="border-b border-line">
                      <td className="px-4 py-1.5">
                        <span className="t-body-sm text-text-hi">{p.description}</span>
                        <span className="t-mono ml-2 text-text-lo">{p.itemCode}</span>
                      </td>
                      <td className="px-4 py-1.5 t-mono text-text-hi">{p.qty} {p.uom}</td>
                      <td className="px-4 py-1.5 t-mono text-text-hi">
                        {p.billable ? formatINR(p.rate) : `${formatINR(p.cost)} cost`}
                      </td>
                      <td className="px-4 py-1.5 t-mono text-text-mid">{p.billable ? `${p.gstRate}%` : "—"}</td>
                      <td className="px-4 py-1.5">
                        <StatusBadge tone={p.billable ? "warn" : "ok"}>
                          {p.billable ? "Billable" : "Non-billable"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-1.5 t-body-sm text-text-lo">{p.locationName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {/* Activity trail */}
          <Panel>
            <PanelHeader
              title="Activity trail"
              sub="Creation, assignment, transitions, visits, parts, communications, escalations and closure — in order."
              right={<span className="t-overline text-text-lo">{trail.length} entries</span>}
            />
            <ol className="flex flex-col">
              {trail.map((e, i) => {
                const Icon = TRAIL_ICON[e.kind] ?? Activity;
                return (
                  <li key={e.id} className="flex gap-3 px-4 py-2.5">
                    <span className="flex flex-col items-center">
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full border",
                          e.kind === "BREACH" || e.kind === "ESCALATION"
                            ? "border-danger/50 bg-danger-bg text-danger"
                            : e.kind === "CLOSURE"
                              ? "border-ok/50 bg-ok-bg text-ok"
                              : "border-line bg-surface-2 text-text-mid",
                        )}
                      >
                        <Icon className="size-3" aria-hidden />
                      </span>
                      {i < trail.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1 pb-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="t-body font-medium text-text-hi">{e.title}</span>
                        <span className="t-mono text-text-lo">{formatDateTime(e.atMs)}</span>
                      </span>
                      <span className="t-body-sm block text-text-mid">{e.detail}</span>
                      <span className="t-body-sm block text-text-lo">{e.actor}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader
              title="Coverage"
              sub="Stored on the ticket at logging; recomputed live below."
              right={<StatusBadge tone={COVERAGE_TONE[ticket.coverage]}>{COVERAGE_LABEL[ticket.coverage]}</StatusBadge>}
            />
            <div className="p-4">
              <p className="t-body-sm text-text-mid">
                <span className="text-text-lo">Basis at logging — </span>
                {ticket.coverageBasis}
              </p>
              <ol className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                {liveCoverage.steps.map((s, i) => (
                  <li key={s.test} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-md border",
                        s.passed ? "border-ok/50 bg-ok-bg text-ok" : "border-line bg-surface-2 text-text-lo",
                      )}
                      aria-hidden
                    >
                      {s.passed ? <CircleCheck className="size-3" /> : <Ban className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="t-body-sm block text-text-hi">{i + 1}. {s.test}</span>
                      <span className="t-body-sm block text-text-lo">{s.outcome}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {liveCoverage.coverage !== ticket.coverage ? (
                <Callout tone="warn" title="Coverage has changed since logging" className="mt-3">
                  Live derivation now reads {COVERAGE_LABEL[liveCoverage.coverage]} — {liveCoverage.basis}.
                  The ticket keeps the classification it was logged under; billing should follow the
                  live state.
                </Callout>
              ) : null}
              {ticket.coverage === "CHARGEABLE" ? (
                <Callout tone="warn" title="Chargeable work" icon={ShieldAlert} className="mt-3">
                  A quotation or a written customer approval may be required before work starts.
                </Callout>
              ) : null}
              {ticket.amcNumber ? (
                <p className="t-body-sm mt-3 text-text-lo">
                  Contract <span className="t-mono text-text-mid">{ticket.amcNumber}</span> ·{" "}
                  {ticket.amcCoverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"}
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Machine" sub="Serial is the primary key for everything service touches." />
            <dl className="px-4 py-2">
              <Row label="Serial" mono>{ticket.asset.serial}</Row>
              <Row label="Model">{ticket.asset.model}</Row>
              <Row label="Product line">{PRODUCT_LINE_LABEL[ticket.asset.productLine]}</Row>
              <Row label="Principal">{OEM_LABEL[ticket.asset.principal]}</Row>
              <Row label="Capacity" mono>
                {ticket.asset.capacityValue} {ticket.asset.capacityUnit}
                {ticket.asset.ratedKw ? ` · ${ticket.asset.ratedKw} kW` : ""}
              </Row>
              <Row label="Location in site">{ticket.asset.locationInSite || "—"}</Row>
              <Row label="Running hours" mono>
                {formatCount(ticket.asset.runningHours)} h @ {formatDate(ticket.asset.runningHoursAtMs)}
              </Row>
              <Row label="Commissioned">
                {ticket.asset.commissioningDateMs ? formatDate(ticket.asset.commissioningDateMs) : "Not recorded"}
              </Row>
            </dl>
            <div className="border-t border-line px-4 py-2">
              <Link href={`/service/assets/${ticket.asset.id}`} className={btnClass("ghost", "sm")}>
                Open asset passport
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Site & contact" />
            <div className="p-4">
              <p className="t-body text-text-hi">{ticket.site.name}</p>
              <p className="t-body-sm text-text-mid">
                {ticket.site.address}, {ticket.site.district} {ticket.site.pincode}
              </p>
              {ticket.site.notes ? (
                <p className="t-body-sm mt-1 text-warn">{ticket.site.notes}</p>
              ) : null}
              <div className="mt-3 border-t border-line pt-3">
                <Overline>Reported by</Overline>
                <p className="t-body text-text-hi">
                  {ticket.contactName ?? "Site contact"}
                  {ticket.contactDesignation ? (
                    <span className="t-body-sm text-text-lo"> · {ticket.contactDesignation}</span>
                  ) : null}
                </p>
                <p className="t-mono text-text-mid">
                  {ticket.contactPhone ? formatPhone(ticket.contactPhone) : "No number on record"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${ticket.site.lat},${ticket.site.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={btnClass("ghost", "sm")}
                >
                  <MapPin className="size-3.5" aria-hidden />
                  Map
                </a>
                <a href={`tel:${ticket.branchPhone.replace(/\s/g, "")}`} className={btnClass("ghost", "sm")}>
                  <Phone className="size-3.5" aria-hidden />
                  Branch desk
                </a>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Assignment"
              right={
                ticket.engineerId ? (
                  <StatusBadge tone="info">Assigned</StatusBadge>
                ) : (
                  <StatusBadge tone="warn">Unassigned</StatusBadge>
                )
              }
            />
            <div className="p-4">
              {ticket.engineerName ? (
                <>
                  <p className="t-body text-text-hi">{ticket.engineerName}</p>
                  {ticket.assignmentOverrideReason ? (
                    <Callout tone="warn" title="Assigned with an override" className="mt-2">
                      {ticket.assignmentOverrideReason}
                    </Callout>
                  ) : null}
                </>
              ) : (
                <p className="t-body-sm text-text-lo">
                  No engineer holds this ticket. It sits in the Logged lane on the dispatch board.
                </p>
              )}
              <Link href="/service/dispatch" className={cn(btnClass("ghost", "sm"), "mt-3")}>
                Open dispatch board
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Escalation ledger"
              sub="Notification matrix rows fired against this ticket."
            />
            {escalations.length === 0 && seededNotifications.length === 0 ? (
              <p className="t-body-sm px-4 py-4 text-text-lo">
                Nothing has escalated. Rows fire automatically at imminent (Service Manager) and at
                breach (Service Manager and Director – Business).
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {seededNotifications.map((n) => (
                  <li key={n.id} className="px-4 py-2">
                    <p className="t-body-sm text-text-hi">{n.title}</p>
                    <p className="t-body-sm text-text-lo">
                      {n.recipient} · <span className="t-mono">{formatDateTime(n.atMs)}</span>
                    </p>
                  </li>
                ))}
                {escalations.map((n) => (
                  <li key={n.id} className="px-4 py-2">
                    <p className="t-body-sm text-text-hi">{n.title}</p>
                    <p className="t-body-sm text-text-mid">{n.body}</p>
                    <p className="t-body-sm text-text-lo">
                      {n.role.replace(/_/g, " ").toLowerCase()} · {n.channel.toLowerCase()} ·{" "}
                      <span className="t-mono">{formatDateTime(n.atMs)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        engineers={engineers}
        target={target}
        currentEngineerId={ticket.engineerId}
        onAssign={({ engineer, overrideReason, certAcknowledged }) => {
          patchTicket(base.id, {
            engineerId: engineer.id,
            engineerName: engineer.name,
            assignmentOverrideReason: overrideReason,
            status: ticket.status === "LOGGED" ? "ASSIGNED" : ticket.status,
            firstResponseAtMs: ticket.firstResponseAtMs ?? now,
          });
          logEvent({
            ticketId: base.id, jobCardId: null, atMs: now, kind: "ASSIGNED",
            title: `Assigned to ${engineer.name}`,
            detail: [
              `${engineer.code} · load ${engineer.loadToday} of ${engineer.dailyCapacity}`,
              overrideReason ? `Capacity override: ${overrideReason}` : null,
              certAcknowledged
                ? `Missing ${OEM_LABEL[ticket.asset.principal]} certification acknowledged.`
                : null,
            ].filter(Boolean).join(" · "),
            actor: actorName,
          });
          notify([
            {
              role: "FIELD_ENGINEER",
              channel: "IN_APP",
              type: "TICKET_ASSIGNED",
              title: `${ticket.number} assigned to you`,
              body: `${ticket.customerName} · ${ticket.site.name} · ${ticket.asset.serial}`,
              href: `/field/today`,
              atMs: now,
              entityId: base.id,
            },
          ]);
        }}
      />

      <Modal
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title="Change ticket status"
        description={`${ticket.number} — currently ${TICKET_STATUS_LABEL[ticket.status]}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setStatusOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={applyStatus}>Apply</Btn>
          </>
        }
      >
        <Field label="New status" htmlFor="next-status" required>
          <Select
            id="next-status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as TicketStatus)}
          >
            {NEXT_STATUS.map((s) => (
              <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Note" htmlFor="status-note" className="mt-3" hint="Written to the activity trail.">
          <TextArea id="status-note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
        </Field>

        {nextStatus === "ASSIGNED" && !ticket.engineerId ? (
          <Callout tone="warn" title="No engineer is assigned" className="mt-3">
            Use Assign engineer instead — the Assigned lane means a named person is holding the job.
          </Callout>
        ) : null}
        {nextPolicy.pauses ? (
          <Callout tone="info" title="The restoration clock will pause" icon={Pause} className="mt-3">
            {nextPolicy.label} The pause window is logged with its start and end, and the paused
            duration is reported separately from remaining time.
          </Callout>
        ) : null}
        {ticket.pauseStartedAtMs && !nextPolicy.pauses ? (
          <Callout tone="info" title="The current pause will close" icon={Play} className="mt-3">
            {formatOverrun(now - ticket.pauseStartedAtMs)} is banked and excluded from remaining time.
          </Callout>
        ) : null}
        {nextStatus === "RESOLVED" ? (
          <Callout tone="ok" title="Restoration clock stops" icon={CircleCheck} className="mt-3">
            The clock stops at <span className="t-mono">{formatDateTime(now)}</span>. Ordinarily this
            happens automatically when a job card is submitted with outcome Resolved.
          </Callout>
        ) : null}
      </Modal>

      <Modal
        open={breachOpen}
        onOpenChange={setBreachOpen}
        title="Record breach reason"
        description="The timestamp is already stored. The reason code explains the miss and cannot be edited afterwards."
        footer={
          <>
            <Btn variant="ghost" onClick={() => setBreachOpen(false)}>Cancel</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                patchTicket(base.id, { breachReasonCode: breachCode });
                logEvent({
                  ticketId: base.id, jobCardId: null, atMs: now, kind: "BREACH",
                  title: "Breach reason recorded",
                  detail: `${breachCode} — ${breachReasonLabel(breachCode)}. Stored permanently against the ticket.`,
                  actor: actorName,
                });
                setBreachOpen(false);
              }}
            >
              Store reason permanently
            </Btn>
          </>
        }
      >
        <Field label="Reason code" htmlFor="breach-code" required>
          <Select id="breach-code" value={breachCode} onChange={(e) => setBreachCode(e.target.value)}>
            {BREACH_REASONS.map((r) => (
              <option key={r.code} value={r.code}>{r.code} — {r.label}</option>
            ))}
          </Select>
        </Field>
        <p className="t-body-sm mt-3 text-text-lo">
          Overrun at the time of recording — {formatOverrun(clock.overrunMs)}.
        </p>
      </Modal>

      <Modal
        open={visitOpen}
        onOpenChange={setVisitOpen}
        title="Create job card"
        description={`Visit ${cards.length + 1} against ${ticket.number}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setVisitOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createVisit}>
              <CalendarClock className="size-4" aria-hidden />
              Create
            </Btn>
          </>
        }
      >
        <Field label="Engineer" htmlFor="visit-engineer" required>
          <Select id="visit-engineer" value={visitEngineer} onChange={(e) => setVisitEngineer(e.target.value)}>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — load {e.loadToday}/{e.dailyCapacity}, {e.branchName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Visit type" htmlFor="visit-type" required className="mt-3">
          <Select id="visit-type" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
            {["BREAKDOWN", "PM", "INSTALLATION", "INSPECTION", "REVISIT"].map((v) => (
              <option key={v} value={v}>{v.toLowerCase()}</option>
            ))}
          </Select>
        </Field>
        <p className="t-body-sm mt-3 text-text-lo">
          Scheduled for <span className="t-mono">{formatDate(now)}</span>. Multiple job cards may sit
          against one ticket — the visit sequence drives the first-visit fix derivation.
        </p>
      </Modal>
    </div>
  );
}
