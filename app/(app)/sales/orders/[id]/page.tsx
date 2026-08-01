import { OrderDetail } from "@/components/domain/sales/OrderDetail";

export const dynamic = "force-dynamic";

/**
 * E3-S7 — sales order detail: customer PO, delivery schedule, advance, and
 * line-level fulfilment with partial despatch, linked back to its quotation.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail orderId={id} />;
}
