import { cookies } from "next/headers";
import Link from "next/link";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { COMMISSIONING_CHECKLIST } from "@/lib/seed/catalog";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canWrite } from "@/lib/rbac/matrix";
import { EmptyState, Panel } from "@/components/patterns/primitives";
import { Package } from "lucide-react";
import { CommissioningForm } from "@/components/domain/assets/CommissioningForm";
import {
  buildAssetRows,
  buildCommissioningDetail,
  buildIndexes,
} from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commissioning report — Pravaah Field",
};

export default async function FieldCommissioningPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const now = ctx.now;
  const idx = buildIndexes(ds, now);

  const asset = ds.assets.find((a) => a.id === assetId || a.serial === assetId);
  const detail = asset ? buildCommissioningDetail(ds, now, asset.id, idx) : null;

  if (!asset || !detail) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4" data-shell="field">
        <Panel>
          <EmptyState
            icon={Package}
            title="That machine is not on the register"
            body={`No installed asset matches "${assetId}". A commissioning report can only be written against a registered, serial-numbered machine.`}
            action={
              <Link
                href="/service/assets"
                className="t-body-sm inline-flex min-h-11 items-center rounded-md border border-primary-600 bg-primary-600 px-3 py-2 text-white hover:bg-primary-500"
              >
                Open the asset register
              </Link>
            }
          />
        </Panel>
      </main>
    );
  }

  const row = buildAssetRows(ds, now, idx).find((r) => r.id === asset.id)!;
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const role = session?.role ?? "AUDITOR";
  const hasReport = Boolean(idx.reportByAsset.get(asset.id));

  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <CommissioningForm
        asset={row}
        detail={detail}
        hasReport={hasReport}
        checklistTemplate={[...COMMISSIONING_CHECKLIST]}
        engineerName={detail.engineerName || session?.name || "Field engineer"}
        todayIso={now.toISOString()}
        canEdit={canWrite(role, "commissioning")}
      />
    </main>
  );
}
