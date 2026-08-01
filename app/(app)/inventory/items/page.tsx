import { ItemsClient } from "@/components/domain/inventory/ItemsClient";

export const dynamic = "force-dynamic";

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "Item master — Pravaah",
  description: "One item master serving quotations, sales orders, job cards, project BOQs and purchase orders.",
};

export default async function ItemMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; q?: string }>;
}) {
  const sp = await searchParams;
  return <ItemsClient initialItemId={sp.item ?? null} initialQuery={sp.q ?? ""} />;
}
