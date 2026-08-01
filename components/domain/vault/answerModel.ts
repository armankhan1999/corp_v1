import type { Dataset, PravaahDocument } from "@/lib/schemas";
import { enumLabel, formatCount, formatDate } from "@/lib/format";
import type { ConfidenceState } from "@/lib/schemas/enums";
import type { RetrievalScope, Viewer } from "./access";

/**
 * The answer contract. AI-G2 makes an uncited sentence a defect, so provenance
 * is expressed in the type: an Assertion cannot be constructed without at
 * least one citation marker. Sentences that carry no citation are not
 * assertions — they are system statements, and they render in the
 * insufficiency / limit blocks where the absence of evidence is the point.
 */

export type AnswerKind =
  | "SEEDED"
  | "TEMPLATE"
  | "INSUFFICIENT"
  | "INFERENCE_LIMIT"
  | "HR_EXCLUDED";

export interface Source {
  marker: number;
  documentId: string | null;
  passageId: string | null;
  recordSetKey: string | null;
  title: string;
  typeLabel: string;
  date: string | null;
  href: string;
  /** The exact sentence the assertion rests on, shown under the source. */
  quote: string | null;
}

export interface Assertion {
  text: string;
  /** Non-empty by construction. Enforced by `assert()`. */
  cite: number[];
}

export interface NearestMatch {
  documentId: string;
  title: string;
  typeLabel: string;
  date: string;
  why: string;
}

export interface BuiltAnswer {
  kind: AnswerKind;
  assertions: Assertion[];
  sources: Source[];
  confidence: ConfidenceState;
  confidenceBasis: string;
  /** E10-S4 AC4 — the caveat lives in the answer body, not only in the chip. */
  caveat: string | null;
  searchedCount: number;
  candidateCount: number;
  readCount: number;
  /** E10-S4 AC2 — what was searched, in plain language. */
  searchedDescription: string[];
  nearest: NearestMatch[];
  scopeNote: string | null;
}

export interface AnswerContext {
  ds: Dataset;
  now: Date;
  viewer: Viewer;
  scope: RetrievalScope;
  corpusTotal: number;
}

/* ----------------------------------------------------------------- builders */

export function assert(text: string, ...cite: number[]): Assertion {
  if (!cite.length) {
    throw new Error(`AI-G2 violation: assertion without provenance — "${text.slice(0, 60)}"`);
  }
  return { text, cite };
}

export function sourceFromDoc(
  marker: number,
  doc: PravaahDocument,
  opts: { passageId?: string | null; quote?: string | null; fromQuestion?: string } = {},
): Source {
  const passageId = opts.passageId ?? doc.passages[0]?.id ?? null;
  const quote = opts.quote ?? doc.passages.find((p) => p.id === passageId)?.text ?? null;
  const params = new URLSearchParams();
  if (passageId) params.set("p", passageId);
  if (opts.fromQuestion) params.set("from", opts.fromQuestion);
  const qs = params.toString();
  return {
    marker,
    documentId: doc.id,
    passageId,
    recordSetKey: null,
    title: doc.title,
    typeLabel: enumLabel(doc.type),
    date: doc.uploadedAt,
    href: `/vault/${doc.id}${qs ? `?${qs}` : ""}`,
    quote,
  };
}

/** AI-G2 also admits a record set as provenance where no document exists. */
export function sourceFromRecordSet(
  marker: number,
  key: string,
  label: string,
  href: string,
  quote: string,
): Source {
  return {
    marker, documentId: null, passageId: null, recordSetKey: key,
    title: label, typeLabel: "Record set", date: null, href, quote,
  };
}

export function passageOf(doc: PravaahDocument, headingStartsWith: string) {
  return doc.passages.find((p) => p.heading.toLowerCase().startsWith(headingStartsWith.toLowerCase()))
    ?? doc.passages[0]
    ?? null;
}

/* --------------------------------------------------------------- confidence */

export interface ConfidenceInput {
  sources: Source[];
  /** True when every cited source carries the same substantive text. */
  agreeing: boolean;
  /** True when the answer rests on catalogue metadata rather than document text. */
  metadataOnly?: boolean;
}

export function deriveConfidence(input: ConfidenceInput): { state: ConfidenceState; basis: string } {
  const n = input.sources.length;
  if (n === 0) {
    return { state: "INSUFFICIENT", basis: "No supporting source was found in the documents you may access." };
  }
  if (input.metadataOnly) {
    return {
      state: "LOW",
      basis: n === 1
        ? "One source, and the answer rests on the document's catalogue record rather than on indexed document text."
        : `${formatCount(n)} sources, all answering from catalogue records rather than indexed document text.`,
    };
  }
  if (!input.agreeing) {
    return {
      state: "LOW",
      basis: `${formatCount(n)} sources were read and they do not agree; the answer reports the disagreement rather than resolving it.`,
    };
  }
  if (n >= 3) {
    return { state: "HIGH", basis: `${formatCount(n)} independent sources were read and all three state the same figure.` };
  }
  if (n === 2) {
    return { state: "MODERATE", basis: "Two sources were read and they agree, which is short of the three this platform treats as High." };
  }
  return { state: "MODERATE", basis: "One source states this directly; no second document corroborates it." };
}

export const CONFIDENCE_LABEL: Record<ConfidenceState, string> = {
  HIGH: "High confidence",
  MODERATE: "Moderate confidence",
  LOW: "Low confidence",
  INSUFFICIENT: "Insufficient evidence",
};

/* ------------------------------------------------------------ insufficiency */

/**
 * E10-S4 AC2 / AI-G3 — no synthesised answer. The response states that no
 * supporting source was found, names what was searched, and offers the nearest
 * related documents that the user is actually permitted to open.
 */
export function insufficiency(
  ctx: AnswerContext,
  opts: {
    searched: string[];
    nearest: NearestMatch[];
    candidateCount?: number;
    note?: string;
  },
): BuiltAnswer {
  return {
    kind: "INSUFFICIENT",
    assertions: [],
    sources: [],
    confidence: "INSUFFICIENT",
    confidenceBasis:
      "No document in the searched set contains a statement that answers this question. Nothing has been inferred to fill the gap.",
    caveat: opts.note ?? null,
    searchedCount: ctx.scope.searchedCount,
    candidateCount: opts.candidateCount ?? 0,
    readCount: 0,
    searchedDescription: opts.searched,
    nearest: opts.nearest,
    scopeNote: ctx.scope.exclusions.length ? ctx.scope.exclusions.join(" · ") : null,
  };
}

export function nearestFromDocs(docs: PravaahDocument[], why: string, limit = 4): NearestMatch[] {
  return docs.slice(0, limit).map((d) => ({
    documentId: d.id,
    title: d.title,
    typeLabel: enumLabel(d.type),
    date: formatDate(d.uploadedAt),
    why,
  }));
}

/* ------------------------------------------------------------------ output */

export function answerPlainText(a: BuiltAnswer): string {
  return a.assertions.map((x) => x.text).join(" ");
}

export function finalise(
  ctx: AnswerContext,
  kind: AnswerKind,
  assertions: Assertion[],
  sources: Source[],
  conf: { state: ConfidenceState; basis: string },
  extra: Partial<Pick<BuiltAnswer, "caveat" | "candidateCount" | "searchedDescription" | "nearest">> = {},
): BuiltAnswer {
  return {
    kind,
    assertions,
    sources,
    confidence: conf.state,
    confidenceBasis: conf.basis,
    caveat: extra.caveat ?? null,
    searchedCount: ctx.scope.searchedCount,
    candidateCount: extra.candidateCount ?? sources.length,
    readCount: sources.length,
    searchedDescription: extra.searchedDescription ?? [],
    nearest: extra.nearest ?? [],
    scopeNote: ctx.scope.exclusions.length ? ctx.scope.exclusions.join(" · ") : null,
  };
}
