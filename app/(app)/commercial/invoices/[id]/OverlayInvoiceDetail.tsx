"use client";

import * as React from "react";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { EmptyState } from "@/components/patterns/primitives";
import { InvoiceDetailClient } from "@/components/domain/commercial/InvoiceDetailClient";
import { useCommercialOverlay } from "@/components/domain/commercial/store";
import { mergedInvoices } from "@/components/domain/commercial/merge";
import type {
  Actor, SeriesRow, SourceOption,
} from "@/components/domain/commercial/types";

/**
 * An invoice raised in this browser session lives only in the localStorage
 * overlay, so the server render cannot find it. Resolving it on the client
 * keeps a document the user has just issued from 404-ing (E14-S2: never a
 * blank screen), while a genuinely unknown reference still gets an honest
 * empty state rather than a crash.
 */
export function OverlayInvoiceDetail({
  id, sourceOptions, noteSeries, receiptSeries, seededNoteCount, seededReceiptCount,
  seededEwayCount, actor, todayIso,
}: {
  id: string;
  sourceOptions: SourceOption[];
  noteSeries: SeriesRow | null;
  receiptSeries: { prefix: string; fySegment: string; width: number; highest: number } | null;
  seededNoteCount: number;
  seededReceiptCount: number;
  seededEwayCount: number;
  actor: Actor;
  todayIso: string;
}) {
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => setHydrated(true), []);

  const entry = overlay.invoices.find((e) => e.row.id === id) ?? null;
  const invoice = React.useMemo(
    () => (entry ? mergedInvoices([], overlay, now).find((r) => r.id === id) ?? null : null),
    [entry, overlay, now, id],
  );
  const eway = overlay.ewayBills.find((e) => e.baseDocId === id) ?? null;

  // Before hydration the overlay is empty by definition; declaring the invoice
  // missing at that moment would be a lie, so hold the geometry instead.
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <div className="pv-skeleton h-8 w-72" />
        <div className="pv-skeleton h-64 w-full" />
      </div>
    );
  }

  if (!entry || !invoice) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Tax invoice not found"
        body={`No invoice with reference ${id} exists in the seeded records or in this browser session. An invoice raised on another device is not visible here.`}
        action={
          <Link
            href="/commercial/invoices"
            className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to all tax invoices
          </Link>
        }
      />
    );
  }

  return (
    <InvoiceDetailClient
      invoice={invoice}
      lines={entry.lines}
      notesSeed={[]}
      followUpsSeed={[]}
      receiptsSeed={[]}
      eway={eway}
      sourceOptions={sourceOptions}
      noteSeries={noteSeries}
      receiptSeries={receiptSeries}
      seededNoteCount={seededNoteCount}
      seededReceiptCount={seededReceiptCount}
      seededEwayCount={seededEwayCount}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
