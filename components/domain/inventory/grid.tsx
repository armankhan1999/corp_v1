"use client";

/**
 * E7 — the accessible dense grid.
 *
 * `ui.tsx`'s `VirtualTable` places its interactive row wrapper *directly* inside
 * `role="row"`, which axe reports as a critical `aria-required-children`
 * violation: a row may own cells and nothing else, so a focusable element that
 * is not inside a `role="gridcell"` is a child the role does not allow.
 *
 * This grid fixes the shape rather than the symptom:
 *
 *   role="grid"                       ← labelled, carries aria-rowcount
 *     role="row"   (header)           ← direct child, aria-rowindex 1
 *       role="columnheader" …
 *     <generic scroller / spacer>     ← transparent to the a11y tree
 *       role="row"    aria-rowindex n
 *         role="gridcell"             ← EVERY link, button and checkbox lives here
 *
 * Rows beyond `virtualiseAbove` (100 by default, per the design law) are
 * windowed with TanStack Virtual; below that the rows render in place so short
 * lists keep native find-in-page.
 */

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/patterns/primitives";

export interface GridColumn<R> {
  key: string;
  header: string;
  /** A grid-template-columns track: `minmax(0,1fr)`, `120px`, … */
  width: string;
  align?: "left" | "right" | "center";
  /** Header text is visually hidden — used by the selection column. */
  srHeader?: boolean;
  cell: (row: R, index: number) => React.ReactNode;
  /** Rendered instead of plain text in the header — sort buttons, select-all. */
  headerCell?: React.ReactNode;
}

export type RowTone = "danger" | "warn" | "ok" | "info" | null;

const TONE_EDGE: Record<Exclude<RowTone, null>, string> = {
  danger: "border-l-2 border-l-danger",
  warn: "border-l-2 border-l-warn",
  ok: "border-l-2 border-l-ok",
  info: "border-l-2 border-l-info",
};

export function DataGrid<R>({
  rows,
  columns,
  rowKey,
  ariaLabel,
  height = 520,
  rowHeight = 36,
  rowTone,
  virtualiseAbove = 100,
  emptyState,
}: {
  rows: R[];
  columns: GridColumn<R>[];
  rowKey: (row: R) => string;
  ariaLabel: string;
  height?: number;
  rowHeight?: number;
  rowTone?: (row: R) => RowTone;
  virtualiseAbove?: number;
  emptyState?: React.ReactNode;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualise = rows.length > virtualiseAbove;
  const virtualizer = useVirtualizer({
    count: virtualise ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const template = columns.map((c) => c.width).join(" ");

  const renderRow = (row: R, index: number, style?: React.CSSProperties) => {
    const tone = rowTone?.(row) ?? null;
    return (
      <div
        key={rowKey(row)}
        role="row"
        aria-rowindex={index + 2}
        className={cn(
          "grid items-center gap-x-3 border-b border-line/70 bg-surface-1 px-3 hover:bg-surface-2",
          tone && TONE_EDGE[tone],
        )}
        style={{ gridTemplateColumns: template, minHeight: rowHeight, ...style }}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            role="gridcell"
            className={cn(
              "t-body-sm min-w-0",
              c.align === "right" && "text-right",
              c.align === "center" && "text-center",
            )}
          >
            {c.cell(row, index)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: "max-content" }}>
        <div role="grid" aria-label={ariaLabel} aria-rowcount={rows.length + 1} aria-colcount={columns.length}>
          <div
            role="row"
            aria-rowindex={1}
            className="grid items-center gap-x-3 border-b border-line-strong bg-surface-2 px-3"
            style={{ gridTemplateColumns: template, minHeight: 32 }}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                role="columnheader"
                className={cn(
                  "t-overline truncate text-text-lo",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                )}
              >
                {c.headerCell ?? (c.srHeader ? <span className="sr-only">{c.header}</span> : c.header)}
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            emptyState ?? null
          ) : virtualise ? (
            <div ref={scrollRef} className="overflow-y-auto" style={{ height }}>
              <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                {virtualizer.getVirtualItems().map((vi) =>
                  renderRow(rows[vi.index]!, vi.index, {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: rowHeight,
                    transform: `translateY(${vi.start}px)`,
                  }),
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: height }}>
              {rows.map((row, i) => renderRow(row, i))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A column header that sorts. Kept ≥24px so the target rule holds. */
export function SortHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${active ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
      className={cn(
        "t-overline inline-flex h-6 min-h-6 w-full items-center gap-1 rounded px-1 text-text-lo hover:text-text-hi",
        align === "right" && "justify-end",
        active && "text-text-hi",
      )}
    >
      {align === "right" && active ? <Icon className="size-3" aria-hidden /> : null}
      <span className="truncate">{label}</span>
      {align === "left" && active ? <Icon className="size-3" aria-hidden /> : null}
    </button>
  );
}

/** Row/select-all checkbox with a 24px hit area, always inside a gridcell. */
export function GridCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);
  return (
    <span className="inline-grid size-6 place-items-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="size-3.5 accent-[var(--primary-600)]"
      />
    </span>
  );
}

export function GridSkeleton({ rows = 10, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-line-strong bg-surface-2 px-3" style={{ height: 32 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 border-b border-line/70 px-3" style={{ height: 36 }}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
