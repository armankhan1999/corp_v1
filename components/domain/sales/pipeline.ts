import type * as T from "@/lib/schemas/entities";
import { formatDate } from "@/lib/format";
import {
  LOSS_REASONS, STAGES, STAGE_AGEING, STAGE_LABEL, checkStageMove, effectiveStatus,
  type Ageing, type Opportunity, type Stage, type TransitionCheck,
} from "./calc";
import { recordFollowUp, transitionQuotation, updateEnquiry, type Actor } from "./store";

/**
 * E3-S8 board logic. The columns, the ageing treatment and the move rules all
 * live here so the drag path and the keyboard path cannot diverge — WCAG 2.2
 * 2.5.7 is only honoured if the non-drag alternative runs the identical check.
 *
 * Nothing here mutates the seed. Every move is executed through the existing
 * E3 mutations in store.ts, so the audit trail, the quotation lifecycle and the
 * order conversion behave exactly as they do on the quotation screen.
 */

export const STAGE_HINT: Record<Stage, string> = {
  ENQUIRY: "Captured, not yet worked",
  QUALIFIED: "Contact made, requirement confirmed",
  QUOTED: "A written offer exists",
  NEGOTIATION: "Commercials under discussion",
  WON: "Order raised from the offer",
  LOST: "Closed with a recorded reason",
};

/** The columns a card may be dragged into. Won and Lost are terminal. */
export const MOVE_TARGETS: Stage[] = STAGES;

export interface BoardColumn {
  stage: Stage;
  items: Opportunity[];
  count: number;
  value: number;
  warn: number;
  escalate: number;
}

const AGEING_RANK: Record<Ageing, number> = { ESCALATE: 2, WARN: 1, OK: 0 };

export function buildBoard(opportunities: readonly Opportunity[]): BoardColumn[] {
  return STAGES.map((stage) => {
    const items = opportunities
      .filter((o) => o.stage === stage)
      .sort(
        (a, b) =>
          AGEING_RANK[b.ageing] - AGEING_RANK[a.ageing] ||
          b.daysInStage - a.daysInStage ||
          b.value - a.value,
      );
    return {
      stage,
      items,
      count: items.length,
      value: items.reduce((s, o) => s + o.value, 0),
      warn: items.filter((o) => o.ageing === "WARN").length,
      escalate: items.filter((o) => o.ageing === "ESCALATE").length,
    };
  });
}

export const AGEING_TONE: Record<Ageing, "neutral" | "warn" | "danger"> = {
  OK: "neutral",
  WARN: "warn",
  ESCALATE: "danger",
};

/** Colour is never the only signal — this is the word that rides with it. */
export function ageingWord(ageing: Ageing): string {
  return ageing === "ESCALATE" ? "Escalated" : ageing === "WARN" ? "Ageing" : "On track";
}

export function ageingExplanation(stage: Stage, ageing: Ageing, days: number): string {
  const t = STAGE_AGEING[stage];
  if (ageing === "ESCALATE") {
    return `${days} days in ${STAGE_LABEL[stage]} — past the ${t.escalate}-day escalation threshold. Published to the exception feed.`;
  }
  if (ageing === "WARN") {
    return `${days} days in ${STAGE_LABEL[stage]} — past the ${t.warn}-day warning threshold, ${t.escalate - days} days from escalation.`;
  }
  if (t.warn > 999) return `${days} days in ${STAGE_LABEL[stage]}. Closed stages are not aged.`;
  return `${days} days in ${STAGE_LABEL[stage]} — warning at ${t.warn} days, escalation at ${t.escalate}.`;
}

/**
 * The offer a close acts on: the newest quotation that is genuinely live with
 * the customer. A draft has not left the building and cannot be won or lost.
 */
export function offerToClose(o: Opportunity, now: Date): T.Quotation | null {
  const live = o.quotations.filter((q) => {
    const s = effectiveStatus(q, now);
    return s === "ISSUED" || s === "NEGOTIATION";
  });
  return live.length ? live[live.length - 1]! : null;
}

export function lossReasonLabel(reason: T.Quotation["lossReason"]): string {
  return LOSS_REASONS.find((r) => r.value === reason)?.label ?? "reason not recorded";
}

/**
 * E3-S8 AC-3. Board-level rules on top of the shared `checkStageMove`, because
 * the board derives a card's stage from the records beneath it: a card cannot
 * be dragged behind its own quotation, because the next render would simply
 * put it back and the user would rightly call that a bug.
 */
export function checkBoardMove(
  o: Opportunity,
  to: Stage,
  lossReason: string | null,
  now: Date,
): TransitionCheck {
  const base = checkStageMove(o, to, lossReason);
  if (!base.ok) return base;

  const reopening = o.stage === "LOST";

  if (!reopening && (to === "ENQUIRY" || to === "QUALIFIED") && o.quotations.length > 0) {
    const n = o.quotations.length;
    return {
      ok: false,
      reason: `The board reads each stage from the records beneath the card, and ${n} quotation${n === 1 ? "" : "s"} already exist${n === 1 ? "s" : ""} against ${o.enquiry.number}. An opportunity cannot sit behind its own offer.`,
      remedy: `Close the offer instead — mark ${o.latest ? `${o.latest.number} v${o.latest.version}` : "the quotation"} Lost, or revise it to a new version. The card follows the record.`,
    };
  }

  if (!reopening && to === "ENQUIRY" && o.lastActivity) {
    return {
      ok: false,
      reason: `A follow-up was logged on ${formatDate(o.lastActivity.at)}, and contact is what qualifies an enquiry. Enquiry means nobody has worked it yet.`,
      remedy: "Qualified is the earliest stage this card can return to.",
    };
  }

  if ((to === "NEGOTIATION" || to === "WON") && !offerToClose(o, now)) {
    const drafts = o.liveQuotations.length;
    return {
      ok: false,
      reason: `No offer on this opportunity is Issued or in Negotiation${drafts ? `, only ${drafts} unissued draft${drafts === 1 ? "" : "s"}` : ""}. A draft has not left the building, so there is nothing for the customer to be negotiating or accepting.`,
      remedy: o.latest
        ? `Open ${o.latest.number} v${o.latest.version} and issue it — the discount gate runs there — then move this card.`
        : "Build a quotation from the enquiry, issue it, then move this card.",
    };
  }

  return { ok: true };
}

export interface MoveOptions {
  lossReason?: T.Quotation["lossReason"];
  competitor?: string | null;
  /** How a pre-quotation loss was learnt. Recorded on the activity, not guessed. */
  mode?: T.Activity["mode"];
}

export interface MoveResult extends TransitionCheck {
  orderId?: string;
  /** Plain statement of what actually happened, shown on success. */
  note?: string;
}

/**
 * Runs the move. Identical for a drop and for the keyboard "Move to…" control —
 * both call this, so a rejection reads the same either way and the card simply
 * never leaves its origin column.
 */
export function executeBoardMove(
  o: Opportunity,
  to: Stage,
  opts: MoveOptions,
  actor: Actor,
  now: Date,
): MoveResult {
  const check = checkBoardMove(o, to, opts.lossReason ?? null, now);
  if (!check.ok) return check;

  const stageEnteredAt = now.toISOString();
  const offer = offerToClose(o, now);

  if (to === "ENQUIRY" || to === "QUALIFIED" || to === "QUOTED") {
    const status: T.Enquiry["status"] =
      to === "ENQUIRY" ? "NEW" : to === "QUALIFIED" ? "QUALIFIED" : "QUOTED";
    updateEnquiry(o.enquiry.id, { status, stageEnteredAt }, actor);
    return {
      ok: true,
      note: `${o.enquiry.number} moved to ${STAGE_LABEL[to]}. The stage clock restarted today, so its ageing is measured from now.`,
    };
  }

  if (to === "NEGOTIATION") {
    if (!offer) return { ok: false, reason: "No live offer to negotiate.", remedy: "Issue a quotation first." };
    const res = transitionQuotation(offer.id, "NEGOTIATION", {}, actor);
    if (!res.ok) return res;
    return {
      ok: true,
      note: `${offer.number} v${offer.version} moved to Negotiation. The card follows the quotation, not the other way round.`,
    };
  }

  if (to === "WON") {
    if (!offer) return { ok: false, reason: "No live offer to win.", remedy: "Issue a quotation first." };
    const res = transitionQuotation(offer.id, "WON", {}, actor);
    if (!res.ok) return res;
    return {
      ok: true,
      orderId: res.orderId,
      note: `Won against ${offer.number} v${offer.version}. A sales order was raised with every line, term and customer detail carried across — nothing was re-entered.`,
    };
  }

  /* ------------------------------------------------------------------ lost */
  const label = lossReasonLabel(opts.lossReason ?? null);

  if (offer) {
    const res = transitionQuotation(
      offer.id,
      "LOST",
      { lossReason: opts.lossReason, competitor: opts.competitor ?? null },
      actor,
    );
    if (!res.ok) return res;
    return {
      ok: true,
      note: `${offer.number} v${offer.version} recorded Lost — ${label.toLowerCase()}${opts.competitor ? ` to ${opts.competitor}` : ""}. The reason feeds the loss-reason distribution in sales analytics.`,
    };
  }

  // No quotation ever left the building: the loss belongs to the enquiry, and
  // the structured reason is held as an activity so it still reaches the
  // customer timeline and the loss analysis.
  updateEnquiry(o.enquiry.id, { status: "LOST", stageEnteredAt }, actor);
  recordFollowUp(
    {
      subjectType: "ENQUIRY",
      subjectId: o.enquiry.id,
      customerId: o.enquiry.customerId,
      mode: opts.mode ?? "CALL",
      outcome: `Lost — ${label}`,
      notes: opts.competitor
        ? `Lost to ${opts.competitor}. Closed from the pipeline board before any quotation was raised.`
        : "Closed from the pipeline board before any quotation was raised.",
      nextActionDate: null,
    },
    actor,
  );
  return {
    ok: true,
    note: `${o.enquiry.number} closed Lost — ${label.toLowerCase()}. No quotation was ever issued, so the reason is held on the enquiry activity and appears on the customer timeline.`,
  };
}
