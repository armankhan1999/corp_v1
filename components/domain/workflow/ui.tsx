"use client";

/**
 * Shared controls for the workflow surfaces. Deliberately small and unstyled
 * beyond the token set — the design law forbids decorative shadow, gradient and
 * blur, so structure is carried entirely by 1px hairlines and surface steps.
 */

import * as React from "react";
import Link from "next/link";
import {
  CircleAlert, Filter, Info, Lock, RotateCcw, ShieldAlert, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Overline } from "@/components/patterns/primitives";
import type { SlaTone } from "./engine";

/* ------------------------------------------------------------------ button */

type BtnVariant = "primary" | "default" | "danger" | "warn" | "ghost";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
  default: "border-line bg-surface-2 text-text-hi hover:border-line-strong hover:bg-surface-3",
  danger: "border-danger/50 bg-danger-bg text-danger hover:border-danger",
  warn: "border-warn/50 bg-warn-bg text-warn hover:border-warn",
  ghost: "border-transparent bg-transparent text-text-mid hover:text-text-hi hover:bg-surface-2",
};

export function Btn({
  variant = "default", size = "md", className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 px-2 text-[0.75rem]" : "h-8 px-3 text-[0.8125rem]",
        BTN_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkBtn({
  href, className, children,
}: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 text-[0.8125rem] text-text-hi hover:border-line-strong hover:bg-surface-3",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label, hint, error, htmlFor, className, children,
}: {
  label: string; hint?: string; error?: string | null; htmlFor?: string;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="t-overline text-text-lo">{label}</label>
      {children}
      {error ? (
        <p className="t-body-sm flex items-start gap-1 text-danger">
          <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="t-body-sm text-text-lo">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "h-8 w-full rounded-md border border-line bg-surface-0 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo focus:border-line-strong";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(CONTROL, "h-auto min-h-16 py-1.5 leading-relaxed", props.className)}
    />
  );
}

export function Select({
  options, className, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...rest} className={cn(CONTROL, "pr-6", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked, onChange, label, disabled, id,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] text-text-mid",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-[var(--primary-600)]"
      />
      {label}
    </label>
  );
}

/* --------------------------------------------------------------- segmented */

export function Segmented<V extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: V; onChange: (v: V) => void;
  options: { value: V; label: string; count?: number }[];
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex overflow-hidden rounded-md border border-line">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-8 items-center gap-1.5 px-3 text-[0.8125rem] transition-colors duration-150",
              i > 0 && "border-l border-line",
              active ? "bg-surface-3 text-text-hi" : "bg-surface-1 text-text-mid hover:bg-surface-2 hover:text-text-hi",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "t-mono rounded px-1 text-[0.6875rem]",
                  active ? "bg-surface-0 text-text-mid" : "bg-surface-2 text-text-lo",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ SLA meter */

const SLA_TOKEN: Record<SlaTone, { bar: string; text: string; label: string }> = {
  comfortable: { bar: "var(--sla-comfortable)", text: "text-[var(--sla-comfortable)]", label: "Within SLA" },
  approaching: { bar: "var(--sla-approaching)", text: "text-[var(--sla-approaching)]", label: "Approaching SLA" },
  imminent: { bar: "var(--sla-imminent)", text: "text-[var(--sla-imminent)]", label: "SLA imminent" },
  breached: { bar: "var(--sla-breached)", text: "text-[var(--sla-breached)]", label: "SLA elapsed" },
};

export function SlaMeter({
  tone, fraction, caption, compact,
}: { tone: SlaTone; fraction: number; caption: string; compact?: boolean }) {
  const t = SLA_TOKEN[tone];
  const width = Math.max(2, Math.min(100, Math.round(fraction * 100)));
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"
          role="img"
          aria-label={`${t.label}. ${caption}`}
        >
          <div className="h-full rounded-full" style={{ width: `${width}%`, background: t.bar }} />
        </div>
        {!compact ? <span className={cn("t-overline shrink-0", t.text)}>{t.label}</span> : null}
      </div>
      <p className="t-body-sm mt-1 text-text-lo">{caption}</p>
    </div>
  );
}

/* ------------------------------------------------------------ state panels */

export function FilteredEmpty({
  filters, onClear, what = "records",
}: { filters: string[]; onClear: () => void; what?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Filter className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No {what} match the current filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">
          {filters.length
            ? `Active: ${filters.join(" · ")}. Widen or clear them to see the full set.`
            : "Widen or clear the filters to see the full set."}
        </p>
      </div>
      <Btn onClick={onClear}>
        <RotateCcw className="size-3.5" aria-hidden /> Clear filters
      </Btn>
    </div>
  );
}

export function ErrorPanel({
  cause, onRetry, escape,
}: { cause: string; onRetry?: () => void; escape?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <CircleAlert className="size-8 text-danger" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">This panel could not be built</p>
        <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">{cause}</p>
      </div>
      <div className="flex gap-2">
        {onRetry ? <Btn onClick={onRetry}>Try again</Btn> : null}
        {escape ? <LinkBtn href={escape.href}>{escape.label}</LinkBtn> : null}
      </div>
    </div>
  );
}

/**
 * E11-S2 AC — where a viewer has data access but no approval authority, no
 * decision control is rendered and the interface names the role that holds it.
 */
export function AuthorityNote({
  message, authorityLabel, icon = "lock", className,
}: { message: string; authorityLabel?: string | null; icon?: "lock" | "shield"; className?: string }) {
  const Icon = icon === "shield" ? ShieldAlert : Lock;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2",
        className,
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
      <div className="min-w-0">
        <p className="t-body-sm text-text-mid">{message}</p>
        {authorityLabel ? (
          <p className="t-body-sm mt-0.5 text-text-hi">
            Authority: <span className="font-medium">{authorityLabel}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Note({
  tone = "info", children, className,
}: { tone?: "info" | "warn" | "sim" | "neutral"; children: React.ReactNode; className?: string }) {
  const map = {
    info: "border-info/40 bg-info-bg text-info",
    warn: "border-warn/40 bg-warn-bg text-warn",
    sim: "border-sim/50 bg-sim-bg text-sim",
    neutral: "border-line bg-surface-2 text-text-mid",
  } as const;
  return (
    <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2", map[tone], className)}>
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="t-body-sm min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ toasts */

export interface ToastItem {
  id: number;
  tone: "ok" | "danger" | "warn" | "info";
  title: string;
  body?: string;
}

export function useToasts() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);
  const push = React.useCallback((tone: ToastItem["tone"], title: string, body?: string) => {
    const id = nextId.current++;
    setItems((s) => [...s, { id, tone, title, body }]);
    window.setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 6000);
  }, []);
  const dismiss = React.useCallback((id: number) => setItems((s) => s.filter((t) => t.id !== id)), []);
  return { items, push, dismiss };
}

const TOAST_TONE = {
  ok: "border-ok/50 bg-ok-bg text-ok",
  danger: "border-danger/50 bg-danger-bg text-danger",
  warn: "border-warn/50 bg-warn-bg text-warn",
  info: "border-info/50 bg-info-bg text-info",
} as const;

export function ToastStack({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  if (!items.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={cn("pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2", TOAST_TONE[t.tone])}
        >
          <div className="min-w-0 flex-1">
            <p className="t-body-sm font-medium">{t.title}</p>
            {t.body ? <p className="t-body-sm mt-0.5 text-text-mid">{t.body}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- data bits */

export function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: "hi" | "ok" | "warn" | "danger" }) {
  const color =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-text-hi";
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2">
      <Overline>{label}</Overline>
      <span className={cn("t-heading-lg tabular-nums", color)}>{value}</span>
      {sub ? <span className="t-body-sm text-text-lo">{sub}</span> : null}
    </div>
  );
}

export function DataRow({
  label, children, mono,
}: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="t-body-sm shrink-0 text-text-lo">{label}</span>
      <span className={cn("t-body-sm min-w-0 text-right text-text-hi", mono && "t-mono")}>{children}</span>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
      <Overline className="text-text-mid">{children}</Overline>
      {right}
    </div>
  );
}
