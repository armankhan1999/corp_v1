import * as React from "react";
import {
  AlarmClock,
  Ban,
  CircleCheck,
  CircleSlash,
  FileClock,
  FileWarning,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Timer,
  TrendingUp,
  Truck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { AMCStatus, AssetStatus, CommissioningSubmission } from "@/lib/schemas/enums";
import { OEM_LABEL, type OEMPrincipal } from "@/lib/schemas/enums";
import { daysBetween, formatDate, pluralise } from "@/lib/format";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------- asset status */

const ASSET_STATUS: Record<
  AssetStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  RUNNING: { label: "Running", icon: CircleCheck, cls: "border-ok/40 bg-ok-bg text-ok" },
  DOWN: { label: "Down", icon: TriangleAlert, cls: "border-danger/40 bg-danger-bg text-danger" },
  DECOMMISSIONED: {
    label: "Decommissioned",
    icon: CircleSlash,
    cls: "border-line-strong bg-surface-2 text-text-mid",
  },
  ON_RENT: { label: "On rent", icon: Truck, cls: "border-info/40 bg-info-bg text-info" },
};

export function AssetStatusBadge({ status, className }: { status: AssetStatus; className?: string }) {
  const meta = ASSET_STATUS[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5",
        meta.cls,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

/* ---------------------------------------------------------- AMC status */

const AMC_STATUS: Record<
  AMCStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  DRAFT: { label: "Draft", icon: Pencil, cls: "border-line-strong bg-surface-2 text-text-mid" },
  ACTIVE: { label: "Active", icon: CircleCheck, cls: "border-ok/40 bg-ok-bg text-ok" },
  EXPIRING: { label: "Expiring", icon: AlarmClock, cls: "border-warn/40 bg-warn-bg text-warn" },
  EXPIRED: { label: "Expired", icon: TriangleAlert, cls: "border-danger/40 bg-danger-bg text-danger" },
  RENEWED: { label: "Renewed", icon: RotateCcw, cls: "border-info/40 bg-info-bg text-info" },
  TERMINATED: { label: "Terminated", icon: Ban, cls: "border-line-strong bg-surface-2 text-text-mid" },
};

export function AmcStatusBadge({ status, className }: { status: AMCStatus; className?: string }) {
  const meta = AMC_STATUS[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5",
        meta.cls,
        className,
      )}
      title="Derived from the contract dates. Only Terminated is set by hand, and it requires a reason."
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------- commissioning submission */

const SUBMISSION: Record<
  CommissioningSubmission,
  { label: string; short: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  NOT_SUBMITTED: {
    label: "Not submitted",
    short: "Not submitted",
    icon: FileClock,
    cls: "border-warn/40 bg-warn-bg text-warn",
  },
  SUBMITTED_IN_WINDOW: {
    label: "Submitted within window",
    short: "In window",
    icon: CircleCheck,
    cls: "border-ok/40 bg-ok-bg text-ok",
  },
  SUBMITTED_LATE: {
    label: "Submitted late",
    short: "Late",
    icon: FileWarning,
    cls: "border-warn/40 bg-warn-bg text-warn",
  },
  OVERDUE: {
    label: "Overdue",
    short: "Overdue",
    icon: TriangleAlert,
    cls: "border-danger/40 bg-danger-bg text-danger",
  },
};

export function SubmissionBadge({
  state,
  short,
  className,
}: {
  state: CommissioningSubmission;
  short?: boolean;
  className?: string;
}) {
  const meta = SUBMISSION[state];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5",
        meta.cls,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {short ? meta.short : meta.label}
    </span>
  );
}

/* ------------------------------------------------ OEM submission clock */

export interface CountdownState {
  daysRemaining: number;
  overdue: boolean;
  submitted: boolean;
  late: boolean;
  headline: string;
  detail: string;
  tone: "ok" | "warn" | "danger" | "info";
}

export function countdownOf(args: {
  deadline: string;
  submittedAt: string | null;
  windowDays: number;
  now: Date;
}): CountdownState {
  const { deadline, submittedAt, windowDays, now } = args;
  const daysRemaining = daysBetween(now, deadline);
  if (submittedAt) {
    const late = new Date(submittedAt) > new Date(deadline);
    const drift = daysBetween(deadline, submittedAt);
    return {
      daysRemaining,
      overdue: false,
      submitted: true,
      late,
      headline: late ? `${Math.abs(drift)} ${pluralise(Math.abs(drift), "day")} late` : "Submitted in window",
      detail: late
        ? `Submitted ${formatDate(submittedAt)}, after the ${windowDays}-day deadline of ${formatDate(deadline)}. Warranty registration is at the OEM's discretion.`
        : `Submitted ${formatDate(submittedAt)}, inside the ${windowDays}-day OEM window. Warranty registration protected.`,
      tone: late ? "warn" : "ok",
    };
  }
  if (daysRemaining < 0) {
    const over = Math.abs(daysRemaining);
    return {
      daysRemaining,
      overdue: true,
      submitted: false,
      late: false,
      headline: `${over} ${pluralise(over, "day")} overdue`,
      detail: `The ${windowDays}-day OEM submission window closed ${formatDate(deadline)}. Director — Business notified and an exception raised; warranty registration is now at risk.`,
      tone: "danger",
    };
  }
  return {
    daysRemaining,
    overdue: false,
    submitted: false,
    late: false,
    headline: daysRemaining === 0 ? "Due today" : `${daysRemaining} ${pluralise(daysRemaining, "day")} left`,
    detail:
      daysRemaining <= 2
        ? `Deadline ${formatDate(deadline)}. Two days or fewer remain — Service Manager and Branch Manager notified.`
        : `Deadline ${formatDate(deadline)}, ${windowDays} days from commissioning.`,
    tone: daysRemaining <= 2 ? "warn" : "info",
  };
}

const TONE_CLS: Record<CountdownState["tone"], string> = {
  ok: "border-ok/40 bg-ok-bg text-ok",
  warn: "border-warn/40 bg-warn-bg text-warn",
  danger: "border-danger/50 bg-danger-bg text-danger",
  info: "border-info/40 bg-info-bg text-info",
};

/** Compact countdown for register rows and passport headers. */
export function CountdownPill({
  state,
  className,
}: {
  state: CountdownState;
  className?: string;
}) {
  const Icon = state.overdue ? TriangleAlert : state.submitted ? CircleCheck : Timer;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 tabular-nums",
        TONE_CLS[state.tone],
        className,
      )}
      title={state.detail}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {state.headline}
    </span>
  );
}

/** The prominent form of the countdown — on the report and the passport. */
export function CountdownPanel({
  state,
  deadline,
  windowDays,
  principal,
  className,
}: {
  state: CountdownState;
  deadline: string;
  windowDays: number;
  principal: OEMPrincipal;
  className?: string;
}) {
  const Icon = state.overdue ? TriangleAlert : state.submitted ? CircleCheck : Timer;
  return (
    <div className={cn("rounded-lg border p-3", TONE_CLS[state.tone], className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="t-overline flex items-center gap-1.5">
          <Icon className="size-3.5" aria-hidden />
          OEM submission countdown
        </span>
        <span className="t-overline text-current opacity-80">
          {OEM_LABEL[principal]} · {windowDays}-day window
        </span>
      </div>
      <p className="t-display-md mt-1 tabular-nums">{state.headline}</p>
      <p className="t-body-sm mt-1 text-text-mid">{state.detail}</p>
      <p className="t-body-sm mt-0.5 text-text-lo">
        Deadline <span className="t-mono text-text-mid">{formatDate(deadline)}</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- assorted */

export function PrincipalTag({ principal }: { principal: OEMPrincipal }) {
  return (
    <span className="t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
      <Wrench className="size-3 shrink-0" aria-hidden />
      {OEM_LABEL[principal]}
    </span>
  );
}

export function RenewalStatusBadge({
  status,
  className,
}: {
  status: "IDENTIFIED" | "QUOTED" | "WON" | "LOST";
  className?: string;
}) {
  const meta =
    status === "QUOTED"
      ? { label: "Quoted", icon: TrendingUp, cls: "border-info/40 bg-info-bg text-info" }
      : status === "WON"
        ? { label: "Renewed", icon: ShieldCheck, cls: "border-ok/40 bg-ok-bg text-ok" }
        : status === "LOST"
          ? { label: "Lost", icon: Ban, cls: "border-danger/40 bg-danger-bg text-danger" }
          : { label: "Identified", icon: Timer, cls: "border-line-strong bg-surface-2 text-text-mid" };
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5",
        meta.cls,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}
