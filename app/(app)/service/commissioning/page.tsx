import { cookies } from "next/headers";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canWrite } from "@/lib/rbac/matrix";
import { CommissioningRegister } from "@/components/domain/assets/CommissioningRegister";
import {
  buildBranchOptions,
  buildCommissioningRows,
  buildIndexes,
} from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commissioning register — Pravaah",
};

export default async function CommissioningPage() {
  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const idx = buildIndexes(ds, ctx.now);
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const role = session?.role ?? "AUDITOR";

  return (
    <CommissioningRegister
      rows={buildCommissioningRows(ds, ctx.now, idx)}
      branches={buildBranchOptions(ds)}
      todayIso={ctx.now.toISOString()}
      canSubmit={canWrite(role, "commissioning")}
    />
  );
}
