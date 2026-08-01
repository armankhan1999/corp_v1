import * as React from "react";
import { FileCheck, ShieldCheck, ShieldOff } from "lucide-react";
import type { CoverageState } from "@/lib/schemas/enums";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * E5-S3 — coverage is derived, never stored and never editable. This renders a
 * static span: there is deliberately no control, no select and no click target
 * that could change a machine's coverage anywhere in the platform. The value
 * always arrives from `D.coverageState` (server) or its documented client
 * mirror in `store.ts` for rows the browser overlay has changed.
 */

const META: Record<
  CoverageState,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  IN_WARRANTY: {
    label: "In warranty",
    icon: ShieldCheck,
    cls: "border-ok/40 bg-ok-bg text-ok",
  },
  UNDER_AMC: {
    label: "Under AMC",
    icon: FileCheck,
    cls: "border-info/40 bg-info-bg text-info",
  },
  OUT_OF_COVERAGE: {
    label: "Out of coverage",
    icon: ShieldOff,
    cls: "border-danger/40 bg-danger-bg text-danger",
  },
};

export function CoverageBadge({
  state,
  className,
  title,
}: {
  state: CoverageState;
  className?: string;
  title?: string;
}) {
  const meta = META[state];
  const Icon = meta.icon;
  return (
    <span
      aria-readonly="true"
      title={title ?? "Derived from warranty end date and live AMC. Read-only."}
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5",
        meta.cls,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}

/**
 * In Warranty takes precedence. Where an AMC is concurrently live it is shown
 * as additionally in force rather than replacing the warranty state.
 */
export function AmcAlsoInForce({
  amcNumber,
  amcEnd,
  className,
}: {
  amcNumber: string;
  amcEnd: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 text-text-mid",
        className,
      )}
      title={`AMC ${amcNumber} is additionally in force${amcEnd ? ` to ${formatDate(amcEnd)}` : ""}`}
    >
      <FileCheck className="size-3 shrink-0" aria-hidden />
      AMC also in force
    </span>
  );
}

/** The derivation, stated in words wherever coverage is consequential. */
export function CoverageDerivation({
  state,
  warrantyEnd,
  amcNumber,
  amcEnd,
  decommissioned,
  now,
}: {
  state: CoverageState;
  warrantyEnd: string | null;
  amcNumber: string | null;
  amcEnd: string | null;
  decommissioned: boolean;
  now: Date;
}) {
  const lines: string[] = [];
  if (decommissioned) {
    lines.push(
      "Asset is decommissioned, so it is excluded from coverage and renewal calculations and resolves to Out of coverage.",
    );
  } else if (warrantyEnd && new Date(warrantyEnd) > now) {
    lines.push(
      `Warranty end ${formatDate(warrantyEnd)} is after the simulated date, so the state is In warranty. Warranty start is the commissioning date, not the invoice date; the duration comes from the product-line configuration.`,
    );
    if (amcNumber) {
      lines.push(
        `AMC ${amcNumber} is live${amcEnd ? ` to ${formatDate(amcEnd)}` : ""}. Warranty takes precedence, so the contract is shown as additionally in force.`,
      );
    }
  } else if (amcNumber && amcEnd) {
    lines.push(
      `No live warranty${warrantyEnd ? ` — it ended ${formatDate(warrantyEnd)}` : ""}. AMC ${amcNumber} runs to ${formatDate(amcEnd)}, so the state is Under AMC.`,
    );
  } else {
    lines.push(
      `No live warranty${warrantyEnd ? ` — it ended ${formatDate(warrantyEnd)}` : " — no commissioning date recorded"} and no live AMC contract, so the state is Out of coverage.`,
    );
  }
  lines.push(
    "Coverage is computed on every read against the simulated clock. It has no editable control anywhere in the platform; advancing the clock changes it automatically and the transition is written to the audit log.",
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <CoverageBadge state={state} />
        <span className="t-overline text-text-lo">Derived · read-only</span>
      </div>
      {lines.map((l) => (
        <p key={l} className="t-body-sm text-text-mid">
          {l}
        </p>
      ))}
    </div>
  );
}
