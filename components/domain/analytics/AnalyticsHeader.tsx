"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, Download, GitCompareArrows, Lock, MapPin, Printer } from "lucide-react";
import { StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import {
  BASIS_IN_WORDS, BASIS_KEYS, BASIS_LABEL, PERIOD_KEYS, PERIOD_LABEL,
  type BasisKey, type PeriodKey,
} from "./scope";
import { buildCsv, downloadCsv, printSurface, type Provenance } from "./exportUtils";

/**
 * E12-S1 — the same header on all five surfaces.
 *
 * Period, branch scope and comparison basis are written to the URL. The surface
 * is a server component, so changing any of the three re-runs every formula
 * against the new window rather than filtering an already-computed view — which
 * is the only way the recomputation claim is true rather than approximately true.
 */

export interface HeaderProps {
  title: string;
  intent: string;
  period: PeriodKey;
  basis: BasisKey;
  branchId: string | null;
  branchOptions: { id: string; label: string }[];
  branchLocked: boolean;
  lockReason: string | null;
  scopeStatement: string;
  periodRange: string;
  provenance: Provenance;
  /** Whole-surface CSV, assembled by the surface from every series it renders. */
  csvSections: { title: string; rows: string[][] }[];
  csvName: string;
}

export function AnalyticsHeader(props: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, setPending] = React.useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "" || value === "ALL") next.delete(key);
    else next.set(key, value);
    setPending(key);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  React.useEffect(() => {
    setPending(null);
  }, [params]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-display-md text-text-hi">{props.title}</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">{props.intent}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            data-testid="export-csv"
            onClick={() => downloadCsv(props.csvName, buildCsv(props.provenance, props.csvSections))}
            className="t-body-sm flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <Download className="size-3.5" aria-hidden />
            CSV
          </button>
          <button
            type="button"
            data-testid="export-pdf"
            onClick={printSurface}
            className="t-body-sm flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <Printer className="size-3.5" aria-hidden />
            Print / PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] px-3 py-2 print:hidden">
        <Control
          icon={Calendar}
          label="Period"
          value={props.period}
          onChange={(v) => setParam("period", v)}
          options={PERIOD_KEYS.map((k) => ({ value: k, label: PERIOD_LABEL[k] }))}
          busy={pending === "period"}
          testid="period-select"
        />
        <Control
          icon={MapPin}
          label="Branch scope"
          value={props.branchId ?? "ALL"}
          onChange={(v) => setParam("branch", v)}
          options={props.branchOptions.map((b) => ({ value: b.id, label: b.label }))}
          disabled={props.branchLocked}
          busy={pending === "branch"}
          testid="branch-select"
        />
        <Control
          icon={GitCompareArrows}
          label="Comparison basis"
          value={props.basis}
          onChange={(v) => setParam("basis", v)}
          options={BASIS_KEYS.map((k) => ({ value: k, label: BASIS_LABEL[k] }))}
          busy={pending === "basis"}
          testid="basis-select"
        />

        <span className="t-body-sm ml-auto text-text-lo">{props.periodRange}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {props.branchLocked ? (
          <StatusBadge tone="info">
            <Lock className="size-3" aria-hidden />
            Scope locked
          </StatusBadge>
        ) : null}
        <p className="t-body-sm text-text-mid">
          {props.scopeStatement}
          {props.branchLocked && props.lockReason ? ` ${props.lockReason}` : ""}
        </p>
      </div>

      <p className="t-body-sm text-text-lo">
        Every figure below is computed {BASIS_IN_WORDS[props.basis] === BASIS_IN_WORDS.NONE ? "without a comparison" : BASIS_IN_WORDS[props.basis]}
        , from platform records by the shared KPI implementation. No figure on this surface is stored or hand-entered.
      </p>

      {/* Provenance block — hidden on screen, printed on the face of the PDF. E12-S4 */}
      <PrintProvenance p={props.provenance} />
    </div>
  );
}

function Control({
  icon: Icon, label, value, options, onChange, disabled, busy, testid,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  busy?: boolean;
  testid: string;
}) {
  const id = `ah-${testid}`;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-text-lo" aria-hidden />
      <label htmlFor={id} className="t-overline text-text-lo">
        {label}
      </label>
      <select
        id={id}
        data-testid={testid}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "t-body-sm h-8 rounded-md border border-line bg-surface-2 px-2 text-text-hi",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-info",
          disabled && "cursor-not-allowed opacity-60",
          busy && "animate-pulse",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PrintProvenance({ p }: { p: Provenance }) {
  return (
    <dl className="hidden border border-line p-3 print:block">
      <p className="t-heading-md">Pravaah — {p.surface}</p>
      <Row label="Period" value={`${p.periodLabel} (${p.periodRange})`} />
      <Row label="Branch scope" value={p.branchLabel} />
      <Row label="Scope applied" value={p.scopeStatement} />
      <Row label="Comparison basis" value={p.basisInWords} />
      <Row label="Active filters" value={p.filters.join(" · ") || "None"} />
      <Row label="Generated" value={`${p.generatedAt} by ${p.generatedBy}`} />
      <Row label="Simulated platform clock" value={p.simulatedClock} />
      <Row
        label="Basis of figures"
        value="Computed from platform records by the shared KPI implementation. No figure is stored or hand-entered."
      />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-0.5">
      <dt className="t-overline w-44 shrink-0">{label}</dt>
      <dd className="t-body-sm">{value}</dd>
    </div>
  );
}
