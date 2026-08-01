import { QuotationDetail } from "@/components/domain/sales/QuotationDetail";

export const dynamic = "force-dynamic";

/**
 * E3-S4 / E3-S5 / E3-S6 / E3-S7 — quotation builder with derived GST, version
 * history, the discount approval gate, and win/loss conversion.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationDetail quotationId={id} />;
}
