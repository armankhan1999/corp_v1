import type { Dataset } from "@/lib/schemas";
import { enumLabel, formatCount, formatDate } from "@/lib/format";
import type { Role } from "@/lib/schemas/enums";
import { retrievalScope, type Corpus, type Viewer } from "./access";
import { insufficiency, type AnswerContext, type BuiltAnswer, type NearestMatch } from "./answerModel";
import { answerIdFor, entryById, matchQuestion, normaliseQuestion, type BankEntry } from "./questionBank";
import { hash32 } from "./versions";

/**
 * AI-G5 — the retrieval path is legible. AI-G10 — it is deterministic: the
 * stage durations and the streaming rate are derived from a hash of the
 * question, so the same question always behaves identically, and first token
 * always lands inside the 600–1,400 ms window E10-S3 requires.
 */

export interface RetrievalStage {
  id: string;
  label: string;
  ms: number;
}

export interface RetrievalPlan {
  stages: RetrievalStage[];
  /** Milliseconds before the first character of the answer appears. */
  firstTokenMs: number;
  /** Characters per second, 18–28 per PRD §9.3. */
  charsPerSecond: number;
}

export const FIRST_TOKEN_MIN_MS = 600;
export const FIRST_TOKEN_MAX_MS = 1400;

export function buildContext(
  ds: Dataset,
  corpus: Corpus,
  viewer: Viewer,
  now: Date,
): AnswerContext {
  return {
    ds,
    now,
    viewer,
    scope: retrievalScope(corpus, viewer.role),
    corpusTotal: corpus.totalInVault,
  };
}

export function planFor(question: string, ctx: AnswerContext, answer: BuiltAnswer): RetrievalPlan {
  const h = hash32(`${question}|${ctx.viewer.role}`);
  const total = FIRST_TOKEN_MIN_MS + (h % (FIRST_TOKEN_MAX_MS - FIRST_TOKEN_MIN_MS + 1));
  const charsPerSecond = 18 + (h % 11);

  // Four stages, weighted, summing exactly to `total`.
  const weights = [0.14, 0.34, 0.26, 0.26];
  const raw = weights.map((w) => Math.round(total * w));
  const drift = total - raw.reduce((a, b) => a + b, 0);
  raw[3] = (raw[3] ?? 0) + drift;

  const readCount = answer.readCount;
  const stages: RetrievalStage[] = [
    { id: "parse", label: "Reading your question", ms: raw[0]! },
    {
      id: "search",
      label: `Searching ${formatCount(ctx.scope.searchedCount)} documents you may access`,
      ms: raw[1]!,
    },
    {
      id: "match",
      label: answer.candidateCount > 0
        ? `Matching ${formatCount(answer.candidateCount)} candidate ${answer.candidateCount === 1 ? "document" : "documents"}`
        : "Matching candidate documents",
      ms: raw[2]!,
    },
    {
      id: "read",
      label: readCount > 0
        ? `Reading ${formatCount(readCount)} ${readCount === 1 ? "source" : "sources"}`
        : "No source met the evidence threshold",
      ms: raw[3]!,
    },
  ];

  return { stages, firstTokenMs: total, charsPerSecond };
}

/* --------------------------------------------------------------- resolving */

export interface ResolvedQuestion {
  answerId: string;
  entry: BankEntry | null;
  question: string;
  answer: BuiltAnswer;
  plan: RetrievalPlan;
}

/**
 * A question that does not match the bank is not forced onto the nearest
 * entry. It runs a real term search over the permitted corpus and returns the
 * honest insufficiency response with whatever that search actually found.
 */
function freeTextFallback(question: string, ctx: AnswerContext): BuiltAnswer {
  const terms = normaliseQuestion(question);
  const scored = ctx.scope.documents
    .map((d) => {
      const hay = `${d.title} ${d.tags.join(" ")} ${d.passages.map((p) => `${p.heading} ${p.text}`).join(" ")}`.toLowerCase();
      let n = 0;
      for (const t of terms) if (hay.includes(t)) n += 1;
      return { d, n };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.d.id.localeCompare(b.d.id));

  const nearest: NearestMatch[] = scored.slice(0, 4).map((x) => ({
    documentId: x.d.id,
    title: x.d.title,
    typeLabel: enumLabel(x.d.type),
    date: formatDate(x.d.uploadedAt),
    why: `Shares ${formatCount(x.n)} of your ${formatCount(terms.length)} search ${terms.length === 1 ? "term" : "terms"}`,
  }));

  return insufficiency(ctx, {
    searched: [
      `${formatCount(ctx.scope.searchedCount)} documents in your permitted scope, of ${formatCount(ctx.corpusTotal)} in the vault`,
      `Title, tags, catalogue metadata and every indexed passage for: ${terms.join(", ") || "the terms you entered"}`,
      "The curated question bank — no entry matched this question closely enough to answer from",
    ],
    nearest,
    candidateCount: scored.length,
    note: scored.length
      ? "No document states an answer to this question. The documents below share terms with it but do not answer it, so nothing has been synthesised from them."
      : "No document in your permitted scope shares a term with this question, and nothing has been invented to fill the gap.",
  });
}

export function resolveQuestion(question: string, ctx: AnswerContext): ResolvedQuestion {
  const match = matchQuestion(question);
  const entry = match?.entry ?? null;
  const answer = entry ? entry.build(ctx) : freeTextFallback(question, ctx);
  const answerId = entry
    ? answerIdFor(entry.id, ctx.viewer.role)
    : `ANS-free-${hash32(`${question}|${ctx.viewer.role}`).toString(36)}`;
  return {
    answerId,
    entry,
    question: entry ? entry.question : question.trim(),
    answer,
    plan: planFor(question, ctx, answer),
  };
}

export function resolveById(entryId: string, ctx: AnswerContext): ResolvedQuestion | null {
  const entry = entryById(entryId);
  if (!entry) return null;
  const answer = entry.build(ctx);
  return {
    answerId: answerIdFor(entry.id, ctx.viewer.role),
    entry,
    question: entry.question,
    answer,
    plan: planFor(entry.question, ctx, answer),
  };
}

/* ------------------------------------------------------------- disclosure */

/** AI-G7 — the standing disclosure text, identical on every AI surface. */
export const STANDING_DISCLOSURE = {
  does: "reads documents and records you already have permission to see, and cites the source of every statement it makes",
  doesNot: "takes no action on your behalf — it cannot create, change, approve, send or delete anything",
  honesty: "states when the documents do not support an answer instead of producing one",
  phase: "Phase 1 answers are deterministic and drawn from a seeded corpus. No model is called and nothing leaves this machine.",
} as const;

export function roleScopeSummary(ctx: AnswerContext, role: Role): string {
  const excluded = ctx.scope.exclusions.length;
  return `${formatCount(ctx.scope.searchedCount)} of ${formatCount(ctx.corpusTotal)} documents are retrievable for ${role.replace(/_/g, " ").toLowerCase()}${excluded ? `; ${formatCount(excluded)} ${excluded === 1 ? "branch is" : "branches are"} excluded before retrieval runs` : ""}.`;
}
