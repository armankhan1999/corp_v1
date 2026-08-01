"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, Route, ShieldAlert, Truck } from "lucide-react";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { Overline, SimulatedBadge , Explainer } from "@/components/patterns/primitives";
import {
  displayEbn, ewayEligibility, ewayValidityDays, simulateEbn, EWAY_SUB_TYPES,
} from "./gst";
import { actions, useCommercialOverlay } from "./store";
import { TRANSPORT_MODE_LABEL, type Actor, type EwayRow, type TransportMode } from "./types";
import {
  BlockedNotice, Button, DefinitionGrid, Field, InfoNotice, Money, NumberInput,
  Select, TextInput,
} from "./ui";

export interface EwayBaseDoc {
  type: "CHALLAN" | "INVOICE";
  id: string;
  number: string;
  date: string;
  customerName: string;
  consignmentValue: number;
  distanceKm: number;
  transporter: string;
  transporterGstin: string;
  vehicleNumber: string;
  transportMode: TransportMode;
  isExport: boolean;
  /** Where a fresh base document would be raised from. */
  replacementHref: string;
  replacementLabel: string;
}

/**
 * INT-03 / E8-S4. The whole e-way bill position for one base document:
 * whether a bill is needed, whether one is in force, whether it has lapsed,
 * and — the case that matters most — whether the base document is too old for
 * one to be raised at all.
 */
export function EwayPanel({
  base, existing, actor, todayIso, seededCount,
}: {
  base: EwayBaseDoc;
  existing: EwayRow | null;
  actor: Actor;
  todayIso: string;
  seededCount: number;
}) {
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const settings = overlay.settings;

  const live = React.useMemo(
    () => overlay.ewayBills.find((e) => e.baseDocId === base.id) ?? existing,
    [overlay.ewayBills, existing, base.id],
  );

  const sourceLabel = base.type === "CHALLAN" ? "Delivery challan" : "Tax invoice";
  const decision = ewayEligibility({
    consignmentValue: base.consignmentValue,
    baseDocDate: base.date,
    baseDocNumber: base.number,
    distanceKm: base.distanceKm,
    existing: live ? { validUntil: live.validUntil } : null,
    settings, now, sourceLabel,
  });

  const [form, setForm] = React.useState({
    supplyType: "OUTWARD" as "OUTWARD" | "INWARD",
    subType: base.isExport ? "Export" : "Supply",
    transportMode: base.transportMode,
    distanceKm: base.distanceKm,
    transporter: base.transporter,
    vehicleNumber: base.vehicleNumber,
  });
  const [error, setError] = React.useState<string | null>(null);

  const validity = ewayValidityDays(form.distanceKm, settings);

  function generate() {
    if (!form.vehicleNumber.trim()) { setError("A vehicle number is required before Part B can be filled."); return; }
    if (!form.transporter.trim()) { setError("Name the transporter carrying the consignment."); return; }
    if (form.distanceKm < 1) { setError("Approximate distance must be at least one kilometre."); return; }
    const generatedAt = todayIso;
    const validUntil = new Date(now.getTime() + validity * 86_400_000).toISOString();
    const row: EwayRow = {
      id: `EWB-${String(seededCount + overlay.ewayBills.length + 1).padStart(4, "0")}`,
      ebn: simulateEbn(base.number, generatedAt),
      baseDocType: base.type,
      baseDocId: base.id,
      baseDocNumber: base.number,
      baseDocDate: base.date,
      customerName: base.customerName,
      supplyType: form.supplyType,
      subType: form.subType,
      transportMode: form.transportMode,
      distanceKm: form.distanceKm,
      transporter: form.transporter,
      vehicleNumber: form.vehicleNumber.replace(/\s|-/g, "").toUpperCase(),
      generatedAt, validUntil,
      consignmentValue: base.consignmentValue,
      simulated: true,
    };
    setError(null);
    actions.addEway(row, actor);
  }

  /* ------------------------------------------------------- below threshold */
  if (decision.decision === "NOT_REQUIRED") {
    return (
      <InfoNotice
        icon={CircleCheck}
        headline={decision.headline}
        detail={`${decision.detail} The configured threshold is ${formatINR(settings.ewayThreshold)}; this consignment is valued at ${formatINR(base.consignmentValue)}.`}
        facts={[
          { label: "Consignment value", value: <Money value={base.consignmentValue} /> },
          { label: "Configured threshold", value: <Money value={settings.ewayThreshold} /> },
          { label: "Base document", value: <span className="t-mono">{base.number}</span> },
          { label: "Dated", value: formatDate(base.date) },
        ]}
      />
    );
  }

  /* ---------------------------------------------------------- blocked case */
  if (decision.decision === "BLOCKED_STALE_BASE") {
    return (
      <div className="flex flex-col gap-3">
        <BlockedNotice
          headline={decision.headline}
          detail={decision.detail}
          remedy={decision.remedy}
          facts={[
            { label: "Base document", value: <span className="t-mono">{base.number}</span> },
            { label: "Base document date", value: formatDate(base.date) },
            { label: "Age today", value: `${decision.ageDays} days` },
            { label: "Configured limit", value: `${decision.maxAgeDays} days` },
          ]}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={base.replacementHref}
                className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi hover:border-line-strong"
              >
                <Truck className="size-3.5" aria-hidden />
                {base.replacementLabel}
              </Link>
              <span className="t-body-sm text-text-lo">
                Consignment value {formatINR(base.consignmentValue)} · {decision.overAgeDays} days past the limit
              </span>
            </div>
          }
        />
        <Explainer className="flex items-start gap-2 text-text-lo">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          The rule is enforced by the platform rather than remembered by the user. It applies identically to every
          branch and cannot be waived on a single document — the limit is a Masters setting and any change to it is
          audit-logged against the person who made it.
        </Explainer>
      </div>
    );
  }

  /* -------------------------------------------------------- bill in force */
  if (decision.decision === "GENERATED" && live) {
    const daysLeft = Math.ceil((new Date(live.validUntil).getTime() - now.getTime()) / 86_400_000);
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-ok/40 bg-ok-bg px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CircleCheck className="size-5 text-ok" aria-hidden />
              <span className="t-heading-md text-text-hi">E-way bill in force</span>
            </div>
            <SimulatedBadge what="E-way bill portal (INT-03)" />
          </div>
          <p className="t-body-sm mt-1 text-text-mid">
            Valid for a further {daysLeft} {daysLeft === 1 ? "day" : "days"}. Part-B validity is computed at one day per{" "}
            {settings.ewayKmPerValidityDay} km, minimum one day.
          </p>
        </div>
        <ExistingBill bill={live} />
      </div>
    );
  }

  /* ------------------------------------------------- expired, or required */
  return (
    <div className="flex flex-col gap-3">
      {decision.decision === "EXPIRED" && live ? (
        <>
          <InfoNotice
            tone="warn"
            headline={decision.headline}
            detail={decision.detail}
            facts={[
              { label: "Expired bill", value: <span className="t-mono">{displayEbn(live.ebn, live.baseDocNumber)}</span> },
              { label: "Validity lapsed", value: formatDate(live.validUntil) },
              { label: "Base document age", value: `${decision.ageDays} days` },
              { label: "Configured limit", value: `${decision.maxAgeDays} days` },
            ]}
          />
          <ExistingBill bill={live} expired />
        </>
      ) : (
        <InfoNotice
          tone="warn"
          headline={decision.headline}
          detail={decision.detail}
          facts={[
            { label: "Consignment value", value: <Money value={base.consignmentValue} /> },
            { label: "Configured threshold", value: <Money value={settings.ewayThreshold} /> },
            { label: "Base document age", value: `${decision.ageDays} of ${decision.maxAgeDays} days` },
            { label: "Part-B validity", value: `${validity} ${validity === 1 ? "day" : "days"}` },
          ]}
        />
      )}

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
          <span className="t-heading-md text-text-hi">
            {decision.decision === "EXPIRED" ? "Raise a replacement bill" : "Generate e-way bill"}
          </span>
          <SimulatedBadge what="E-way bill portal (INT-03)" />
        </div>
        <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
          <Field label="Supply type">
            <Select
              value={form.supplyType}
              onChange={(e) => setForm((f) => ({ ...f, supplyType: e.target.value as "OUTWARD" | "INWARD" }))}
              options={[{ value: "OUTWARD", label: "Outward" }, { value: "INWARD", label: "Inward" }]}
            />
          </Field>
          <Field label="Sub-type">
            <Select
              value={form.subType}
              onChange={(e) => setForm((f) => ({ ...f, subType: e.target.value }))}
              options={EWAY_SUB_TYPES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Base document reference" hint={`${sourceLabel} dated ${formatDate(base.date)}`}>
            <TextInput value={base.number} readOnly className="t-mono" />
          </Field>
          <Field label="Transport mode">
            <Select
              value={form.transportMode}
              onChange={(e) => setForm((f) => ({ ...f, transportMode: e.target.value as TransportMode }))}
              options={(Object.keys(TRANSPORT_MODE_LABEL) as TransportMode[]).map((k) => ({ value: k, label: TRANSPORT_MODE_LABEL[k] }))}
            />
          </Field>
          <Field label="Approximate distance (km)" hint={`Validity ${validity} ${validity === 1 ? "day" : "days"}`}>
            <NumberInput
              value={form.distanceKm}
              onChange={(e) => setForm((f) => ({ ...f, distanceKm: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </Field>
          <Field label="Transporter">
            <TextInput value={form.transporter} onChange={(e) => setForm((f) => ({ ...f, transporter: e.target.value }))} />
          </Field>
          <Field label="Vehicle number">
            <TextInput
              value={form.vehicleNumber}
              onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="Consignment value">
            <TextInput value={formatINR(base.consignmentValue)} readOnly className="text-right tabular-nums" />
          </Field>
          <div className="flex items-end">
            <Button tone="primary" onClick={generate} disabled={!actor.canWrite} className="w-full justify-center">
              <Route className="size-3.5" aria-hidden />
              Generate e-way bill
            </Button>
          </div>
        </div>
        {error ? (
          <p className="t-body-sm border-t border-line px-4 py-2 text-danger">{error}</p>
        ) : (
          <Explainer className="border-t border-line px-4 py-2 text-text-lo">
            Generation returns a simulated e-way bill number and validity period. The live portal needs credentials with
            two-factor authentication, a transporter master and a distance source —{" "}
            <Link href="/admin/integrations" className="text-info hover:underline">see Integration Readiness</Link>.
          </Explainer>
        )}
      </div>
    </div>
  );
}

function ExistingBill({ bill, expired }: { bill: EwayRow; expired?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <Overline>E-way bill particulars</Overline>
        {expired ? <span className="t-body-sm text-warn">Expired</span> : null}
      </div>
      <div className="px-4 py-3">
        <DefinitionGrid
          items={[
            { label: "E-way bill number", value: displayEbn(bill.ebn, bill.baseDocNumber), mono: true },
            { label: "Generated", value: formatDateTime(bill.generatedAt) },
            { label: "Valid until", value: formatDateTime(bill.validUntil) },
            { label: "Supply type", value: `${bill.supplyType === "OUTWARD" ? "Outward" : "Inward"} · ${bill.subType}` },
            { label: "Transport mode", value: TRANSPORT_MODE_LABEL[bill.transportMode] },
            { label: "Distance", value: `${bill.distanceKm} km` },
            { label: "Transporter", value: bill.transporter },
            { label: "Vehicle", value: bill.vehicleNumber, mono: true },
          ]}
        />
      </div>
    </div>
  );
}
