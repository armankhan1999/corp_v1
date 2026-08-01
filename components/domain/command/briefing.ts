import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import { abbreviateINR, formatCount, formatDateTime, formatPercent } from "@/lib/format";
import { EXCEPTION_LABEL, ROLE_LABEL } from "@/lib/schemas/enums";
import type { ExceptionRow } from "./exceptions";
import { periodQuery, type ResolvedPeriod } from "./period";

/**
 * E2-S6 — the daily briefing generator.
 *
 * Deterministic: the same dataset and the same simulated clock produce the same
 * prose, word for word. Nothing here is a language model. Every factual
 * sentence carries a citation marker pointing at the record set that produced
 * the number, and where a check returns nothing the briefing says so instead of
 * filling the gap (E2-S6 AC 3, guardrail A-19).
 */

export interface BriefingCitation {
  marker: number;
  label: string;
  href: string;
  basis: string;
}

export interface BriefingSentence {
  text: string;
  marker: number | null;
}

export interface BriefingSection {
  heading: string;
  sentences: BriefingSentence[];
}

export interface Briefing {
  generatedAtIso: string;
  generatedAtLabel: string;
  periodLabel: string;
  scopeLabel: string;
  sections: BriefingSection[];
  citations: BriefingCitation[];
  gaps: string[];
  disclosure: string;
}

export const BRIEFING_DISCLOSURE =
  "This briefing is generated from platform records against the simulated clock. It reads platform data, cites its sources, and takes no actions. Every figure below opens the records that produced it.";

export function buildBriefing(
  ds: Dataset,
  p: ResolvedPeriod,
  exceptions: ExceptionRow[],
  scopeLabel: string,
): Briefing {
  const ctx = D.ctxOf(ds, p.asOf.toISOString());
  const q = periodQuery(p);
  const citations: BriefingCitation[] = [];
  const cite = (label: string, href: string, basis: string): number => {
    const marker = citations.length + 1;
    citations.push({ marker, label, href, basis });
    return marker;
  };

  const revenue = D.revenueInPeriod(ds, p.period);
  const prior = D.revenueInPeriod(ds, p.prior);
  const growth = prior ? ((revenue - prior) / prior) * 100 : null;
  const locked = D.lockedCash(ctx);
  const rec = D.receivables(ctx);
  const ret = D.retention(ctx);
  const orderBook = D.orderBookValue(ds);
  const openTickets = ds.tickets.filter(D.isOpenTicket);
  const breached = openTickets.filter((t) => D.slaClock(t, p.asOf).state === "BREACHED");
  const expiring = ds.amcContracts.filter((a) => D.amcStatus(a, p.asOf) === "EXPIRING");
  const expiringValue = expiring.reduce((s, a) => s + a.contractValue, 0);
  const attach = D.amcAttachRate(ctx);
  const brokenPromises = ds.collectionFollowUps.filter(
    (f) => !f.fulfilled && f.promisedDate && new Date(f.promisedDate) < p.asOf,
  );

  const cRevenue = cite(
    `Invoices dated inside ${p.label}`,
    `/analytics/cash${q}`,
    `${formatCount(ds.invoices.filter((i) => new Date(i.date) >= p.period.from && new Date(i.date) <= p.period.to).length)} invoices summed at line level`,
  );
  const cReceivables = cite(
    "Open invoices, net of receipts and credit notes",
    "/commercial/receivables",
    `${formatCount(rec.openInvoices.length)} invoices with a balance`,
  );
  const cRetention = cite(
    "Retention register",
    "/projects/retention",
    `${formatCount(ret.projectCount)} projects holding retention`,
  );
  const cOrderBook = cite(
    "Confirmed sales orders not yet invoiced",
    "/sales/orders",
    `${formatCount(ds.salesOrders.filter((o) => o.status === "OPEN" || o.status === "PARTIAL").length)} open orders`,
  );
  const cTickets = cite(
    "Open service tickets with live SLA clocks",
    "/service/dispatch",
    `${formatCount(openTickets.length)} open tickets`,
  );
  const cAmc = cite(
    "AMC contracts inside the 60-day renewal horizon",
    "/service/renewals",
    `${formatCount(expiring.length)} contracts`,
  );
  const cCollections = cite(
    "Collection follow-up log",
    "/commercial/receivables?filter=promises",
    `${formatCount(ds.collectionFollowUps.length)} logged follow-ups`,
  );

  const position: BriefingSentence[] = [
    {
      text: `Revenue for ${p.label} stands at ${abbreviateINR(revenue)}, against ${abbreviateINR(prior)} in ${p.priorLabel}.`,
      marker: cRevenue,
    },
    {
      text: `${abbreviateINR(locked.total)} is sitting outside the business: ${abbreviateINR(locked.receivables)} in receivables and ${abbreviateINR(locked.retention)} in project retention.`,
      marker: cReceivables,
    },
    {
      text: `Of that retention, ${abbreviateINR(ret.eligible)} across ${formatCount(ret.eligibleProjectCount)} project${ret.eligibleProjectCount === 1 ? "" : "s"} is already claimable — the defect-liability period has run.`,
      marker: cRetention,
    },
    {
      text: `The order book carries ${abbreviateINR(orderBook)} of confirmed work not yet invoiced.`,
      marker: cOrderBook,
    },
  ];

  const movements: BriefingSentence[] = [];
  if (growth === null) {
    movements.push({
      text: "There is no comparable prior period in the dataset, so no movement can be stated for revenue.",
      marker: null,
    });
  } else {
    movements.push({
      text: `Revenue is ${growth >= 0 ? "up" : "down"} ${formatPercent(Math.abs(growth), 1)} against ${p.priorLabel} — a change of ${abbreviateINR(Math.abs(revenue - prior))}.`,
      marker: cRevenue,
    });
  }
  movements.push({
    text: `${formatCount(rec.buckets.B90_PLUS.count)} invoices worth ${abbreviateINR(rec.buckets.B90_PLUS.value)} have passed ninety days, which is ${formatPercent((rec.buckets.B90_PLUS.value / (rec.total || 1)) * 100, 1)} of everything outstanding.`,
    marker: cReceivables,
  });
  if (brokenPromises.length > 0) {
    movements.push({
      text: `${formatCount(brokenPromises.length)} payment promises recorded against those invoices have passed unfulfilled.`,
      marker: cCollections,
    });
  }
  movements.push({
    text: `${formatCount(openTickets.length)} service commitments are open and ${formatCount(breached.length)} are already past their restoration commitment.`,
    marker: cTickets,
  });
  movements.push({
    text: `${formatCount(expiring.length)} AMC contracts worth ${abbreviateINR(expiringValue)} expire within sixty days, while the attach rate across eligible machines is ${formatPercent(attach.pct)} — ${formatCount(attach.outOfCoverage)} machines carry no cover at all.`,
    marker: cAmc,
  });

  const attention: BriefingSentence[] = [];
  /* One per type, so three different problems are named rather than one problem three times. */
  const seenTypes = new Set<string>();
  const topThree: ExceptionRow[] = [];
  for (const row of exceptions) {
    if (seenTypes.has(row.type)) continue;
    seenTypes.add(row.type);
    topThree.push(row);
    if (topThree.length === 3) break;
  }
  if (topThree.length === 0) {
    attention.push({
      text: "No exception rule matched anything in the current scope, so there is nothing the platform can put in front of you today.",
      marker: null,
    });
  } else {
    topThree.forEach((row) => {
      const marker = cite(
        `${EXCEPTION_LABEL[row.type]} — ${row.subject}`,
        row.subjectHref,
        `${row.ownerName}, ${ROLE_LABEL[row.ownerRole]}`,
      );
      attention.push({
        text: `${EXCEPTION_LABEL[row.type]} on ${row.subject}: ${row.detail} Accountable: ${row.ownerName}.`,
        marker,
      });
    });
  }

  /* ---- what the briefing deliberately will not assert -------------------- */
  const gaps: string[] = [];
  const renewedLast12 = ds.amcContracts.filter(
    (a) =>
      a.renewedIntoId &&
      new Date(a.endDate) >= new Date(p.asOf.getTime() - 365 * 86_400_000) &&
      new Date(a.endDate) <= p.asOf,
  ).length;
  if (renewedLast12 === 0) {
    gaps.push(
      "No AMC renewal has been recorded in the trailing twelve months, so no renewal-rate trend can be stated. The figure would read zero at every branch, which reflects the absence of records rather than a measured decline.",
    );
  }
  const unreportedEInvoices = ds.invoices.filter((i) => i.eInvoiceApplicable && !i.irpReportedAt).length;
  if (unreportedEInvoices === 0) {
    gaps.push(
      "The e-invoice reporting-window rule was evaluated against every applicable invoice and matched nothing. The briefing therefore makes no compliance claim in either direction beyond that.",
    );
  }
  const lostWithoutCompetitor = ds.quotations.filter((qt) => qt.status === "LOST" && !qt.competitor).length;
  if (lostWithoutCompetitor > 0) {
    gaps.push(
      `${formatCount(lostWithoutCompetitor)} lost quotations carry no competitor on the record, so the briefing cannot attribute those losses to a named rival.`,
    );
  }
  gaps.push(
    "The platform holds no bank balance and no supplier payment plan, so nothing here is a cash-flow forecast. It reports what is invoiced, what is promised and what is retained — not what will clear.",
  );

  return {
    generatedAtIso: p.asOf.toISOString(),
    generatedAtLabel: formatDateTime(p.asOf),
    periodLabel: p.label,
    scopeLabel,
    sections: [
      { heading: "Position", sentences: position },
      { heading: "What moved", sentences: movements },
      { heading: "Three things that deserve you today", sentences: attention },
    ],
    citations,
    gaps,
    disclosure: BRIEFING_DISCLOSURE,
  };
}
