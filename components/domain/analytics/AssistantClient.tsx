"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Ban, Database, Eraser, Info, Send, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Overline, Panel, StatusBadge } from "@/components/patterns/primitives";
import type { AssistantAnswer } from "./assistantBank";

interface Prompt { id: string; question: string }
interface Turn { id: string; question: string; answer: AssistantAnswer }

const HISTORY_KEY = "pravaah.v1.assistant.history";

/**
 * E13-S1/S4 — natural-language querying with record-set disclosure, and the
 * guardrails that make it defensible: no autonomous action, explicit refusal
 * rather than estimation, and a standing disclosure on the surface.
 */
export function AssistantClient({
  prompts, resolve, roleLabel, scopeLabel,
}: {
  prompts: Prompt[];
  resolve: (input: { id?: string; text: string }) => Promise<AssistantAnswer>;
  roleLabel: string;
  scopeLabel: string;
}) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [trail, setTrail] = React.useState<string[]>([]);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(HISTORY_KEY);
      if (raw) setTurns(JSON.parse(raw) as Turn[]);
    } catch { /* storage unavailable */ }
  }, []);

  const persist = (next: Turn[]) => {
    setTurns(next);
    try {
      window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
  };

  async function ask(question: string, id?: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput("");
    // E13-S1: the reasoning trail names the datasets before the result appears.
    setTrail(["Resolving scope and permissions…"]);
    await new Promise((r) => setTimeout(r, 420));
    const answer = await resolve({ id, text: question });
    setTrail(
      answer.queried.length
        ? [`Querying ${answer.queried.length} datasets`, ...answer.queried.map((q) => `· ${q}`)]
        : ["No dataset was queried"],
    );
    await new Promise((r) => setTimeout(r, 520));
    persist([...turns, { id: `${Date.now()}`, question, answer }]);
    setTrail([]);
    setBusy(false);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Assistant</h1>
          <p className="t-body-sm mt-1 text-text-mid">
            Ask the business a question. Every answer shows its formula and the records it came from.
          </p>
        </div>
        {turns.length > 0 ? (
          <button
            type="button"
            onClick={() => persist([])}
            className="t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <Eraser className="size-4" aria-hidden />
            Clear conversation
          </button>
        ) : null}
      </div>

      {/* AI-G7 — standing disclosure, always present */}
      <Panel className="p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <div className="min-w-0">
            <p className="t-label text-text-hi">What this assistant does</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              <li className="t-body-sm text-text-mid">
                <span className="text-text-hi">It reads and cites.</span> Answers are computed from
                platform data, with the formula shown and the record set one click away.
              </li>
              <li className="t-body-sm text-text-mid">
                <span className="text-text-hi">It does not act.</span> It cannot approve, send,
                create or delete anything. It prepares drafts; you perform the action.
              </li>
              <li className="t-body-sm text-text-mid">
                <span className="text-text-hi">It declines rather than guesses.</span> Where the
                data does not support an answer it says so and names what would be required.
              </li>
            </ul>
            <p className="t-body-sm mt-2 text-text-lo">
              Answering as {roleLabel} · {scopeLabel} · responses are deterministic prototype
              behaviour.
            </p>
          </div>
        </div>
      </Panel>

      {turns.length === 0 && !busy ? (
        <Panel className="p-4">
          <Overline>Try one of these</Overline>
          <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            {prompts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => ask(p.question, p.id)}
                  className="lift flex min-h-11 w-full items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-left"
                >
                  <ArrowRight className="size-3.5 shrink-0 text-text-lo" aria-hidden />
                  <span className="t-body-sm text-text-hi">{p.question}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <ol className="flex flex-col gap-4">
        {turns.map((t) => (
          <li key={t.id} className="flex flex-col gap-2">
            <p className="t-body self-end rounded-lg rounded-br-sm bg-primary-600 px-3 py-2 text-white">
              {t.question}
            </p>
            <AnswerBlock answer={t.answer} />
          </li>
        ))}
      </ol>

      {busy ? (
        <Panel className="p-4">
          <ul className="flex flex-col gap-1">
            {trail.map((line, i) => (
              <li key={i} className="t-body-sm flex items-center gap-2 text-text-mid">
                <Database className="size-3.5 shrink-0 text-text-lo" aria-hidden />
                {line}
              </li>
            ))}
            <li className="t-body-sm text-text-lo">
              <span className="pv-caret">▋</span>
            </li>
          </ul>
        </Panel>
      ) : null}

      <div ref={endRef} />

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(input); }}
        className="sticky bottom-4 flex gap-2"
      >
        <label htmlFor="assistant-input" className="sr-only">Ask a question</label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about receivables, renewals, service performance, projects…"
          disabled={busy}
          className="panel t-body min-h-11 flex-1 px-3 text-text-hi placeholder:text-text-lo"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary-600 px-4 font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden />
          Ask
        </button>
      </form>
    </div>
  );
}

function AnswerBlock({ answer }: { answer: AssistantAnswer }) {
  const refusal = answer.kind === "REFUSAL";
  return (
    <Panel className={cn("overflow-hidden", refusal && "border-warn/40")}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {refusal ? (
            <StatusBadge tone="warn">
              <Ban className="size-3" aria-hidden /> Declined
            </StatusBadge>
          ) : (
            <StatusBadge tone="ok">Answered from platform data</StatusBadge>
          )}
          <span className="t-overline text-text-lo">{answer.scopeNote}</span>
        </div>

        <p
          className={cn(
            "text-text-hi",
            refusal ? "t-heading-md" : "t-display-md",
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {answer.headline}
        </p>

        <p className="t-body-lg text-text-mid">{answer.narrative}</p>

        {answer.caution ? (
          <p className="t-body-sm flex items-start gap-2 rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {answer.caution}
          </p>
        ) : null}

        {answer.requires ? (
          <div className="rounded-md border border-line bg-surface-2 p-3">
            <Overline>What would be required</Overline>
            <p className="t-body-sm mt-1 text-text-mid">{answer.requires}</p>
          </div>
        ) : null}
      </div>

      {answer.rows && answer.rows.length > 0 && answer.columns ? (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {answer.columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "t-overline border-b border-line bg-surface-2 px-3 py-2 text-text-lo",
                      c.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.rows.map((r, i) => (
                <tr key={i} className="hover:bg-surface-2">
                  {answer.columns!.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "t-body-sm border-b border-line px-3 py-2",
                        c.numeric ? "text-right text-text-hi" : "text-text-mid",
                      )}
                      style={c.numeric ? { fontVariantNumeric: "tabular-nums" } : undefined}
                    >
                      {r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2 px-4 py-3">
        {answer.formula ? (
          <details className="min-w-0 flex-1">
            <summary className="t-body-sm cursor-pointer text-text-mid">Show the formula</summary>
            <p className="t-body-sm mt-1.5 text-text-lo">{answer.formula}</p>
          </details>
        ) : (
          <span className="t-body-sm flex-1 text-text-lo">No computation was performed.</span>
        )}
        {answer.recordSetHref ? (
          <Link
            href={answer.recordSetHref}
            className="t-body-sm inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface-1 px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            {answer.recordSetLabel ?? "Open records"}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}
