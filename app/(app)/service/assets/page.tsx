import { cookies } from "next/headers";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canCreate as rbacCanCreate, canWrite as rbacCanWrite } from "@/lib/rbac/matrix";
import { AssetRegister } from "@/components/domain/assets/AssetRegister";
import {
  PRODUCT_LINE_CONFIGS,
  buildAssetRows,
  buildBranchOptions,
  buildCustomerOptions,
  buildIndexes,
  buildInvoiceOptions,
  buildItemOptions,
  buildOrderLineOptions,
} from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Installed assets — Pravaah",
};

export default async function AssetsPage() {
  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const idx = buildIndexes(ds, ctx.now);
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const role = session?.role ?? "AUDITOR";

  return (
    <AssetRegister
      rows={buildAssetRows(ds, ctx.now, idx)}
      todayIso={ctx.now.toISOString()}
      canCreate={rbacCanCreate(role, "assets")}
      canEdit={rbacCanWrite(role, "assets")}
      options={{
        customers: buildCustomerOptions(ds),
        items: buildItemOptions(ds),
        invoices: buildInvoiceOptions(ds),
        branches: buildBranchOptions(ds),
        orderLines: buildOrderLineOptions(ds, idx),
        productLines: PRODUCT_LINE_CONFIGS,
      }}
    />
  );
}
