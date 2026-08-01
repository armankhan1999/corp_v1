"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { CircleAlert, Info, Lock, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, Overline, Skeleton } from "@/components/patterns/primitives";

/* ------------------------------------------------------------ page frame */

export function PageHeader({
  title, lead, right, meta,
}: {
  title: string;
  lead: string;
  right?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-display-md text-text-hi">{title}</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">{lead}</p>
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- buttons */

type BtnVariant = "primary" | "default" | "ghost" | "danger";

const BTN: Record<BtnVariant, string> = {
  primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
  default: "border-line bg-surface-1 text-text-mid hover:border-line-strong hover:text-text-hi",
  ghost: "border-transparent bg-transparent text-text-mid hover:text-text-hi hover:bg-surface-2",
  danger: "border-danger/50 bg-danger-bg text-danger hover:border-danger",
};

export function Btn({
  variant = "default", size = "md", className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 px-2 text-[0.75rem]" : "h-8 px-3 text-[0.8125rem]",
        BTN[variant], className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkBtn({
  href, variant = "default", size = "md", className, children,
}: {
  href: string; variant?: BtnVariant; size?: "sm" | "md"; className?: string; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border transition-colors duration-150",
        size === "sm" ? "h-7 px-2 text-[0.75rem]" : "h-8 px-3 text-[0.8125rem]",
        BTN[variant], className,
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- fields */

let fieldSeq = 0;
function useFieldId(explicit?: string) {
  const [id] = React.useState(() => explicit ?? `pv-f${++fieldSeq}`);
  return id;
}

export function Field({
  label, hint, error, required, children, id, className,
}: {
  label: string; hint?: string; error?: string | null; required?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
  id?: string; className?: string;
}) {
  const fid = useFieldId(id);
  const describedBy = error ? `${fid}-err` : hint ? `${fid}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={fid} className="t-label text-text-mid">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden>*</span> : null}
      </label>
      {children({ id: fid, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${fid}-err`} role="alert" className="t-body-sm flex items-start gap-1 text-danger">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${fid}-hint`} className="t-body-sm text-text-lo">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "h-8 w-full min-w-0 rounded-md border bg-surface-0 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo focus-visible:border-primary-500 disabled:opacity-50 aria-[invalid=true]:border-danger";

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "border-line", className)} {...rest} />;
}

export function NumberInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cn(CONTROL, "border-line text-right tabular-nums", className)}
      {...rest}
    />
  );
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(CONTROL, "h-auto border-line py-1.5 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "border-line pr-6", className)} {...rest}>
      {children}
    </select>
  );
}

/* ---------------------------------------------------------------- tables */

export function TableFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-max border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children, right, className, ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "t-overline sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface-2 px-3 py-2 font-semibold text-text-lo",
        right && "text-right",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children, right, mono, className, ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean; mono?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 text-[0.8125rem] text-text-mid",
        right && "text-right tabular-nums",
        mono && "t-mono",
        className,
      )}
      style={{ height: "var(--row-h, 36px)" }}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors duration-150 hover:bg-surface-2", className)} {...rest}>
      {children}
    </tr>
  );
}

/* ------------------------------------------------------- interaction states */

export function TableSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <TableFrame>
      <thead>
        <tr>
          {Array.from({ length: cols }, (_, i) => (
            <Th key={i}><Skeleton className="h-2.5 w-16" /></Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }, (_, c) => (
              <td key={c} className="border-b border-line px-3" style={{ height: "var(--row-h, 36px)" }}>
                <Skeleton className={cn("h-2.5", c === 0 ? "w-28" : c % 3 === 0 ? "w-12" : "w-20")} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

export function PageSkeleton({ title, cols = 7 }: { title: string; cols?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">{title}</h1>
        <Skeleton className="mt-2 h-2.5 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Panel key={i} className="p-3">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="mt-3 h-6 w-28" />
            <Skeleton className="mt-2 h-2 w-24" />
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        <TableSkeleton cols={cols} />
      </Panel>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Panel className="p-6">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0">
          <p className="t-heading-md text-text-hi">The sales data could not be built</p>
          <p className="t-body-sm mt-1 text-text-mid">{message}</p>
          <p className="t-body-sm mt-1 text-text-lo">
            Nothing was written. The seeded dataset is deterministic, so a retry rebuilds the identical world.
          </p>
          <Btn className="mt-3" onClick={onRetry}>
            <RotateCcw className="size-3.5" aria-hidden />
            Retry
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

export function FilteredEmpty({
  activeFilters, onClear, noun = "records",
}: { activeFilters: string[]; onClear: () => void; noun?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Info className="size-7 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No {noun} match the current filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          Active: {activeFilters.join(" · ")}. Records exist outside this filter set — widen it or clear it to see them.
        </p>
      </div>
      <Btn onClick={onClear}>
        <X className="size-3.5" aria-hidden />
        Clear filters
      </Btn>
    </div>
  );
}

/** Blocked action — states the rule and what would unblock it. E14-S2. */
export function BlockedNotice({
  reason, remedy, action, className,
}: { reason: string; remedy?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2 rounded-md border border-warn/40 bg-warn-bg px-3 py-2", className)}
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="t-body-sm font-medium text-warn">Blocked — {reason}</p>
        {remedy ? <p className="t-body-sm mt-0.5 text-text-mid">{remedy}</p> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Notice({
  tone = "info", title, children, icon: Icon = Info, className,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title: string;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const styles = {
    info: "border-info/40 bg-info-bg text-info",
    warn: "border-warn/40 bg-warn-bg text-warn",
    danger: "border-danger/40 bg-danger-bg text-danger",
    ok: "border-ok/40 bg-ok-bg text-ok",
  }[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="t-body-sm font-medium">{title}</p>
        {children ? <div className="t-body-sm mt-0.5 text-text-mid">{children}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- modal */

export function Modal({
  open, onOpenChange, title, description, children, footer, wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-md border border-line-strong bg-surface-1 shadow-e2",
            wide ? "max-w-4xl" : "max-w-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="t-heading-md text-text-hi">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="t-body-sm mt-0.5 text-text-mid">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* --------------------------------------------------------------- bits */

export function Stat({
  label, value, sub, href, tone,
}: {
  label: string; value: string; sub?: string; href?: string;
  tone?: "ok" | "warn" | "danger" | "info";
}) {
  const toneClass = tone ? { ok: "text-ok", warn: "text-warn", danger: "text-danger", info: "text-info" }[tone] : "text-text-hi";
  const body = (
    <>
      <Overline>{label}</Overline>
      <span className={cn("t-display-md block tabular-nums", toneClass)}>{value}</span>
      {sub ? <span className="t-body-sm block text-text-lo">{sub}</span> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex h-full flex-col gap-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3 transition-colors duration-150 hover:border-line-strong"
    >
      {body}
    </Link>
  ) : (
    <div className="flex h-full flex-col gap-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">{body}</div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-line bg-surface-1 px-3 py-2.5">{children}</div>
  );
}

export function InlineLabel({ children }: { children: React.ReactNode }) {
  return <span className="t-overline text-text-lo">{children}</span>;
}

/** A number that opens the records behind it. Design law: every number clicks. */
export function NumLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("tabular-nums text-text-hi underline decoration-line-strong underline-offset-2 hover:decoration-primary-500", className)}
    >
      {children}
    </Link>
  );
}

export function Meter({ pct, tone = "info" }: { pct: number; tone?: "ok" | "warn" | "danger" | "info" }) {
  const bg = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", info: "bg-primary-500" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-surface-3">
      <div className={cn("h-full", bg)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
