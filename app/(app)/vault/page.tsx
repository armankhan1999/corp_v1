import { requireSession } from "@/components/domain/admin/serverSession";
import { VaultBrowser } from "@/components/domain/vault/VaultBrowser";

export const dynamic = "force-dynamic";

/** E10-S1 / E10-S2 — vault tree, versioning, permissions and direct search. */
export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return (
    <VaultBrowser
      session={session}
      initial={{ category: one(sp.category), type: one(sp.type), q: one(sp.q) }}
    />
  );
}
