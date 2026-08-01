"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CornerDownLeft, Sparkle } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { formatCount } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import type { Session } from "@/lib/rbac/session";
import { Panel, PanelHeader, Overline } from "@/components/patterns/primitives";
import { buildAccessIndex, buildCorpus, viewerOf } from "./access";
import { buildContext, resolveById, resolveQuestion, type ResolvedQuestion } from "./retrieval";
import { suggestionsFor } from "./questionBank";
import { AnswerBlock } from "./AnswerBlock";
import { RetrievalIndicator, ScopeNote, StandingDisclosure } from "./AskChrome";
import { createdDocuments, deletions, storeAnswer, useVaultStore } from "./store";
import { useHydrated } from "./ui";

/**
 * E10-S3 / E10-S4 / E10-S5 — Ask the Vault.
 *
 * Order of events is the contract: retrieval stages complete first, then the
 * first character appears between 600 and 1,400 ms after submit, then the
 * answer streams at 18–28 characters per second with a blinking caret.
 */

type Phase = "IDLE" | "RETRIEVING" | "ANSWERING" | "DONE";

export function AskVault({ session, initialQuestionId }: { session: Session; initialQuestionId?: string }) {
  const hydrated = useHydrated();
  useVaultStore();
  const router = useRouter();

  const ds = React.useMemo(() => getDataset(), []);
  const now = React.useMemo(() => new Date(ds.meta.today), [ds]);
  const viewer = React.useMemo(() => viewerOf(session, ds), [session, ds]);
  const index = React.useMemo(() => buildAccessIndex(ds, viewer), [ds, viewer]);

  // Overlay reads are memoised on `hydrated` so the corpus is rebuilt once per
  // hydration rather than on every render.
  const created = React.useMemo(() => (hydrated ? createdDocuments() : []), [hydrated]);
  const deletedIds = React.useMemo(
    () => new Set(hydrated ? Object.keys(deletions()) : []),
    [hydrated],
  );
  const ctx = React.useMemo(
    () => buildContext(ds, buildCorpus(ds, index, { deletedIds, extra: created }), viewer, now),
    [ds, index, viewer, now, deletedIds, created],
  );

  const [input, setInput] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("IDLE");
  const [stageIndex, setStageIndex] = React.useState(0);
  const [resolved, setResolved] = React.useState<ResolvedQuestion | null>(null);
  const [restored, setRestored] = React.useState(false);
  const timers = React.useRef<number[]>([]);

  /* Returning from a citation — the answer is restored, not re-run. */
  React.useEffect(() => {
    if (!initialQuestionId) return;
    const r = resolveById(initialQuestionId, ctx);
    if (!r) return;
    setResolved(r);
    setRestored(true);
    setPhase("DONE");
    setStageIndex(r.plan.stages.length);
    setInput(r.question);
  
    // ctx is rebuilt from the same inputs; re-running on it would loop the restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestionId, hydrated]);

  React.useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    const r = resolveQuestion(trimmed, ctx);
    setResolved(r);
    setRestored(false);
    setStageIndex(0);
    setPhase("RETRIEVING");

    let elapsed = 0;
    r.plan.stages.forEach((stage, i) => {
      elapsed += stage.ms;
      timers.current.push(window.setTimeout(() => {
        setStageIndex(i + 1);
        if (i === r.plan.stages.length - 1) setPhase("ANSWERING");
      }, elapsed));
    });

    if (r.entry) router.replace(`/vault/ask?q=${r.entry.id}`, { scroll: false });
  }

  const suggestions = suggestionsFor(session.role);
  const showAnswer = resolved !== null && (phase === "ANSWERING" || phase === "DONE");

  return (
    <div className="flex flex-col gap-4">
      <StandingDisclosure
        scopeLine={`Signed in as ${ROLE_LABEL[session.role]} — ${formatCount(ctx.scope.searchedCount)} of ${formatCount(ctx.corpusTotal)} documents are retrievable for you.`}
      />

      <Panel>
        <PanelHeader
          title="Ask the Vault"
          sub="Plain-language questions answered from the document corpus, with a citation on every assertion."
          right={
            <Link href="/vault" className="t-body-sm rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi">
              Search directly instead
            </Link>
          }
        />
        <form
          className="flex flex-col gap-2 p-4"
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
        >
          <label htmlFor="vault-question" className="sr-only">Your question</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="vault-question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What is our standard warranty period on screw compressors?"
              className="h-10 min-w-64 flex-1 rounded-md border border-line bg-surface-1 px-3 text-[0.9375rem] text-text-hi placeholder:text-text-lo hover:border-line-strong"
            />
            <button
              type="submit"
              disabled={!input.trim() || phase === "RETRIEVING"}
              className="t-body-sm inline-flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-white hover:bg-primary-500 disabled:opacity-40"
            >
              Ask <CornerDownLeft className="size-3.5" aria-hidden />
            </button>
          </div>
          <p className="t-body-sm text-text-lo">
            Direct search is on the Browse screen and does not go through this path — you are never obliged to hold a
            conversation to find a file.
          </p>
        </form>

        <div className="border-t border-line p-4">
          <ScopeNote exclusions={ctx.scope.exclusions} searched={ctx.scope.searchedCount} total={ctx.corpusTotal} />
        </div>
      </Panel>

      {phase === "IDLE" && !resolved ? (
        <Panel>
          <PanelHeader
            title="Starter questions"
            sub={`Grounded in the seeded Bhushan Corp corpus and chosen for ${ROLE_LABEL[session.role]}. Another role is offered a different set.`}
          />
          <ul className="divide-y divide-line">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { setInput(s.question); ask(s.question); }}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
                >
                  <Sparkle className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
                  <span className="min-w-0">
                    <span className="t-body block text-text-hi">{s.question}</span>
                    <span className="t-body-sm block text-text-lo">{s.category}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {resolved && (phase === "RETRIEVING" || phase === "ANSWERING" || phase === "DONE") && !restored ? (
        <RetrievalIndicator
          stages={resolved.plan.stages}
          activeIndex={stageIndex}
          done={stageIndex >= resolved.plan.stages.length}
        />
      ) : null}

      {showAnswer && resolved ? (
        <AnswerBlock
          key={resolved.answerId + (restored ? "-restored" : "-live")}
          answer={resolved.answer}
          answerId={resolved.answerId}
          question={resolved.question}
          charsPerSecond={resolved.plan.charsPerSecond}
          stream={!restored}
          viewer={viewer}
          onStreamComplete={() => {
            setPhase("DONE");
            storeAnswer({
              answerId: resolved.answerId,
              questionId: resolved.entry?.id ?? "free-text",
              question: resolved.question,
              role: session.role,
              body: resolved.answer.assertions.map((a) => a.text).join(" "),
              confidence: resolved.answer.confidence,
              confidenceBasis: resolved.answer.confidenceBasis,
              citations: resolved.answer.sources.map((s) => ({
                marker: s.marker, documentId: s.documentId, passageId: s.passageId,
                recordSetKey: s.recordSetKey, label: s.title, type: s.typeLabel, date: s.date, href: s.href,
              })),
              searchedCount: resolved.answer.searchedCount,
              readCount: resolved.answer.readCount,
              refusal: resolved.answer.kind === "INSUFFICIENT" || resolved.answer.kind === "HR_EXCLUDED",
              at: new Date().toISOString(),
            });
          }}
        />
      ) : null}

      {resolved && phase !== "IDLE" ? (
        <Panel className="px-4 py-3">
          <Overline>Ask another</Overline>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.filter((s) => s.id !== resolved.entry?.id).slice(0, 4).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setInput(s.question); ask(s.question); }}
                className="t-body-sm rounded-md border border-line bg-surface-2 px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                {s.question}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
