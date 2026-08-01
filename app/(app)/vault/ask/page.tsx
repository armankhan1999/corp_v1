import { requireSession } from "@/components/domain/admin/serverSession";
import { AskVault } from "@/components/domain/vault/AskVault";

export const dynamic = "force-dynamic";

/**
 * E10-S3 / E10-S4 / E10-S5 — cited retrieval, confidence states, honest
 * insufficiency and answer feedback. Deterministic and seeded (AI-G10).
 */
export default async function AskVaultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;

  return <AskVault session={session} initialQuestionId={q} />;
}
