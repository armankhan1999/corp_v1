import type { Dataset } from "@/lib/schemas";
import * as D from "@/lib/derive";
import { abbreviateINR, formatCount, formatDate, formatPercent } from "@/lib/format";

/**
 * E13 — the assistant's deterministic answer set. AI-G10: Phase 1 behaviour is
 * seeded, not generated. Every answer carries the formula it applied and a
 * one-click path to the exact record set it was computed from (E13-S1), and the
 * refusal cases are first-class designed states rather than errors (E13-S4).
 */

export type AnswerKind = "FIGURE" | "TABLE" | "REFUSAL";

export interface AnswerColumn { key: string; label: string; numeric?: boolean }

export interface AssistantAnswer {
  kind: AnswerKind;
  headline: string;
  narrative: string;
  formula: string | null;
  /** Datasets touched, surfaced as the reasoning trail (E13-S1). */
  queried: string[];
  scopeNote: string;
  recordSetHref: string | null;
  recordSetLabel: string | null;
  columns?: AnswerColumn[];
  rows?: Record<string, string>[];
  /** Set on refusals: precisely what would be required to answer. */
  requires?: string;
  caution?: string;
}

export interface BankEntry {
  id: string;
  question: string;
  answer: (ds: Dataset) => AssistantAnswer;
}

export const ASSISTANT_BANK: BankEntry[] = [
  {
    id: "outstanding-institutional-90",
    question: "How much is outstanding beyond ninety days from institutional customers?",
    answer: (ds) => {
      const rec = D.receivables(D.ctxOf(ds));
      const instIds = new Set(
        ds.customers.filter((c) => c.type === "INSTITUTIONAL" || c.type === "GOVERNMENT").map((c) => c.id),
      );
      const rows = rec.openInvoices
        .filter((o) => o.bucket === "B90_PLUS" && instIds.has(o.invoice.customerId))
        .sort((a, b) => b.outstanding - a.outstanding);
      const total = rows.reduce((s, r) => s + r.outstanding, 0);
      const custName = (id: string) => ds.customers.find((c) => c.id === id)?.tradeName ?? "—";
      return {
        kind: "FIGURE",
        headline: abbreviateINR(total),
        narrative:
          `${abbreviateINR(total)} is outstanding beyond ninety days from institutional and ` +
          `government customers, across ${formatCount(rows.length)} invoices — ` +
          `${formatPercent((total / (rec.total || 1)) * 100)} of total receivables.`,
        formula:
          "Σ (invoice total − allocated receipts − credit notes) for invoices dated more than 90 days " +
          "before the simulated date, where customer type is Institutional or Government.",
        queried: ["invoices", "invoiceLines", "receiptAllocations", "creditNotes", "customers"],
        scopeNote: "All branches",
        recordSetHref: "/commercial/receivables?bucket=B90_PLUS",
        recordSetLabel: `${formatCount(rows.length)} invoices`,
        columns: [
          { key: "number", label: "Invoice" },
          { key: "customer", label: "Customer" },
          { key: "date", label: "Date" },
          { key: "days", label: "Days", numeric: true },
          { key: "outstanding", label: "Outstanding", numeric: true },
        ],
        rows: rows.slice(0, 12).map((r) => ({
          number: r.invoice.number,
          customer: custName(r.invoice.customerId),
          date: formatDate(r.invoice.date),
          days: String(r.days),
          outstanding: abbreviateINR(r.outstanding),
        })),
      };
    },
  },
  {
    id: "amc-expiring-by-branch",
    question: "Which AMCs expire next month, by branch?",
    answer: (ds) => {
      const now = new Date(ds.meta.today);
      const horizon = new Date(now.getTime() + 60 * 86_400_000);
      const expiring = ds.amcContracts.filter((a) => {
        const end = new Date(a.endDate);
        return !a.terminated && end >= now && end <= horizon;
      });
      const branchName = (id: string) => ds.branches.find((b) => b.id === id)?.name ?? "—";
      const byBranch = new Map<string, { count: number; value: number }>();
      for (const a of expiring) {
        const k = branchName(a.branchId);
        const cur = byBranch.get(k) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += a.contractValue;
        byBranch.set(k, cur);
      }
      const total = expiring.reduce((s, a) => s + a.contractValue, 0);
      return {
        kind: "TABLE",
        headline: `${formatCount(expiring.length)} contracts · ${abbreviateINR(total)}`,
        narrative:
          `${formatCount(expiring.length)} AMC contracts worth ${abbreviateINR(total)} expire within ` +
          `sixty days. That is a renewal pipeline, not a loss — each carries an accountable owner on ` +
          `the Renewal Radar.`,
        formula: "AMC contracts whose end date falls between the simulated date and +60 days, grouped by branch.",
        queried: ["amcContracts", "branches", "installedAssets"],
        scopeNote: "All branches",
        recordSetHref: "/service/renewals",
        recordSetLabel: "Renewal Radar",
        columns: [
          { key: "branch", label: "Branch" },
          { key: "count", label: "Contracts", numeric: true },
          { key: "value", label: "Value at stake", numeric: true },
        ],
        rows: [...byBranch]
          .sort((a, b) => b[1].value - a[1].value)
          .map(([branch, v]) => ({ branch, count: String(v.count), value: abbreviateINR(v.value) })),
      };
    },
  },
  {
    id: "lowest-ftfr-engineer",
    question: "Which engineer has the lowest first-time-fix rate this quarter?",
    answer: (ds) => {
      const now = new Date(ds.meta.today);
      const from = now.getTime() - 90 * 86_400_000;
      const byEngineer = new Map<string, { first: number; total: number }>();
      for (const t of ds.tickets) {
        if (!t.closedAt || !t.assignedEngineerId) continue;
        const closed = new Date(t.closedAt).getTime();
        if (closed < from || closed > now.getTime()) continue;
        const cards = ds.jobCards.filter((j) => j.ticketId === t.id);
        const cur = byEngineer.get(t.assignedEngineerId) ?? { first: 0, total: 0 };
        cur.total += 1;
        if (cards.length === 1 && cards[0]!.resolvedOnThisVisit) cur.first += 1;
        byEngineer.set(t.assignedEngineerId, cur);
      }
      const name = (id: string) => ds.employees.find((e) => e.id === id)?.name ?? "—";
      const rows = [...byEngineer]
        .map(([id, v]) => ({ id, pct: (v.first / v.total) * 100, ...v }))
        .sort((a, b) => a.pct - b.pct);
      const worst = rows[0];
      const thin = rows.filter((r) => r.total < 12).length;
      return {
        kind: "TABLE",
        headline: worst ? `${name(worst.id)} · ${formatPercent(worst.pct)}` : "No data",
        narrative: worst
          ? `${name(worst.id)} shows the lowest first-time-fix rate at ${formatPercent(worst.pct)}, ` +
            `across ${formatCount(worst.total)} tickets closed in the trailing quarter.`
          : "No tickets were closed in the trailing quarter.",
        formula:
          "Tickets closed on the first visit ÷ tickets closed × 100, per assigned engineer, trailing " +
          "90 days. Derived from job-card outcomes, never entered.",
        queried: ["serviceTickets", "jobCards", "employees"],
        scopeNote: "All branches · trailing 90 days",
        recordSetHref: "/analytics/service",
        recordSetLabel: "Service analytics",
        caution: thin
          ? `${formatCount(thin)} engineers closed fewer than 12 tickets in the window. Their rates ` +
            `are indicative only — the sample is too small to rank on.`
          : undefined,
        columns: [
          { key: "engineer", label: "Engineer" },
          { key: "closed", label: "Closed", numeric: true },
          { key: "firstFix", label: "First-visit fixes", numeric: true },
          { key: "pct", label: "FTFR", numeric: true },
        ],
        rows: rows.slice(0, 10).map((r) => ({
          engineer: name(r.id),
          closed: String(r.total),
          firstFix: String(r.first),
          pct: formatPercent(r.pct),
        })),
      };
    },
  },
  {
    id: "locked-cash",
    question: "How much of our cash is sitting outside the business?",
    answer: (ds) => {
      const ctx = D.ctxOf(ds);
      const locked = D.lockedCash(ctx);
      const ret = D.retention(ctx);
      return {
        kind: "FIGURE",
        headline: abbreviateINR(locked.total),
        narrative:
          `${abbreviateINR(locked.total)} sits outside the business: ${abbreviateINR(locked.receivables)} ` +
          `in receivables and ${abbreviateINR(locked.retention)} in project retention. ` +
          `${abbreviateINR(ret.eligible)} of that retention is already claimable across ` +
          `${formatCount(ret.eligibleProjectCount)} projects.`,
        formula: "Outstanding receivables + retention withheld and not yet released.",
        queried: ["invoices", "receiptAllocations", "creditNotes", "retentionEntries", "projects"],
        scopeNote: "All branches",
        recordSetHref: "/commercial/receivables",
        recordSetLabel: "Receivables ageing",
      };
    },
  },
  {
    id: "attach-rate",
    question: "What is our AMC attach rate, and how many machines are uncovered?",
    answer: (ds) => {
      const attach = D.amcAttachRate(D.ctxOf(ds));
      return {
        kind: "FIGURE",
        headline: formatPercent(attach.pct),
        narrative:
          `${formatPercent(attach.pct)} attach rate — ${formatCount(attach.underAmc)} machines under AMC ` +
          `out of ${formatCount(attach.eligible)} eligible. ${formatCount(attach.outOfCoverage)} machines ` +
          `have neither live warranty nor live AMC. ${formatCount(attach.inWarranty)} are still in ` +
          `warranty and so are not yet an AMC opportunity.`,
        formula:
          "Assets under a live AMC ÷ (total assets − assets in warranty − decommissioned) × 100. " +
          "In-warranty machines are excluded from the denominator because they are not yet eligible.",
        queried: ["installedAssets", "amcContracts", "commissioningReports"],
        scopeNote: "All branches",
        recordSetHref: "/service/renewals",
        recordSetLabel: `${formatCount(attach.outOfCoverage)} uncovered assets`,
      };
    },
  },
  {
    id: "forecast-refusal",
    question: "Will the treatment plant project finish on time?",
    answer: (ds) => {
      const now = new Date(ds.meta.today);
      const live = ds.projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "MOBILISED");
      return {
        kind: "REFUSAL",
        headline: "I do not forecast",
        narrative:
          "I will not predict a completion date. What I can show is the evidence — cumulative " +
          "progress against plan, and the schedule variance that follows from it. Whether that " +
          "recovers is your judgement, not mine.",
        formula: "Schedule variance = (cumulative actual progress − cumulative planned) ÷ planned × 100.",
        queried: ["projects", "milestones", "dprs", "boqLines"],
        scopeNote: "Live projects",
        recordSetHref: "/projects",
        recordSetLabel: "Portfolio with S-curves",
        requires:
          "A forecast would need a productivity model, a resource plan and a risk register — none of " +
          "which this platform holds. Predicting from schedule variance alone would be a guess " +
          "wearing a number.",
        columns: [
          { key: "project", label: "Project" },
          { key: "planned", label: "Contractual completion" },
          { key: "progress", label: "Physical progress", numeric: true },
          { key: "variance", label: "Schedule variance", numeric: true },
        ],
        rows: live.map((p) => ({
          project: p.name,
          planned: formatDate(p.contractualCompletion),
          progress: formatPercent(D.projectProgress(ds, p.id).pct),
          variance: formatPercent(D.scheduleVariancePct(ds, p, now)),
        })),
      };
    },
  },
  {
    id: "action-refusal",
    question: "Approve the pending discount on the screw compressor quotation.",
    answer: () => ({
      kind: "REFUSAL",
      headline: "I do not take actions",
      narrative:
        "I read platform data and cite my sources. I cannot approve, send, create or delete a " +
        "business record — that is a design commitment, not a limitation. The approval is waiting " +
        "for you on My Approvals, with the quotation lines, the resulting margin and the customer " +
        "history rendered inline so you can decide without navigating away.",
      formula: null,
      queried: ["approvalRequests"],
      scopeNote: "—",
      recordSetHref: "/workflow/approvals",
      recordSetLabel: "Open My Approvals",
      requires: "A human decision. I can prepare a draft; I cannot act on your behalf.",
    }),
  },
  {
    id: "personal-data-refusal",
    question: "What is the home address and salary of the Muzaffarpur field engineer?",
    answer: () => ({
      kind: "REFUSAL",
      headline: "Excluded from this query",
      narrative:
        "Employee personal data is excluded from assistant retrieval for roles without HR " +
        "permission, and salary is not held by this platform at all — payroll computation sits " +
        "outside its boundary. I am telling you the exclusion applied rather than quietly " +
        "returning a thinner answer.",
      formula: null,
      queried: [],
      scopeNote: "Employee personal data withheld",
      recordSetHref: null,
      recordSetLabel: null,
      requires:
        "HR permission for personal data. Salary would require the external payroll system, which " +
        "this platform hands off to rather than replaces.",
    }),
  },
];

export function findAnswer(ds: Dataset, questionId: string): AssistantAnswer | null {
  const entry = ASSISTANT_BANK.find((e) => e.id === questionId);
  return entry ? entry.answer(ds) : null;
}

/** Anything outside the bank gets an honest insufficiency, never a guess. */
export function unknownQuestion(text: string): AssistantAnswer {
  return {
    kind: "REFUSAL",
    headline: "I could not answer that from platform data",
    narrative:
      `I searched the transactional datasets and found no basis for "${text.trim()}". Rather than ` +
      "assemble something plausible, I am telling you it is outside what I can support.",
    formula: null,
    queried: ["invoices", "serviceTickets", "projects", "amcContracts", "stockMovements"],
    scopeNote: "All permitted data",
    recordSetHref: null,
    recordSetLabel: null,
    requires:
      "In Phase 1 the assistant answers from a curated question bank plus parameterised templates. " +
      "A production retrieval pipeline is Phase 2 — what is being validated here is the provenance " +
      "model and the refusal behaviour, not breadth of coverage.",
  };
}
