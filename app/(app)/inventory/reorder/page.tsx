import { ReorderClient } from "@/components/domain/inventory/ReorderClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reorder list — Pravaah",
};

/**
 * E7-S5 — the reorder list, service-critical above velocity-ranked.
 * Membership and order are both derived from the ledger in the browser, so the
 * server component only translates the query string into a starting view.
 */
export default async function ReorderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const trailing = Number(one(sp.trailing));

  return (
    <ReorderClient
      initialQuery={one(sp.q) ?? ""}
      initialCriticalOnly={one(sp.critical) === "1"}
      initialTrailing={Number.isFinite(trailing) && trailing >= 30 ? Math.min(730, trailing) : 180}
    />
  );
}
