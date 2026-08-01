"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSearch, Info, RotateCw, ShieldQuestion } from "lucide-react";
import { Panel, PanelHeader, Overline, SimulatedBadge } from "@/components/patterns/primitives";
import type { Briefing } from "./briefing";

/**
 * E2-S6 — AI Daily Briefing.
 *
 * The prose arrives fully formed from the server (deterministic, see
 * briefing.ts); this component streams it sentence by sentence so the reader
 * watches it assemble rather than being handed a wall of text. Reduced-motion
 * users get the finished briefing immediately.
 */

const STEP_MS = 260;

export function DailyBriefing({
  briefing,
  regenerateHref,
  nonce,
}: {
  briefing: Briefing;
  regenerateHref: string;
  nonce: string;
}) {
  const flat = useMemo(
    () => briefing.sections.flatMap((s) => s.sentences.map(() => 1)).length,
    [briefing],
  );
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealed(flat);
      return;
    }
    setRevealed(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= flat) window.clearInterval(timer);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [flat, nonce]);

  const done = revealed >= flat;
  let index = 0;

  return (
    <Panel>
      <PanelHeader
        title="Daily briefing"
        sub={`${briefing.periodLabel} · ${briefing.scopeLabel} · generated ${briefing.generatedAtLabel} IST`}
        right={
          <div className="flex items-center gap-2">
            <SimulatedBadge what="AI generation runs locally against seeded records" />
            <Link
              href={regenerateHref}
              scroll={false}
              prefetch={false}
              className="t-overline inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <RotateCw className="size-3" aria-hidden />
              Regenerate
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-4 p-4">
        <p className="t-body-sm flex gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-text-mid">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <span>{briefing.disclosure}</span>
        </p>

        <div aria-live="polite" aria-busy={!done} className="flex flex-col gap-4">
          {briefing.sections.map((section) => (
            <section key={section.heading}>
              <Overline>{section.heading}</Overline>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {section.sentences.map((s) => {
                  const myIndex = index++;
                  const visible = myIndex < revealed;
                  const isCursor = myIndex === revealed - 1 && !done;
                  const citation = s.marker
                    ? briefing.citations.find((c) => c.marker === s.marker)
                    : undefined;
                  return (
                    <li
                      key={s.text}
                      className="t-body text-text-mid"
                      style={{ visibility: visible ? "visible" : "hidden" }}
                    >
                      <span className="text-text-hi">{s.text}</span>
                      {citation ? (
                        <>
                          {" "}
                          <Link
                            href={citation.href}
                            title={`${citation.label} — ${citation.basis}`}
                            className="t-mono align-super text-[0.625rem] text-info underline decoration-dotted underline-offset-2 hover:text-text-hi"
                          >
                            [{citation.marker}]
                          </Link>
                        </>
                      ) : null}
                      {isCursor ? (
                        <span className="pv-caret ml-0.5 text-info" aria-hidden>
                          |
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {briefing.gaps.length > 0 ? (
          <section className="rounded-md border border-line bg-surface-2 p-3">
            <p className="t-overline flex items-center gap-1.5 text-warn">
              <ShieldQuestion className="size-3.5" aria-hidden />
              What this briefing will not assert
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {briefing.gaps.map((g) => (
                <li key={g} className="t-body-sm text-text-mid">
                  {g}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <Overline>Sources</Overline>
          <ol className="mt-1.5 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
            {briefing.citations.map((c) => (
              <li key={c.marker} className="bg-surface-1">
                <Link
                  href={c.href}
                  className="flex items-start gap-2 px-3 py-2 hover:bg-surface-2"
                >
                  <span className="t-mono shrink-0 text-[0.6875rem] text-info">[{c.marker}]</span>
                  <span className="min-w-0">
                    <span className="t-body-sm block truncate text-text-hi">{c.label}</span>
                    <span className="t-body-sm block text-text-lo">{c.basis}</span>
                  </span>
                  <FileSearch className="ml-auto size-3.5 shrink-0 text-text-lo" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Panel>
  );
}
