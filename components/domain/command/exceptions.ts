import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import type { ExceptionSeverity, ExceptionType, Role } from "@/lib/schemas/enums";
import { OEM_LABEL, ROLE_LABEL } from "@/lib/schemas/enums";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "@/lib/seed/catalog";
import { daysBetween, formatCount, formatOverrun } from "@/lib/format";

/**
 * E2-S4 — the exception producer.
 *
 * Every rule below is published on screen (EXCEPTION_RULE) so the feed is not
 * an oracle: a director can read why a row is present and argue with it. The
 * type set is the unified 16-value taxonomy from `zExceptionType` (PLAN.md
 * C-16); a rule that currently matches nothing is still evaluated and reported
 * as evaluated, rather than quietly omitted.
 *
 * Derived values are never recomputed here — SLA state, coverage, ageing,
 * retention and schedule variance all come from `@/lib/derive` (AR-1, AR-2).
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Thresholds. Sourced from the PRD notification & escalation matrix (§14). */
export const THRESHOLD = {
  /** Commissioning: OEM window is per principal; the feed warns at 2 days left. */
  commissioningWarnDays: 2,
  /** AMC: 60-day renewal horizon, escalating inside 7 days. */
  amcHorizonDays: 60,
  amcUrgentDays: 7,
  /** A quotation is aged once it is past its own stated validity. */
  quotationGraceDays: 0,
  /** Statutory e-invoice reporting window, configurable in Masters. */
  eInvoiceWindowDays: 30,
  eInvoiceWarnDays: 5,
  /** RA-bill uncertified for longer than this. */
  raBillCertificationDays: 30,
  raBillEscalationDays: 45,
  /** Receivables. */
  invoiceOverdueDays: 90,
  invoiceSevereDays: 180,
} as const;

export const EXCEPTION_RULE: Record<ExceptionType, string> = {
  SLA_IMMINENT:
    "Open ticket with under 10% of its restoration window remaining, on the contracted SLA less recorded pauses.",
  SLA_BREACHED:
    "Open ticket past its restoration commitment. Age is measured from the moment the clock ran out.",
  COMMISSIONING_WINDOW_CLOSING:
    "Commissioning report unsubmitted with 2 days or less left in the principal's window (ELGi and ATS-ELGi 7 days, KSB 10, Ion Exchange 15).",
  COMMISSIONING_OVERDUE:
    "Commissioning report never submitted inside the principal's window. Warranty registration is at risk.",
  AMC_EXPIRING:
    "Live AMC contract ending within 60 days and not yet renewed. Escalates inside 7 days.",
  AMC_LAPSED:
    "AMC contract past its end date with no renewal recorded and no termination on file.",
  QUOTATION_AGED:
    "Quotation still Issued or in Negotiation after its own stated validity has run out.",
  INVOICE_OVER_90:
    "Invoice outstanding beyond 90 days from invoice date, net of allocated receipts and credit notes.",
  PAYMENT_PROMISE_BROKEN:
    "A promised payment date recorded in the collection follow-up log has passed with the promise unfulfilled.",
  EINVOICE_WINDOW_CLOSING:
    "E-invoice-applicable invoice not yet reported to the IRP with 5 days or less left in the 30-day reporting window.",
  PROJECT_SCHEDULE_VARIANCE:
    "Live project whose milestone-weighted schedule variance is worse than its own contracted tolerance.",
  RABILL_AWAITING_CERTIFICATION:
    "RA-bill submitted to the client and uncertified for more than 30 days. Escalates past 45 days.",
  RETENTION_ELIGIBLE:
    "Retention whose defect-liability period has run, and which is therefore claimable now.",
  STOCK_SERVICE_CRITICAL:
    "Service-critical spare — one that has blocked a job card — at or below its reorder level.",
  APPROVAL_OVERDUE:
    "Approval request pending longer than the escalation window of its current step.",
  DOCUMENT_EXPIRED:
    "Statutory or operational document past its recorded expiry date.",
};

export const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const SEVERITY_ORDER: ExceptionSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** Presentation order of the taxonomy — operational urgency, then money, then hygiene. */
export const TYPE_ORDER: ExceptionType[] = [
  "SLA_BREACHED",
  "SLA_IMMINENT",
  "COMMISSIONING_OVERDUE",
  "COMMISSIONING_WINDOW_CLOSING",
  "AMC_LAPSED",
  "AMC_EXPIRING",
  "STOCK_SERVICE_CRITICAL",
  "PROJECT_SCHEDULE_VARIANCE",
  "INVOICE_OVER_90",
  "PAYMENT_PROMISE_BROKEN",
  "EINVOICE_WINDOW_CLOSING",
  "RABILL_AWAITING_CERTIFICATION",
  "RETENTION_ELIGIBLE",
  "QUOTATION_AGED",
  "APPROVAL_OVERDUE",
  "DOCUMENT_EXPIRED",
];

export interface ExceptionRow {
  /** Stable across evaluations: type + subject key. Acknowledgement hangs off it. */
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  /** Identifier of the subject record — rendered in mono. */
  subject: string;
  subjectHref: string;
  headline: string;
  detail: string;
  branchId: string | null;
  ownerId: string;
  ownerName: string;
  ownerRole: Role;
  /** ISO instant at which the exception became true. */
  sinceIso: string;
  ageMs: number;
  /** Rupees at stake, where the exception has a monetary face. */
  value: number | null;
}

/** "18 d" / "6 h 20 m" — never hand-formatted; both helpers come from @/lib/format. */
export function formatAge(ms: number, now: Date, sinceIso: string): string {
  if (ms < 2 * DAY) return formatOverrun(ms);
  return `${formatCount(daysBetween(sinceIso, now))} d`;
}

interface Owner {
  id: string;
  name: string;
  role: Role;
}

function ownerResolver(ds: Dataset) {
  const byUser = new Map(ds.users.map((u) => [u.id, u]));
  const byEmployee = new Map(ds.employees.map((e) => [e.id, e]));
  const byRole = new Map(ds.users.map((u) => [u.role, u]));
  const engineerRole: Role = "FIELD_ENGINEER";

  return function resolve(id: string | null, fallbackRole: Role, branchId?: string | null): Owner {
    if (id) {
      const u = byUser.get(id);
      if (u) return { id: u.id, name: u.name, role: u.role };
      const e = byEmployee.get(id);
      if (e) {
        const linked = ds.users.find((x) => x.employeeId === e.id);
        return { id: e.id, name: e.name, role: linked?.role ?? engineerRole };
      }
    }
    if (branchId) {
      const scoped = ds.users.find((u) => u.role === fallbackRole && u.branchId === branchId);
      if (scoped) return { id: scoped.id, name: scoped.name, role: scoped.role };
    }
    const f = byRole.get(fallbackRole);
    return f
      ? { id: f.id, name: f.name, role: f.role }
      : { id: "", name: "Unassigned", role: fallbackRole };
  };
}

function quotationValues(ds: Dataset): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of ds.quotationLines) {
    const gross = Math.round(l.qty * l.rate * (1 - l.discountPct / 100) * (1 + l.gstRate / 100));
    out.set(l.quotationId, (out.get(l.quotationId) ?? 0) + gross);
  }
  return out;
}

/* ------------------------------------------------------------------ producer */

export function deriveExceptions(ds: Dataset, now: Date): ExceptionRow[] {
  const ctx = D.ctxOf(ds, now.toISOString());
  const rows: ExceptionRow[] = [];
  const owner = ownerResolver(ds);
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  const projectById = new Map(ds.projects.map((p) => [p.id, p]));
  const push = (r: ExceptionRow) => rows.push(r);
  const age = (since: Date) => Math.max(0, now.getTime() - since.getTime());

  /* ---------------------------------------------------------------- service */
  for (const t of ds.tickets) {
    if (!D.isOpenTicket(t)) continue;
    const clock = D.slaClock(t, now);
    if (clock.state !== "BREACHED" && clock.state !== "IMMINENT") continue;
    const o = owner(t.assignedEngineerId, "SERVICE_MANAGER", t.branchId);
    const asset = assetById.get(t.assetId);
    const customer = customerById.get(t.customerId);
    const since = clock.state === "BREACHED"
      ? clock.dueAt
      : new Date(clock.dueAt.getTime() - 0.1 * clock.totalMs);
    push({
      id: `${clock.state === "BREACHED" ? "SLA_BREACHED" : "SLA_IMMINENT"}:${t.id}`,
      type: clock.state === "BREACHED" ? "SLA_BREACHED" : "SLA_IMMINENT",
      severity: clock.state === "BREACHED" ? "CRITICAL" : "HIGH",
      subject: t.number,
      subjectHref: `/service/tickets/${t.id}`,
      headline: `${customer?.tradeName ?? "Customer"} — ${asset?.model ?? "asset"}`,
      detail: clock.state === "BREACHED"
        ? `Restoration commitment passed ${formatOverrun(clock.overrunMs)} ago. ${t.slaRuleApplied}.`
        : `Under 10% of the restoration window remains — ${formatOverrun(clock.remainingMs)} left. ${t.slaRuleApplied}.`,
      branchId: t.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: null,
    });
  }

  /* ---------------------------------------------------------- commissioning */
  for (const r of ds.commissioningReports) {
    const asset = assetById.get(r.assetId);
    if (!asset) continue;
    const windowDays = OEM_COMMISSIONING_WINDOW_DAYS[asset.principal];
    const deadline = D.commissioningDeadline(r, windowDays);
    const state = D.commissioningSubmissionState(r, deadline, now);
    if (state !== "OVERDUE" && state !== "NOT_SUBMITTED") continue;
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY);
    if (state === "NOT_SUBMITTED" && daysLeft > THRESHOLD.commissioningWarnDays) continue;
    const o = owner(r.engineerUserId, "SERVICE_MANAGER", asset.branchId);
    const type: ExceptionType = state === "OVERDUE"
      ? "COMMISSIONING_OVERDUE"
      : "COMMISSIONING_WINDOW_CLOSING";
    const since = state === "OVERDUE"
      ? deadline
      : new Date(deadline.getTime() - THRESHOLD.commissioningWarnDays * DAY);
    push({
      id: `${type}:${r.id}`,
      type,
      severity: state === "OVERDUE" ? "CRITICAL" : "HIGH",
      subject: r.number,
      subjectHref: `/service/commissioning/${r.id}`,
      headline: `${asset.model} · ${customerById.get(asset.customerId)?.tradeName ?? "Customer"}`,
      detail: state === "OVERDUE"
        ? `Never submitted to ${OEM_LABEL[asset.principal]} inside the ${windowDays}-day window. Warranty registration at risk.`
        : `${daysLeft} day(s) left of the ${windowDays}-day submission window.`,
      branchId: asset.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: null,
    });
  }

  /* -------------------------------------------------------------------- AMC */
  for (const a of ds.amcContracts) {
    if (a.terminated || a.renewedIntoId) continue;
    const status = D.amcStatus(a, now);
    if (status !== "EXPIRING" && status !== "EXPIRED") continue;
    const end = new Date(a.endDate);
    const o = owner(a.ownerUserId, "SERVICE_MANAGER", a.branchId);
    const customer = customerById.get(a.customerId);
    const lapsed = status === "EXPIRED";
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / DAY);
    const since = lapsed ? end : new Date(end.getTime() - THRESHOLD.amcHorizonDays * DAY);
    push({
      id: `${lapsed ? "AMC_LAPSED" : "AMC_EXPIRING"}:${a.id}`,
      type: lapsed ? "AMC_LAPSED" : "AMC_EXPIRING",
      severity: lapsed ? "HIGH" : daysLeft <= THRESHOLD.amcUrgentDays ? "HIGH" : "MEDIUM",
      subject: a.number,
      subjectHref: `/service/amc/${a.id}`,
      headline: `${customer?.tradeName ?? "Customer"} — ${a.assetIds.length} machine(s), ${a.coverage === "COMPREHENSIVE" ? "comprehensive" : "non-comprehensive"}`,
      detail: lapsed
        ? "Past its end date with no renewal and no termination recorded. The machines are out of coverage."
        : `Ends in ${daysLeft} day(s). Renewal not yet quoted.`,
      branchId: a.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: a.contractValue,
    });
  }

  /* -------------------------------------------------------------- quotations */
  const qValue = quotationValues(ds);
  for (const q of ds.quotations) {
    if (q.status !== "ISSUED" && q.status !== "NEGOTIATION") continue;
    const expiry = new Date(new Date(q.quotationDate).getTime() + q.validityDays * DAY);
    if (expiry > now) continue;
    const o = owner(q.ownerUserId, "SALES_EXECUTIVE", q.branchId);
    const value = qValue.get(q.id) ?? 0;
    const days = daysBetween(expiry, now);
    push({
      id: `QUOTATION_AGED:${q.id}`,
      type: "QUOTATION_AGED",
      severity: value >= 1_000_000 && days > 60 ? "HIGH" : value >= 500_000 ? "MEDIUM" : "LOW",
      subject: q.number,
      subjectHref: `/sales/quotations/${q.id}`,
      headline: `${customerById.get(q.customerId)?.tradeName ?? "Customer"} — ${q.status === "NEGOTIATION" ? "in negotiation" : "issued, no response"}`,
      detail: `Validity of ${q.validityDays} days ran out ${formatCount(days)} day(s) ago and the quotation is still open.`,
      branchId: q.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: expiry.toISOString(),
      ageMs: age(expiry),
      value,
    });
  }

  /* ------------------------------------------------------------ receivables */
  const rec = D.receivables(ctx);
  for (const line of rec.openInvoices) {
    if (line.bucket !== "B90_PLUS") continue;
    const inv = line.invoice;
    const o = owner(inv.ownerUserId, "ACCOUNTS_EXECUTIVE", inv.branchId);
    const since = new Date(new Date(inv.date).getTime() + THRESHOLD.invoiceOverdueDays * DAY);
    push({
      id: `INVOICE_OVER_90:${inv.id}`,
      type: "INVOICE_OVER_90",
      severity: line.days >= THRESHOLD.invoiceSevereDays && line.outstanding >= 500_000
        ? "CRITICAL"
        : "HIGH",
      subject: inv.number,
      subjectHref: `/commercial/invoices/${inv.id}`,
      headline: customerById.get(inv.customerId)?.tradeName ?? "Customer",
      detail: `${formatCount(line.days)} days from invoice date, net of allocated receipts and credit notes.`,
      branchId: inv.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: line.outstanding,
    });
  }

  const invoiceById = new Map(ds.invoices.map((i) => [i.id, i]));
  for (const f of ds.collectionFollowUps) {
    if (f.fulfilled || !f.promisedDate) continue;
    const promised = new Date(f.promisedDate);
    if (promised >= now) continue;
    const inv = invoiceById.get(f.invoiceId);
    if (!inv) continue;
    const o = owner(f.byUserId, "ACCOUNTS_EXECUTIVE", inv.branchId);
    push({
      id: `PAYMENT_PROMISE_BROKEN:${f.id}`,
      type: "PAYMENT_PROMISE_BROKEN",
      severity: "HIGH",
      subject: inv.number,
      subjectHref: `/commercial/receivables?invoice=${inv.id}`,
      headline: `${customerById.get(inv.customerId)?.tradeName ?? "Customer"} — promise made to ${f.personSpokenTo}`,
      detail: `${f.outcome} Promised on the ${f.mode.toLowerCase()} of that date; nothing received since.`,
      branchId: inv.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: promised.toISOString(),
      ageMs: age(promised),
      value: f.promisedAmount,
    });
  }

  for (const inv of ds.invoices) {
    if (!inv.eInvoiceApplicable || inv.irpReportedAt) continue;
    const closes = new Date(new Date(inv.date).getTime() + THRESHOLD.eInvoiceWindowDays * DAY);
    const daysLeft = Math.ceil((closes.getTime() - now.getTime()) / DAY);
    if (daysLeft > THRESHOLD.eInvoiceWarnDays) continue;
    const o = owner(inv.ownerUserId, "ACCOUNTS_EXECUTIVE", inv.branchId);
    const since = new Date(closes.getTime() - THRESHOLD.eInvoiceWarnDays * DAY);
    push({
      id: `EINVOICE_WINDOW_CLOSING:${inv.id}`,
      type: "EINVOICE_WINDOW_CLOSING",
      severity: daysLeft <= 0 ? "CRITICAL" : "HIGH",
      subject: inv.number,
      subjectHref: `/commercial/invoices/${inv.id}`,
      headline: customerById.get(inv.customerId)?.tradeName ?? "Customer",
      detail: daysLeft <= 0
        ? `The ${THRESHOLD.eInvoiceWindowDays}-day reporting window has closed with no IRN recorded.`
        : `${daysLeft} day(s) left of the ${THRESHOLD.eInvoiceWindowDays}-day reporting window.`,
      branchId: inv.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: D.invoiceTotal(ds, inv.id),
    });
  }

  /* ---------------------------------------------------------------- projects */
  for (const p of ds.projects) {
    if (p.status !== "IN_PROGRESS" && p.status !== "MOBILISED" && p.status !== "COMMISSIONING") continue;
    const variance = D.scheduleVariancePct(ds, p, now);
    if (variance >= -p.varianceTolerancePct) continue;
    const slipped = ds.milestones
      .filter((m) => m.projectId === p.id && !m.actualDate && new Date(m.plannedDate) <= now)
      .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime())[0];
    const since = new Date(slipped?.plannedDate ?? p.startDate);
    const o = owner(p.managerUserId, "PROJECT_MANAGER", p.branchId);
    push({
      id: `PROJECT_SCHEDULE_VARIANCE:${p.id}`,
      type: "PROJECT_SCHEDULE_VARIANCE",
      severity: variance <= -25 ? "CRITICAL" : "HIGH",
      subject: p.code,
      subjectHref: `/projects/${p.id}`,
      headline: p.name,
      detail: `Schedule variance ${variance.toFixed(1)}% against a contracted tolerance of ${p.varianceTolerancePct}%. ${slipped ? `Earliest unmet milestone: ${slipped.name}.` : ""}`,
      branchId: p.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: p.contractValue,
    });
  }

  for (const b of ds.raBills) {
    if (b.certifiedValue !== null || !b.submittedAt) continue;
    const due = new Date(new Date(b.submittedAt).getTime() + THRESHOLD.raBillCertificationDays * DAY);
    if (due > now) continue;
    const p = projectById.get(b.projectId);
    const waiting = daysBetween(b.submittedAt, now);
    const o = owner(p?.managerUserId ?? null, "PROJECT_MANAGER", p?.branchId ?? null);
    push({
      id: `RABILL_AWAITING_CERTIFICATION:${b.id}`,
      type: "RABILL_AWAITING_CERTIFICATION",
      severity: waiting > THRESHOLD.raBillEscalationDays ? "HIGH" : "MEDIUM",
      subject: b.number,
      subjectHref: `/projects/${b.projectId}/ra-bills/${b.id}`,
      headline: p?.name ?? "Project",
      detail: `Submitted ${formatCount(waiting)} days ago and still uncertified by the client.`,
      branchId: p?.branchId ?? null,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: due.toISOString(),
      ageMs: age(due),
      value: b.claimedValue,
    });
  }

  const ret = D.retention(ctx);
  for (const rp of ret.byProject) {
    if (rp.eligible <= 0) continue;
    const p = projectById.get(rp.projectId);
    const entries = ds.retentionEntries
      .filter((e) => e.projectId === rp.projectId && !e.releasedAt && new Date(e.eligibleFrom) <= now)
      .sort((a, b) => new Date(a.eligibleFrom).getTime() - new Date(b.eligibleFrom).getTime());
    const since = new Date(entries[0]?.eligibleFrom ?? now.toISOString());
    const o = owner(p?.managerUserId ?? null, "PROJECT_MANAGER", p?.branchId ?? null);
    push({
      id: `RETENTION_ELIGIBLE:${rp.projectId}`,
      type: "RETENTION_ELIGIBLE",
      severity: rp.eligible >= 500_000 ? "HIGH" : "MEDIUM",
      subject: p?.code ?? rp.projectId,
      subjectHref: `/projects/retention?project=${rp.projectId}`,
      headline: p?.name ?? "Project",
      detail: `Defect-liability period has run on ${formatCount(entries.length)} retention entr${entries.length === 1 ? "y" : "ies"}. Claimable now; no claim raised.`,
      branchId: p?.branchId ?? null,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: since.toISOString(),
      ageMs: age(since),
      value: rp.eligible,
    });
  }

  /* --------------------------------------------------------------- inventory */
  const serviceCriticalItemIds = new Set<string>();
  for (const pr of ds.partsRequests) {
    if (!pr.serviceCritical) continue;
    for (const l of pr.lines) serviceCriticalItemIds.add(l.itemId);
  }
  for (const itemId of serviceCriticalItemIds) {
    const item = itemById.get(itemId);
    if (!item) continue;
    const onHand = D.stockOnHand(ds, itemId);
    if (onHand > item.reorderLevel) continue;
    const last = D.lastIssueDate(ds, itemId);
    const o = owner(null, "STORE_INCHARGE");
    push({
      id: `STOCK_SERVICE_CRITICAL:${itemId}`,
      type: "STOCK_SERVICE_CRITICAL",
      severity: onHand <= 0 ? "CRITICAL" : "HIGH",
      subject: item.code,
      subjectHref: `/inventory/reorder?item=${itemId}`,
      headline: item.description,
      detail: `${formatCount(onHand)} ${item.uom} on hand against a reorder level of ${formatCount(item.reorderLevel)}. This part has already blocked a job card.`,
      branchId: null,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: (last ?? now).toISOString(),
      ageMs: age(last ?? now),
      value: Math.round(item.reorderQty * item.standardCost),
    });
  }

  /* ---------------------------------------------------------------- workflow */
  for (const ar of ds.approvalRequests) {
    if (ar.status !== "PENDING" && ar.status !== "ESCALATED") continue;
    const step = ar.resolvedSteps.find((s) => s.order === ar.currentStep) ?? ar.resolvedSteps[0];
    if (!step) continue;
    const due = new Date(new Date(ar.raisedAt).getTime() + step.escalationHours * HOUR);
    if (due > now) continue;
    const o = owner(null, step.approverRole, ar.branchId);
    const waitedH = Math.round((now.getTime() - new Date(ar.raisedAt).getTime()) / HOUR);
    push({
      id: `APPROVAL_OVERDUE:${ar.id}`,
      type: "APPROVAL_OVERDUE",
      severity: waitedH >= step.escalationHours * 2 ? "HIGH" : "MEDIUM",
      subject: ar.number,
      subjectHref: `/workflow/approvals/${ar.id}`,
      headline: ar.subjectLabel,
      detail: `Pending ${formatCount(waitedH)} h against a step escalation window of ${formatCount(step.escalationHours)} h at ${ROLE_LABEL[step.approverRole]}.`,
      branchId: ar.branchId,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: due.toISOString(),
      ageMs: age(due),
      value: ar.value || null,
    });
  }

  /* --------------------------------------------------------------- documents */
  const employeeById = new Map(ds.employees.map((e) => [e.id, e]));
  for (const ed of ds.employeeDocuments) {
    if (!ed.expiresOn) continue;
    const exp = new Date(ed.expiresOn);
    if (exp >= now) continue;
    const emp = employeeById.get(ed.employeeId);
    const o = owner(null, "HR_ADMIN", emp?.branchId ?? null);
    push({
      id: `DOCUMENT_EXPIRED:${ed.id}`,
      type: "DOCUMENT_EXPIRED",
      severity: "MEDIUM",
      subject: ed.title,
      subjectHref: `/people/documents?employee=${ed.employeeId}`,
      headline: `${emp?.name ?? "Employee"} — ${emp?.designation ?? ""}`,
      detail: `Expired ${formatCount(daysBetween(exp, now))} days ago and no superseding version is on file.`,
      branchId: emp?.branchId ?? null,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: exp.toISOString(),
      ageMs: age(exp),
      value: null,
    });
  }
  for (const doc of ds.documents) {
    if (!doc.expiresOn || doc.deletedAt) continue;
    const exp = new Date(doc.expiresOn);
    if (exp >= now) continue;
    const o = owner(doc.ownerUserId, "HR_ADMIN");
    push({
      id: `DOCUMENT_EXPIRED:${doc.id}`,
      type: "DOCUMENT_EXPIRED",
      severity: doc.category === "STATUTORY" ? "HIGH" : "MEDIUM",
      subject: doc.title,
      subjectHref: `/vault?document=${doc.id}`,
      headline: `${doc.category.replace(/_/g, " ").toLowerCase()} · version ${doc.version}`,
      detail: `Expired ${formatCount(daysBetween(exp, now))} days ago and no superseding version is on file.`,
      branchId: null,
      ownerId: o.id,
      ownerName: o.name,
      ownerRole: o.role,
      sinceIso: exp.toISOString(),
      ageMs: age(exp),
      value: null,
    });
  }

  /* Ordered by severity, then by age — oldest first inside a severity band. */
  rows.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    if (b.ageMs !== a.ageMs) return b.ageMs - a.ageMs;
    return a.id.localeCompare(b.id);
  });
  return rows;
}

export function countByType(rows: ExceptionRow[]): Record<ExceptionType, number> {
  const out = {} as Record<ExceptionType, number>;
  for (const t of TYPE_ORDER) out[t] = 0;
  for (const r of rows) out[r.type] += 1;
  return out;
}

export function countBySeverity(rows: ExceptionRow[]): Record<ExceptionSeverity, number> {
  const out: Record<ExceptionSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of rows) out[r.severity] += 1;
  return out;
}
