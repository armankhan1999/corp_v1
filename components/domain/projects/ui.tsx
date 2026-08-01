"use client";

import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, Lock, RotateCcw, Table2, LineChart as LineChartIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Overline } from "@/components/patterns/primitives";

/* ------------------------------------------------------------- progress */

export function ProgressBar({
  pct, tone = "projects", className, label,
}: { pct: number; tone?: "projects" | "ok" | "warn" | "danger"; className?: string; label?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const colour =
    tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)"
      : tone === "danger" ? "var(--danger)" : "var(--v-projects)";
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-md bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div className="h-full rounded-md" style={{ width: `${clamped}%`, background: colour }} />
    </div>
  );
}

/* ---------------------------------------------------------------- cells */

export function Num({
  children, className, mono,
}: { children: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <span
      className={cn("tabular-nums", mono && "t-mono", className)}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- sorting */

export type SortDir = "asc" | "desc";

export function SortButton({
  label, active, dir, onClick, align = "left",
}: { label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "left" | "right" }) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${active ? `, currently ${dir === "asc" ? "ascending" : "descending"}` : ""}`}
      className={cn(
        "t-overline inline-flex w-full items-center gap-1 text-text-lo hover:text-text-hi",
        align === "right" && "justify-end",
        active && "text-text-hi",
      )}
    >
      {align === "right" ? null : <span>{label}</span>}
      <Icon className="size-3 shrink-0" aria-hidden />
      {align === "right" ? <span>{label}</span> : null}
    </button>
  );
}

/* ------------------------------------------------------- interaction states */

/**
 * E14-S2 — a blocked action never fails silently. It names the rule that
 * stopped it and the one thing that would unblock it.
 */
export function BlockedNotice({
  rule, unblock, action, onDismiss, className,
}: {
  rule: string; unblock: string; action?: React.ReactNode;
  onDismiss?: () => void; className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2.5",
        className,
      )}
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="t-body-sm font-medium text-danger">Blocked — {rule}</p>
        <p className="t-body-sm mt-0.5 text-text-mid">{unblock}</p>
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-text-lo hover:text-text-hi"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function WarnNotice({
  title, body, action, className,
}: { title: string; body: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn-bg px-3 py-2.5", className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="t-body-sm font-medium text-warn">{title}</p>
        <div className="t-body-sm mt-0.5 text-text-mid">{body}</div>
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Distinct from the empty state: names the filters and offers to clear them. */
export function FilteredEmpty({
  filters, onClear,
}: { filters: string[]; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Table2 className="size-7 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No records match these filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">
          Active: {filters.join(" · ")}. Widen or clear them to see the full set.
        </p>
      </div>
      <Btn onClick={onClear} variant="primary">
        <RotateCcw className="size-3.5" aria-hidden /> Clear filters
      </Btn>
    </div>
  );
}

export function ErrorNotice({
  cause, onRetry,
}: { cause: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="size-7 text-danger" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">This view could not be built</p>
        <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">{cause}</p>
      </div>
      {onRetry ? <Btn onClick={onRetry}>Retry</Btn> : null}
    </div>
  );
}

/* --------------------------------------------------------------- buttons */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Btn({ variant = "default", size = "sm", className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "t-body-sm h-8 px-2.5" : "t-body h-9 px-3",
        variant === "primary" && "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
        variant === "danger" && "border-danger/50 bg-danger-bg text-danger hover:border-danger",
        variant === "ghost" && "border-transparent text-text-mid hover:bg-surface-2 hover:text-text-hi",
        variant === "default" && "border-line bg-surface-1 text-text-mid hover:border-line-strong hover:text-text-hi",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- forms */

export function Field({
  label, hint, required, error, children, className,
}: {
  label: string; hint?: string; required?: boolean; error?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="t-overline text-text-lo">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden>*</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="t-body-sm text-text-lo">{hint}</span> : null}
      {error ? <span className="t-body-sm text-danger">{error}</span> : null}
    </label>
  );
}

const controlClass =
  "h-8 w-full rounded-md border border-line bg-surface-2 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo focus:border-line-strong disabled:opacity-50";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={cn(controlClass, "text-right tabular-nums", props.className)}
      style={{ fontVariantNumeric: "tabular-nums", ...props.style }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={2}
      {...props}
      className={cn(controlClass, "h-auto min-h-16 py-1.5 leading-snug", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, "pr-1", props.className)} />;
}

/* -------------------------------------------------- chart / table toggle */

/**
 * E6-S4 and WCAG 2.2 — every chart in this epic exposes the identical series
 * as a data table through a visible control, not a hidden affordance.
 */
export function ChartTableToggle({
  view, onChange, id,
}: { view: "chart" | "table"; onChange: (v: "chart" | "table") => void; id: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line" role="group" aria-label="Chart or data table">
      {(["chart", "table"] as const).map((v) => {
        const Icon = v === "chart" ? LineChartIcon : Table2;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            aria-controls={id}
            onClick={() => onChange(v)}
            className={cn(
              "t-overline flex h-7 items-center gap-1 px-2",
              view === v ? "bg-surface-3 text-text-hi" : "bg-surface-1 text-text-lo hover:text-text-hi",
            )}
          >
            <Icon className="size-3" aria-hidden />
            {v === "chart" ? "Chart" : "Data table"}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ small parts */

export function StatBlock({
  label, value, sub, tone,
}: { label: string; value: string; sub?: React.ReactNode; tone?: "ok" | "warn" | "danger" | "info" }) {
  const colour =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn"
      : tone === "danger" ? "text-danger" : tone === "info" ? "text-info" : "text-text-hi";
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <Overline>{label}</Overline>
      <span className={cn("t-heading-lg tabular-nums", colour)} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      {sub ? <span className="t-body-sm text-text-mid">{sub}</span> : null}
    </div>
  );
}

export function DenseTableShell({
  children, className, minWidth,
}: { children: React.ReactNode; className?: string; minWidth?: number }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

/** 36px dense rows — the register register geometry used across this epic. */
export const ROW = "h-9 border-b border-line last:border-b-0";
export const TH = "t-overline whitespace-nowrap px-2 py-1.5 text-left align-middle text-text-lo";
export const THR = "t-overline whitespace-nowrap px-2 py-1.5 text-right align-middle text-text-lo";
export const TD = "t-body-sm whitespace-nowrap px-2 align-middle text-text-mid";
export const TDR = "t-body-sm whitespace-nowrap px-2 text-right align-middle tabular-nums text-text-hi";
