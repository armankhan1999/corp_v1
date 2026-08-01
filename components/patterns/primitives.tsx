import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Circle, Info, TriangleAlert } from "lucide-react";

/**
 * Panel — the base surface. `.panel` carries the hairline, the ambient shadow
 * and the 1px top highlight that makes a dark card read as an object rather
 * than a flat region. `hero` promotes it for the one figure that carries the
 * room; `lift` adds the hover response used on clickable cards.
 */
export function Panel({
  className, hero, lift, children, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hero?: boolean; lift?: boolean }) {
  return (
    <div
      className={cn(hero ? "panel-hero" : "panel", lift && "lift", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title, sub, right, className,
}: { title: string; sub?: string; right?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-start justify-between gap-4 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="t-heading-md text-text-hi">{title}</h2>
        {sub ? <p className="t-body-sm mt-0.5 text-text-mid">{sub}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Overline({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("t-overline text-text-lo", className)}>{children}</span>;
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("t-mono text-text-hi", className)}>{children}</span>;
}

/* Status badge — colour is never the only signal. WCAG 2.2 / NFR-09 */
type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "sim";

const TONE_STYLES: Record<Tone, { bg: string; fg: string; border: string }> = {
  ok: { bg: "bg-ok-bg", fg: "text-ok", border: "border-ok/40" },
  warn: { bg: "bg-warn-bg", fg: "text-warn", border: "border-warn/40" },
  danger: { bg: "bg-danger-bg", fg: "text-danger", border: "border-danger/40" },
  info: { bg: "bg-info-bg", fg: "text-info", border: "border-info/40" },
  neutral: { bg: "bg-surface-2", fg: "text-text-mid", border: "border-line" },
  sim: { bg: "bg-sim-bg", fg: "text-sim", border: "border-sim/50" },
};

const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = {
  ok: Check, warn: TriangleAlert, danger: AlertTriangle, info: Info, neutral: Circle, sim: Info,
};

export function StatusBadge({
  tone = "neutral", children, icon = true, className,
}: { tone?: Tone; children: React.ReactNode; icon?: boolean; className?: string }) {
  const s = TONE_STYLES[tone];
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 rounded-md border px-2 py-1 whitespace-nowrap",
        s.bg, s.fg, s.border, className,
      )}
    >
      {icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

/**
 * DP-5 / FR-M1-16 — every simulated integration is visibly marked, never behind
 * hover alone, and the chip links to the Integration Readiness screen.
 */
export function SimulatedBadge({ what, className }: { what?: string; className?: string }) {
  return (
    <a
      href="/admin/integrations"
      title={what ? `Simulated — ${what}. Open Integration Readiness for the Phase 2 prerequisites.` : "Simulated integration. Open Integration Readiness for the Phase 2 prerequisites."}
      className={cn(
        "t-overline inline-flex items-center gap-1 rounded-md border border-sim/60 bg-sim-bg px-1.5 py-0.5 text-sim hover:border-sim",
        className,
      )}
    >
      <Info className="size-3" aria-hidden />
      Simulated
    </a>
  );
}

/* E14-S2 — empty state is never a bare "No data" */
export function EmptyState({
  icon: Icon = Circle, title, body, action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string; body: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <Icon className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">{title}</p>
        <p className="t-body-sm mx-auto mt-1 max-w-md text-text-mid">{body}</p>
      </div>
      {action}
    </div>
  );
}

/* Skeleton matches final geometry so the page does not reflow. E14-S2 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("pv-skeleton", className)} aria-hidden />;
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Overline>{label}</Overline>
      <span className="t-body text-text-hi">{children}</span>
    </div>
  );
}
