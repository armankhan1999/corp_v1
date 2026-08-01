"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Layers, SearchX, ThumbsDown, ThumbsUp, Ban } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader, Overline, StatusBadge } from "@/components/patterns/primitives";
import type { BuiltAnswer } from "./answerModel";
import { ConfidenceChip } from "./AskChrome";
import { feedbackFor, upsertFeedback, useVaultStore, type StoredCitation } from "./store";
import type { Viewer } from "./access";

/**
 * The answer is an evidence surface, not a chat bubble: streamed prose with a
 * superscript marker on every assertion, a numbered source list beneath, a
 * confidence chip with its basis, and feedback controls.
 *
 * AI-G2 is enforced upstream in the type — an Assertion cannot exist without a
 * marker — so nothing rendered here can be an uncited factual claim.
 */

interface Props {
  answer: BuiltAnswer;
  answerId: string;
  question: string;
  charsPerSecond: number;
  stream: boolean;
  viewer: Viewer;
  onStreamComplete?: () => void;
}

export function AnswerBlock({ answer, answerId, question, charsPerSecond, stream, viewer, onStreamComplete }: Props) {
  const full = React.useMemo(() => answer.assertions.map((a) => a.text).join(" "), [answer]);
  const [revealed, setRevealed] = React.useState(() => (stream ? 0 : full.length));
  const done = revealed >= full.length;

  React.useEffect(() => {
    if (!stream) { setRevealed(full.length); return; }
    setRevealed(0);
    if (!full.length) { onStreamComplete?.(); return; }
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const chars = Math.floor(((ts - start) / 1000) * charsPerSecond);
      setRevealed(Math.min(chars, full.length));
      if (chars < full.length) raf = window.requestAnimationFrame(step);
      else onStreamComplete?.();
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, charsPerSecond, stream]);

  const low = answer.confidence === "LOW";
  const insufficient = answer.confidence === "INSUFFICIENT";

  let offset = 0;
  const pieces = answer.assertions.map((a) => {
    const start = offset;
    const end = offset + a.text.length;
    offset = end + 1;
    return { a, start, end };
  });

  return (
    <div className="flex flex-col gap-3">
      <Panel
        className={cn(
          "overflow-hidden",
          low && "border-l-2 border-l-warn",
          insufficient && "border-l-2 border-l-danger",
          answer.confidence === "HIGH" && "border-l-2 border-l-ok",
          answer.confidence === "MODERATE" && "border-l-2 border-l-info",
        )}
      >
        <PanelHeader
          title={question}
          sub={`Answered from ${answer.readCount} cited ${answer.readCount === 1 ? "source" : "sources"} · ${answer.searchedCount.toLocaleString("en-IN")} documents searched`}
        />

        <div className="flex flex-col gap-4 p-4">
          <ConfidenceChip state={answer.confidence} basis={answer.confidenceBasis} />

          {answer.kind === "INFERENCE_LIMIT" ? (
            <div className="flex items-start gap-2 rounded-lg border border-warn/60 bg-warn-bg p-3">
              <Ban className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              <div>
                <p className="t-label text-text-hi">This question asks for something the documents cannot support</p>
                <p className="t-body-sm mt-1 text-text-mid">{answer.caveat}</p>
                <p className="t-body-sm mt-1 text-text-mid">
                  What the documents do record is set out below, and nothing beyond it has been extrapolated.
                </p>
              </div>
            </div>
          ) : null}

          {answer.assertions.length > 0 ? (
            <div
              className={cn(
                "rounded-lg p-3",
                low ? "bg-warn-bg/50" : "bg-surface-0/40",
              )}
              aria-live="polite"
              aria-busy={!done}
            >
              <p className="t-body-lg text-text-hi">
                {pieces.map(({ a, start, end }, i) => {
                  const visible = Math.max(0, Math.min(revealed, end) - start);
                  if (visible <= 0) return null;
                  const text = a.text.slice(0, visible);
                  const complete = revealed >= end;
                  const isLastVisible = !done && revealed < end;
                  return (
                    <React.Fragment key={i}>
                      {text}
                      {complete ? (
                        <sup className="ml-0.5">
                          {a.cite.map((m, k) => (
                            <React.Fragment key={m}>
                              {k > 0 ? <span className="text-text-lo">,</span> : null}
                              <a
                                href={`#source-${answerId}-${m}`}
                                className="t-mono rounded-md px-[2px] text-[0.6875rem] text-primary-400 hover:bg-primary-100 hover:text-primary-500"
                                aria-label={`Citation ${m}`}
                              >
                                {m}
                              </a>
                            </React.Fragment>
                          ))}
                        </sup>
                      ) : null}
                      {isLastVisible ? (
                        <span className="pv-caret ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] bg-primary-400" aria-hidden />
                      ) : null}
                      {complete && i < pieces.length - 1 ? " " : null}
                    </React.Fragment>
                  );
                })}
              </p>

              {low && answer.caveat && answer.kind !== "INFERENCE_LIMIT" && done ? (
                <p className="t-body-sm mt-3 border-t border-warn/40 pt-2 text-warn">{answer.caveat}</p>
              ) : null}
              {!low && answer.caveat && answer.kind !== "INFERENCE_LIMIT" && done ? (
                <p className="t-body-sm mt-3 border-t border-line pt-2 text-text-mid">{answer.caveat}</p>
              ) : null}

              {!done ? (
                <button
                  type="button"
                  onClick={() => setRevealed(full.length)}
                  className="t-body-sm mt-3 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
                >
                  Show the full answer
                </button>
              ) : null}
            </div>
          ) : null}

          {answer.kind === "INSUFFICIENT" || answer.kind === "HR_EXCLUDED" ? (
            <InsufficiencyBlock answer={answer} />
          ) : null}

          {answer.sources.length > 0 && done ? (
            <SourceList answerId={answerId} answer={answer} />
          ) : null}
        </div>

        {done ? <FeedbackControls answer={answer} answerId={answerId} question={question} viewer={viewer} /> : null}
      </Panel>
    </div>
  );
}

/* ----------------------------------------------------------- source list */

function SourceList({ answerId, answer }: { answerId: string; answer: BuiltAnswer }) {
  return (
    <div>
      <Overline>Sources — {answer.sources.length} read, all cited above</Overline>
      <ol className="mt-2 flex flex-col gap-2">
        {answer.sources.map((s) => (
          <li
            key={s.marker}
            id={`source-${answerId}-${s.marker}`}
            className="flex items-start gap-3 rounded-md border border-line bg-surface-0/40 p-3 target:border-primary-500"
          >
            <span className="t-mono mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-line-strong text-[0.6875rem] text-text-hi">
              {s.marker}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {s.recordSetKey ? (
                  <Layers className="size-3.5 shrink-0 text-info" aria-hidden />
                ) : (
                  <FileText className="size-3.5 shrink-0 text-text-lo" aria-hidden />
                )}
                <Link href={s.href} className="t-body-sm text-primary-400 hover:text-primary-500">
                  {s.title}
                </Link>
                <StatusBadge tone={s.recordSetKey ? "info" : "neutral"} icon={false}>{s.typeLabel}</StatusBadge>
                {s.date ? <span className="t-mono text-[0.75rem] text-text-lo" data-numeric>{formatDate(s.date)}</span> : null}
              </div>
              {s.quote ? (
                <p className="t-body-sm mt-1 border-l-2 border-line-strong pl-2 text-text-mid">{s.quote}</p>
              ) : null}
              <p className="t-body-sm mt-1 text-text-lo">
                {s.recordSetKey
                  ? "Opens the record set this statement was computed from."
                  : "Opens the document with this passage highlighted. You can return to the answer without losing it."}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------------------- E10-S4 insufficiency state */

function InsufficiencyBlock({ answer }: { answer: BuiltAnswer }) {
  const hrExcluded = answer.kind === "HR_EXCLUDED";
  return (
    <div className="rounded-lg border border-danger/50 bg-danger-bg/60 p-4">
      <div className="flex items-start gap-2">
        <SearchX className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="t-heading-md text-text-hi">
            {hrExcluded ? "That branch is excluded from retrieval" : "I could not find a source for that"}
          </p>
          <p className="t-body-lg mt-1 text-text-mid">{answer.caveat ?? answer.confidenceBasis}</p>

          <div className="mt-3">
            <Overline>What was searched</Overline>
            <ul className="mt-1 flex flex-col gap-0.5">
              {answer.searchedDescription.map((s) => (
                <li key={s} className="t-body-sm text-text-mid">— {s}</li>
              ))}
            </ul>
          </div>

          {answer.nearest.length > 0 ? (
            <div className="mt-3">
              <Overline>Nearest related documents</Overline>
              <ul className="mt-1 flex flex-col gap-1">
                {answer.nearest.map((n) => (
                  <li key={n.documentId} className="t-body-sm flex flex-wrap items-baseline gap-x-2 text-text-mid">
                    <Link href={`/vault/${n.documentId}`} className="text-primary-400 hover:text-primary-500">{n.title}</Link>
                    <span className="text-text-lo">{n.typeLabel} · {n.date}</span>
                    <span className="text-text-lo">— {n.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="t-body-sm mt-3 text-text-lo">
              No related document was close enough to offer, so none has been offered.
            </p>
          )}

          <p className="t-body-sm mt-3 border-t border-danger/30 pt-2 text-text-hi">
            No answer has been synthesised. Nothing above is a guess.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- E10-S5 / AI-G8 feedback */

function FeedbackControls({
  answer, answerId, question, viewer,
}: { answer: BuiltAnswer; answerId: string; question: string; viewer: Viewer }) {
  useVaultStore();
  const existing = feedbackFor(answerId);
  const [comment, setComment] = React.useState(existing?.comment ?? "");
  const [open, setOpen] = React.useState(false);

  const citations: StoredCitation[] = answer.sources.map((s) => ({
    marker: s.marker, documentId: s.documentId, passageId: s.passageId,
    recordSetKey: s.recordSetKey, label: s.title, type: s.typeLabel, date: s.date, href: s.href,
  }));

  function submit(helpful: boolean, withComment: string) {
    upsertFeedback({
      id: `VFB-${answerId}`,
      answerId,
      question,
      answerBody: answer.assertions.map((a) => a.text).join(" ") || "(no synthesised answer — insufficiency response)",
      citations,
      confidence: answer.confidence,
      helpful,
      comment: withComment.trim(),
      byUserId: viewer.userId, byName: viewer.name, byRole: viewer.role,
      at: new Date().toISOString(),
    });
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line bg-surface-0/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Overline>Was this answer useful?</Overline>
        <button
          type="button"
          onClick={() => submit(true, comment)}
          aria-pressed={existing?.helpful === true}
          className={cn(
            "t-body-sm inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
            existing?.helpful === true
              ? "border-ok bg-ok-bg text-ok"
              : "border-line text-text-mid hover:border-line-strong hover:text-text-hi",
          )}
        >
          <ThumbsUp className="size-3.5" aria-hidden /> Helpful
        </button>
        <button
          type="button"
          onClick={() => submit(false, comment)}
          aria-pressed={existing?.helpful === false}
          className={cn(
            "t-body-sm inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
            existing?.helpful === false
              ? "border-danger bg-danger-bg text-danger"
              : "border-line text-text-mid hover:border-line-strong hover:text-text-hi",
          )}
        >
          <ThumbsDown className="size-3.5" aria-hidden /> Not helpful
        </button>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="t-body-sm rounded-md border border-line px-2.5 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          {existing?.comment ? "Edit comment" : "Add a comment"}
        </button>
        {existing ? (
          <span className="t-body-sm text-text-lo">
            Recorded {existing.helpful ? "helpful" : "not helpful"} by {existing.byName}. You can change it.
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional — what was wrong, missing or good about this answer?"
            aria-label="Feedback comment"
            className="h-8 min-w-64 flex-1 rounded-md border border-line bg-surface-1 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo"
          />
          <button
            type="button"
            onClick={() => submit(existing?.helpful ?? true, comment)}
            className="t-body-sm rounded-md bg-primary-600 px-3 py-1 text-white hover:bg-primary-500"
          >
            Save comment
          </button>
        </div>
      ) : existing?.comment ? (
        <p className="t-body-sm text-text-mid">Comment: {existing.comment}</p>
      ) : null}

      <p className="t-body-sm text-text-lo">
        The question, the answer, the cited sources and the confidence state are retained with your rating for
        Phase 2 evaluation.
      </p>
    </div>
  );
}
