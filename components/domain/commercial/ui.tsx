"use client";

import * as React from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Ban, Check, ChevronDown, FilterX, Info, Printer, RefreshCw, Search, Settings2,
  TriangleAlert, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { abbreviateINR, formatINR } from "@/lib/format";
import { Overline, Panel, PanelHeader, StatusBadge, Explainer } from "@/components/patterns/primitives";

/**
 * Shared instruments for Epic E8. Dense rows, hairline structure, tabular
 * numerals everywhere a figure appears, and every state named — loading,
 * empty, filtered-empty, error and blocked.
 */

/* ------------------------------------------------------------ page header */

export function PageHead({
  title, lede, right, meta,
}: { title: string; lede: string; right?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-display-md text-text-hi">{title}</h1>
        {lede.length > 90 ? (
          /* Long ledes are explanations, not captions. Collapsed so the
             screen opens on its data rather than on three lines of prose. */
          <Explainer className="mt-1" label="About this screen">{lede}</Explainer>
        ) : (
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">{lede}</p>
        )}
        {meta}
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- buttons */

type ButtonTone = "default" | "primary" | "danger" | "ghost";

const BUTTON_TONE: Record<ButtonTone, string> = {
  default: "border-line bg-surface-2 text-text-hi hover:border-line-strong",
  primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-700 hover:border-primary-700",
  danger: "border-danger/50 bg-danger-bg text-danger hover:border-danger",
  ghost: "border-transparent bg-transparent text-text-mid hover:bg-surface-2 hover:text-text-hi",
};

export function Button({
  tone = "default", className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      type="button"
      className={cn(
        "t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_TONE[tone], className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href, className, children,
}: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi transition-colors duration-150 hover:border-line-strong",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------- fields */

export function Field({
  label, hint, error, children, className,
}: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Overline>{label}</Overline>
      {children}
      {error ? (
        <span className="t-body-sm flex items-center gap-1 text-danger">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="t-body-sm text-text-lo">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  "h-8 w-full rounded-md border border-line bg-surface-0 px-2 text-[0.8125rem] text-text-hi " +
  "placeholder:text-text-lo focus:border-line-strong";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      inputMode="decimal"
      {...props}
      className={cn(CONTROL, "t-mono text-right tabular-nums", props.className)}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={2}
      {...props}
      className={cn(
        "w-full rounded-md border border-line bg-surface-0 px-2 py-1.5 text-[0.8125rem] text-text-hi placeholder:text-text-lo focus:border-line-strong",
        props.className,
      )}
    />
  );
}

export function Select({
  options, className, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select {...rest} className={cn(CONTROL, "appearance-none pr-7", className)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-2 size-4 text-text-lo" aria-hidden />
    </div>
  );
}

export function SearchInput({
  value, onValueChange, placeholder, className,
}: { value: string; onValueChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2 top-2 size-4 text-text-lo" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, "pl-8")}
      />
    </div>
  );
}

/* ------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-md border border-line">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "t-body-sm flex h-8 items-center gap-1.5 px-2.5 transition-colors duration-150",
            i > 0 && "border-l border-line",
            value === o.value
              ? "bg-surface-3 text-text-hi"
              : "bg-surface-1 text-text-mid hover:bg-surface-2 hover:text-text-hi",
          )}
        >
          {o.label}
          {o.count !== undefined ? (
            <span className="t-mono text-[0.6875rem] text-text-lo tabular-nums">{o.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ money */

export function Money({
  value, abbreviate, className, tone,
}: { value: number; abbreviate?: boolean; className?: string; tone?: "hi" | "mid" | "lo" | "ok" | "warn" | "danger" }) {
  const toneClass =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger"
      : tone === "mid" ? "text-text-mid" : tone === "lo" ? "text-text-lo" : "text-text-hi";
  return (
    <span
      className={cn("tabular-nums", toneClass, className)}
      title={formatINR(value)}
      data-numeric
    >
      {abbreviate ? abbreviateINR(value) : formatINR(value)}
    </span>
  );
}

/* ------------------------------------------------------------------ stats */

export function Stat({
  label, value, sub, tone, href, onClick, active, count,
}: {
  label: string; value: string; sub?: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger" | "info";
  href?: string; onClick?: () => void; active?: boolean; count?: number;
}) {
  const border =
    active ? "border-primary-500"
      : tone === "danger" ? "border-danger/40"
        : tone === "warn" ? "border-warn/40"
          : tone === "ok" ? "border-ok/40"
            : tone === "info" ? "border-info/40" : "border-line";
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <Overline>{label}</Overline>
        {count !== undefined ? (
          <span className="t-mono text-[0.6875rem] text-text-lo tabular-nums">
            {count} inv
          </span>
        ) : null}
      </div>
      <span className="t-display-md text-text-hi tabular-nums">{value}</span>
      {sub ? <span className="t-body-sm mt-auto block text-text-mid">{sub}</span> : null}
    </>
  );
  const cls = cn(
    "flex h-full flex-col gap-1 rounded-lg border bg-surface-1 p-3 text-left transition-colors duration-150",
    border,
    (href || onClick) && "hover:border-line-strong hover:bg-surface-2",
    active && "bg-surface-2",
  );
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

/* ----------------------------------------------------------------- states */

export function TableSkeleton({ rows = 12, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-px bg-line" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-9 items-center gap-4 bg-surface-1 px-3">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="pv-skeleton h-3"
              style={{ width: `${[18, 22, 14, 12, 16, 10][c % 6]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="pv-skeleton h-8 w-72" />
        <div className="pv-skeleton h-4 w-[32rem]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pv-skeleton h-24" />)}
      </div>
      <Panel><TableSkeleton rows={14} /></Panel>
    </div>
  );
}

export function FilteredEmpty({
  active, onClear, subject,
}: { active: string[]; onClear: () => void; subject: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <FilterX className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No {subject} match the current filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          {active.length
            ? <>Filtering by {active.map((a, i) => (
              <React.Fragment key={a}>
                {i > 0 ? (i === active.length - 1 ? " and " : ", ") : ""}
                <span className="text-text-hi">{a}</span>
              </React.Fragment>
            ))}. Widen one of them, or clear all filters to see the full set.</>
            : "The current query returns nothing."}
        </p>
      </div>
      <Button onClick={onClear}><FilterX className="size-3.5" aria-hidden />Clear filters</Button>
    </div>
  );
}

export function ErrorNotice({ cause, onRetry }: { cause: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-danger" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">This view could not be built</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">{cause}</p>
      </div>
      {onRetry ? (
        <Button onClick={onRetry}><RefreshCw className="size-3.5" aria-hidden />Try again</Button>
      ) : null}
    </div>
  );
}

/**
 * The blocked-action pattern. A refusal states the rule that produced it and
 * what would make the action possible; it never simply disables a control.
 */
export function BlockedNotice({
  headline, detail, remedy, facts, action,
}: {
  headline: string;
  detail: string;
  remedy?: string | null;
  facts?: { label: string; value: React.ReactNode }[];
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-danger/50 bg-danger-bg">
      <div className="flex items-start gap-3 border-b border-danger/30 px-4 py-3">
        <Ban className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0">
          <p className="t-heading-md text-text-hi">{headline}</p>
          <p className="t-body-sm mt-1 text-text-mid">{detail}</p>
        </div>
      </div>
      {facts?.length ? (
        <dl className="grid grid-cols-2 gap-px border-b border-danger/30 bg-danger/20 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="bg-surface-1 px-3 py-2">
              <Overline>{f.label}</Overline>
              <dd className="t-body mt-0.5 text-text-hi tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {remedy ? (
        <div className="px-4 py-3">
          <Overline className="text-danger">What would make this possible</Overline>
          <p className="t-body-sm mt-1 text-text-mid">{remedy}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A non-blocking statement of position — used where an action is simply not needed. */
export function InfoNotice({
  tone = "info", headline, detail, facts, action, icon: Icon = Info,
}: {
  tone?: "info" | "ok" | "warn";
  headline: string; detail: string;
  facts?: { label: string; value: React.ReactNode }[];
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const border = tone === "ok" ? "border-ok/40" : tone === "warn" ? "border-warn/40" : "border-info/40";
  const bg = tone === "ok" ? "bg-ok-bg" : tone === "warn" ? "bg-warn-bg" : "bg-info-bg";
  const fg = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-info";
  return (
    <div className={cn("rounded-lg border", border, bg)}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", fg)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="t-heading-md text-text-hi">{headline}</p>
          <p className="t-body-sm mt-1 text-text-mid">{detail}</p>
          {facts?.length ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label}>
                  <Overline>{f.label}</Overline>
                  <dd className="t-body mt-0.5 text-text-hi tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<R> {
  key: string;
  label: string;
  /** CSS grid track, e.g. "minmax(9rem,1fr)" or "7rem". */
  width: string;
  align?: "left" | "right";
  mono?: boolean;
  render: (row: R) => React.ReactNode;
  /** Omitted from the DOM below this breakpoint class. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

const HIDE_CLASS: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:block", md: "hidden md:block", lg: "hidden lg:block", xl: "hidden xl:block",
};

/**
 * Virtualised beyond 100 rows, plain DOM below it. ARIA grid roles rather than
 * a `<table>`, because a virtualised `<tbody>` cannot keep row order honest.
 */
export function DataTable<R>({
  columns, rows, rowKey, onRowClick, rowHref, empty, maxHeight = 620, footer, caption,
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  onRowClick?: (row: R) => void;
  rowHref?: (row: R) => string;
  empty: React.ReactNode;
  maxHeight?: number;
  footer?: React.ReactNode;
  caption?: string;
}) {
  const template = columns.map((c) => c.width).join(" ");
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualise = rows.length > 100;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 12,
    enabled: virtualise,
  });

  if (!rows.length) return <>{empty}</>;

  const header = (
    <div
      role="row"
      className="sticky top-0 z-10 grid items-center gap-3 border-b border-line bg-surface-1/95 px-3 py-2.5 backdrop-blur-sm"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((c) => (
        <span
          key={c.key}
          role="columnheader"
          className={cn(
            "t-overline truncate text-text-lo",
            c.align === "right" && "text-right",
            c.hideBelow && HIDE_CLASS[c.hideBelow],
          )}
        >
          {c.label}
        </span>
      ))}
    </div>
  );

  const cellsOf = (row: R) =>
    columns.map((c) => (
      <span
        key={c.key}
        role="cell"
        className={cn(
          "min-w-0 truncate",
          c.align === "right" ? "text-right tabular-nums" : "text-left",
          c.mono ? "t-mono" : "t-body-sm",
          c.hideBelow && HIDE_CLASS[c.hideBelow],
        )}
      >
        {c.render(row)}
      </span>
    ));

  const rowClass =
    "grid items-center gap-3 border-b border-line/70 px-3 text-text-mid transition-colors duration-150 hover:bg-surface-2";

  return (
    <div role="table" aria-label={caption} aria-rowcount={rows.length}>
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: virtualise ? maxHeight : undefined }}
      >
        {header}
        <div role="rowgroup" style={virtualise ? { height: virtualizer.getTotalSize(), position: "relative" } : undefined}>
          {virtualise
            ? virtualizer.getVirtualItems().map((v) => {
              const row = rows[v.index]!;
              const inner = (
                <div role="row" className={cn(rowClass, "h-10")} style={{ gridTemplateColumns: template }}>
                  {cellsOf(row)}
                </div>
              );
              return (
                <div
                  key={rowKey(row)}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)` }}
                >
                  {rowHref
                    ? <Link href={rowHref(row)} className="block">{inner}</Link>
                    : onRowClick
                      ? <button type="button" onClick={() => onRowClick(row)} className="block w-full text-left">{inner}</button>
                      : inner}
                </div>
              );
            })
            : rows.map((row) => {
              const inner = (
                <div role="row" className={cn(rowClass, "min-h-9 py-1")} style={{ gridTemplateColumns: template }}>
                  {cellsOf(row)}
                </div>
              );
              return (
                <React.Fragment key={rowKey(row)}>
                  {rowHref
                    ? <Link href={rowHref(row)} className="block">{inner}</Link>
                    : onRowClick
                      ? <button type="button" onClick={() => onRowClick(row)} className="block w-full text-left">{inner}</button>
                      : inner}
                </React.Fragment>
              );
            })}
        </div>
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-strong bg-surface-2 px-3 py-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open, onClose, title, sub, children, footer, wide,
}: {
  open: boolean; onClose: () => void; title: string; sub?: string;
  children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: "var(--overlay)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full rounded-md border border-line-strong bg-surface-1 shadow-e2",
          wide ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="t-heading-lg text-text-hi">{title}</h2>
            {sub ? <p className="t-body-sm mt-0.5 text-text-mid">{sub}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- settings */

/**
 * The configured values E8 keeps testing against. They belong in Masters and
 * will move there; until then they live here, beside the rule they govern, so
 * "changing the setting recomputes everything" is one click away from the
 * figure it changes.
 */
export function SettingsBar({
  children, note,
}: { children: React.ReactNode; note: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Panel className="no-print">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-surface-2"
      >
        <Settings2 className="size-4 text-text-lo" aria-hidden />
        <span className="t-body-sm text-text-mid">
          Masters — Commercial configuration
        </span>
        <ChevronDown className={cn("ml-auto size-4 text-text-lo transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="border-t border-line px-4 py-3">
          <p className="t-body-sm mb-3 text-text-lo">{note}</p>
          <div className="flex flex-wrap items-end gap-4">{children}</div>
        </div>
      ) : null}
    </Panel>
  );
}

/* --------------------------------------------------------------- printing */

export function PrintBar({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
      <span className="t-body-sm text-text-mid">{label}</span>
      <div className="flex items-center gap-2">
        {children}
        <Button tone="primary" onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          Print / export PDF
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- misc atoms */

export function DefinitionGrid({
  items, cols = 4,
}: { items: { label: string; value: React.ReactNode; mono?: boolean }[]; cols?: 2 | 3 | 4 }) {
  const grid = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <dl className={cn("grid grid-cols-1 gap-x-4 gap-y-3", grid)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <Overline>{i.label}</Overline>
          <dd className={cn("mt-0.5 break-words text-text-hi", i.mono ? "t-mono" : "t-body")}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionPanel({
  title, sub, right, children, className,
}: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={className}>
      <PanelHeader title={title} sub={sub} right={right} />
      {children}
    </Panel>
  );
}

export function ReconcileNote({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={cn("t-body-sm inline-flex items-center gap-1.5", ok ? "text-ok" : "text-danger")}>
      {ok ? <Check className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
      {text}
    </span>
  );
}

export function Chip({
  tone = "neutral", children,
}: { tone?: "ok" | "warn" | "danger" | "info" | "neutral" | "sim"; children: React.ReactNode }) {
  return <StatusBadge tone={tone}>{children}</StatusBadge>;
}

export function useDebounced<T>(value: T, ms = 180): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
