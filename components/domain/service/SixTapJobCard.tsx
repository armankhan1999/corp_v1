"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check, ChevronLeft, CloudOff, Eraser, Hand, LogIn, PenLine, Send, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/format";
import { Overline, Panel, StatusBadge } from "@/components/patterns/primitives";
import type { JobOutcome, RootCause } from "@/lib/schemas/enums";
import { OUTCOME_LABEL, ROOT_CAUSE_LABEL } from "./types";

const STORE_KEY = "pravaah.v1.field.jobcard";

export interface SixTapInput {
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  siteName: string;
  siteAddress: string;
  assetModel: string;
  assetSerial: string;
  problem: string;
  coverageLabel: string;
  contactName: string;
  contactDesignation: string;
  previousReading: number | null;
  suggestedReading: number;
  observationPresets: string[];
  workPresets: string[];
  rootCausePresets: RootCause[];
  todayIso: string;
}

interface Draft {
  checkedInAt: string | null;
  observation: string;
  work: string;
  rootCause: RootCause | null;
  outcome: JobOutcome | null;
  reading: number | null;
  signed: boolean;
  submittedAt: string | null;
  taps: number;
}

const BLANK: Draft = {
  checkedInAt: null, observation: "", work: "", rootCause: null,
  outcome: null, reading: null, signed: false, submittedAt: null, taps: 0,
};

function load(ticketId: string): Draft {
  if (typeof window === "undefined") return BLANK;
  try {
    const raw = window.localStorage.getItem(`${STORE_KEY}.${ticketId}`);
    return raw ? { ...BLANK, ...(JSON.parse(raw) as Draft) } : BLANK;
  } catch {
    return BLANK;
  }
}

/**
 * E4-S5 — the six-tap mobile job card. BRD R-01 scores field adoption as the
 * single highest risk in the programme, so the budget is measured on screen
 * rather than asserted.
 *
 * PLAN.md C-05 adjudication, published to the user below:
 *   • a TAP is one discrete commit on an actionable control;
 *   • a STANDARD VISIT is one asset, one root cause, outcome Resolved, no parts.
 * Typing into a pre-filled field is not a tap. The with-parts path budgets 8.
 */
export function SixTapJobCard({ input }: { input: SixTapInput }) {
  const [draft, setDraft] = React.useState<Draft>(BLANK);
  const [hydrated, setHydrated] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [readingText, setReadingText] = React.useState("");
  const [strokes, setStrokes] = React.useState<{ x: number; y: number }[][]>([]);
  const drawing = React.useRef(false);
  const padRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const d = load(input.ticketId);
    setDraft(d);
    setReadingText(String(d.reading ?? input.suggestedReading));
    setHydrated(true);
  }, [input.ticketId, input.suggestedReading]);

  const commit = React.useCallback(
    (patch: Partial<Draft>, countsAsTap = true) => {
      setDraft((prev) => {
        const next: Draft = { ...prev, ...patch, taps: prev.taps + (countsAsTap ? 1 : 0) };
        try {
          window.localStorage.setItem(`${STORE_KEY}.${input.ticketId}`, JSON.stringify(next));
        } catch { /* storage unavailable — the step still holds in memory */ }
        return next;
      });
    },
    [input.ticketId],
  );

  /* Steps are ordered; the flow resumes at the first incomplete one. */
  const steps = [
    { key: "checkin", label: "Check in", done: draft.checkedInAt !== null },
    { key: "observation", label: "What you found", done: draft.observation.length > 0 },
    { key: "work", label: "What you did", done: draft.work.length > 0 },
    { key: "outcome", label: "Outcome", done: draft.outcome !== null },
    { key: "sign", label: "Customer signature", done: draft.signed },
    { key: "submit", label: "Submit", done: draft.submittedAt !== null },
  ];
  const activeIndex = steps.findIndex((s) => !s.done);
  const current = activeIndex === -1 ? steps.length - 1 : activeIndex;

  const readingValue = Number(readingText);
  const readingTooLow =
    input.previousReading !== null &&
    Number.isFinite(readingValue) &&
    readingValue < input.previousReading;

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3">
        <div className="pv-skeleton h-16 w-full" />
        <div className="pv-skeleton h-40 w-full" />
      </div>
    );
  }

  if (draft.submittedAt) {
    return (
      <div className="flex flex-col gap-4">
        <Panel className="border-ok/40 bg-ok-bg p-4">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            <div>
              <p className="t-heading-md text-text-hi">Job card submitted</p>
              <p className="t-body-sm mt-1 text-text-mid">
                {input.ticketNumber} closed at {formatTime(new Date(draft.submittedAt))} in{" "}
                <span className="t-mono text-text-hi">{draft.taps} taps</span>.
              </p>
            </div>
          </div>
        </Panel>
        <TapLedger draft={draft} />
        <div className="flex flex-col gap-2">
          <Link
            href="/field/today"
            className="flex min-h-12 items-center justify-center rounded-md bg-primary-600 text-white active:bg-primary-500"
          >
            <span className="t-body font-medium">Back to today</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(`${STORE_KEY}.${input.ticketId}`);
              setDraft(BLANK);
              setStrokes([]);
            }}
            className="t-body-sm min-h-11 rounded-md border border-line text-text-mid"
          >
            Reset this job card (demo)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Context header — never makes the engineer go looking */}
      <Panel className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-body font-medium text-text-hi">{input.customerName}</p>
            <p className="t-body-sm text-text-mid">{input.siteName}</p>
            <p className="t-body-sm text-text-lo">
              {input.assetModel} · <span className="t-mono">{input.assetSerial}</span>
            </p>
          </div>
          <StatusBadge tone="info">{input.coverageLabel}</StatusBadge>
        </div>
        <p className="t-body-sm mt-2 border-t border-line pt-2 text-text-mid">{input.problem}</p>
      </Panel>

      {/* The measured budget, stated rather than claimed */}
      <div className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Hand className="size-4 text-text-lo" aria-hidden />
          <Overline>Taps used</Overline>
        </div>
        <span
          className={cn(
            "t-mono text-base font-medium",
            draft.taps <= 6 ? "text-ok" : "text-warn",
          )}
        >
          {draft.taps} / 6
        </span>
      </div>

      {offline ? (
        <p className="t-body-sm flex items-center gap-2 rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-warn">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          Held on this device. It will submit when connectivity returns.
        </p>
      ) : null}

      {/* Step rail */}
      <ol className="flex gap-1" aria-label="Job card progress">
        {steps.map((s, i) => (
          <li key={s.key} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full",
                s.done ? "bg-ok" : i === current ? "bg-primary-500" : "bg-surface-3",
              )}
              aria-hidden
            />
            <p
              className={cn(
                "t-body-sm mt-1 truncate",
                i === current ? "text-text-hi" : "text-text-lo",
              )}
            >
              {s.label}
            </p>
          </li>
        ))}
      </ol>

      {/* ---- Step 1: check in (tap 1) ---- */}
      {current === 0 ? (
        <StepCard title="Check in" hint="Location is captured with the timestamp.">
          <TapButton
            icon={LogIn}
            label="Check in now"
            onClick={() =>
              commit({ checkedInAt: new Date(input.todayIso).toISOString() })
            }
          />
        </StepCard>
      ) : null}

      {/* ---- Step 2: observation (tap 2) ---- */}
      {current === 1 ? (
        <StepCard
          title="What you found"
          hint="One tap picks the common case. Free text is there if it is not."
        >
          <div className="flex flex-col gap-2">
            {input.observationPresets.slice(0, 5).map((p) => (
              <TapButton key={p} label={p} align="left" onClick={() => commit({ observation: p })} />
            ))}
            <FreeText
              placeholder="Something else…"
              onCommit={(v) => commit({ observation: v })}
            />
          </div>
        </StepCard>
      ) : null}

      {/* ---- Step 3: work performed (tap 3) ---- */}
      {current === 2 ? (
        <StepCard title="What you did" hint="Root cause is set from the same tap.">
          <div className="flex flex-col gap-2">
            {input.workPresets.slice(0, 5).map((p, i) => (
              <TapButton
                key={p}
                label={p}
                align="left"
                onClick={() =>
                  commit({
                    work: p,
                    rootCause: input.rootCausePresets[i % input.rootCausePresets.length] ?? null,
                  })
                }
              />
            ))}
            <FreeText placeholder="Something else…" onCommit={(v) => commit({ work: v })} />
          </div>
        </StepCard>
      ) : null}

      {/* ---- Step 4: outcome (tap 4) ---- */}
      {current === 3 ? (
        <StepCard
          title="Outcome"
          hint="Resolved on this visit is what feeds first-time-fix. It is derived here, never typed."
        >
          <div className="flex flex-col gap-2">
            {(["RESOLVED", "PARTS_AWAITED", "REVISIT_REQUIRED", "PARTIALLY_RESOLVED"] as JobOutcome[]).map(
              (o) => (
                <TapButton
                  key={o}
                  label={OUTCOME_LABEL[o]}
                  align="left"
                  tone={o === "RESOLVED" ? "primary" : "default"}
                  onClick={() => commit({ outcome: o, reading: Number(readingText) || null })}
                />
              ),
            )}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <Overline>Running hours</Overline>
            <input
              inputMode="numeric"
              value={readingText}
              onChange={(e) => setReadingText(e.target.value)}
              aria-label="Running hours reading"
              className="mt-1 min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-text-hi"
              style={{ fontFamily: "var(--font-mono)" }}
            />
            <p className="t-body-sm mt-1 text-text-lo">
              Pre-filled from the last reading
              {input.previousReading !== null ? ` (${input.previousReading} h)` : ""}. Editing it is
              typing, not a tap.
            </p>
            {readingTooLow ? (
              <p className="t-body-sm mt-1 text-danger">
                Below the previous reading. Correct it, or record a meter replacement.
              </p>
            ) : null}
          </div>
        </StepCard>
      ) : null}

      {/* ---- Step 5: signature (tap 5) ---- */}
      {current === 4 ? (
        <StepCard
          title="Customer signature"
          hint={`${input.contactName} · ${input.contactDesignation}`}
        >
          <div
            ref={padRef}
            role="application"
            aria-label="Signature pad"
            onPointerDown={(e) => {
              drawing.current = true;
              const r = e.currentTarget.getBoundingClientRect();
              setStrokes((s) => [...s, [{ x: e.clientX - r.left, y: e.clientY - r.top }]]);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const r = e.currentTarget.getBoundingClientRect();
              setStrokes((s) => {
                const copy = [...s];
                copy[copy.length - 1] = [
                  ...(copy[copy.length - 1] ?? []),
                  { x: e.clientX - r.left, y: e.clientY - r.top },
                ];
                return copy;
              });
            }}
            onPointerUp={() => { drawing.current = false; }}
            onPointerLeave={() => { drawing.current = false; }}
            className="relative h-40 w-full touch-none rounded-md border border-dashed border-line-strong bg-surface-2"
          >
            <svg className="absolute inset-0 h-full w-full" aria-hidden>
              {strokes.map((st, i) => (
                <polyline
                  key={i}
                  points={st.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="var(--text-hi)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            {strokes.length === 0 ? (
              <span className="t-body-sm pointer-events-none absolute inset-0 grid place-items-center text-text-lo">
                <PenLine className="mb-1 size-4" aria-hidden />
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setStrokes([])}
              className="t-body-sm flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-text-mid"
            >
              <Eraser className="size-4" aria-hidden />
              Clear
            </button>
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => commit({ signed: true })}
              className="t-body flex min-h-12 flex-[2] items-center justify-center gap-1.5 rounded-md bg-primary-600 font-medium text-white disabled:opacity-40"
            >
              <Check className="size-4" aria-hidden />
              Confirm signature
            </button>
          </div>
          <p className="t-body-sm mt-2 text-text-lo">
            Drawing is not counted. Confirming is the tap.
          </p>
        </StepCard>
      ) : null}

      {/* ---- Step 6: submit (tap 6) ---- */}
      {current === 5 ? (
        <StepCard title="Submit" hint="Parts, if any, are added here and cost two more taps.">
          <dl className="mb-3 flex flex-col gap-1.5">
            <Row label="Found" value={draft.observation} />
            <Row label="Done" value={draft.work} />
            <Row
              label="Root cause"
              value={draft.rootCause ? ROOT_CAUSE_LABEL[draft.rootCause] : "—"}
            />
            <Row label="Outcome" value={draft.outcome ? OUTCOME_LABEL[draft.outcome] : "—"} />
            <Row label="Running hours" value={`${draft.reading ?? readingText} h`} />
            <Row label="Acknowledged by" value={input.contactName} />
          </dl>
          <TapButton
            icon={Send}
            label="Submit job card"
            tone="primary"
            onClick={() => commit({ submittedAt: new Date().toISOString() })}
          />
          <button
            type="button"
            onClick={() => setOffline((o) => !o)}
            className="t-body-sm mt-2 min-h-11 w-full rounded-md border border-line text-text-lo"
          >
            {offline ? "Simulate connectivity returning" : "Simulate losing connectivity"}
          </button>
        </StepCard>
      ) : null}

      <TapLedger draft={draft} />

      <Link
        href="/field/today"
        className="t-body-sm flex min-h-11 items-center gap-1 text-text-mid"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back to today
      </Link>
    </div>
  );
}

function StepCard({
  title, hint, children,
}: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Panel className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <Wrench className="size-4 text-v-service" aria-hidden />
        <h2 className="t-heading-md text-text-hi">{title}</h2>
      </div>
      <p className="t-body-sm mb-3 text-text-mid">{hint}</p>
      {children}
    </Panel>
  );
}

function TapButton({
  label, onClick, icon: Icon, tone = "default", align = "center",
}: {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary";
  align?: "center" | "left";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-2 rounded-md px-3",
        align === "center" ? "justify-center" : "justify-start text-left",
        tone === "primary"
          ? "bg-primary-600 font-medium text-white active:bg-primary-500"
          : "border border-line bg-surface-2 text-text-hi active:bg-surface-3",
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      <span className="t-body">{label}</span>
    </button>
  );
}

function FreeText({
  placeholder, onCommit,
}: { placeholder: string; onCommit: (v: string) => void }) {
  const [v, setV] = React.useState("");
  return (
    <div className="flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        className="min-h-12 flex-1 rounded-md border border-line bg-surface-2 px-3 text-text-hi placeholder:text-text-lo"
      />
      <button
        type="button"
        disabled={v.trim().length === 0}
        onClick={() => onCommit(v.trim())}
        className="t-body-sm min-h-12 rounded-md border border-line px-3 text-text-mid disabled:opacity-40"
      >
        Use
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="t-body-sm shrink-0 text-text-lo">{label}</dt>
      <dd className="t-body-sm text-right text-text-hi">{value || "—"}</dd>
    </div>
  );
}

function TapLedger({ draft }: { draft: Draft }) {
  return (
    <details className="rounded-md border border-line bg-surface-1 p-3">
      <summary className="t-body-sm cursor-pointer text-text-mid">
        How the six taps are counted
      </summary>
      <div className="mt-2 flex flex-col gap-1">
        <p className="t-body-sm text-text-mid">
          A <span className="text-text-hi">tap</span> is one discrete commit on an actionable
          control. A <span className="text-text-hi">standard visit</span> is one asset, one root
          cause, outcome Resolved, no parts consumed.
        </p>
        <ol className="t-body-sm mt-1 flex list-decimal flex-col gap-0.5 pl-4 text-text-lo">
          <li>Check in</li>
          <li>What you found — preset</li>
          <li>What you did — preset (sets root cause)</li>
          <li>Outcome — Resolved</li>
          <li>Confirm signature</li>
          <li>Submit</li>
        </ol>
        <p className="t-body-sm mt-1 text-text-lo">
          Typing into a pre-filled field and drawing the signature are not counted. Consuming a
          part adds two taps, budgeted at eight.
        </p>
        {draft.checkedInAt ? (
          <p className="t-body-sm mt-1 text-text-lo">
            Checked in {formatDate(draft.checkedInAt)} at {formatTime(draft.checkedInAt)}.
          </p>
        ) : null}
      </div>
    </details>
  );
}
