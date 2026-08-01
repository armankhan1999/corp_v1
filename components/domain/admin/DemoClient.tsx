"use client";

/**
 * E14-S6 / FR-M1-18 — Demo Controls.
 *
 * Three groups, each stating in plain language exactly what it does before it
 * offers to do it: reset the world to its seeded baseline, move the simulated
 * clock, and force the four demonstration scenarios. Nothing here contacts a
 * real system and nothing fabricates a record — the reset removes browser
 * overlays, the clock changes the date the derivations are measured against, and
 * a scenario toggle writes a flag that the owning screen reads.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Lock,
  Minus,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import {
  abbreviateINR,
  addDays,
  daysBetween,
  formatCount,
  formatDate,
  formatINR,
  pluralise,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { appendAudit } from "./auditStore";
import {
  AUDIT_KEY,
  DEMO_KEY,
  PRESERVED_KEYS,
  RESET_KEYS,
  clearOverlays,
  useDemoFlags,
  writeDemoFlags,
  type DemoFlags,
} from "./demoStore";
import { dateOnly } from "./demoDates";
import type { DemoFigure, DemoMetricGroup } from "./demoMetrics";
import { Btn, Callout, ConfirmDialog, DateInput, Field, Modal, Td, Th } from "./ui";
import type { ActorInfo } from "./types";

/* ------------------------------------------------------------- scenarios */

type ScenarioKey = "slaBreach" | "stockOut" | "whatsappFailure" | "upiPaid";

interface Scenario {
  key: ScenarioKey;
  title: string;
  does: string;
  observe: string;
  href: string;
  hrefLabel: string;
  /** Whether a screen reads the flag in this release. Stated, never implied. */
  live: boolean;
  liveNote: string;
}

const SCENARIOS: Scenario[] = [
  {
    key: "slaBreach",
    title: "Force an SLA breach",
    does: "Sets the slaBreach flag on the shared demo key. It creates no ticket and moves no clock — the derivation of a breach stays exactly what slaClock computes.",
    observe:
      "The ticket board presents its breach treatment for the demonstration ticket: the clock cell turns to the breached state with its icon and overrun label, and the row is offered to the exceptions feed.",
    href: "/service/tickets",
    hrefLabel: "Service tickets",
    live: false,
    liveNote: "Published on pravaah.v1.demo for the ticket board to read on its next load.",
  },
  {
    key: "stockOut",
    title: "Force a stock-out",
    does: "Sets the stockOut flag. No stock movement is written and no balance is altered — the ledger remains the sum of its seeded movements.",
    observe:
      "The reorder screen presents a service-critical item at zero available, with the parts request that is blocked behind it and the reorder suggestion it triggers.",
    href: "/inventory/reorder",
    hrefLabel: "Reorder",
    live: false,
    liveNote: "Published on pravaah.v1.demo for the reorder screen to read on its next load.",
  },
  {
    key: "whatsappFailure",
    title: "Force a WhatsApp delivery failure",
    does: "Sets the whatsappFailure flag. Nothing is sent to any gateway — the WhatsApp integration is simulated end to end (INT-04).",
    observe:
      "The next simulated WhatsApp message fails instead of delivering: the message log shows the FAILED state with its reason and the retry path, and the notification falls back to the in-app channel.",
    href: "/workflow/notifications",
    hrefLabel: "Notifications",
    live: true,
    liveNote: "Read today by the workflow notification preview, which reads this exact key.",
  },
  {
    key: "upiPaid",
    title: "Complete a UPI payment",
    does: "Sets the upiPaid flag. No receipt is inserted and no invoice is allocated against — the receivables arithmetic is untouched until a receipt is actually recorded on its own screen.",
    observe:
      "The receipts screen presents the pending UPI collection as completed, with the simulated reference and the allocation it would post.",
    href: "/commercial/receipts",
    hrefLabel: "Receipts",
    live: false,
    liveNote: "Published on pravaah.v1.demo for the receipts screen to read on its next load.",
  },
];

/* ---------------------------------------------------------------- figures */

function figureText(f: DemoFigure): string {
  return f.unit === "MONEY" ? abbreviateINR(f.value) : formatCount(f.value);
}

function figureTitle(f: DemoFigure): string | undefined {
  return f.unit === "MONEY" ? formatINR(f.value) : undefined;
}

function Delta({ before, after, unit, risingIs }: {
  before: number;
  after: number;
  unit: DemoFigure["unit"];
  risingIs: DemoFigure["risingIs"];
}) {
  const diff = after - before;
  if (diff === 0) {
    return (
      <span className="t-body-sm inline-flex items-center gap-1 text-text-lo">
        <Minus className="size-3" aria-hidden />
        No change
      </span>
    );
  }
  const up = diff > 0;
  const bad = risingIs === "BAD" ? up : risingIs === "GOOD" ? !up : false;
  const good = risingIs === "BAD" ? !up : risingIs === "GOOD" ? up : false;
  const Icon = up ? ArrowUp : ArrowDown;
  const body = unit === "MONEY" ? abbreviateINR(Math.abs(diff)) : formatCount(Math.abs(diff));
  return (
    <span
      className={cn(
        "t-body-sm inline-flex items-center gap-1 tabular-nums",
        bad ? "text-danger" : good ? "text-ok" : "text-text-mid",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {up ? "+" : "−"}
      {body}
    </span>
  );
}

/* ------------------------------------------------------------------ screen */

export function DemoClient({
  actor,
  canOperate,
  canReset,
  seededTodayIso,
  seededDate,
  projectedDate,
  projectedIso,
  invalidAt,
  seeded,
  projected,
  maxDate,
}: {
  actor: ActorInfo;
  canOperate: boolean;
  canReset: boolean;
  seededTodayIso: string;
  seededDate: string;
  projectedDate: string | null;
  projectedIso: string | null;
  invalidAt: string | null;
  seeded: DemoMetricGroup[];
  projected: DemoMetricGroup[] | null;
  maxDate: string;
}) {
  const router = useRouter();
  const { flags, ready, occupied, setFlags } = useDemoFlags();

  const [flash, setFlash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [blockedReset, setBlockedReset] = React.useState(false);
  const [pickerDate, setPickerDate] = React.useState(projectedDate ?? seededDate);

  /* The stored clock is the source of truth; the URL is how the server learns
     which date to derive against. Reconciled once, on mount. */
  const synced = React.useRef(false);
  React.useEffect(() => {
    if (!ready || synced.current) return;
    synced.current = true;
    const stored = flags.simulatedToday ? flags.simulatedToday.slice(0, 10) : null;
    if (stored !== projectedDate) {
      router.replace(stored ? `/admin/demo?at=${stored}` : "/admin/demo");
    }
  }, [ready, flags.simulatedToday, projectedDate, router]);

  const offsetDays = projectedIso ? daysBetween(seededTodayIso, projectedIso) : 0;
  const groups = React.useMemo(() => {
    const byKey = new Map((projected ?? []).map((g) => [g.key, g]));
    return seeded.map((g) => ({ base: g, next: byKey.get(g.key) ?? null }));
  }, [seeded, projected]);

  function persist(next: DemoFlags): boolean {
    const ok = writeDemoFlags(next);
    if (!ok) {
      setError(
        "The browser refused to write to local storage — private browsing or a full quota. The control did not take effect, and nothing was logged as though it had. Free some storage or leave private mode, then try again.",
      );
      return false;
    }
    setError(null);
    setFlags(next);
    return true;
  }

  /* ------------------------------------------------------------- clock */

  function applyDate(nextDateOnly: string | null, how: string) {
    const beforeIso = flags.simulatedToday ?? seededTodayIso;
    const nextIso = nextDateOnly ? `${nextDateOnly}${seededTodayIso.slice(10)}` : null;
    const afterIso = nextIso ?? seededTodayIso;
    if (beforeIso.slice(0, 10) === afterIso.slice(0, 10)) {
      setFlash(`The simulated clock is already on ${formatDate(afterIso)}.`);
      return;
    }
    if (!persist({ ...flags, simulatedToday: nextIso })) return;

    const shift = daysBetween(beforeIso, afterIso);
    appendAudit({
      actor,
      action: "CLOCK_ADVANCE",
      entityType: "DemoControls",
      entityId: "simulated-clock",
      entityLabel: "Simulated clock",
      summary: `Simulated today moved ${shift >= 0 ? "forward" : "back"} ${formatCount(Math.abs(shift))} ${pluralise(Math.abs(shift), "day")} (${how}). SLA clocks, coverage and AMC status, ageing buckets, retention eligibility and commissioning deadlines are all measured against the new date; the seeded dataset itself is unchanged.`,
      before: formatDate(beforeIso),
      after: formatDate(afterIso),
    });

    setFlash(
      nextIso
        ? `Simulated today is now ${formatDate(afterIso)} — ${formatCount(Math.abs(shift))} ${pluralise(Math.abs(shift), "day")} ${shift >= 0 ? "ahead of" : "behind"} where it was. The figures below have re-derived.`
        : `Returned to the seeded today, ${formatDate(seededTodayIso)}.`,
    );
    setPickerDate(nextDateOnly ?? seededDate);
    router.replace(nextDateOnly ? `/admin/demo?at=${nextDateOnly}` : "/admin/demo");
    router.refresh();
  }

  function shiftBy(days: number) {
    const from = flags.simulatedToday ?? seededTodayIso;
    applyDate(dateOnly(addDays(from, days)), `+${formatCount(days)} ${pluralise(days, "day")}`);
  }

  /* ------------------------------------------------------------- reset */

  function runReset() {
    // Written first, so the record of the reset exists before anything is removed.
    const entry = appendAudit({
      actor,
      action: "DEMO_RESET",
      entityType: "DemoControls",
      entityId: "seed-reset",
      entityLabel: "Reset to seed state",
      summary: `Every browser overlay namespace cleared — ${formatCount(RESET_KEYS.length)} keys enumerated on screen, of which ${formatCount(occupied.length)} held session changes. The seeded dataset was never mutated, so the world returns to its reproducible baseline. The audit log and the session are deliberately not cleared.`,
      before: occupied.length
        ? `${formatCount(occupied.length)} ${pluralise(occupied.length, "namespace")} holding changes: ${occupied.join(", ")}`
        : "No overlay held changes",
      after: "Seeded baseline",
    });

    const result = clearOverlays();

    if (!result.auditIntact) {
      // Cannot happen — the audit key is not in RESET_KEYS — but proven rather than assumed.
      appendAudit({
        actor,
        action: "DEMO_RESET",
        entityType: "DemoControls",
        entityId: "seed-reset",
        entityLabel: "Reset to seed state",
        summary: `${entry.summary} (re-appended: the audit overlay was missing after the clear)`,
        before: entry.before,
        after: entry.after,
      });
    }
    if (result.failed.length > 0) {
      setError(
        `The browser refused to clear ${formatCount(result.failed.length)} ${pluralise(result.failed.length, "namespace")}: ${result.failed.join(", ")}. Everything else was cleared and the reset is in the audit log. Close private browsing or free storage and run it again.`,
      );
    } else {
      setError(null);
    }

    setFlags({ whatsappFailure: false, slaBreach: false, stockOut: false, upiPaid: false, simulatedToday: null });
    setPickerDate(seededDate);
    setFlash(
      `Reset complete. ${formatCount(result.cleared.length)} of ${formatCount(RESET_KEYS.length)} ${pluralise(RESET_KEYS.length, "namespace")} held changes and were removed; the audit log kept every entry, including this reset.`,
    );
    router.replace("/admin/demo");
    router.refresh();
  }

  /* --------------------------------------------------------- scenarios */

  function toggleScenario(s: Scenario) {
    const on = !flags[s.key];
    const next: DemoFlags = { ...flags };
    next[s.key] = on;
    if (!persist(next)) return;
    appendAudit({
      actor,
      action: "STATE_TRANSITION",
      entityType: "DemoControls",
      entityId: s.key,
      entityLabel: s.title,
      summary: `Demonstration scenario switched ${on ? "on" : "off"}. ${s.does} Observable on ${s.href}.`,
      before: on ? "Off" : "On",
      after: on ? "On" : "Off",
    });
    setFlash(
      on
        ? `${s.title} is on. Open ${s.hrefLabel} to see it; the flag is a flag, nothing was inserted into the seeded data.`
        : `${s.title} is off. The screen returns to the seeded behaviour on its next load.`,
    );
  }

  /* ------------------------------------------------------------ render */

  const auditNote = (
    <Explainer className="text-text-lo">
      Every control on this screen writes an audit entry stamped with the real wall clock, not the
      simulated one, so the log stays a truthful record of when the operator acted.
    </Explainer>
  );

  return (
    <div className="flex flex-col gap-4">
      {invalidAt ? (
        <Callout
          tone="danger"
          title="The requested date could not be read"
          right={
            <Btn icon={RotateCcw} onClick={() => router.replace("/admin/demo")}>
              Return to seeded today
            </Btn>
          }
        >
          <p>
            <span className="t-mono">?at={invalidAt}</span> is not a calendar date in{" "}
            <span className="t-mono">YYYY-MM-DD</span> form, so the figures below are the seeded
            ones and nothing was advanced. Pick a date with the control instead of editing the
            address.
          </p>
        </Callout>
      ) : null}

      {error ? (
        <Callout
          tone="danger"
          title="The last action did not take effect"
          right={
            <Btn icon={RotateCcw} onClick={() => { setError(null); router.refresh(); }}>
              Retry
            </Btn>
          }
        >
          <p>{error}</p>
        </Callout>
      ) : null}

      {flash ? (
        <div className="flex items-start gap-2 rounded-lg border border-ok/40 bg-ok-bg px-3 py-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <p className="t-body-sm text-text-mid">{flash}</p>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss confirmation"
            className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-text-lo hover:bg-surface-2 hover:text-text-hi"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ============================================ 1 — reset to seed state */}

      <Panel id="reset">
        <PanelHeader
          title="1 · Reset to seed state"
          sub="Removes every browser overlay so the world returns to the seeded baseline. The seeded dataset is regenerated from a fixed seed, so the baseline is identical every time."
          right={<StatusBadge tone={occupied.length > 0 ? "warn" : "ok"}>{ready ? `${formatCount(occupied.length)} of ${formatCount(RESET_KEYS.length)} hold changes` : "Reading…"}</StatusBadge>}
        />
        <div className="flex flex-col gap-3 p-4">
          <Explainer className="text-text-mid">
            Nothing in this prototype writes to a server. Everything a demonstration changes —
            tickets moved, approvals decided, stock issued, users edited — lives in{" "}
            <span className="t-mono">localStorage</span> under{" "}
            <span className="t-mono">pravaah.v1.*</span>, layered over an immutable seeded dataset.
            Reset removes those layers. It does not undo anything on a real system, because there
            is no real system behind it.
          </Explainer>

          <div>
            <Overline>Namespaces this removes</Overline>
            <ul className="mt-1.5 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2">
              {RESET_KEYS.map((k) => {
                const holds = occupied.includes(k.key);
                return (
                  <li key={k.key} className="flex items-start gap-2 bg-surface-1 px-2.5 py-1.5">
                    {holds ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="t-mono block text-text-hi">{k.key}</span>
                      <span className="t-body-sm block text-text-lo">{k.what}</span>
                      {holds ? (
                        <span className="t-body-sm block text-warn">
                          Currently holds session changes
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <Overline>Deliberately left alone</Overline>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {PRESERVED_KEYS.map((k) => (
                <li key={k.key} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
                  <p className="t-body-sm text-text-mid">
                    <span className="t-mono text-text-hi">{k.key}</span> — {k.why}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <Callout tone="info" title="The audit log is not cleared, and that is the point">
            <p>
              <span className="t-mono">{AUDIT_KEY}</span> is append-only by construction: the store
              exports exactly one mutating function and no counterpart that edits or removes an
              entry (E1-S6). A reset that erased the log would make the immutability claim a
              convenience. The reset is written into the log <em>before</em> the overlays are
              cleared, and every earlier entry survives it.
            </p>
          </Callout>

          <div className="flex flex-wrap items-center gap-2">
            {canReset ? (
              <Btn tone="danger" icon={RotateCcw} onClick={() => setConfirmReset(true)} disabled={!ready}>
                Reset to seed state
              </Btn>
            ) : (
              <Btn tone="danger" icon={Lock} onClick={() => setBlockedReset(true)}>
                Reset to seed state
              </Btn>
            )}
            <span className="t-body-sm text-text-lo">
              Typed confirmation is required. The reset is audit-logged as{" "}
              <span className="t-mono">DEMO_RESET</span>.
            </span>
          </div>
        </div>
      </Panel>

      {/* ============================================== 2 — the simulated clock */}

      <Panel id="clock">
        <PanelHeader
          title="2 · Advance the simulated clock"
          sub="Moves the date every derivation is measured against. The seeded records keep their own dates — only the observer moves."
          right={<SimulatedBadge what="the platform clock" />}
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] p-3">
              <Overline>Seeded today</Overline>
              <p className="t-heading-md tabular-nums text-text-hi">{formatDate(seededTodayIso)}</p>
              <p className="t-body-sm text-text-lo">The baseline the dataset was generated against.</p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-3",
                projectedIso ? "border-sim/50 bg-sim-bg" : "border-line bg-surface-2",
              )}
            >
              <Overline>Simulated today</Overline>
              <p className="t-heading-md tabular-nums text-text-hi">
                {formatDate(projectedIso ?? seededTodayIso)}
              </p>
              <p className="t-body-sm text-text-lo">
                {projectedIso ? "Held in pravaah.v1.demo for the rest of the platform." : "On the seeded date."}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] p-3">
              <Overline>Offset</Overline>
              <p className="t-heading-md tabular-nums text-text-hi">
                {offsetDays === 0
                  ? "None"
                  : `${offsetDays > 0 ? "+" : "−"}${formatCount(Math.abs(offsetDays))} ${pluralise(Math.abs(offsetDays), "day")}`}
              </p>
              <p className="t-body-sm text-text-lo">Applied to every date-derived state below.</p>
            </div>
          </div>

          {canOperate ? (
            <div className="flex flex-wrap items-end gap-2">
              {[1, 7, 30, 90].map((d) => (
                <Btn key={d} icon={CalendarClock} onClick={() => shiftBy(d)} disabled={!ready}>
                  +{formatCount(d)} {pluralise(d, "day")}
                </Btn>
              ))}
              <Field
                label="Or pick a date"
                hint={`Between ${formatDate(seededTodayIso)} and ${formatDate(`${maxDate}T00:00:00`)}`}
                className="w-44"
              >
                <DateInput
                  value={pickerDate}
                  min={seededDate}
                  max={maxDate}
                  onChange={(e) => setPickerDate(e.target.value)}
                />
              </Field>
              <Btn
                tone="primary"
                onClick={() => applyDate(pickerDate === seededDate ? null : pickerDate, "picked date")}
                disabled={!ready}
              >
                Apply date
              </Btn>
              <Btn
                icon={RotateCcw}
                onClick={() => applyDate(null, "return to seeded today")}
                disabled={!ready || !projectedIso}
              >
                Return to seeded today
              </Btn>
            </div>
          ) : (
            <Callout tone="info" title={`${ROLE_LABEL[actor.role]} holds read access to Demo Controls`}>
              <p>The clock and the scenario switches are operated by a role with write access.</p>
            </Callout>
          )}

          {auditNote}
        </div>
      </Panel>

      {/* ===================================================== what recomputes */}

      <Panel>
        <PanelHeader
          title="What recomputes when the clock moves"
          sub={
            projected
              ? `Both columns are produced by the same single implementation in /lib/derive over the same immutable seed. The only difference between them is the date passed in.`
              : "Move the clock and a second column appears beside every figure, computed by the same derivation against the new date."
          }
        />
        <div className="flex flex-col">
          {groups.map(({ base, next }) => (
            <section key={base.key} className="border-b border-line last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 bg-surface-0 px-4 py-2">
                <h3 className="t-heading-md text-text-hi">{base.label}</h3>
                <Link
                  href={base.href}
                  className="t-body-sm inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-text-mid underline decoration-line-strong underline-offset-2 hover:text-text-hi"
                >
                  {base.hrefLabel}
                  <ExternalLink className="size-3" aria-hidden />
                </Link>
              </div>
              <p className="t-body-sm px-4 pt-2 text-text-mid">{base.explains}</p>
              <p className="t-body-sm px-4 pb-2 text-text-lo">
                Derived by <span className="t-mono">{base.source}</span>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <caption className="sr-only">
                    {base.label} measured against the seeded today and the simulated date
                  </caption>
                  <thead>
                    <tr>
                      <Th>Figure</Th>
                      <Th align="right">{formatDate(seededTodayIso)}</Th>
                      {next ? (
                        <Th align="right">{formatDate(projectedIso ?? seededTodayIso)}</Th>
                      ) : null}
                      {next ? <Th>Change</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {base.figures.map((f, i) => {
                      const after = next?.figures[i];
                      return (
                        <tr key={f.key} className="hover:bg-surface-2">
                          <Td>{f.label}</Td>
                          <Td align="right" mono className="text-text-hi" title={figureTitle(f)}>
                            {figureText(f)}
                          </Td>
                          {next && after ? (
                            <Td align="right" mono className="text-text-hi" title={figureTitle(after)}>
                              {figureText(after)}
                            </Td>
                          ) : null}
                          {next && after ? (
                            <Td>
                              <Delta
                                before={f.value}
                                after={after.value}
                                unit={f.unit}
                                risingIs={f.risingIs}
                              />
                            </Td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
        <Explainer className="border-t border-line px-4 py-2 text-text-lo">
          Money is shown abbreviated; the full rupee figure is in each cell&rsquo;s title. Nothing on
          this table is estimated — each number is the derivation named beneath its heading, run
          against the date in the column head.
        </Explainer>
      </Panel>

      {/* =========================================== 3 — the scenario switches */}

      <Panel id="scenarios">
        <PanelHeader
          title="3 · Scenario switches"
          sub="Four flags, so the awkward states a demonstration needs can be reached on demand rather than waited for."
          right={<SimulatedBadge what="demonstration scenarios" />}
        />
        <div className="flex flex-col gap-3 p-4">
          <Callout tone="sim" title="A switch writes a flag; it never writes a record">
            <p>
              Each switch sets a boolean on <span className="t-mono">{DEMO_KEY}</span>. No ticket is
              created, no stock is consumed, no message leaves the browser and no receipt is posted
              — the seeded arithmetic is identical with a switch on or off. Each owning screen reads
              the flag when it next loads and presents the state named below.
            </p>
          </Callout>

          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {SCENARIOS.map((s) => {
              const on = flags[s.key];
              return (
                <li
                  key={s.key}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3",
                    on ? "border-sim/50 bg-sim-bg" : "border-line bg-surface-1",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="t-heading-md text-text-hi">{s.title}</h3>
                    <StatusBadge tone={on ? "sim" : "neutral"}>{on ? "On" : "Off"}</StatusBadge>
                  </div>
                  <p className="t-body-sm text-text-mid">
                    <span className="text-text-hi">What it does: </span>
                    {s.does}
                  </p>
                  <p className="t-body-sm text-text-mid">
                    <span className="text-text-hi">What you will see: </span>
                    {s.observe}
                  </p>
                  <p className="t-body-sm text-text-lo">{s.liveNote}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    {canOperate ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        disabled={!ready}
                        aria-label={`${s.title} — ${on ? "On" : "Off"}`}
                        onClick={() => toggleScenario(s)}
                        className={cn(
                          "t-body-sm inline-flex h-8 items-center gap-2 rounded-md border px-2.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
                          on
                            ? "border-sim/60 bg-sim-bg text-sim hover:border-sim"
                            : "border-line bg-surface-2 text-text-mid hover:border-line-strong hover:text-text-hi",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-4 place-items-center rounded-md border",
                            on ? "border-sim/60 bg-sim/20" : "border-line",
                          )}
                          aria-hidden
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        {on ? "On" : "Off"}
                      </button>
                    ) : null}
                    <Link
                      href={s.href}
                      className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
                    >
                      Go and see it on {s.hrefLabel}
                      <ExternalLink className="size-3" aria-hidden />
                    </Link>
                    {s.live ? (
                      <StatusBadge tone="ok">Read by that screen today</StatusBadge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {auditNote}
        </div>
      </Panel>

      {/* --------------------------------------------------------- dialogs */}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={runReset}
        title="Reset the demonstration to its seeded state?"
        confirmLabel="Reset to seed state"
        typeToConfirm="RESET"
        consequence={`${formatCount(occupied.length)} of ${formatCount(RESET_KEYS.length)} ${pluralise(RESET_KEYS.length, "namespace")} currently hold session changes. All of them are removed and cannot be recovered from this screen.`}
        body={
          <div className="flex flex-col gap-2">
            <p>
              Every overlay listed above is removed and the platform re-reads the seeded dataset —
              the same fixed seed produces the same world, so the baseline is identical to the one
              the demonstration started from.
            </p>
            <p>
              <span className="text-text-hi">Not removed: </span>
              the audit log, which is append-only and keeps every entry including this reset; and
              your session, which would otherwise sign you out mid-demonstration.
            </p>
          </div>
        }
      />

      {blockedReset ? (
        <Modal
          open
          onClose={() => setBlockedReset(false)}
          title="Reset blocked"
          sub="Demo Controls — reset to seed state"
          width={520}
          footer={<Btn onClick={() => setBlockedReset(false)}>Close</Btn>}
        >
          <Callout tone="danger" title={`${ROLE_LABEL[actor.role]} holds read and update on Demo Controls`}>
            <p>
              The permission matrix grants your role <span className="t-mono">RU</span> on{" "}
              <span className="t-mono">admin.demo</span>: you may move the clock and switch the
              scenarios, both of which are reversible. Discarding every session change is not
              reversible, so it is reserved to full control.
            </p>
          </Callout>
          <p className="t-body-sm mt-3 text-text-mid">
            <span className="text-text-hi">What would unblock it: </span>a{" "}
            {ROLE_LABEL.SUPER_ADMIN} — the only role holding <span className="t-mono">F</span> on{" "}
            <span className="t-mono">admin.demo</span> — running the reset from this screen.
          </p>
          <p className="t-body-sm mt-2 text-text-lo">
            Nothing was cleared and no audit entry was raised for a reset that did not happen.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
