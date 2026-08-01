"use client";

import * as React from "react";
import { CheckCircle2, CircleHelp, Eye, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ConfidenceState } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/patterns/primitives";
import { CONFIDENCE_LABEL } from "./answerModel";
import { STANDING_DISCLOSURE, type RetrievalStage } from "./retrieval";
import { PrototypeChip } from "./ui";

/* ------------------------------------------------------- AI-G4 confidence */

const CHIP: Record<ConfidenceState, { cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  HIGH: { cls: "border-ok/50 bg-ok-bg text-ok", icon: CheckCircle2 },
  MODERATE: { cls: "border-info/50 bg-info-bg text-info", icon: ShieldCheck },
  LOW: { cls: "border-warn/60 bg-warn-bg text-warn", icon: TriangleAlert },
  INSUFFICIENT: { cls: "border-danger/60 bg-danger-bg text-danger", icon: CircleHelp },
};

export function ConfidenceChip({ state, basis }: { state: ConfidenceState; basis: string }) {
  const c = CHIP[state];
  const Icon = c.icon;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", c.cls)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="t-label">{CONFIDENCE_LABEL[state]}</p>
        <p className="t-body-sm mt-0.5 text-text-mid">{basis}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- AI-G7 disclosure */

export function StandingDisclosure({ scopeLine }: { scopeLine?: string }) {
  return (
    <Panel className="border-line-strong bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="t-overline text-text-lo">What this assistant does</p>
        <PrototypeChip />
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        <li className="t-body-sm text-text-mid">
          <span className="text-text-hi">It reads and cites.</span> It {STANDING_DISCLOSURE.does}.
        </li>
        <li className="t-body-sm text-text-mid">
          <span className="text-text-hi">It does not act.</span> It {STANDING_DISCLOSURE.doesNot}.
        </li>
        <li className="t-body-sm text-text-mid">
          <span className="text-text-hi">It says when it cannot answer.</span> It {STANDING_DISCLOSURE.honesty}.
        </li>
      </ul>
      <p className="t-body-sm mt-2 text-text-lo">{STANDING_DISCLOSURE.phase}</p>
      {scopeLine ? <p className="t-body-sm mt-1 text-text-lo">{scopeLine}</p> : null}
    </Panel>
  );
}

/* -------------------------------------------------- AI-G5 retrieval stages */

/**
 * E10-S3 AC1 — the staged retrieval indicator is shown in plain language and
 * completes before a single character of answer text appears.
 */
export function RetrievalIndicator({
  stages, activeIndex, done,
}: { stages: RetrievalStage[]; activeIndex: number; done: boolean }) {
  return (
    <Panel className="p-4" aria-live="polite" aria-busy={!done}>
      <p className="t-overline text-text-lo">Retrieval path</p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {stages.map((s, i) => {
          const complete = done || i < activeIndex;
          const active = !done && i === activeIndex;
          return (
            <li key={s.id} className="flex items-center gap-2">
              {complete ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-ok" aria-hidden />
              ) : active ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-info" aria-hidden />
              ) : (
                <span className="size-3.5 shrink-0 rounded-full border border-line" aria-hidden />
              )}
              <span className={cn("t-body-sm", complete ? "text-text-mid" : active ? "text-text-hi" : "text-text-lo")}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------- AI-G6 scope note */

export function ScopeNote({ exclusions, searched, total }: { exclusions: string[]; searched: number; total: number }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-line bg-surface-0/40 px-3 py-2">
      <Eye className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
      <div className="min-w-0">
        <p className="t-body-sm text-text-mid">
          Retrieval ran over <span className="text-text-hi">{searched.toLocaleString("en-IN")}</span> of{" "}
          {total.toLocaleString("en-IN")} documents — the ones your role may open. Another role asking this question
          may correctly get a different answer.
        </p>
        {exclusions.map((e) => (
          <p key={e} className="t-body-sm mt-0.5 text-text-lo">Excluded before retrieval — {e}.</p>
        ))}
      </div>
    </div>
  );
}
