import {
  buildBranchRefs, buildChallanRows, buildChallanSources, buildSeries, ctx, readActor,
} from "@/components/domain/commercial/data";
import { ChallansClient } from "@/components/domain/commercial/ChallansClient";

export const dynamic = "force-dynamic";

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "Delivery challans — Pravaah",
  description: "Statutory delivery challans with Rule 55 triplicate printing and e-way bill control.",
};

export default async function ChallansPage() {
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("challans");

  const rows = buildChallanRows(ds, now);

  const ewayByChallan: Record<string, { id: string; ebn: string; validUntil: string }> = {};
  for (const e of ds.ewayBills) {
    if (e.baseDocType === "CHALLAN") ewayByChallan[e.baseDocId] = { id: e.id, ebn: e.ebn, validUntil: e.validUntil };
  }

  const customerSites: Record<string, { siteId: string; siteName: string; siteAddress: string; stateCode: string; state: string; gstin: string | null }> = {};
  for (const c of ds.customers) {
    const site = ds.sites.find((s) => s.customerId === c.id);
    if (!site) continue;
    customerSites[c.id] = {
      siteId: site.id, siteName: site.name,
      siteAddress: `${site.address}, ${site.district}, ${site.state} ${site.pincode}`,
      stateCode: c.country === "NP" ? "96" : site.stateCode,
      state: c.country === "NP" ? "Nepal (outside India)" : site.state,
      gstin: c.gstin,
    };
  }

  return (
    <ChallansClient
      rows={rows}
      ewayByChallan={ewayByChallan}
      branches={buildBranchRefs(ds).map((b) => ({ id: b.id, code: b.code, name: b.name }))}
      sources={buildChallanSources(ds)}
      customerSites={customerSites}
      series={buildSeries(ds).find((s) => s.docType === "CHALLAN") ?? null}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
