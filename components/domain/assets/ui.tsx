"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Overline } from "@/components/patterns/primitives";

/**
 * The dense control-room controls Epic E5 reuses. Hairline structure, 3/5px
 * radii, no decorative shadow, ≥44px targets wherever a field surface renders.
 */

/* ------------------------------------------------------------- headings */

export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-display-md text-text-hi">{title}</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">{sub}</p>
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- buttons */

type ButtonTone = "primary" | "default" | "danger" | "ghost";

const BUTTON_TONE: Record<ButtonTone, string> = {
  primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
  default: "border-line bg-surface-1 text-text-mid hover:border-line-strong hover:text-text-hi",
  danger: "border-danger/50 bg-danger-bg text-danger hover:border-danger",
  ghost: "border-transparent bg-transparent text-text-mid hover:text-text-hi",
};

export function Button({
  tone = "default",
  className,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      type={type}
      className={cn(
        "t-body-sm inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------- toolbars */

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-2 border-b border-line bg-surface-1 px-3 py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex min-w-[13rem] flex-1 flex-col gap-1", className)}>
      <label htmlFor={id} className="t-overline text-text-lo">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo"
          aria-hidden
        />
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="t-body-sm h-8 w-full rounded-md border border-line bg-surface-0 pl-7 pr-2 text-text-hi placeholder:text-text-lo focus:border-line-strong"
        />
      </div>
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
  id: idProp,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const generated = React.useId();
  const id = idProp ?? generated;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="t-overline text-text-lo">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="t-body-sm h-8 w-full appearance-none rounded-md border border-line bg-surface-0 pl-2 pr-7 text-text-hi focus:border-line-strong disabled:opacity-50"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo"
          aria-hidden
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- form fields */

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
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="t-overline text-text-lo">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="t-body-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="t-body-sm text-text-lo">{hint}</span>
      ) : null}
    </div>
  );
}

const CONTROL =
  "t-body-sm min-h-9 w-full rounded-md border border-line bg-surface-0 px-2 py-1.5 text-text-hi placeholder:text-text-lo focus:border-line-strong disabled:opacity-55";

export function TextInput({
  className,
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(CONTROL, invalid && "border-danger", className)} {...rest} />;
}

export function TextArea({
  className,
  invalid,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(CONTROL, "min-h-[4.5rem] resize-y", invalid && "border-danger", className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, "appearance-none pr-7", className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo"
        aria-hidden
      />
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  description,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex min-h-11 items-start gap-2.5 py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border border-line-strong bg-surface-0 accent-[var(--primary-600)]"
      />
      <label htmlFor={id} className="min-w-0">
        <span className="t-body-sm block text-text-hi">{label}</span>
        {description ? <span className="t-body-sm block text-text-lo">{description}</span> : null}
      </label>
    </div>
  );
}

/** Date control. Values move as `yyyy-mm-dd`; callers convert to ISO. */
export function DateInput({
  value,
  onChange,
  invalid,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(CONTROL, invalid && "border-danger")}
      {...rest}
    />
  );
}

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fromDateInput(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 9, 0, 0).toISOString();
}

/* ---------------------------------------------------------------- modal */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-line-strong bg-surface-1 shadow-e2",
            wide ? "sm:max-w-4xl" : "sm:max-w-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="t-heading-md text-text-hi">{title}</Dialog.Title>
              <Dialog.Description className="t-body-sm mt-0.5 text-text-mid">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-0 px-4 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ----------------------------------------------------------------- tabs */

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-px overflow-hidden border-b border-line">
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
              "t-body-sm -mb-px flex min-h-9 items-center gap-2 border-b-2 px-3 py-1.5 transition-colors duration-150",
              on
                ? "border-b-primary-500 text-text-hi"
                : "border-b-transparent text-text-mid hover:text-text-hi",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span
                className={cn(
                  "t-mono rounded px-1 text-[0.6875rem]",
                  on ? "bg-primary-100 text-text-hi" : "bg-surface-2 text-text-lo",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- tables */

export function TableFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[52rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  numeric,
  scope = "col",
}: {
  children: React.ReactNode;
  className?: string;
  numeric?: boolean;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "t-overline whitespace-nowrap border-b border-line bg-surface-1 px-3 py-2 font-semibold text-text-lo",
        numeric && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  numeric,
  nowrap,
}: {
  children: React.ReactNode;
  className?: string;
  numeric?: boolean;
  nowrap?: boolean;
}) {
  return (
    <td
      className={cn(
        "t-body-sm border-b border-line px-3 py-2 align-middle text-text-mid",
        numeric && "text-right tabular-nums",
        nowrap && "whitespace-nowrap",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Row({
  children,
  className,
  tone,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "danger" | "warn" | "none";
}) {
  return (
    <tr
      className={cn(
        "h-[var(--row-h,36px)] transition-colors duration-150 hover:bg-surface-2",
        tone === "danger" && "bg-danger-bg/50",
        tone === "warn" && "bg-warn-bg/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/* ------------------------------------------------------------- fragments */

/** Serials render in mono and are never truncated. E5-S1. */
export function Serial({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("t-mono whitespace-nowrap text-text-hi", className)} title={value}>
      {value}
    </span>
  );
}

export function Metric({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "danger" | "info" | "default";
  className?: string;
}) {
  const toneClass =
    tone === "ok"
      ? "text-ok"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : tone === "info"
            ? "text-info"
            : "text-text-hi";
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3", className)}>
      <Overline>{label}</Overline>
      <span className={cn("t-display-md tabular-nums", toneClass)}>{value}</span>
      {sub ? <span className="t-body-sm text-text-lo">{sub}</span> : null}
    </div>
  );
}

/** Filtered-empty is deliberately distinct from empty. E14-S2. */
export function FilteredEmpty({
  names,
  onClear,
  entity,
}: {
  names: string[];
  onClear: () => void;
  entity: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Search className="size-7 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No {entity} match the current filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          Active: {names.length ? names.join(" · ") : "none"}. Records exist outside this
          selection.
        </p>
      </div>
      <Button onClick={onClear}>Clear filters</Button>
    </div>
  );
}

/** A blocked action always states the rule and what unblocks it. */
export function BlockedNote({ rule, unblock }: { rule: string; unblock: string }) {
  return (
    <p className="t-body-sm rounded-md border border-warn/40 bg-warn-bg px-2.5 py-2 text-warn">
      <span className="font-medium">Blocked — </span>
      {rule} <span className="text-text-mid">Unblock by {unblock}</span>
    </p>
  );
}

/** Collapsible section — the passport reads as one column on a phone. E5-S2. */
export function Section({
  title,
  sub,
  right,
  children,
  defaultOpen = true,
  id,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  id?: string;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className="size-4 shrink-0 text-text-lo transition-transform group-open:rotate-0 [details:not([open])_&]:-rotate-90"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="t-heading-md block text-text-hi">{title}</span>
            {sub ? <span className="t-body-sm block text-text-mid">{sub}</span> : null}
          </span>
        </span>
        {right ? <span className="shrink-0">{right}</span> : null}
      </summary>
      {children}
    </details>
  );
}

/** A number is a doorway to its source. Small inline definition disclosure. */
export function FormulaDisclosure({
  title,
  formula,
  note,
  defaultOpen = false,
}: {
  title: string;
  formula: string;
  note: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-md border border-line bg-surface-0 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="t-body-sm flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 py-2 text-text-mid hover:text-text-hi">
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        {title}
      </summary>
      <div className="border-t border-line px-3 py-2.5">
        <p className="t-mono break-words text-text-hi">{formula}</p>
        <p className="t-body-sm mt-1.5 text-text-mid">{note}</p>
      </div>
    </details>
  );
}
