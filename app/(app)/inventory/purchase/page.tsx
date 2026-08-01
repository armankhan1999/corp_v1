import { PurchaseClient } from "@/components/domain/inventory/PurchaseClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase & goods receipt — Pravaah",
};

const TABS = ["orders", "receipts", "suppliers"] as const;
type Tab = (typeof TABS)[number];

/**
 * E7-S4 — purchase orders, goods receipts and the supplier master.
 * The audit log links here with `?focus={id}` (see `components/domain/admin/links.ts`),
 * so the focus parameter is honoured on the supplier tab.
 */
export default async function PurchasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const rawTab = (one(sp.tab) ?? "orders").toLowerCase() as Tab;
  const tab: Tab = TABS.includes(rawTab) ? rawTab : "orders";
  const status = (one(sp.status) ?? "").toUpperCase();

  return (
    <PurchaseClient
      initialTab={tab}
      initialQuery={one(sp.q) ?? ""}
      initialStatus={status}
      initialFocus={one(sp.focus) ?? ""}
    />
  );
}
