import {
  buildBranchRefs, buildInvoiceRows, buildReceiptRows, buildSeries, ctx, readActor,
} from "@/components/domain/commercial/data";
import { ReceiptsClient } from "./ReceiptsClient";

export const dynamic = "force-dynamic";

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "Receipts — Pravaah",
  description: "Receipts with invoice-level allocation, visible unallocated balances and a simulated UPI collection link.",
};

export default async function ReceiptsPage() {
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("receipts");

  return (
    <ReceiptsClient
      receipts={buildReceiptRows(ds)}
      invoices={buildInvoiceRows(ds, now)}
      branches={buildBranchRefs(ds)}
      series={buildSeries(ds).find((s) => s.docType === "RECEIPT") ?? null}
      seededReceiptCount={ds.receipts.length}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
