"use client";

import * as React from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { OEM_LABEL, PRODUCT_LINE_LABEL } from "@/lib/schemas/enums";
import { formatCount, formatDate, formatQty } from "@/lib/format";
import { EmptyState, Overline, Panel, Skeleton } from "@/components/patterns/primitives";
import { AssetStatusBadge, PrincipalTag } from "./badges";
import { CoverageBadge, CoverageDerivation } from "./CoverageBadge";
import { EMPTY_ASSETS, useOverlay, type AssetsOverlay } from "./store";
import { Serial } from "./ui";

/**
 * A serial the seeded dataset does not hold may still exist in this browser —
 * assets created through the register live in the localStorage overlay. Rather
 * than a bare 404, resolve it here and say plainly that it has no history yet.
 */
export function LocalAssetFallback({ serial, todayIso }: { serial: string; todayIso: string }) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const { state, ready } = useOverlay<AssetsOverlay>("pravaah.v1.assets", EMPTY_ASSETS);
  const asset = state.created.find((a) => a.serial.toUpperCase() === serial.toUpperCase()) ?? null;

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!asset) {
    return (
      <Panel>
        <EmptyState
          icon={Package}
          title="No asset carries that serial"
          body={`Nothing on the register matches "${serial}". Serials are unique platform-wide, so either the machine has not been registered or the serial was mistyped.`}
          action={
            <Link
              href="/service/assets"
              className="t-body-sm inline-flex min-h-9 items-center rounded-md border border-primary-600 bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-500"
            >
              Open the asset register
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Overline>Asset passport</Overline>
          <PrincipalTag principal={asset.principal} />
          <AssetStatusBadge status={asset.status} />
          <span className="t-overline rounded border border-line bg-surface-2 px-1 text-text-lo">
            Created in this browser
          </span>
        </div>
        <h1 className="t-display-md text-text-hi">
          <span className="t-mono text-[1.5rem] leading-tight">{asset.serial}</span>
        </h1>
        <p className="t-body text-text-mid">{asset.model}</p>
        <p className="t-body-sm text-text-lo">
          {asset.customerName} · {asset.siteName}
          {asset.locationInSite ? ` · ${asset.locationInSite}` : ""}
        </p>
      </header>

      <Panel>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {(
              [
                ["Serial", <Serial key="s" value={asset.serial} />],
                ["Principal", OEM_LABEL[asset.principal]],
                ["Product line", PRODUCT_LINE_LABEL[asset.productLine]],
                ["Capacity", formatQty(asset.capacityValue, asset.capacityUnit)],
                ["Rated power", asset.ratedKw === null ? "—" : `${asset.ratedKw} kW`],
                ["Installation", asset.installationDate ? formatDate(asset.installationDate) : "—"],
                [
                  "Commissioning",
                  asset.commissioningDate ? formatDate(asset.commissioningDate) : "Not commissioned",
                ],
                ["Warranty", `${asset.warrantyMonths} months`],
                ["Running hours", formatCount(asset.runningHours)],
                ["Branch", asset.branchName],
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k}>
                <Overline>{k}</Overline>
                <dd className="t-body-sm text-text-hi">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CoverageBadge state={asset.coverage} />
            </div>
            <CoverageDerivation
              state={asset.coverage}
              warrantyEnd={asset.warrantyEnd}
              amcNumber={asset.amcNumber}
              amcEnd={asset.amcEnd}
              decommissioned={asset.status === "DECOMMISSIONED"}
              now={now}
            />
            <p className="t-body-sm rounded-md border border-line bg-surface-0 px-2.5 py-2 text-text-mid">
              This machine was registered in this browser session, so it carries no tickets, visits,
              parts, documents or commissioning report yet. Record its commissioning to start the
              OEM submission clock and fix warranty start.
            </p>
            <Link
              href={`/field/commissioning/${asset.id}`}
              className="t-body-sm inline-flex min-h-9 items-center justify-center rounded-md border border-primary-600 bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-500"
            >
              Record the commissioning report
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
