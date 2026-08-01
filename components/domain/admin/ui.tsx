"use client";

/**
 * Shared control-room furniture for the Admin screens. Deliberately small and
 * local: hairlines, 3/5px radii, no shadow except on overlays, colour never the
 * only signal, and every blocked or destructive path carries its own words.
 */

import * as React from "react";
import { AlertTriangle, Ban, Check, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- button */

type BtnTone = "default" | "primary" | "danger" | "ghost";

const BTN_TONE: Record<BtnTone, string> = {
  default: "border-line bg-surface-2 text-text-mid hover:border-line-strong hover:text-text-hi",
  primary: "border-primary-600 bg-primary-600 text-white hover:bg-primary-500 hover:border-primary-500",
  danger: "border-danger/60 bg-danger-bg text-danger hover:border-danger",
  ghost: "border-transparent bg-transparent text-text-mid hover:bg-surface-2 hover:text-text-hi",
};

export function Btn({
  tone = "default",
  icon: Icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: BtnTone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      className={cn(
        "t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45",
        BTN_TONE[tone],
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- callout */

type CalloutTone = "info" | "warn" | "danger" | "ok" | "sim";

const CALLOUT: Record<CalloutTone, { box: string; fg: string; Icon: React.ComponentType<{ className?: string }> }> = {
  info: { box: "border-info/40 bg-info-bg", fg: "text-info", Icon: Info },
  warn: { box: "border-warn/40 bg-warn-bg", fg: "text-warn", Icon: TriangleAlert },
  danger: { box: "border-danger/40 bg-danger-bg", fg: "text-danger", Icon: AlertTriangle },
  ok: { box: "border-ok/40 bg-ok-bg", fg: "text-ok", Icon: Check },
  sim: { box: "border-sim/50 bg-sim-bg", fg: "text-sim", Icon: Info },
};

export function Callout({
  tone = "info",
  title,
  children,
  right,
  className,
}: {
  tone?: CalloutTone;
  title: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const c = CALLOUT[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", c.box, className)}>
      <c.Icon className={cn("mt-0.5 size-4 shrink-0", c.fg)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("t-body font-medium", c.fg)}>{title}</p>
        {children ? <div className="t-body-sm mt-1 text-text-mid">{children}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  sub,
  footer,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  const panel = React.useRef<HTMLDivElement | null>(null);
  const prior = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    prior.current = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>(
      "input,select,textarea,button:not([data-modal-close])",
    );
    (first ?? node)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const firstEl = focusables[0]!;
      const lastEl = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const el = prior.current;
      if (el && document.body.contains(el)) el.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--overlay)] p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
        style={{ width, maxWidth: "100%", boxShadow: "var(--shadow-e2)" }}
        className="mt-[6vh] rounded-md border border-line-strong bg-surface-1"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="t-heading-md text-text-hi">
              {title}
            </h2>
            {sub ? <p className="t-body-sm mt-0.5 text-text-mid">{sub}</p> : null}
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="t-overline text-text-lo">{label}</span>
      {children}
      {error ? (
        <span className="t-body-sm flex items-center gap-1 text-danger">
          <AlertTriangle className="size-3" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="t-body-sm text-text-lo">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  "h-8 w-full rounded-md border border-line bg-surface-0 px-2 text-[0.8125rem] text-text-hi outline-none placeholder:text-text-lo focus:border-line-strong";

export function TextInput({
  mono,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input type="text" className={cn(CONTROL, mono && "t-mono", className)} {...rest} />;
}

export function NumberInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cn(CONTROL, "t-mono text-right", className)}
      {...rest}
    />
  );
}

export function DateInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" className={cn(CONTROL, "t-mono", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "pr-1", className)} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-line bg-surface-0 px-2 py-1.5 text-[0.8125rem] text-text-hi outline-none placeholder:text-text-lo focus:border-line-strong",
        className,
      )}
      {...rest}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  sub,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 accent-[var(--primary-600)]"
      />
      <span className="min-w-0">
        <span className="t-body-sm block text-text-hi">{label}</span>
        {sub ? <span className="t-body-sm block text-text-lo">{sub}</span> : null}
      </span>
    </label>
  );
}

/* ----------------------------------------------------- blocked + confirm */

/**
 * The canonical blocked-action state: the rule, the count that proves it, and
 * the route that would unblock it. E14-S2.
 */
export function BlockedDialog({
  open,
  onClose,
  what,
  count,
  refLabel,
  onDeactivate,
  canDeactivate,
  alreadyInactive,
  systemReason,
}: {
  open: boolean;
  onClose: () => void;
  what: string;
  count: number;
  refLabel: string;
  onDeactivate?: () => void;
  canDeactivate: boolean;
  alreadyInactive: boolean;
  systemReason?: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deletion blocked"
      sub={what}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          {canDeactivate && onDeactivate && !alreadyInactive ? (
            <Btn tone="primary" icon={Ban} onClick={onDeactivate}>
              Deactivate instead
            </Btn>
          ) : null}
        </>
      }
    >
      <Callout tone="danger" title={systemReason ? "This value is structural" : `Referenced by ${count} existing ${count === 1 ? "record" : "records"}`}>
        {systemReason ? (
          <p>{systemReason}</p>
        ) : (
          <p>
            {refLabel}. Deleting it would orphan those records and break the figures derived from
            them, so the platform refuses.
          </p>
        )}
      </Callout>
      <div className="mt-3 flex flex-col gap-2">
        <p className="t-body-sm text-text-mid">
          <span className="text-text-hi">What would unblock it: </span>
          {systemReason
            ? "Nothing in this release — the value is part of the platform's structure."
            : `re-point or close all ${count} referencing ${count === 1 ? "record" : "records"}, after which the value becomes deletable.`}
        </p>
        {!systemReason ? (
          <p className="t-body-sm text-text-mid">
            <span className="text-text-hi">What you can do now: </span>
            {alreadyInactive
              ? "the value is already deactivated — it stays readable on historical records but cannot be chosen on a new one."
              : "deactivate it. Historical records keep their value and read correctly; it simply stops appearing in new-record pickers."}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Destructive confirmation — explicit by default, typed when `typeToConfirm`. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  typeToConfirm,
  tone = "danger",
  consequence,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  typeToConfirm?: string;
  tone?: "danger" | "primary";
  consequence?: string;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const ok = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            tone={tone}
            disabled={!ok}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <div className="t-body-sm flex flex-col gap-3 text-text-mid">
        <div>{body}</div>
        {consequence ? <Callout tone="warn" title={consequence} /> : null}
        <p className="t-body-sm text-text-lo">This action is written to the audit log.</p>
        {typeToConfirm ? (
          <Field
            label={`Type ${typeToConfirm} to confirm`}
            hint="Typed confirmation is required because the change is not reversible from this screen."
          >
            <TextInput
              mono
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              autoComplete="off"
            />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ empty states */

export function FilteredEmpty({
  active,
  onClear,
}: {
  active: string[];
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <Ban className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No rows match the current filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          {active.length > 0 ? (
            <>
              Filtering by <span className="text-text-hi">{active.join(", ")}</span>. Widen or clear
              a filter to see rows again.
            </>
          ) : (
            "Widen the search to see rows again."
          )}
        </p>
      </div>
      <Btn onClick={onClear} icon={X}>
        Clear filters
      </Btn>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="t-body-sm inline-flex items-center gap-2 text-text-lo">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------- header */

export function PageHead({
  title,
  lede,
  right,
  meta,
}: {
  title: string;
  lede: string;
  right?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-3xl">
        <h1 className="t-display-md text-text-hi">{title}</h1>
        <p className="t-body-sm mt-1 text-text-mid">{lede}</p>
        {meta}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- table */

export function Th({
  children,
  className,
  align = "left",
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn(
        "t-overline whitespace-nowrap border-b border-line bg-surface-2 px-3 py-2 font-semibold text-text-lo",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  mono,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right"; mono?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-line px-3 py-1.5 text-text-mid",
        align === "right" ? "text-right tabular-nums" : "text-left",
        mono ? "t-mono" : "t-body-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
