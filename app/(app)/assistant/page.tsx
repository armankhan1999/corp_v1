import { getDataset } from "@/lib/seed";
import { scopeFor } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { requireSession } from "@/components/domain/admin/serverSession";
import { AssistantClient } from "@/components/domain/analytics/AssistantClient";
import {
  ASSISTANT_BANK, findAnswer, unknownQuestion, type AssistantAnswer,
} from "@/components/domain/analytics/assistantBank";

export const dynamic = "force-dynamic";

/**
 * E13 — AI Executive Assistant. Resolution happens in a server action so the
 * client bundle never carries the dataset, and so AI-G1 is structural: there is
 * no code path here that mutates a business record.
 */
export default async function AssistantPage() {
  const session = await requireSession();
  const ds = getDataset();
  const scope = scopeFor(session.role, "assistant");
  const branch = ds.branches.find((b) => b.id === session.branchId);

  async function resolve(input: { id?: string; text: string }): Promise<AssistantAnswer> {
    "use server";
    const data = getDataset();
    if (input.id) {
      const hit = findAnswer(data, input.id);
      if (hit) return hit;
    }
    // Loose match on the typed question before falling back to insufficiency.
    const needle = input.text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const entry = ASSISTANT_BANK.find((e) => {
      const q = e.question.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      if (q === needle) return true;
      const words = needle.split(/\s+/).filter((w) => w.length > 4);
      return words.length >= 2 && words.every((w) => q.includes(w));
    });
    return entry ? entry.answer(data) : unknownQuestion(input.text);
  }

  const scopeLabel =
    scope === "BRANCH" || scope === "OWN"
      ? `Scoped to ${branch?.name ?? "your branch"}`
      : scope === "ASSIGNED"
        ? "Scoped to your assignments"
        : "All branches";

  return (
    <AssistantClient
      prompts={ASSISTANT_BANK.map((e) => ({ id: e.id, question: e.question }))}
      resolve={resolve}
      roleLabel={ROLE_LABEL[session.role]}
      scopeLabel={scopeLabel}
    />
  );
}
