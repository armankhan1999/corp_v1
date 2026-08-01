import { buildChallanRows, buildEwayRows, ctx, readActor } from "@/components/domain/commercial/data";
import { stableDigits } from "@/components/domain/commercial/gst";
import { DEFAULT_SETTINGS } from "@/components/domain/commercial/types";
import { EwayClient, type EwayBaseOption } from "./EwayClient";

export const dynamic = "force-dynamic";

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "E-way bills — Pravaah",
  description: "Simulated e-way bills with threshold, validity and the stale-base-document block enforced by the platform.",
};

/**
 * The seed's digit helper emits "NaN" wherever its internal XOR turns negative,
 * so a handful of registration marks carry letters where the statute requires
 * digits. `/lib` is frozen for this wave, so the defect is repaired
 * deterministically at the point of display — the same input always yields the
 * same output, and the form never pre-fills a vehicle number that is not one.
 */
function repairNaN(value: string, salt: string): string {
  let n = 0;
  return value.replace(/NaN/g, () => stableDigits(`${salt}${n++}`, 3));
}

export default async function EwayPage() {
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("eway");

  const rows = buildEwayRows(ds);
  const withBill = new Set(rows.map((r) => r.baseDocId));

  const bases: EwayBaseOption[] = buildChallanRows(ds, now).map((c) => ({
    id: c.id,
    number: c.number,
    date: c.date,
    customerName: c.customerName,
    consignmentValue: c.consignmentValue,
    distanceKm: c.approxDistanceKm,
    transporter: c.transporter,
    transporterGstin: repairNaN(c.transporterGstin, `gstin${c.id}`),
    vehicleNumber: repairNaN(c.vehicleNumber, `veh${c.id}`),
    transportMode: c.transportMode,
    hasBill: withBill.has(c.id),
  }));

  // The screen opens on the most recently numbered challan the age rule blocks,
  // so the demonstration reads against a real despatch rather than a contrived
  // one. The seed places a challan at 190 days precisely for this.
  const defaultBaseId =
    bases
      .filter((b) =>
        !b.hasBill &&
        b.consignmentValue > DEFAULT_SETTINGS.ewayThreshold &&
        Math.round((now.getTime() - new Date(b.date).getTime()) / 86_400_000) > DEFAULT_SETTINGS.ewayMaxBaseAgeDays)
      .sort((a, b) => b.number.localeCompare(a.number))[0]?.id ?? null;

  return (
    <EwayClient
      rows={rows}
      bases={bases}
      defaultBaseId={defaultBaseId}
      seededCount={ds.ewayBills.length}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
