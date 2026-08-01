import { notFound } from "next/navigation";
import { buildChallanRows, buildEwayRows, ctx, readActor } from "@/components/domain/commercial/data";
import { ChallanDetailClient } from "@/components/domain/commercial/ChallanDetailClient";
import { OverlayChallanDetail } from "@/components/domain/commercial/OverlayDetail";

export const dynamic = "force-dynamic";

export default async function ChallanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("challans");

  const seeded = ds.challans.find((c) => c.id === id);

  // A challan raised in this browser lives only in the overlay, so the record
  // is resolved on the client instead of 404-ing on a document the user just made.
  if (!seeded) {
    return <OverlayChallanDetail id={id} actor={actor} todayIso={todayIso} seededEwayCount={ds.ewayBills.length} />;
  }

  const challan = buildChallanRows(ds, now).find((c) => c.id === id);
  if (!challan) notFound();

  const eway = buildEwayRows(ds).find((e) => e.baseDocId === id) ?? null;
  const sourceHref =
    seeded.sourceType === "SALES_ORDER" && seeded.sourceId !== "—"
      ? `/sales/orders/${seeded.sourceId}`
      : null;

  return (
    <ChallanDetailClient
      challan={challan}
      eway={eway}
      actor={actor}
      todayIso={todayIso}
      seededEwayCount={ds.ewayBills.length}
      sourceHref={sourceHref}
    />
  );
}
