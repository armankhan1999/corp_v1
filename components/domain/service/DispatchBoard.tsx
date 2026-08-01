"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarClock, GripVertical, Info, Keyboard, MousePointerClick, UserRoundCheck, Wrench,
} from "lucide-react";
import type { CoverageType, TicketSeverity, TicketStatus } from "@/lib/schemas/enums";
import { OEM_LABEL, type OEMPrincipal } from "@/lib/schemas/enums";
import { formatCount, formatDate, formatDateTime } from "@/lib/format";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { SlaClock, slaStateMeta, useSimNow } from "./SlaClock";
import { AssignDialog, type AssignTarget } from "./AssignDialog";
import { computeClock } from "./sla";
import { logEvent, notify, patchTicket, useOverlay } from "./store";
import { Btn, btnClass, Callout, Serial } from "./ui";
import {
  COVERAGE_LABEL, COVERAGE_TONE, DISPATCH_LANES, SEVERITY_LABEL, SEVERITY_SHORT,
  SEVERITY_TONE, SLA_STATE_LABEL, TICKET_STATUS_LABEL,
  type EngineerView, type PlannedVisitView,
} from "./types";

export interface DispatchCard {
  id: string;
  number: string;
  customerName: string;
  siteName: string;
  siteDistrict: string;
  assetSerial: string;
  assetModel: string;
  assetPrincipal: OEMPrincipal;
  severity: TicketSeverity;
  coverage: CoverageType;
  status: TicketStatus;
  branchId: string;
  engineerId: string | null;
  engineerName: string | null;
  problem: string;
  loggedAtMs: number;
  restorationDueMs: number;
  restoredAtMs: number | null;
  pausedMs: number;
  pauseStartedAtMs: number | null;
  businessHours: boolean;
  breachedAtMs: number | null;
  breachReasonCode: string | null;
}

export function DispatchBoard({
  cards: seedCards, engineers: seedEngineers, planned, nowMs, holidays, canWrite, actorName,
}: {
  cards: DispatchCard[];
  engineers: EngineerView[];
  planned: PlannedVisitView[];
  nowMs: number;
  holidays: string[];
  canWrite: boolean;
  actorName: string;
}) {
  const now = useSimNow(nowMs);
  const overlay = useOverlay();
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<DispatchCard | null>(null);
  const [preselect, setPreselect] = useState<string | null>(null);

  const cards = useMemo(
    () =>
      seedCards.map((c) => {
        const p = overlay.tickets[c.id];
        if (!p) return c;
        return {
          ...c,
          status: p.status ?? c.status,
          engineerId: p.engineerId !== undefined ? p.engineerId : c.engineerId,
          engineerName: p.engineerName !== undefined ? p.engineerName : c.engineerName,
          pausedMs: p.pausedMs ?? c.pausedMs,
          pauseStartedAtMs: p.pauseStartedAtMs !== undefined ? p.pauseStartedAtMs : c.pauseStartedAtMs,
          breachedAtMs: p.breachedAtMs !== undefined ? p.breachedAtMs : c.breachedAtMs,
          restoredAtMs: p.restoredAtMs !== undefined ? p.restoredAtMs : c.restoredAtMs,
        };
      }),
    [seedCards, overlay],
  );

  /** Load recomputes from the live board, so an override warning is never stale. */
  const engineers = useMemo(
    () =>
      seedEngineers.map((e) => {
        const mine = cards.filter(
          (c) => c.engineerId === e.id && c.status !== "RESOLVED",
        );
        const rank: Record<string, number> = {
          ON_SITE: 5, EN_ROUTE: 4, AWAITING_PARTS: 3, AWAITING_CUSTOMER: 2, ASSIGNED: 1,
        };
        let best = "";
        let bestRank = 0;
        for (const c of mine) {
          const r = rank[c.status] ?? 0;
          if (r > bestRank) { bestRank = r; best = c.status; }
        }
        const over = mine.length >= e.dailyCapacity;
        return {
          ...e,
          loadToday: mine.length,
          statusLabel: best ? TICKET_STATUS_LABEL[best as TicketStatus] : "Available",
          statusTone: (!best ? "ok" : over ? "danger" : best === "ON_SITE" || best === "EN_ROUTE" ? "info" : "warn") as EngineerView["statusTone"],
        };
      }),
    [seedEngineers, cards],
  );

  const lanes = DISPATCH_LANES.map((lane) => ({
    ...lane,
    cards: cards
      .filter((c) => c.status === lane.status)
      .sort((a, b) => remaining(a) - remaining(b)),
  }));

  function remaining(c: DispatchCard): number {
    return computeClock(
      {
        loggedAtMs: c.loggedAtMs,
        dueAtMs: c.restorationDueMs,
        stoppedAtMs: c.restoredAtMs,
        pausedMs: c.pausedMs,
        pauseStartedAtMs: c.pauseStartedAtMs,
        businessHours: c.businessHours,
      },
      now,
      holidaySet,
    ).remainingMs;
  }

  function assign(card: DispatchCard, engineer: EngineerView, overrideReason: string | null, certAck: boolean) {
    patchTicket(card.id, {
      engineerId: engineer.id,
      engineerName: engineer.name,
      assignmentOverrideReason: overrideReason,
      status: card.status === "LOGGED" ? "ASSIGNED" : card.status,
    });
    logEvent({
      ticketId: card.id, jobCardId: null, atMs: now, kind: "ASSIGNED",
      title: `Assigned to ${engineer.name}`,
      detail: [
        `${engineer.code} · load ${engineer.loadToday} of ${engineer.dailyCapacity}`,
        overrideReason ? `Capacity override: ${overrideReason}` : null,
        certAck ? `Missing ${OEM_LABEL[card.assetPrincipal]} certification acknowledged.` : null,
      ].filter(Boolean).join(" · "),
      actor: actorName,
    });
    notify([
      {
        role: "FIELD_ENGINEER", channel: "IN_APP", type: "TICKET_ASSIGNED",
        title: `${card.number} assigned to you`,
        body: `${card.customerName} · ${card.siteName} · ${card.assetSerial}`,
        href: "/field/today", atMs: now, entityId: card.id,
      },
    ]);
  }

  function handleDrop(engineer: EngineerView) {
    const card = cards.find((c) => c.id === dragging);
    setDragging(null);
    setDropTarget(null);
    if (!card || !canWrite) return;
    const over = engineer.loadToday >= engineer.dailyCapacity;
    const noCert = !engineer.oemCertifications.includes(card.assetPrincipal);
    if (over || noCert) {
      // A gated assignment never completes silently on a drop.
      setPreselect(engineer.id);
      setAssignFor(card);
      return;
    }
    assign(card, engineer, null, false);
  }

  const openCount = cards.filter((c) => c.status !== "RESOLVED").length;
  const unassigned = cards.filter((c) => !c.engineerId && c.status !== "RESOLVED").length;
  const idle = engineers.filter((e) => e.loadToday === 0).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Engineer availability strip — E4-S3 */}
      <Panel>
        <PanelHeader
          title="Engineer availability"
          sub="Today's load, current status, branch and OEM certification. Drop a ticket on a card to assign, or use the Assign control on the ticket."
          right={
            <span className="t-overline text-text-lo">
              {formatCount(engineers.length)} field engineers · {idle} idle
            </span>
          }
        />
        <ul className="flex gap-px overflow-x-auto bg-line p-px">
          {engineers.map((e) => {
            const over = e.loadToday >= e.dailyCapacity;
            const isTarget = dropTarget === e.id;
            return (
              <li
                key={e.id}
                onDragOver={(ev) => {
                  if (!dragging || !canWrite) return;
                  ev.preventDefault();
                  setDropTarget(e.id);
                }}
                onDragLeave={() => setDropTarget((t) => (t === e.id ? null : t))}
                onDrop={(ev) => {
                  ev.preventDefault();
                  handleDrop(e);
                }}
                className={cn(
                  "min-w-56 flex-1 bg-surface-1 p-3 transition-colors duration-150",
                  isTarget && "bg-primary-100 outline outline-2 -outline-offset-2 outline-primary-500",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="t-body font-medium text-text-hi">{e.name}</p>
                    <p className="t-body-sm text-text-lo">
                      <span className="t-mono">{e.code}</span> · {e.branchName}
                    </p>
                  </div>
                  <StatusBadge tone={e.statusTone}>{e.statusLabel}</StatusBadge>
                </div>
                <p className={cn("t-mono mt-2 tabular-nums", over ? "text-danger" : "text-text-hi")}>
                  {e.loadToday} / {e.dailyCapacity}
                  <span className="t-body-sm ml-1.5 text-text-lo">jobs today</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.oemCertifications.length ? (
                    e.oemCertifications.map((c) => (
                      <span
                        key={c}
                        className="t-overline rounded-md border border-line bg-surface-2 px-1 py-px text-text-lo"
                      >
                        {OEM_LABEL[c]}
                      </span>
                    ))
                  ) : (
                    <span className="t-overline text-text-lo">No certification recorded</span>
                  )}
                </div>
                {over ? (
                  <p className="t-body-sm mt-1.5 text-danger">
                    At or above capacity — assignment needs an override reason.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* Legend + method disclosure */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] px-3 py-2">
        <span className="t-overline text-text-lo">SLA state</span>
        {(["COMFORTABLE", "APPROACHING", "IMMINENT", "BREACHED"] as const).map((s) => {
          const m = slaStateMeta(s);
          const Icon = m.icon;
          return (
            <span key={s} className={cn("t-body-sm inline-flex items-center gap-1", m.text)}>
              <Icon className="size-3.5" aria-hidden />
              {SLA_STATE_LABEL[s]}
              <span className="text-text-lo">
                {s === "APPROACHING" ? "· <25%" : s === "IMMINENT" ? "· <10%" : ""}
              </span>
            </span>
          );
        })}
        <span className="t-body-sm ml-auto inline-flex items-center gap-1 text-text-lo">
          <Keyboard className="size-3.5" aria-hidden />
          Every card carries an Assign control — dragging is never the only way.
        </span>
      </div>

      {openCount === 0 ? (
        <Panel>
          <EmptyState
            icon={Wrench}
            title="No open service commitments"
            body="Every ticket on the register is resolved or closed. New requests arrive here the moment they are logged, sorted by time to breach."
            action={
              <Link href="/service/tickets/new" className={btnClass("primary")}>
                Log a ticket
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {lanes.map((lane) => (
            <section
              key={lane.status}
              aria-label={`${lane.label} — ${lane.cards.length} tickets`}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <Overline>{lane.label}</Overline>
                <span className="t-mono text-text-mid">{lane.cards.length}</span>
              </div>
              {lane.cards.length === 0 ? (
                <p className="t-body-sm px-3 py-6 text-center text-text-lo">
                  {lane.status === "LOGGED"
                    ? "Nothing waiting to be picked up."
                    : `No ticket is ${lane.label.toLowerCase()}.`}
                </p>
              ) : (
                <ul className="flex flex-col gap-2 p-2">
                  {lane.cards.map((c) => (
                    <li key={c.id}>
                      <article
                        draggable={canWrite}
                        onDragStart={() => setDragging(c.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        className={cn(
                          "rounded-md border border-line bg-surface-2 p-2.5 transition-colors duration-150",
                          canWrite && "cursor-grab active:cursor-grabbing",
                          dragging === c.id && "opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/service/tickets/${c.id}`}
                            className="t-mono text-text-hi hover:text-primary-400"
                          >
                            {c.number}
                          </Link>
                          {canWrite ? (
                            <GripVertical className="size-3.5 shrink-0 text-text-lo" aria-hidden />
                          ) : null}
                        </div>
                        <p className="t-body-sm mt-1 font-medium text-text-hi">{c.customerName}</p>
                        <p className="t-body-sm text-text-lo">
                          {c.siteName} · {c.siteDistrict}
                        </p>
                        <p className="mt-1.5">
                          <Serial>{c.assetSerial}</Serial>
                        </p>
                        <p className="t-body-sm text-text-lo">{c.assetModel}</p>

                        <div className="mt-2 flex flex-wrap gap-1">
                          <StatusBadge tone={SEVERITY_TONE[c.severity]}>{SEVERITY_SHORT[c.severity]}</StatusBadge>
                          <StatusBadge tone={COVERAGE_TONE[c.coverage]}>{COVERAGE_LABEL[c.coverage]}</StatusBadge>
                        </div>

                        <div className="mt-2">
                          <SlaClock
                            input={{
                              loggedAtMs: c.loggedAtMs,
                              dueAtMs: c.restorationDueMs,
                              stoppedAtMs: c.restoredAtMs,
                              pausedMs: c.pausedMs,
                              pauseStartedAtMs: c.pauseStartedAtMs,
                              businessHours: c.businessHours,
                            }}
                            nowMs={now}
                            holidays={holidays}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                          <span
                            className={cn(
                              "t-body-sm truncate",
                              c.engineerName ? "text-text-mid" : "text-warn",
                            )}
                          >
                            {c.engineerName ?? "Unassigned"}
                          </span>
                          {canWrite ? (
                            <Btn
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setPreselect(c.engineerId);
                                setAssignFor(c);
                              }}
                            >
                              <UserRoundCheck className="size-3.5" aria-hidden />
                              Assign
                            </Btn>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {unassigned > 0 ? (
        <Callout tone="warn" title={`${unassigned} open ${unassigned === 1 ? "ticket has" : "tickets have"} no engineer`} icon={MousePointerClick}>
          Drag a card onto an engineer, or open its Assign dialog. A drop onto an engineer who is at
          capacity or missing the machine&apos;s OEM certification opens the dialog instead of assigning
          silently, so the override is always recorded.
        </Callout>
      ) : null}

      {/* Forward-planned preventive work — E4-S3, visually distinct from breakdowns */}
      <Panel className="border-dashed">
        <PanelHeader
          title="Forward-planned work — preventive visits due within 7 days"
          sub="Generated from AMC visit schedules. These are commitments to plan around, not breakdowns on a clock."
          right={
            <StatusBadge tone="info" icon={false}>
              {formatCount(planned.length)} due
            </StatusBadge>
          }
        />
        {planned.length === 0 ? (
          <p className="t-body-sm px-4 py-6 text-center text-text-lo">
            No preventive visit falls due in the next seven days across the four branches.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {planned.map((v) => (
              <li key={v.id} className="bg-surface-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="t-body-sm font-medium text-text-hi">{v.customerName}</p>
                    <p className="t-body-sm text-text-lo">
                      {v.siteName} · {v.siteDistrict}
                    </p>
                  </div>
                  <span
                    className="t-overline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                    style={{ borderColor: "var(--v-service)", color: "var(--v-service)" }}
                  >
                    <CalendarClock className="size-3" aria-hidden />
                    Planned
                  </span>
                </div>
                <p className="mt-1.5">
                  <Serial>{v.assetSerial}</Serial>
                </p>
                <p className="t-body-sm text-text-lo">{v.assetModel}</p>
                <p className="t-body-sm mt-1.5 text-text-mid">
                  Visit {v.sequence} of {v.visitsPerYear} · due{" "}
                  <span className="t-mono">{formatDate(v.dueDateMs)}</span>
                </p>
                <p className="t-body-sm text-text-lo">
                  Contract <span className="t-mono">{v.amcNumber}</span> · {v.branchName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="t-body-sm flex items-start gap-1.5 text-text-lo">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Board state as of <span className="t-mono">{formatDateTime(now)}</span>. Lanes sort by time
        to breach ascending; a breached ticket sorts above every ticket still inside its window.
      </p>

      <AssignDialog
        open={assignFor !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAssignFor(null);
            setPreselect(null);
          }
        }}
        engineers={engineers}
        target={
          assignFor
            ? ({
              id: assignFor.id,
              number: assignFor.number,
              customerName: assignFor.customerName,
              assetSerial: assignFor.assetSerial,
              assetPrincipal: assignFor.assetPrincipal,
              branchId: assignFor.branchId,
              severityLabel: SEVERITY_LABEL[assignFor.severity],
            } satisfies AssignTarget)
            : null
        }
        currentEngineerId={preselect}
        onAssign={({ engineer, overrideReason, certAcknowledged }) => {
          if (assignFor) assign(assignFor, engineer, overrideReason, certAcknowledged);
        }}
      />
    </div>
  );
}
