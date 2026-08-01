import {
  buildBranchRefs, buildFollowUpRows, buildInvoiceRows, buildUserRefs, ctx, readActor,
} from "@/components/domain/commercial/data";
import { ReceivablesClient } from "./ReceivablesClient";

export const dynamic = "force-dynamic";

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "Receivables — Pravaah",
  description: "Receivables aged 0–30 / 31–60 / 61–90 / 90+, institutional against private exposure, broken promises and escalations.",
};

export default async function ReceivablesPage() {
  const { ds, now, todayIso } = ctx();
  const actor = await readActor("receivables");

  const rows = buildInvoiceRows(ds, now);
  const executiveIds = new Set(rows.map((r) => r.accountExecutiveId));

  return (
    <ReceivablesClient
      rows={rows}
      followUps={buildFollowUpRows(ds)}
      branches={buildBranchRefs(ds)}
      executives={buildUserRefs(ds, executiveIds)}
      actor={actor}
      todayIso={todayIso}
    />
  );
}
