"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { COMPANY } from "@/lib/seed/catalog";
import { formatCount, formatDate, formatINR, formatQty } from "@/lib/format";
import { Overline, Panel, PanelHeader, SimulatedBadge } from "@/components/patterns/primitives";
import { EwayPanel } from "./EwayPanel";
import { CHALLAN_COPIES, ChallanSheet, SheetScroller } from "./sheets";
import { useCommercialOverlay } from "./store";
import {
  CHALLAN_SOURCE_LABEL, TRANSPORT_MODE_LABEL,
  type Actor, type ChallanRow, type EwayRow,
} from "./types";
import { Button, DefinitionGrid, Money, PrintBar, SectionPanel, Segmented } from "./ui";

export function ChallanDetailClient({
  challan, eway, actor, todayIso, seededEwayCount, sourceHref,
}: {
  challan: ChallanRow;
  eway: EwayRow | null;
  actor: Actor;
  todayIso: string;
  seededEwayCount: number;
  sourceHref: string | null;
}) {
  const overlay = useCommercialOverlay();
  const [tab, setTab] = React.useState<"record" | "print">("record");
  const now = new Date(todayIso);
  const ageDays = Math.floor((now.getTime() - new Date(challan.date).getTime()) / 86_400_000);

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/commercial/challans" className="t-body-sm inline-flex items-center gap-1 text-text-mid hover:text-text-hi">
            <ArrowLeft className="size-3.5" aria-hidden />
            All delivery challans
          </Link>
          <h1 className="t-display-md mt-1 flex flex-wrap items-center gap-2 text-text-hi">
            <span className="t-mono text-[1.5rem]">{challan.number}</span>
            {challan.simulated ? <SimulatedBadge what="document created in this session" /> : null}
          </h1>
          <p className="t-body-sm mt-1 text-text-mid">
            Delivery challan under Rule 55 · {formatDate(challan.date)} · {ageDays} {ageDays === 1 ? "day" : "days"} old ·
            despatched to {challan.customerName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="View"
            value={tab}
            onChange={setTab}
            options={[{ value: "record", label: "Record" }, { value: "print", label: "Print preview" }]}
          />
        </div>
      </div>

      {tab === "record" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_28rem]">
          <div className="flex flex-col gap-4">
            <SectionPanel title="Document particulars" sub="Everything Rule 55 requires a challan to carry.">
              <div className="px-4 py-3">
                <DefinitionGrid
                  items={[
                    { label: "Challan number", value: challan.number, mono: true },
                    { label: "Challan date", value: formatDate(challan.date) },
                    { label: "Reason for transportation", value: challan.reasonForTransportation },
                    { label: "Branch", value: `${challan.branchName} (${challan.branchCode})` },
                  ]}
                />
              </div>
            </SectionPanel>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SectionPanel title="Consigner" sub="Goods despatched by">
                <div className="px-4 py-3">
                  <p className="t-body font-medium text-text-hi">{COMPANY.legalName}</p>
                  <p className="t-body-sm mt-0.5 text-text-mid">{COMPANY.address}</p>
                  <div className="mt-3">
                    <DefinitionGrid
                      cols={2}
                      items={[
                        { label: "GSTIN", value: COMPANY.gstin, mono: true },
                        { label: "State", value: `${COMPANY.stateName} (${COMPANY.stateCode})` },
                      ]}
                    />
                  </div>
                </div>
              </SectionPanel>
              <SectionPanel title="Consignee" sub="Goods received by">
                <div className="px-4 py-3">
                  <p className="t-body font-medium text-text-hi">{challan.customerName}</p>
                  <p className="t-body-sm mt-0.5 text-text-mid">{challan.siteName} — {challan.siteAddress}</p>
                  <div className="mt-3">
                    <DefinitionGrid
                      cols={2}
                      items={[
                        { label: "GSTIN", value: challan.customerGstin ?? "Unregistered", mono: true },
                        { label: "State", value: `${challan.siteState} (${challan.siteStateCode})` },
                      ]}
                    />
                  </div>
                </div>
              </SectionPanel>
            </div>

            <SectionPanel
              title="Source document"
              sub="A challan always moves goods against something, and the reference prints on the document."
              right={sourceHref ? (
                <Link href={sourceHref} className="t-body-sm inline-flex items-center gap-1 text-info hover:underline">
                  <FileText className="size-3.5" aria-hidden />
                  Open {challan.sourceLabel}
                </Link>
              ) : null}
            >
              <div className="px-4 py-3">
                <DefinitionGrid
                  cols={3}
                  items={[
                    { label: "Source type", value: CHALLAN_SOURCE_LABEL[challan.sourceType] },
                    { label: "Reference", value: challan.sourceLabel, mono: true },
                    { label: "Consignment value", value: <Money value={challan.consignmentValue} /> },
                  ]}
                />
              </div>
            </SectionPanel>

            <SectionPanel
              title="Particulars of goods"
              sub={`${formatCount(challan.lines.length)} line${challan.lines.length === 1 ? "" : "s"} with quantity and taxable value`}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse">
                  <thead>
                    <tr className="border-b border-line-strong bg-surface-2">
                      <th className="t-overline px-3 py-2 text-left text-text-lo">Description</th>
                      <th className="t-overline w-24 px-3 py-2 text-left text-text-lo">HSN/SAC</th>
                      <th className="t-overline w-20 px-3 py-2 text-left text-text-lo">UOM</th>
                      <th className="t-overline w-24 px-3 py-2 text-right text-text-lo">Qty</th>
                      <th className="t-overline w-32 px-3 py-2 text-right text-text-lo">Rate</th>
                      <th className="t-overline w-36 px-3 py-2 text-right text-text-lo">Taxable value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challan.lines.map((l, i) => (
                      <tr key={`${l.itemId}-${i}`} className="border-b border-line">
                        <td className="t-body-sm px-3 py-2 text-text-hi">{l.description}</td>
                        <td className="t-mono px-3 py-2 text-text-mid">{l.hsnSac}</td>
                        <td className="t-body-sm px-3 py-2 text-text-mid">{l.uom}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-mid tabular-nums">{formatQty(l.qty)}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-mid tabular-nums">{formatINR(l.taxableValue)}</td>
                        <td className="t-body-sm px-3 py-2 text-right text-text-hi tabular-nums">{formatINR(l.lineValue)}</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-2">
                      <td colSpan={5} className="t-body-sm px-3 py-2 text-right font-medium text-text-mid">
                        Total taxable value of consignment
                      </td>
                      <td className="t-body px-3 py-2 text-right font-semibold text-text-hi tabular-nums">
                        {formatINR(challan.consignmentValue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionPanel>

            <SectionPanel title="Transport" sub="Carrier, conveyance and consignment note.">
              <div className="px-4 py-3">
                <DefinitionGrid
                  items={[
                    { label: "Mode", value: TRANSPORT_MODE_LABEL[challan.transportMode] },
                    { label: "Vehicle number", value: challan.vehicleNumber, mono: true },
                    { label: "Transporter", value: challan.transporter },
                    { label: "Transporter GSTIN", value: challan.transporterGstin, mono: true },
                    { label: "LR / RR number", value: challan.lrNumber, mono: true },
                    { label: "Approximate distance", value: `${challan.approxDistanceKm} km` },
                  ]}
                />
              </div>
            </SectionPanel>
          </div>

          <div className="flex flex-col gap-4">
            <Panel>
              <PanelHeader
                title="E-way bill"
                sub="Movement authorisation, tested against the configured threshold and the base-document age limit."
              />
              <div className="p-4">
                <EwayPanel
                  base={{
                    type: "CHALLAN", id: challan.id, number: challan.number, date: challan.date,
                    customerName: challan.customerName,
                    consignmentValue: challan.consignmentValue,
                    distanceKm: challan.approxDistanceKm,
                    transporter: challan.transporter,
                    transporterGstin: challan.transporterGstin,
                    vehicleNumber: challan.vehicleNumber,
                    transportMode: challan.transportMode,
                    isExport: challan.siteStateCode === "96",
                    replacementHref: "/commercial/challans",
                    replacementLabel: "Raise a fresh challan against the same order",
                  }}
                  existing={eway}
                  actor={actor}
                  todayIso={todayIso}
                  seededCount={seededEwayCount}
                />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Statutory copies" sub="CGST Rule 55(2) requires three, each carrying its own designation." />
              <ul className="divide-y divide-line">
                {CHALLAN_COPIES.map((c) => (
                  <li key={c.key} className="px-4 py-2">
                    <p className="t-body-sm font-medium text-text-hi">{c.designation}</p>
                    <p className="t-body-sm text-text-lo">{c.note}</p>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 py-3">
                <Button onClick={() => setTab("print")} className="w-full justify-center">
                  <Printer className="size-3.5" aria-hidden />
                  Open the triplicate print preview
                </Button>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Audit" sub="Every mutation against this document." />
              <ul className="divide-y divide-line">
                {overlay.audit.filter((a) => a.entityId === challan.id || a.entityLabel === challan.number).length === 0 ? (
                  <li className="px-4 py-3">
                    <p className="t-body-sm text-text-mid">
                      Creation of this challan was logged when the seeded world was built. Anything you change here is
                      appended below.
                    </p>
                  </li>
                ) : (
                  overlay.audit
                    .filter((a) => a.entityId === challan.id || a.entityLabel === challan.number)
                    .map((a) => (
                      <li key={a.id} className="px-4 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <Overline>{a.action.replace(/_/g, " ")}</Overline>
                          <span className="t-body-sm text-text-lo">{formatDate(a.at)}</span>
                        </div>
                        <p className="t-body-sm mt-0.5 text-text-mid">{a.summary}</p>
                        <p className="t-body-sm text-text-lo">{a.actorName} · {a.actorRole.replace(/_/g, " ").toLowerCase()}</p>
                      </li>
                    ))
                )}
              </ul>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel className="overflow-hidden">
          <PrintBar label="Three copies render below, each carrying the statutory designation Rule 55(2) requires. Printing produces all three on separate A4 pages." />
          <SheetScroller>
            {CHALLAN_COPIES.map((c) => (
              <ChallanSheet key={c.key} challan={challan} copy={c.designation} note={c.note} />
            ))}
          </SheetScroller>
        </Panel>
      )}
    </div>
  );
}
