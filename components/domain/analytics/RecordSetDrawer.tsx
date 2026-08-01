"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { formatCount } from "@/lib/format";
import { Overline } from "@/components/patterns/primitives";
import type { DrillSet } from "./chartTypes";

/**
 * E12-S2 — clicking a chart element opens the records behind it, and the
 * aggregate stated at the top of this panel is the value that was clicked. The
 * drawer holds the contributing records itself rather than only linking away,
 * so the claim can be checked without leaving the surface.
 */
export function RecordSetDrawer({ set, onClose }: { set: DrillSet; onClose: () => void }) {
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <button
        type="button"
        aria-label="Close record set"
        onClick={onClose}
        className="absolute inset-0 bg-surface-0/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drill-title"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-line-strong bg-surface-1"
      >
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <Overline>Records behind the figure</Overline>
            <h2 id="drill-title" className="t-heading-md mt-0.5 text-text-hi">
              {set.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="drill-close"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="border-b border-line bg-surface-2 px-4 py-3">
          <Overline>{set.aggregateLabel}</Overline>
          <p className="t-display-md text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
            {set.aggregateValue}
          </p>
          <p className="t-body-sm mt-1 text-text-lo">
            This is the value that was clicked, summed across the {formatCount(set.totalRecords)} records below.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {set.records.length === 0 ? (
            <p className="t-body-sm px-4 py-8 text-center text-text-lo">
              The aggregate is derived from a rate rather than an enumerable record list. Open the full list for the
              underlying records.
            </p>
          ) : (
            <ul>
              {set.records.map((r) => (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={r.href}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2"
                    style={{ minHeight: "var(--row-h, 36px)" }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="t-mono block truncate text-text-hi">{r.label}</span>
                      <span className="t-body-sm block truncate text-text-lo">{r.sub}</span>
                    </span>
                    <span
                      className="t-body shrink-0 text-right text-text-mid"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {r.value}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {set.records.length < set.totalRecords ? (
            <p className="t-body-sm px-4 py-3 text-text-lo">
              Showing the first {formatCount(set.records.length)} of {formatCount(set.totalRecords)}. The aggregate
              above covers all {formatCount(set.totalRecords)}.
            </p>
          ) : null}
        </div>

        <div className="border-t border-line px-4 py-3">
          <Link
            href={set.listHref}
            className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {set.listLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
