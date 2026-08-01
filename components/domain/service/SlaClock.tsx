"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Clock3, OctagonAlert, Pause, TriangleAlert } from "lucide-react";
import type { SLAState } from "@/lib/schemas/enums";
import { formatDateTime, formatDurationHM, formatOverrun } from "@/lib/format";
import { cn } from "@/lib/utils";
import { breachReasonLabel, computeClock, excludedMs, type ClockInput, type ServiceClock } from "./sla";
import { SLA_STATE_LABEL } from "./types";

/**
 * E4-S2 — the live SLA clock.
 *
 * Colour is never the only signal: every state carries its own colour, its own
 * icon and its own written label. The four-segment indicator reads as quarters
 * of the committed window, with the final quarter carrying the approaching and
 * imminent bands where they actually fall (75% and 90% consumed).
 */

/**
 * The platform runs on a simulated today (31 Jul 2026). A clock that ticked on
 * the wall clock would disagree with every other figure on the screen, so the
 * countdown advances the *simulated* instant by real elapsed time. Server and
 * first client render both see the base value, so hydration matches.
 */
export function useSimNow(baseMs: number, intervalMs = 15_000): number {
  const [now, setNow] = useState(baseMs);
  const anchor = useRef<{ base: number; real: number } | null>(null);

  useEffect(() => {
    anchor.current = { base: baseMs, real: Date.now() };
    setNow(baseMs);
    const tick = () => {
      const a = anchor.current;
      if (a) setNow(a.base + (Date.now() - a.real));
    };
    const handle = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(handle);
  }, [baseMs, intervalMs]);

  return now;
}

export function useHolidaySet(keys: string[]): ReadonlySet<string> {
  const joined = keys.join("|");
  return useMemo(() => new Set(joined ? joined.split("|") : []), [joined]);
}

const STATE_META: Record<
  SLAState,
  {
    icon: React.ComponentType<{ className?: string }>;
    text: string;
    bg: string;
    border: string;
    tint: string;
  }
> = {
  COMFORTABLE: {
    icon: CircleCheck,
    text: "text-sla-comfortable",
    bg: "bg-sla-comfortable",
    border: "border-sla-comfortable/45",
    tint: "bg-sla-comfortable/10",
  },
  APPROACHING: {
    icon: Clock3,
    text: "text-sla-approaching",
    bg: "bg-sla-approaching",
    border: "border-sla-approaching/45",
    tint: "bg-sla-approaching/10",
  },
  IMMINENT: {
    icon: TriangleAlert,
    text: "text-sla-imminent",
    bg: "bg-sla-imminent",
    border: "border-sla-imminent/50",
    tint: "bg-sla-imminent/12",
  },
  BREACHED: {
    icon: OctagonAlert,
    text: "text-sla-breached",
    bg: "bg-sla-breached",
    border: "border-sla-breached/60",
    tint: "bg-sla-breached/12",
  },
};

export function slaStateMeta(state: SLAState) {
  return STATE_META[state];
}

/** Four segments = four quarters of the committed window. */
function Segments({ state, elapsedFraction }: { state: SLAState; elapsedFraction: number }) {
  const clamped = Math.max(0, Math.min(1, elapsedFraction));
  const meta = STATE_META[state];
  return (
    <span aria-hidden className="flex h-1.5 w-full min-w-16 gap-[2px]">
      {[0, 1, 2, 3].map((i) => {
        const fill = Math.max(0, Math.min(1, (clamped - i / 4) * 4));
        // Quarters 1–3 are the comfortable run; the fourth quarter holds the
        // approaching (75%) and imminent (90%) thresholds.
        const zone =
          i < 3
            ? STATE_META[state === "BREACHED" ? "BREACHED" : "COMFORTABLE"]
            : meta;
        return (
          <span key={i} className="relative flex-1 overflow-hidden rounded-sm bg-surface-3">
            <span
              className={cn("absolute inset-y-0 left-0", zone.bg)}
              style={{ width: `${fill * 100}%` }}
            />
            {i === 3 ? (
              // 90% consumed — where imminent begins inside the final quarter.
              <span className="absolute inset-y-0 left-[60%] w-px bg-surface-0/70" />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export interface SlaClockProps {
  input: ClockInput;
  nowMs: number;
  holidays: string[];
  breachedAtMs?: number | null;
  breachReasonCode?: string | null;
  size?: "sm" | "md" | "lg";
  caption?: string;
  className?: string;
  /** Suppress the basis line where the surface already states it once. */
  hideBasis?: boolean;
}

export function SlaClock({
  input, nowMs, holidays, breachedAtMs = null, breachReasonCode = null,
  size = "sm", caption, className, hideBasis,
}: SlaClockProps) {
  const holidaySet = useHolidaySet(holidays);
  const clock = computeClock(input, nowMs, holidaySet);
  const meta = STATE_META[clock.state];
  const Icon = clock.paused ? Pause : meta.icon;
  const elapsedFraction = clock.totalMs > 0 ? 1 - clock.fractionRemaining : 1;

  const headline = clock.breached
    ? formatDurationHM(clock.overrunMs)
    : formatDurationHM(clock.remainingMs);

  const ariaLabel = [
    caption ?? "Restoration commitment",
    SLA_STATE_LABEL[clock.state],
    clock.breached
      ? `overrun ${formatOverrun(clock.overrunMs)}`
      : `${formatDurationHM(clock.remainingMs)} remaining`,
    clock.paused ? "clock paused" : null,
    clock.basis === "BUSINESS" ? "business hours basis" : "elapsed hours basis",
  ]
    .filter(Boolean)
    .join(", ");

  if (size === "sm") {
    return (
      <span
        className={cn("flex min-w-24 flex-col gap-1", className)}
        role="img"
        aria-label={ariaLabel}
      >
        <span className="flex items-center gap-1.5">
          <Icon className={cn("size-3.5 shrink-0", meta.text)} aria-hidden />
          <span className={cn("t-mono font-medium tabular-nums", meta.text)}>{headline}</span>
          <span className={cn("t-overline", meta.text)}>
            {clock.breached ? "Over" : SLA_STATE_LABEL[clock.state]}
          </span>
        </span>
        <Segments state={clock.state} elapsedFraction={elapsedFraction} />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        meta.border,
        meta.tint,
        clock.state === "BREACHED" && size === "lg" && "pv-breach-pulse",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {caption ? <p className="t-overline text-text-lo">{caption}</p> : null}
          <p className="mt-0.5 flex items-baseline gap-2">
            <span
              className={cn(
                "font-medium tabular-nums",
                meta.text,
                size === "lg" ? "t-display-md" : "t-heading-lg",
              )}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {headline}
            </span>
            <span className="t-body-sm text-text-lo">
              {clock.breached ? "hh:mm over commitment" : "hh:mm remaining"}
            </span>
          </p>
        </div>
        <span
          className={cn(
            "t-overline inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5",
            meta.border,
            meta.text,
          )}
        >
          <Icon className="size-3" aria-hidden />
          {clock.paused ? "Paused" : SLA_STATE_LABEL[clock.state]}
        </span>
      </div>

      <div className="mt-2.5" role="img" aria-label={ariaLabel}>
        <Segments state={clock.state} elapsedFraction={elapsedFraction} />
        <div className="mt-1 flex justify-between">
          <span className="t-overline text-text-lo">0%</span>
          <span className="t-overline text-text-lo">75% approaching</span>
          <span className="t-overline text-text-lo">90% imminent</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div className="flex justify-between gap-2">
          <dt className="t-body-sm text-text-lo">Due</dt>
          <dd className="t-mono text-text-hi">{formatDateTime(clock.dueAtMs)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="t-body-sm text-text-lo">Committed</dt>
          <dd className="t-mono text-text-hi">
            {(clock.totalMs / 3_600_000).toFixed(0)} h
          </dd>
        </div>
        {clock.pausedMsEffective > 0 ? (
          <div className="col-span-2 flex justify-between gap-2">
            <dt className="t-body-sm text-text-lo">
              Paused {clock.paused ? "(running)" : "(banked)"}
            </dt>
            <dd className="t-mono text-warn">
              {formatOverrun(clock.pausedMsEffective)} · excluded from remaining
            </dd>
          </div>
        ) : null}
        {clock.basis === "BUSINESS" ? (
          <div className="col-span-2 flex justify-between gap-2">
            <dt className="t-body-sm text-text-lo">Non-working time excluded</dt>
            <dd className="t-mono text-text-mid">
              {formatOverrun(excludedMs(input, nowMs, holidaySet))}
            </dd>
          </div>
        ) : null}
      </dl>

      {!hideBasis ? (
        <p className="t-body-sm mt-2 border-t border-line pt-2 text-text-lo">
          Basis — {clock.basisLabel}
        </p>
      ) : null}

      {breachedAtMs ? (
        <div className="mt-2 rounded-md border border-sla-breached/50 bg-sla-breached/10 p-2">
          <p className="t-overline text-sla-breached">Breach recorded — permanent</p>
          <p className="t-body-sm mt-1 text-text-hi">
            Breached <span className="t-mono">{formatDateTime(breachedAtMs)}</span> ·{" "}
            {breachReasonLabel(breachReasonCode)}
            {breachReasonCode ? (
              <span className="t-mono text-text-lo"> ({breachReasonCode})</span>
            ) : null}
          </p>
          <p className="t-body-sm mt-1 text-text-lo">
            Overrun {formatOverrun(clock.overrunMs)} and counting. The timestamp and reason code
            cannot be edited away — no screen in the platform offers that path.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Compact, text-first variant for dense tables where a bar would not fit. */
export function SlaChip({
  input, nowMs, holidays, className,
}: {
  input: ClockInput;
  nowMs: number;
  holidays: string[];
  className?: string;
}) {
  const holidaySet = useHolidaySet(holidays);
  const clock: ServiceClock = computeClock(input, nowMs, holidaySet);
  const meta = STATE_META[clock.state];
  const Icon = clock.paused ? Pause : meta.icon;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        meta.border,
        meta.tint,
        meta.text,
        className,
      )}
      title={`${SLA_STATE_LABEL[clock.state]} · ${clock.basisLabel}`}
    >
      <Icon className="size-3" aria-hidden />
      {SLA_STATE_LABEL[clock.state]}
      <span className="t-mono">
        {clock.breached ? `+${formatDurationHM(clock.overrunMs)}` : formatDurationHM(clock.remainingMs)}
      </span>
    </span>
  );
}
