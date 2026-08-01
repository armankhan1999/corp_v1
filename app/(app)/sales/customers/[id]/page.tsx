import { Customer360 } from "@/components/domain/sales/Customer360";

export const dynamic = "force-dynamic";

/** E3-S2 — Customer 360: forty years of relationship in one screen. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Customer360 customerId={id} />;
}
