"use client";

/**
 * E7 — shared inventory surface kit.
 *
 * Everything an inventory screen needs that is not already a shared primitive:
 * the dense 36px virtualised table the 1,240-row stock list demands, the
 * filter/toolbar furniture, and the five interaction states E14-S2 requires on
 * every surface — loading, empty, filtered-empty, error and blocked-action.
 */

import * as React from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Check, ChevronDown, Info, Lock, RotateCcw, Search, SlidersHorizontal, TriangleAlert, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Overline, Panel, Skeleton } from "@/components/patterns/primitives";

/* ------------------------------------------------------------ page header */

export function PageHeader({
  title, lede, right,
}: { title: string; lede: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-display-md text-text-hi">{title}</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">{lede}</p>
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- metrics */

export interface MetricSpec {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "default" | "warn" | "danger" | "ok";
  icon?: React.ComponentType<{ className?: string }>;
}

const METRIC_TONE: Record<NonNullable<MetricSpec["tone"]>, string> = {
  default: "text-text-hi",
  warn: "text-warn",
  danger: "text-danger",
  ok: "text-ok",
};

const METRIC_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export function MetricStrip({ metrics, columns = 4 }: { metrics: MetricSpec[]; columns?: number }) {
  return (
    <ul className={cn("grid grid-cols-1 gap-3", METRIC_COLS[columns] ?? METRIC_COLS[4])}>
      {metrics.map((m) => {
        const Icon = m.icon;
        const body = (
          <>
            <span className="flex items-center gap-1.5">
              {Icon ? <Icon className="size-3.5 text-text-lo" aria-hidden /> : null}
              <Overline>{m.label}</Overline>
            </span>
            <span
              className={cn("t-display-md", METRIC_TONE[m.tone ?? "default"])}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {m.value}
            </span>
            {m.sub ? <span className="t-body-sm mt-auto text-text-mid">{m.sub}</span> : null}
          </>
        );
        return (
          <li key={m.label} className="lg:col-span-1">
            {m.href ? (
              <Link
                href={m.href}
                className="flex h-full flex-col gap-1.5 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3 transition-colors duration-150 hover:border-line-strong"
              >
                {body}
              </Link>
            ) : (
              <div className="flex h-full flex-col gap-1.5 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- toolbar */

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b border-line bg-surface-1 px-3 py-2", className)}>
      {children}
    </div>
  );
}

export function SearchField({
  value, onChange, placeholder, label, width = "w-72",
}: { value: string; onChange: (v: string) => void; placeholder: string; label: string; width?: string }) {
  return (
    <label className={cn("relative flex items-center", width)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="t-body-sm h-8 w-full rounded-md border border-line bg-surface-0 pl-7 pr-7 text-text-hi placeholder:text-text-lo focus:border-line-strong"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 grid size-5 place-items-center rounded text-text-lo hover:text-text-hi"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

export function ChipGroup<V extends string>({
  label, options, selected, onToggle,
}: {
  label: string;
  options: { value: V; label: string }[];
  selected: V[];
  onToggle: (v: V) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Overline className="mr-0.5">{label}</Overline>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            className={cn(
              "t-body-sm inline-flex h-7 items-center gap-1 rounded-md border px-2 transition-colors duration-150",
              on
                ? "border-primary-500 bg-primary-100 text-text-hi"
                : "border-line bg-surface-0 text-text-mid hover:border-line-strong hover:text-text-hi",
            )}
          >
            {on ? <Check className="size-3" aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SelectField<V extends string>({
  label, value, options, onChange, width = "w-auto", hideLabel,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  width?: string;
  hideLabel?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-1.5", width)}>
      {hideLabel ? <span className="sr-only">{label}</span> : <Overline>{label}</Overline>}
      <span className="relative flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as V)}
          className="t-body-sm h-8 appearance-none rounded-md border border-line bg-surface-0 pl-2 pr-7 text-text-hi focus:border-line-strong"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-text-lo" aria-hidden />
      </span>
    </label>
  );
}

export function NumberStepper({
  label, value, onChange, min = 1, max = 3650, step = 1, suffix, width = "w-24",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <Overline>{label}</Overline>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
          }}
          className={cn(
            "t-mono h-8 rounded-md border border-line bg-surface-0 px-2 text-right text-text-hi focus:border-line-strong",
            width,
          )}
        />
        {suffix ? <span className="t-body-sm text-text-lo">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function Btn({
  variant = "secondary", size = "md", icon: Icon, children, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const styles: Record<string, string> = {
    primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
    secondary: "border-line bg-surface-0 text-text-mid hover:border-line-strong hover:text-text-hi",
    danger: "border-danger/50 bg-danger-bg text-danger hover:border-danger",
    ghost: "border-transparent bg-transparent text-text-mid hover:text-text-hi",
  };
  return (
    <button
      type="button"
      className={cn(
        "t-body-sm inline-flex items-center justify-center gap-1.5 rounded-md border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 px-2" : "h-8 px-3",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkBtn({
  href, children, icon: Icon, variant = "secondary", className,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border px-3 transition-colors duration-150",
        variant === "primary"
          ? "border-primary-600 bg-primary-600 text-white hover:border-primary-500 hover:bg-primary-500"
          : "border-line bg-surface-0 text-text-mid hover:border-line-strong hover:text-text-hi",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------- numeric cell */

export function Num({
  children, className, tone,
}: { children: React.ReactNode; className?: string; tone?: "default" | "warn" | "danger" | "ok" | "lo" }) {
  const toneClass =
    tone === "warn" ? "text-warn"
      : tone === "danger" ? "text-danger"
        : tone === "ok" ? "text-ok"
          : tone === "lo" ? "text-text-lo"
            : "text-text-hi";
  return (
    <span className={cn("block text-right", toneClass, className)} style={{ fontVariantNumeric: "tabular-nums" }}>
      {children}
    </span>
  );
}

export function MonoCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("t-mono block truncate text-text-hi", className)}>{children}</span>;
}

/* -------------------------------------------------------- virtual table */

export interface Column<R> {
  key: string;
  header: string;
  width: string;
  align?: "left" | "right" | "center";
  cell: (row: R, index: number) => React.ReactNode;
  headerClassName?: string;
}

export function VirtualTable<R>({
  rows, columns, rowKey, onRowClick, rowHref, height = 520, ariaLabel, activeKey, rowTone,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (row: R) => string;
  onRowClick?: (row: R) => void;
  rowHref?: (row: R) => string | null;
  height?: number;
  ariaLabel: string;
  activeKey?: string | null;
  rowTone?: (row: R) => "danger" | "warn" | null;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 14,
  });
  const template = columns.map((c) => c.width).join(" ");

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <div style={{ minWidth: "max-content" }}>
          <div
            role="row"
            className="grid items-center gap-x-3 border-b border-line-strong bg-surface-2 px-3"
            style={{ gridTemplateColumns: template, height: 30 }}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                role="columnheader"
                className={cn(
                  "t-overline truncate text-text-lo",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.headerClassName,
                )}
              >
                {c.header}
              </div>
            ))}
          </div>
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{ height }}
            role="grid"
            aria-label={ariaLabel}
            aria-rowcount={rows.length}
            tabIndex={0}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index]!;
                const key = rowKey(row);
                const href = rowHref?.(row) ?? null;
                const tone = rowTone?.(row) ?? null;
                const content = (
                  <div
                    className="grid h-9 items-center gap-x-3 px-3"
                    style={{ gridTemplateColumns: template }}
                  >
                    {columns.map((c) => (
                      <div
                        key={c.key}
                        className={cn(
                          "t-body-sm min-w-0 truncate",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                        )}
                      >
                        {c.cell(row, vi.index)}
                      </div>
                    ))}
                  </div>
                );
                return (
                  <div
                    key={key}
                    role="row"
                    aria-rowindex={vi.index + 1}
                    className={cn(
                      "absolute left-0 top-0 w-full border-b border-line/70",
                      activeKey === key ? "bg-surface-2" : "bg-surface-1 hover:bg-surface-2",
                      tone === "danger" && "border-l-2 border-l-danger",
                      tone === "warn" && "border-l-2 border-l-warn",
                    )}
                    style={{ height: 36, transform: `translateY(${vi.start}px)` }}
                  >
                    {href ? (
                      <Link href={href} className="block focus-visible:outline-offset-[-2px]">
                        {content}
                      </Link>
                    ) : onRowClick ? (
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="block w-full text-left focus-visible:outline-offset-[-2px]"
                      >
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A plain (non-virtual) dense table for short lists — same row register. */
export function DenseTable<R>({
  rows, columns, rowKey, ariaLabel, rowHref, onRowClick, rowTone,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (row: R) => string;
  ariaLabel: string;
  rowHref?: (row: R) => string | null;
  onRowClick?: (row: R) => void;
  rowTone?: (row: R) => "danger" | "warn" | null;
}) {
  const template = columns.map((c) => c.width).join(" ");
  return (
    <div className="overflow-x-auto" role="grid" aria-label={ariaLabel}>
      <div style={{ minWidth: "max-content" }}>
        <div
          role="row"
          className="grid items-center gap-x-3 border-b border-line-strong bg-surface-2 px-3"
          style={{ gridTemplateColumns: template, height: 30 }}
        >
          {columns.map((c) => (
            <div
              key={c.key}
              role="columnheader"
              className={cn(
                "t-overline truncate text-text-lo",
                c.align === "right" && "text-right",
                c.align === "center" && "text-center",
              )}
            >
              {c.header}
            </div>
          ))}
        </div>
        {rows.map((row, i) => {
          const href = rowHref?.(row) ?? null;
          const tone = rowTone?.(row) ?? null;
          const content = (
            <div className="grid min-h-9 items-center gap-x-3 px-3 py-1" style={{ gridTemplateColumns: template }}>
              {columns.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    "t-body-sm min-w-0",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  {c.cell(row, i)}
                </div>
              ))}
            </div>
          );
          return (
            <div
              key={rowKey(row)}
              role="row"
              className={cn(
                "border-b border-line/70 bg-surface-1",
                (href || onRowClick) && "hover:bg-surface-2",
                tone === "danger" && "border-l-2 border-l-danger",
                tone === "warn" && "border-l-2 border-l-warn",
              )}
            >
              {href ? (
                <Link href={href} className="block">{content}</Link>
              ) : onRowClick ? (
                <button type="button" onClick={() => onRowClick(row)} className="block w-full text-left">
                  {content}
                </button>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------- interaction states */

/** Loading — same geometry as the final table, so nothing reflows. E14-S2 */
export function TableSkeleton({ rows = 12, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line-strong bg-surface-2 px-3" style={{ height: 30 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-line/70 px-3" style={{ height: 36 }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ metrics = 4, rows = 14, columns = 7 }: { metrics?: number; rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: metrics }).map((_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>
      <Panel>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
        <TableSkeleton rows={rows} columns={columns} />
      </Panel>
      <span className="sr-only">Loading inventory data</span>
    </div>
  );
}

/** Filtered-empty is deliberately distinct from genuinely empty. E14-S2 */
export function FilteredEmpty({
  filters, onClear, total,
}: { filters: string[]; onClear: () => void; total: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <SlidersHorizontal className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No rows match the active filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          {total} rows exist. {filters.length ? `Filtering by ${filters.join(" · ")}.` : "A filter is narrowing the list."}
        </p>
      </div>
      <Btn variant="secondary" icon={RotateCcw} onClick={onClear}>
        Clear filters
      </Btn>
    </div>
  );
}

export function ErrorState({
  cause, onRetry,
}: { cause: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center" role="alert">
      <TriangleAlert className="size-8 text-danger" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">This view could not be built</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">{cause}</p>
      </div>
      {onRetry ? <Btn variant="secondary" icon={RotateCcw} onClick={onRetry}>Retry</Btn> : null}
    </div>
  );
}

/**
 * Blocked action — states the rule and what unblocks it. The two blocks this
 * epic turns on are structural: a balance is never directly editable, and a
 * ledger row is never edited or deleted.
 */
export function Blocked({
  title, rule, unblock, actions,
}: { title: string; rule: string; unblock: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger-bg p-3" role="alert">
      <p className="t-body flex items-center gap-1.5 font-medium text-danger">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {title}
      </p>
      <p className="t-body-sm mt-1 text-text-mid">{rule}</p>
      <p className="t-body-sm mt-1.5 text-text-hi">{unblock}</p>
      {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Note({
  tone = "info", title, children, icon: Icon,
}: {
  tone?: "info" | "warn" | "ok" | "danger" | "neutral";
  title?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const map = {
    info: "border-info/40 bg-info-bg text-info",
    warn: "border-warn/40 bg-warn-bg text-warn",
    ok: "border-ok/40 bg-ok-bg text-ok",
    danger: "border-danger/40 bg-danger-bg text-danger",
    neutral: "border-line bg-surface-2 text-text-mid",
  } as const;
  const I = Icon ?? Info;
  return (
    <div className={cn("rounded-lg border p-3", map[tone])}>
      <div className="flex gap-2">
        <I className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          {title ? <p className="t-body font-medium">{title}</p> : null}
          <div className={cn("t-body-sm", title && "mt-0.5", tone === "neutral" ? "text-text-mid" : "text-text-mid")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open, onClose, title, sub, children, footer, width = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea, button",
    );
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close dialog"
        className="fixed inset-0 cursor-default"
        style={{ background: "var(--overlay)" }}
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full rounded-md border border-line-strong bg-surface-1",
          width,
        )}
        style={{ boxShadow: "var(--elev-2)" }}
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
            className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

export function Field({
  label, hint, error, required, children, className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="t-overline text-text-lo">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="t-body-sm flex items-center gap-1 text-danger">
          <TriangleAlert className="size-3" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="t-body-sm text-text-lo">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLASS =
  "t-body-sm h-8 w-full rounded-md border border-line bg-surface-0 px-2 text-text-hi placeholder:text-text-lo focus:border-line-strong disabled:opacity-50";

export function TextInput({
  mono, className, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={cn(INPUT_CLASS, mono && "t-mono", className)} {...rest} />;
}

export function NumInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      className={cn(INPUT_CLASS, "t-mono text-right", className)}
      {...rest}
    />
  );
}

export function Select({
  className, children, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative flex items-center">
      <select className={cn(INPUT_CLASS, "appearance-none pr-7", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-text-lo" aria-hidden />
    </span>
  );
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        "t-body-sm w-full rounded-md border border-line bg-surface-0 px-2 py-1.5 text-text-hi placeholder:text-text-lo focus:border-line-strong",
        className,
      )}
      {...rest}
    />
  );
}

export function CheckRow({
  checked, onChange, label, hint, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2", disabled && "cursor-not-allowed opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 accent-[var(--primary-600)]"
      />
      <span className="min-w-0">
        <span className="t-body-sm block text-text-hi">{label}</span>
        {hint ? <span className="t-body-sm block text-text-lo">{hint}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------- tabs */

export function Tabs<V extends string>({
  tabs, value, onChange,
}: { tabs: { value: V; label: string; count?: number }[]; value: V; onChange: (v: V) => void }) {
  return (
    <div role="tablist" aria-label="Section" className="flex flex-wrap items-center gap-1 border-b border-line px-3">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "t-body-sm -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 transition-colors duration-150",
              on
                ? "border-b-primary-500 text-text-hi"
                : "border-b-transparent text-text-mid hover:text-text-hi",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span className="t-mono text-[0.6875rem] text-text-lo">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- toaster */

export function ActionResult({
  tone, title, children, onDismiss,
}: {
  tone: "ok" | "warn" | "danger" | "info";
  title: string;
  children?: React.ReactNode;
  onDismiss: () => void;
}) {
  const map = {
    ok: "border-ok/40 bg-ok-bg",
    warn: "border-warn/40 bg-warn-bg",
    danger: "border-danger/40 bg-danger-bg",
    info: "border-info/40 bg-info-bg",
  } as const;
  const fg = {
    ok: "text-ok", warn: "text-warn", danger: "text-danger", info: "text-info",
  } as const;
  const I = tone === "ok" ? Check : tone === "info" ? Info : TriangleAlert;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3", map[tone])} role="status">
      <I className={cn("mt-0.5 size-3.5 shrink-0", fg[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("t-body font-medium", fg[tone])}>{title}</p>
        {children ? <div className="t-body-sm mt-0.5 text-text-mid">{children}</div> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-6 shrink-0 place-items-center rounded text-text-lo hover:text-text-hi"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
