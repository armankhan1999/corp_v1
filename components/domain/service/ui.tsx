"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Ban, FilterX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Overline } from "@/components/patterns/primitives";

/**
 * Service-desk control kit. Restyled to the industrial register — hairlines,
 * 3/5px radii, no shadow, no rounded-pill defaults. Radix supplies the dialog
 * so focus trapping, Escape and aria-modal are handled properly (WCAG 2.2).
 */

/* ---------------------------------------------------------------- buttons */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md border t-body-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary:
    "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
  secondary: "border-line bg-surface-2 text-text-hi hover:border-line-strong",
  ghost: "border-line bg-transparent text-text-mid hover:border-line-strong hover:text-text-hi",
  danger: "border-danger/60 bg-danger-bg text-danger hover:border-danger",
  quiet: "border-transparent bg-transparent text-text-mid hover:text-text-hi",
};

const BTN_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "h-7 px-2",
  md: "h-9 px-3",
  lg: "min-h-11 px-4 py-2 text-[0.9375rem]",
};

export function Btn({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" }) {
  return <button type="button" className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)} {...rest} />;
}

export function btnClass(variant: BtnVariant = "secondary", size: "sm" | "md" | "lg" = "md") {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size]);
}

/* ----------------------------------------------------------------- inputs */

export function Field({
  label, hint, required, error, htmlFor, children, className,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="t-overline text-text-lo">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="t-body-sm flex items-center gap-1 text-danger">
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="t-body-sm text-text-lo">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border border-line bg-surface-2 px-2.5 py-2 t-body text-text-hi placeholder:text-text-lo focus:border-line-strong";

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-9", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-20 resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "h-9 appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/** Preset chip. 44px minimum on field surfaces, per E4-S5. */
export function Chip({
  selected, touch, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; touch?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-md border px-3 text-left t-body-sm transition-colors duration-150",
        touch ? "min-h-11 py-2.5" : "min-h-8 py-1.5",
        selected
          ? "border-primary-500 bg-primary-100 text-text-hi"
          : "border-line bg-surface-2 text-text-mid hover:border-line-strong hover:text-text-hi",
        className,
      )}
      {...rest}
    />
  );
}

/* ---------------------------------------------------------------- callout */

type Tone = "info" | "warn" | "danger" | "ok" | "neutral";

const TONE_CLASS: Record<Tone, { box: string; text: string; icon: string }> = {
  info: { box: "border-info/40 bg-info-bg", text: "text-info", icon: "text-info" },
  warn: { box: "border-warn/40 bg-warn-bg", text: "text-warn", icon: "text-warn" },
  danger: { box: "border-danger/45 bg-danger-bg", text: "text-danger", icon: "text-danger" },
  ok: { box: "border-ok/40 bg-ok-bg", text: "text-ok", icon: "text-ok" },
  neutral: { box: "border-line bg-surface-2", text: "text-text-mid", icon: "text-text-lo" },
};

export function Callout({
  tone = "info", title, icon: Icon = Info, children, className, action,
}: {
  tone?: Tone;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const c = TONE_CLASS[tone];
  return (
    <div className={cn("rounded-lg border p-3", c.box, className)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", c.icon)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn("t-body font-medium", c.text)}>{title}</p>
          {children ? <div className="t-body-sm mt-1 text-text-mid">{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * E14-S2 blocked-action state: state the rule, and state what would unblock it.
 * Never a disabled control with no explanation.
 */
export function BlockedNotice({
  rule, unblock, className,
}: {
  rule: string;
  unblock: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-warn/45 bg-warn-bg p-3", className)} role="status">
      <p className="t-body flex items-start gap-2 font-medium text-warn">
        <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
        {rule}
      </p>
      <div className="t-body-sm mt-1.5 pl-6 text-text-mid">{unblock}</div>
    </div>
  );
}

/* --------------------------------------------------------------- dialog */

export function Modal({
  open, onOpenChange, title, description, children, footer, wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
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
            "fixed left-1/2 top-1/2 z-50 max-h-[88dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-line-strong bg-surface-1",
            wide ? "max-w-3xl" : "max-w-lg",
          )}
          style={{ boxShadow: "var(--shadow-e2)" }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="t-heading-md text-text-hi">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="t-body-sm mt-0.5 text-text-mid">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
              aria-label="Close dialog"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="p-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------ empty states */

export function FilteredEmpty({
  filters, onClear,
}: {
  filters: string[];
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <FilterX className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No records match these filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          Active filters — {filters.join(" · ")}. The records exist; this combination excludes all
          of them.
        </p>
      </div>
      <Btn variant="secondary" onClick={onClear}>
        <FilterX className="size-4" aria-hidden />
        Clear filters
      </Btn>
    </div>
  );
}

/* -------------------------------------------------------------- key value */

export function Row({
  label, children, mono, className,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="t-body-sm shrink-0 text-text-lo">{label}</dt>
      <dd className={cn("min-w-0 text-right text-text-hi", mono ? "t-mono" : "t-body-sm")}>
        {children}
      </dd>
    </div>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
      <Overline>{children}</Overline>
      {right}
    </div>
  );
}

/** Serial numbers are always mono and never truncated. Design law. */
export function Serial({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("t-mono whitespace-nowrap text-text-hi", className)}>{children}</span>
  );
}
