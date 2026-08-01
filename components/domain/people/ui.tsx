"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  CircleSlash,
  Clock,
  FileWarning,
  Info,
  Lock,
  MapPinOff,
  Plane,
  ShieldAlert,
  Smartphone,
  SunMedium,
  Fingerprint,
  PencilLine,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { Overline, StatusBadge } from "@/components/patterns/primitives";
import type { AttendanceState, Role } from "@/lib/schemas/enums";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { ATTENDANCE_STATE_LABEL, ATTENDANCE_STATE_TONE, SOURCE_LABEL } from "./config";
import type { AuditEntry, ExceptionKind } from "./derive";

/* ---------------------------------------------------------------- buttons */

type ButtonTone = "primary" | "ghost" | "danger" | "quiet";

const BUTTON_STYLES: Record<ButtonTone, string> = {
  primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
  ghost: "border-line bg-transparent text-text-mid hover:border-line-strong hover:text-text-hi",
  danger: "border-danger/50 bg-danger-bg text-danger hover:border-danger",
  quiet: "border-transparent bg-transparent text-text-lo hover:text-text-hi",
};

export function Button({
  tone = "ghost",
  size = "sm",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone; size?: "sm" | "touch" }) {
  return (
    <button
      type="button"
      className={cn(
        "t-body-sm inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size === "touch" ? "min-h-11 px-4" : "h-8 px-3",
        BUTTON_STYLES[tone],
        className,
      )}
      {...rest}
    />
  );
}

/* ----------------------------------------------------------------- fields */

const CONTROL =
  "w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 t-body-sm text-text-hi placeholder:text-text-lo focus-visible:border-primary-500";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="t-overline text-text-lo">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="t-body-sm flex items-center gap-1 text-danger">
          <AlertTriangle className="size-3 shrink-0" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="t-body-sm text-text-lo">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, "min-h-16 resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(CONTROL, "appearance-none pr-6", props.className)} />;
}

export function CheckLine({
  checked,
  onChange,
  children,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary-600)]"
      />
      <span className="t-body-sm text-text-mid">{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      style={{ background: "var(--overlay)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[8px] border border-line-strong bg-surface-1 sm:rounded-md",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
        style={{ boxShadow: "var(--shadow-e2)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="t-heading-md text-text-hi">{title}</h2>
            {sub ? <p className="t-body-sm mt-0.5 text-text-mid">{sub}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- tabs */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-px overflow-hidden border-b border-line">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "t-body-sm -mb-px border-b-2 px-3 py-2 font-medium transition-colors duration-150",
              on
                ? "border-b-primary-500 text-text-hi"
                : "border-b-transparent text-text-mid hover:text-text-hi",
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="t-mono ml-1.5 text-text-lo">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ chips */

const STATE_ICON: Record<AttendanceState, React.ComponentType<{ className?: string }>> = {
  PRESENT: Check,
  ABSENT: CircleSlash,
  ON_LEAVE: Plane,
  ON_FIELD: MapPinOff,
  HALF_DAY: Clock,
  WEEK_OFF: SunMedium,
  HOLIDAY: SunMedium,
};

export function StateChip({ state, className }: { state: AttendanceState; className?: string }) {
  const Icon = STATE_ICON[state];
  const tone = ATTENDANCE_STATE_TONE[state];
  const styles: Record<string, string> = {
    ok: "border-ok/40 bg-ok-bg text-ok",
    warn: "border-warn/40 bg-warn-bg text-warn",
    danger: "border-danger/40 bg-danger-bg text-danger",
    info: "border-info/40 bg-info-bg text-info",
    neutral: "border-line bg-surface-2 text-text-mid",
    sim: "border-sim/50 bg-sim-bg text-sim",
  };
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5",
        styles[tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {ATTENDANCE_STATE_LABEL[state]}
    </span>
  );
}

export function SourceChip({ source }: { source: "APP" | "DEVICE" | "MANUAL" }) {
  const Icon = source === "DEVICE" ? Fingerprint : source === "APP" ? Smartphone : PencilLine;
  return (
    <span className="t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
      <Icon className="size-3 shrink-0" aria-hidden />
      {SOURCE_LABEL[source]}
    </span>
  );
}

export const EXCEPTION_META: Record<
  ExceptionKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: "warn" | "danger" }
> = {
  LATE: { label: "Late mark", icon: Clock, tone: "warn" },
  MISSING_CHECKOUT: { label: "Missing check-out", icon: FileWarning, tone: "danger" },
  GEOFENCE: { label: "Outside geofence", icon: MapPinOff, tone: "warn" },
};

/* ------------------------------------------------------------------ notes */

export function RuleNote({
  title,
  children,
  tone = "info",
  icon: Icon = Info,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "info" | "warn" | "danger" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const styles = {
    info: "border-info/35 bg-info-bg text-info",
    warn: "border-warn/35 bg-warn-bg text-warn",
    danger: "border-danger/35 bg-danger-bg text-danger",
    neutral: "border-line bg-surface-2 text-text-mid",
  }[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5", styles)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="t-label font-semibold">{title}</p>
        <div className="t-body-sm mt-0.5 text-text-mid">{children}</div>
      </div>
    </div>
  );
}

export function MetricChip({
  label,
  value,
  tone = "neutral",
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "danger" | "info" | "neutral";
  onClick?: () => void;
  active?: boolean;
}) {
  const accent = {
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    info: "text-info",
    neutral: "text-text-hi",
  }[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex min-w-24 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-left",
        active ? "border-primary-500 bg-surface-2" : "border-line bg-surface-1",
        onClick && "hover:border-line-strong",
      )}
    >
      <span className="t-overline text-text-lo">{label}</span>
      <span className={cn("t-heading-md tabular-nums", accent)}>{value}</span>
    </Tag>
  );
}

/* ------------------------------------------------------- interaction states */

export function FilteredEmpty({
  filters,
  onClear,
}: {
  filters: string[];
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <CircleSlash className="size-7 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No records match these filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">
          Active {filters.length === 1 ? "filter" : "filters"}:{" "}
          <span className="text-text-hi">{filters.join(" · ")}</span>. Widen or clear them to see the
          full register.
        </p>
      </div>
      <Button tone="ghost" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

export function DeniedPanel({
  what,
  capability,
  holders,
  className,
}: {
  what: string;
  capability: string;
  holders: Role[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-danger/35 bg-danger-bg px-4 py-4",
        className,
      )}
    >
      <span className="flex items-center gap-2 text-danger">
        <Lock className="size-4" aria-hidden />
        <span className="t-label font-semibold">Access denied — {what}</span>
      </span>
      <p className="t-body-sm text-text-mid">
        Your role does not hold the <span className="t-mono text-text-hi">{capability}</span>{" "}
        permission. {holders.length ? "This is held by " : "No role currently holds this."}
        {holders.length ? (
          <span className="text-text-hi">{holders.map((r) => ROLE_LABEL[r]).join(", ")}</span>
        ) : null}
        {holders.length ? "." : ""}
      </p>
      <p className="t-body-sm flex items-center gap-1.5 text-text-lo">
        <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
        This denial has been written to the audit log with your user, role and the record requested.
      </p>
    </div>
  );
}

export function BlockedNote({ rule, unblock }: { rule: string; unblock: string }) {
  return (
    <RuleNote title="Action blocked" tone="warn" icon={AlertTriangle}>
      {rule} <span className="text-text-hi">{unblock}</span>
    </RuleNote>
  );
}

/* ------------------------------------------------------------ audit trail */

export function AuditTrail({
  entries,
  title = "Audit trail",
  empty = "No actions have been recorded in this session yet.",
  limit = 12,
}: {
  entries: AuditEntry[];
  title?: string;
  empty?: string;
  limit?: number;
}) {
  const shown = entries.slice(0, limit);
  return (
    <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <Overline>{title}</Overline>
        <span className="t-mono text-[0.6875rem] text-text-lo">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} · append-only
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="t-body-sm px-3 py-4 text-text-lo">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {shown.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={a.action === "ACCESS_DENIED" ? "danger" : "neutral"}>
                  {a.action.replace(/_/g, " ")}
                </StatusBadge>
                <span className="t-mono text-[0.6875rem] text-text-lo">{a.entityLabel}</span>
                <span className="t-body-sm ml-auto text-text-lo">{formatDateTime(a.at)}</span>
              </div>
              <p className="t-body-sm text-text-mid">{a.summary}</p>
              <p className="t-body-sm text-text-lo">
                {a.actorName} · {ROLE_LABEL[a.actorRole]}
                {a.before || a.after ? (
                  <>
                    {" · "}
                    <span className="t-mono text-text-mid">
                      {a.before ?? "—"} → {a.after ?? "—"}
                    </span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- table bits */

export function Th({
  children,
  numeric,
  className,
}: {
  children?: React.ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "t-overline whitespace-nowrap border-b border-line px-3 py-2 font-semibold text-text-lo",
        numeric ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  numeric,
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "t-body-sm border-b border-line px-3 py-2 align-middle text-text-mid",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
