import { notFound } from "next/navigation";
import { getDataset } from "@/lib/seed";
import { machineFamily, OBSERVATION_PRESETS, WORK_PRESETS } from "@/lib/seed/catalog";
import { COVERAGE_LABEL } from "@/components/domain/service/types";
import { projectTicket, serviceCtx } from "@/components/domain/service/project";
import { SixTapJobCard } from "@/components/domain/service/SixTapJobCard";
import type { RootCause } from "@/lib/schemas/enums";

export const dynamic = "force-dynamic";

const ROOT_CAUSE_BY_FAMILY: Record<string, RootCause[]> = {
  COMPRESSOR: ["FILTER_CHOKED", "OIL_LEAK", "AIR_END_WEAR", "BELT_SLIP", "COOLER_FOULING"],
  PUMP: ["SEAL_FAILURE", "IMPELLER_WEAR", "MOTOR_OVERLOAD", "ELECTRICAL_SUPPLY", "SCHEDULED_SERVICE"],
  GARAGE: ["VALVE_FAILURE", "SEAL_FAILURE", "PRESSURE_SWITCH", "OPERATOR_ERROR", "SCHEDULED_SERVICE"],
  TREATMENT: ["CONTROLLER_FAULT", "SEAL_FAILURE", "SCHEDULED_SERVICE", "ELECTRICAL_SUPPLY", "OTHER"],
};

/** E4-S5 — the six-tap mobile job card, routed from the day view. */
export default async function FieldJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ds = getDataset();
  const { now } = serviceCtx();

  const ticket = ds.tickets.find((t) => t.id === id);
  if (!ticket) notFound();

  const v = projectTicket(ds, ticket, now);
  const family = machineFamily(v.asset.productLine);

  // Prior readings bound the validation in E4-S4: a reading below the last one
  // recorded against this asset is rejected rather than silently accepted.
  const priorReadings = ds.jobCards
    .filter((j) => j.assetId === v.asset.id && j.runningHoursReading !== null)
    .map((j) => j.runningHoursReading as number);
  const previousReading = priorReadings.length ? Math.max(...priorReadings) : null;

  return (
    <SixTapJobCard
      input={{
        ticketId: v.id,
        ticketNumber: v.number,
        customerName: v.customerName,
        siteName: v.site.name,
        siteAddress: v.site.address,
        assetModel: v.asset.model,
        assetSerial: v.asset.serial,
        problem: v.problem,
        coverageLabel: COVERAGE_LABEL[v.coverage],
        contactName: v.contactName ?? v.site.contactPerson,
        contactDesignation: v.contactDesignation ?? "Site contact",
        previousReading,
        suggestedReading: Math.max(v.asset.runningHours, previousReading ?? 0),
        observationPresets: OBSERVATION_PRESETS[family] ?? [],
        workPresets: WORK_PRESETS[family] ?? [],
        rootCausePresets: ROOT_CAUSE_BY_FAMILY[family] ?? ["OTHER"],
        todayIso: ds.meta.today,
      }}
    />
  );
}
