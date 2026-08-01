import { notFound } from "next/navigation";
import {
  buildEwayRows, buildFollowUpRows, buildInvoiceLines, buildInvoiceRows, buildNoteRows,
  buildSeries, buildSourceOptions, ctx, readActor,
} from "@/components/domain/commercial/data";
import { InvoiceDetailClient } from "@/components/domain/commercial/InvoiceDetailClient";
import { INVOICE_TYPE_SOURCE } from "@/components/domain/commercial/types";
import { OverlayInvoiceDetail } from "./OverlayInvoiceDetail";

export const dynamic = "force-dynamic";

/** Enough of the expected source kind to link one, without shipping all 957. */
const LINKABLE = 40;

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("invoices");

  const series = buildSeries(ds);
  const noteSeries = series.find((s) => s.docType === "CREDIT_NOTE") ?? null;
  const receiptSeriesRow = series.find((s) => s.docType === "RECEIPT") ?? null;
  const receiptSeries = receiptSeriesRow
    ? {
      prefix: receiptSeriesRow.prefix, fySegment: receiptSeriesRow.fySegment,
      width: receiptSeriesRow.width, highest: receiptSeriesRow.highest,
    }
    : null;

  const seeded = ds.invoices.find((i) => i.id === id);

  // An invoice issued in this browser exists only in the overlay, so it is
  // resolved on the client rather than 404-ing on a document just created.
  if (!seeded) {
    return (
      <OverlayInvoiceDetail
        id={id}
        sourceOptions={buildSourceOptions(ds, now).slice(0, LINKABLE)}
        noteSeries={noteSeries}
        receiptSeries={receiptSeries}
        seededNoteCount={ds.creditNotes.length}
        seededReceiptCount={ds.receipts.length}
        seededEwayCount={ds.ewayBills.length}
        actor={actor}
        todayIso={todayIso}
      />
    );
  }

  const invoice = buildInvoiceRows(ds, now).find((i) => i.id === id);
  if (!invoice) notFound();

  const receiptById = new Map(ds.receipts.map((r) => [r.id, r]));
  const receiptsSeed = ds.receiptAllocations
    .filter((a) => a.invoiceId === id)
    .map((a) => {
      const r = receiptById.get(a.receiptId);
      return {
        id: a.id,
        number: r?.number ?? a.receiptId,
        date: r?.date ?? invoice.date,
        amount: a.amount,
        mode: r?.mode ?? "ADJUSTMENT",
        reference: r?.reference ?? "—",
        simulated: false,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Only the source kind this invoice type bills against can be linked, so
  // that is the only slice the browser needs.
  const expected = INVOICE_TYPE_SOURCE[invoice.type].kind;
  const sourceOptions = buildSourceOptions(ds, now)
    .filter((o) => o.kind === expected)
    .slice(0, LINKABLE);

  return (
    <InvoiceDetailClient
      invoice={invoice}
      lines={buildInvoiceLines(ds, id)}
      notesSeed={buildNoteRows(ds).filter((n) => n.invoiceId === id)}
      followUpsSeed={buildFollowUpRows(ds).filter((f) => f.invoiceId === id)}
      receiptsSeed={receiptsSeed}
      eway={buildEwayRows(ds).find((e) => e.baseDocId === id) ?? null}
      sourceOptions={sourceOptions}
      noteSeries={noteSeries}
      receiptSeries={receiptSeries}
      seededNoteCount={ds.creditNotes.length}
      seededReceiptCount={ds.receipts.length}
      seededEwayCount={ds.ewayBills.length}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
