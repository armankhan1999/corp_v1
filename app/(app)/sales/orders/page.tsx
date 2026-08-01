import { OrdersPage } from "@/components/domain/sales/OrdersPage";

export const dynamic = "force-dynamic";

/** E3-S7 — sales order register; the open order book reconciles to the seed. */
export default function Page() {
  return <OrdersPage />;
}
