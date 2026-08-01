import { cookies } from "next/headers";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { can, canWrite } from "@/lib/rbac/matrix";
import { AssetPassport } from "@/components/domain/assets/AssetPassport";
import { LocalAssetFallback } from "@/components/domain/assets/LocalAssetFallback";
import {
  buildAssetRows,
  buildCommissioningRows,
  buildCoverageBands,
  buildDocumentRows,
  buildIndexes,
  buildPartRows,
  buildRunningHoursSeries,
  buildTicketRows,
  buildVisitRows,
} from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  return { title: `${decodeURIComponent(serial)} — Asset passport — Pravaah` };
}

export default async function AssetPassportPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial: raw } = await params;
  const serial = decodeURIComponent(raw);

  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const now = ctx.now;
  const todayIso = now.toISOString();

  const asset = ds.assets.find((a) => a.serial.toUpperCase() === serial.toUpperCase());
  if (!asset) {
    return <LocalAssetFallback serial={serial} todayIso={todayIso} />;
  }

  const idx = buildIndexes(ds, now);
  const row = buildAssetRows(ds, now, idx).find((r) => r.id === asset.id)!;
  const visits = buildVisitRows(ds, asset.id, idx);
  const commissioning =
    buildCommissioningRows(ds, now, idx).find((r) => r.assetId === asset.id) ?? null;

  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const role = session?.role ?? "AUDITOR";

  const amcHistory = ds.amcContracts
    .filter((c) => c.assetIds.includes(asset.id))
    .map((c) => ({
      id: c.id,
      number: c.number,
      coverage: c.coverage,
      startDate: c.startDate,
      endDate: c.endDate,
      contractValue: c.contractValue,
      status: D.amcStatus(c, now),
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <AssetPassport
      asset={row}
      bands={buildCoverageBands(ds, asset, now)}
      tickets={buildTicketRows(ds, asset.id, idx)}
      visits={visits}
      parts={buildPartRows(ds, asset.id, idx)}
      documents={buildDocumentRows(ds, asset.id)}
      hours={buildRunningHoursSeries(asset, visits)}
      commissioning={commissioning}
      amcHistory={amcHistory}
      todayIso={todayIso}
      showCommercial={can(role, "invoices")}
      canEdit={canWrite(role, "assets")}
    />
  );
}
