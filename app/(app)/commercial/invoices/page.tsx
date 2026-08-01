import {
  buildBranchRefs, buildCustomerRefs, buildInvoiceRows, buildSeries, buildSourceOptions,
  buildUserRefs, ctx, readActor,
} from "@/components/domain/commercial/data";
import type { SourceOption } from "@/components/domain/commercial/types";
import { InvoicesClient } from "./InvoicesClient";

export const dynamic = "force-dynamic";

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "Tax invoices — Pravaah",
  description: "Tax invoices with GST treatment derived from the place of supply, simulated IRN and QR, and reporting-window tracking.",
};

/** How many source documents of each kind travel to the browser. */
const PER_KIND = 30;

export default async function InvoicesPage() {
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("invoices");

  const rows = buildInvoiceRows(ds, now);

  // Only customers that actually carry an invoice reach the filter, and only a
  // recent slice of each source kind reaches the raise-invoice picker — the
  // seeded world holds 957 billable sources and none of the rest is needed here.
  const invoiced = new Set(rows.map((r) => r.customerId));
  const customers = buildCustomerRefs(ds)
    .filter((c) => invoiced.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const perKind = new Map<string, SourceOption[]>();
  for (const option of buildSourceOptions(ds, now)) {
    const bucket = perKind.get(option.kind) ?? [];
    if (bucket.length >= PER_KIND) continue;
    bucket.push(option);
    perKind.set(option.kind, bucket);
  }
  const sources = [...perKind.values()].flat();

  const executiveIds = new Set(customers.map((c) => c.accountExecutiveId));

  return (
    <InvoicesClient
      rows={rows}
      branches={buildBranchRefs(ds)}
      customers={customers}
      executives={buildUserRefs(ds, executiveIds)}
      sources={sources}
      series={buildSeries(ds).find((s) => s.docType === "INVOICE") ?? null}
      seededCount={ds.invoices.length}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
