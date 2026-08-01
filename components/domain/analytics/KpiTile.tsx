"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Overline, StatusBadge } from "@/components/patterns/primitives";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KpiTileData } from "./kpiRegistry";

/**
 * E12-S1 — the tile that has to be able to defend itself.
 *
 * Three things are non-negotiable here and are therefore structural rather than
 * optional props: the disclosure control (formula, period, scope, record set),
 * the comparison delta stated with its basis in words, and the data-sufficiency
 * caveat that names the record count instead of quietly presenting a rate
 * computed from four observations as if it were a measurement.
 */
export function KpiTile({
  kpi, hero = false, className,
}: {
  kpi: KpiTileData;
  hero?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = `kpi-${kpi.id}-disclosure`;

  const DeltaIcon =
    kpi.delta === null ? Minus : kpi.delta.direction === "UP" ? TrendingUp : kpi.delta.direction === "DOWN" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-surface-1",
        kpi.caveat ? "border-warn/45" : "border-line",
        className,
      )}
      data-testid={`kpi-${kpi.id}`}
    >
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <Overline>{kpi.name}</Overline>
          <span className="t-mono shrink-0 text-[0.6875rem] text-text-lo">{kpi.id}</span>
        </div>

        <span
          className={cn("text-text-hi", hero ? "t-display-lg" : "t-display-md")}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {kpi.value}
        </span>

        {kpi.sub ? <p className="t-body-sm text-text-mid">{kpi.sub}</p> : null}

        {kpi.delta ? (
          <p className="t-body-sm mt-auto flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn("inline-flex items-center gap-1", kpi.delta.good ? "text-ok" : "text-danger")}>
              <DeltaIcon className="size-3.5 shrink-0" aria-hidden />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{kpi.delta.pctText}</span>
            </span>
            {/* E12-S2 — the basis is named in words, never left as a bare percentage. */}
            <span className="text-text-lo">{kpi.delta.basisInWords}</span>
          </p>
        ) : (
          <p className="t-body-sm mt-auto text-text-lo">No comparison basis applied</p>
        )}

        {kpi.caveat ? (
          <div className="mt-1 flex flex-col gap-1 rounded-md border border-warn/40 bg-warn-bg px-2 py-1.5">
            <StatusBadge tone="warn">Insufficient records</StatusBadge>
            <p className="t-body-sm text-text-mid">{kpi.caveat}</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`kpi-disclose-${kpi.id}`}
        className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 text-text-lo transition-colors duration-150 hover:bg-surface-2 hover:text-text-hi"
      >
        <span className="t-body-sm">How this is computed</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-line bg-surface-2 px-3 py-2.5">
          <dl className="flex flex-col gap-2">
            <Field label="Published formula">
              <span className="t-mono text-text-hi">{kpi.formula}</span>
            </Field>
            <Field label="In plain language">{kpi.plain}</Field>
            <Field label="Period">
              {kpi.periodLabel} — {kpi.periodRange}
            </Field>
            <Field label="Scope filters applied">
              {kpi.scopeStatement}
              {kpi.filters.length ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {kpi.filters.map((f) => (
                    <span key={f} className="t-overline rounded-md border border-line bg-surface-1 px-1.5 py-0.5 text-text-lo">
                      {f}
                    </span>
                  ))}
                </span>
              ) : null}
            </Field>
            <Field label="Records behind the figure">
              {formatCount(kpi.recordCount)} contributing records
            </Field>
            {kpi.delta ? (
              <Field label="Comparison">
                {kpi.delta.pctText} {kpi.delta.basisInWords} — that basis read {kpi.delta.priorDisplay} over{" "}
                {kpi.delta.priorRange}.
              </Field>
            ) : null}
            <Field label="Owner and cadence">
              {kpi.owner} · {kpi.frequency}
            </Field>
          </dl>
          <Link
            href={kpi.recordSetHref}
            className="t-body-sm mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-1 px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            {kpi.recordSetLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="t-overline text-text-lo">{label}</dt>
      <dd className="t-body-sm mt-0.5 text-text-mid">{children}</dd>
    </div>
  );
}

export function KpiGrid({ kpis, columns = 4 }: { kpis: KpiTileData[]; columns?: number }) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        columns === 3 ? "xl:grid-cols-3" : columns === 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {kpis.map((k) => (
        <li key={k.id} className="flex">
          <KpiTile kpi={k} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
