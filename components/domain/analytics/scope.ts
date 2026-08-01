import type { Dataset } from "@/lib/schemas";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { scopeFor, type Capability } from "@/lib/rbac/matrix";
import type { Session } from "@/lib/rbac/session";
import { formatDate } from "@/lib/format";

/**
 * E12-S1 — the analytics header contract.
 *
 * Period, branch scope and comparison basis are the three controls every one of
 * the five surfaces carries. They live in the URL, so a server component
 * recomputes the entire surface when any of the three changes, and a shared
 * link reproduces the same figures for the next reader.
 *
 * Nothing here computes a KPI. Scoping filters *records*; the formula that
 * consumes them is always the single implementation in `/lib/derive` (AR-2).
 */

export interface Period {
  from: Date;
  to: Date;
}

export const PERIOD_KEYS = [
  "FY_TO_DATE",
  "THIS_MONTH",
  "THIS_QUARTER",
  "LAST_30",
  "LAST_12M",
  "PRIOR_FY",
] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  FY_TO_DATE: "Financial year to date",
  THIS_MONTH: "This month",
  THIS_QUARTER: "This quarter",
  LAST_30: "Last 30 days",
  LAST_12M: "Last 12 months",
  PRIOR_FY: "Prior financial year",
};

export interface ResolvedPeriod {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date;
  /** "01 Apr 2026 – 31 Jul 2026" */
  rangeLabel: string;
  days: number;
}

const DAY = 86_400_000;

function fyStart(now: Date): Date {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 3, 1, 0, 0, 0, 0);
}

/** FY quarters run Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar. */
function fyQuarterStart(now: Date): Date {
  const m = now.getMonth();
  const qStartMonth = m >= 3 && m <= 5 ? 3 : m >= 6 && m <= 8 ? 6 : m >= 9 ? 9 : 0;
  return new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
}

function seal(key: PeriodKey, from: Date, to: Date): ResolvedPeriod {
  return {
    key,
    label: PERIOD_LABEL[key],
    from,
    to,
    rangeLabel: `${formatDate(from)} – ${formatDate(to)}`,
    days: Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY)),
  };
}

export function resolvePeriod(key: PeriodKey, now: Date): ResolvedPeriod {
  switch (key) {
    case "THIS_MONTH":
      return seal(key, new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), now);
    case "THIS_QUARTER":
      return seal(key, fyQuarterStart(now), now);
    case "LAST_30":
      return seal(key, new Date(now.getTime() - 30 * DAY), now);
    case "LAST_12M":
      return seal(key, new Date(now.getTime() - 365 * DAY), now);
    case "PRIOR_FY": {
      const s = fyStart(now);
      return seal(
        key,
        new Date(s.getFullYear() - 1, 3, 1, 0, 0, 0, 0),
        new Date(s.getFullYear(), 2, 31, 23, 59, 59, 999),
      );
    }
    case "FY_TO_DATE":
    default:
      return seal("FY_TO_DATE", fyStart(now), now);
  }
}

export function parsePeriodKey(raw: string | undefined | null): PeriodKey {
  return PERIOD_KEYS.includes(raw as PeriodKey) ? (raw as PeriodKey) : "FY_TO_DATE";
}

/* ------------------------------------------------------- comparison basis */

export const BASIS_KEYS = ["NONE", "PRIOR_PERIOD", "PRIOR_YEAR"] as const;
export type BasisKey = (typeof BASIS_KEYS)[number];

export const BASIS_LABEL: Record<BasisKey, string> = {
  NONE: "No comparison",
  PRIOR_PERIOD: "Prior period",
  PRIOR_YEAR: "Prior year",
};

/**
 * E12-S2 — a delta is never an unlabelled percentage. This sentence fragment is
 * appended to every comparison so the reader is told, in words, what the number
 * is measured against.
 */
export const BASIS_IN_WORDS: Record<BasisKey, string> = {
  NONE: "no comparison basis is selected",
  PRIOR_PERIOD: "against the immediately preceding period of equal length",
  PRIOR_YEAR: "against the same period one year earlier",
};

export function parseBasisKey(raw: string | undefined | null): BasisKey {
  return BASIS_KEYS.includes(raw as BasisKey) ? (raw as BasisKey) : "PRIOR_YEAR";
}

export function comparisonPeriod(basis: BasisKey, p: ResolvedPeriod): ResolvedPeriod | null {
  if (basis === "NONE") return null;
  if (basis === "PRIOR_PERIOD") {
    const span = p.to.getTime() - p.from.getTime();
    const to = new Date(p.from.getTime() - 1);
    return seal(p.key, new Date(to.getTime() - span), to);
  }
  const shift = (d: Date) => new Date(d.getFullYear() - 1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return seal(p.key, shift(p.from), shift(p.to));
}

/* ---------------------------------------------------------- branch scope */

export interface AnalyticsScope {
  branchId: string | null;
  branchLabel: string;
  /** RBAC-2 — a branch-scoped role cannot widen the selector. */
  locked: boolean;
  lockReason: string | null;
  ownerUserId: string | null;
  ownerEmployeeId: string | null;
  ownerLabel: string | null;
  roleLabel: string;
  /** One sentence, rendered on screen, naming exactly what was included. */
  statement: string;
  /** Machine-readable filter list for the export provenance block. */
  filters: string[];
  selectable: { id: string; label: string }[];
}

export function resolveScope(
  ds: Dataset,
  session: Session,
  cap: Capability,
  requestedBranch: string | undefined | null,
): AnalyticsScope {
  const rbacScope = scopeFor(session.role, cap);
  const roleLabel = ROLE_LABEL[session.role];
  const branchName = (id: string | null) =>
    id ? (ds.branches.find((b) => b.id === id)?.name ?? id) : "All branches";
  const selectable = [
    { id: "ALL", label: "All branches" },
    ...ds.branches.map((b) => ({ id: b.id, label: b.name })),
  ];

  if (rbacScope === "OWN" || rbacScope === "SELF" || rbacScope === "ASSIGNED") {
    const user = ds.users.find((u) => u.id === session.userId) ?? null;
    const branchId = session.branchId;
    return {
      branchId,
      branchLabel: branchName(branchId),
      locked: true,
      lockReason: `Your role reads its own records only, so the branch and owner filters are fixed.`,
      ownerUserId: session.userId,
      ownerEmployeeId: user?.employeeId ?? null,
      ownerLabel: session.name,
      roleLabel,
      statement: `Scope — records owned by ${session.name} at ${branchName(branchId)}. The ${roleLabel} role is scoped to its own records, so figures here are narrower than the same metric read by a director.`,
      filters: [`Branch: ${branchName(branchId)}`, `Owner: ${session.name}`],
      selectable: [{ id: branchId, label: branchName(branchId) }],
    };
  }

  if (rbacScope === "BRANCH") {
    const branchId = session.branchId;
    return {
      branchId,
      branchLabel: branchName(branchId),
      locked: true,
      lockReason: "RBAC-2 — a branch-scoped role reads its own branch only, so the selector is locked.",
      ownerUserId: null,
      ownerEmployeeId: null,
      ownerLabel: null,
      roleLabel,
      statement: `Scope — ${branchName(branchId)} only. The ${roleLabel} role is branch-scoped, so every figure on this surface excludes the other branches.`,
      filters: [`Branch: ${branchName(branchId)}`],
      selectable: [{ id: branchId, label: branchName(branchId) }],
    };
  }

  const branchId = requestedBranch && requestedBranch !== "ALL" && ds.branches.some((b) => b.id === requestedBranch)
    ? requestedBranch
    : null;
  return {
    branchId,
    branchLabel: branchName(branchId),
    locked: false,
    lockReason: null,
    ownerUserId: null,
    ownerEmployeeId: null,
    ownerLabel: null,
    roleLabel,
    statement: branchId
      ? `Scope — ${branchName(branchId)} only. Every figure on this surface excludes the other three branches.`
      : `Scope — all four branches. The ${roleLabel} role reads the whole business.`,
    filters: [`Branch: ${branchName(branchId)}`],
    selectable,
  };
}

/* ------------------------------------------------- record-level filtering */

const keep = <T>(rows: T[], f: (r: T) => boolean) => rows.filter(f);

/**
 * Filters the seeded world down to the records the scope admits, then hands the
 * result to the unchanged formulas in `/lib/derive`. Scoping is a *record*
 * operation; no formula is re-implemented here.
 */
export function scopeDataset(ds: Dataset, scope: AnalyticsScope): Dataset {
  if (!scope.branchId && !scope.ownerUserId) return ds;
  const b = scope.branchId;
  const owner = scope.ownerUserId;
  const ownerEmp = scope.ownerEmployeeId;
  const byBranch = <T extends { branchId: string }>(rows: T[]) => (b ? keep(rows, (r) => r.branchId === b) : rows);

  const customers = byBranch(ds.customers);
  const customerIds = new Set(customers.map((c) => c.id));
  const sites = keep(ds.sites, (s) => customerIds.has(s.customerId));

  const enquiries = keep(byBranch(ds.enquiries), (e) => !owner || e.ownerUserId === owner);
  const quotations = keep(byBranch(ds.quotations), (q) => !owner || q.ownerUserId === owner);
  const quotationIds = new Set(quotations.map((q) => q.id));
  const salesOrders = keep(byBranch(ds.salesOrders), (o) => !owner || o.ownerUserId === owner);
  const salesOrderIds = new Set(salesOrders.map((o) => o.id));

  const assets = byBranch(ds.assets);
  const assetIds = new Set(assets.map((a) => a.id));
  const amcContracts = byBranch(ds.amcContracts);
  const amcIds = new Set(amcContracts.map((a) => a.id));

  const tickets = byBranch(ds.tickets);
  const ticketIds = new Set(tickets.map((t) => t.id));
  const jobCards = keep(ds.jobCards, (j) => ticketIds.has(j.ticketId) && (!ownerEmp || j.engineerUserId === ownerEmp));
  const jobCardIds = new Set(jobCards.map((j) => j.id));

  const projects = byBranch(ds.projects);
  const projectIds = new Set(projects.map((p) => p.id));
  const raBills = keep(ds.raBills, (r) => projectIds.has(r.projectId));
  const raBillIds = new Set(raBills.map((r) => r.id));

  const invoices = keep(byBranch(ds.invoices), (i) => !owner || i.ownerUserId === owner);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const receipts = byBranch(ds.receipts);
  const receiptIds = new Set(receipts.map((r) => r.id));

  const rentalAssets = byBranch(ds.rentalAssets);
  const rentalAssetIds = new Set(rentalAssets.map((r) => r.id));

  const stockLocations = keep(ds.stockLocations, (l) => !b || l.branchId === b || l.branchId === null);
  const stockLocationIds = new Set(stockLocations.map((l) => l.id));

  const employees = byBranch(ds.employees);

  return {
    ...ds,
    branches: b ? keep(ds.branches, (x) => x.id === b) : ds.branches,
    users: b ? keep(ds.users, (u) => u.branchId === b) : ds.users,
    customers,
    sites,
    contacts: keep(ds.contacts, (c) => customerIds.has(c.customerId)),
    enquiries,
    quotations,
    quotationLines: keep(ds.quotationLines, (l) => quotationIds.has(l.quotationId)),
    salesOrders,
    salesOrderLines: keep(ds.salesOrderLines, (l) => salesOrderIds.has(l.salesOrderId)),
    targets: b ? keep(ds.targets, (t) => t.branchId === b || t.branchId === null) : ds.targets,
    activities: keep(ds.activities, (a) => customerIds.has(a.customerId)),
    assets,
    commissioningReports: keep(ds.commissioningReports, (r) => assetIds.has(r.assetId)),
    amcContracts,
    scheduledVisits: keep(ds.scheduledVisits, (v) => amcIds.has(v.amcContractId)),
    rentalAssets,
    rentalAgreements: keep(ds.rentalAgreements, (a) => rentalAssetIds.has(a.rentalAssetId)),
    tickets,
    jobCards,
    partConsumptions: keep(ds.partConsumptions, (p) => jobCardIds.has(p.jobCardId)),
    partsRequests: keep(
      ds.partsRequests,
      (r) => (r.jobCardId ? jobCardIds.has(r.jobCardId) : r.projectId ? projectIds.has(r.projectId) : true),
    ),
    projects,
    boqLines: keep(ds.boqLines, (l) => projectIds.has(l.projectId)),
    dprs: keep(ds.dprs, (d) => projectIds.has(d.projectId)),
    milestones: keep(ds.milestones, (m) => projectIds.has(m.projectId)),
    raBills,
    retentionEntries: keep(ds.retentionEntries, (r) => projectIds.has(r.projectId) || raBillIds.has(r.raBillId)),
    projectCosts: keep(ds.projectCosts, (c) => projectIds.has(c.projectId)),
    stockLocations,
    stockMovements: keep(
      ds.stockMovements,
      (m) =>
        (m.fromLocationId ? stockLocationIds.has(m.fromLocationId) : true) &&
        (m.toLocationId ? stockLocationIds.has(m.toLocationId) : true),
    ),
    stockReservations: keep(ds.stockReservations, (r) => stockLocationIds.has(r.locationId)),
    challans: byBranch(ds.challans),
    invoices,
    invoiceLines: keep(ds.invoiceLines, (l) => invoiceIds.has(l.invoiceId)),
    creditNotes: keep(ds.creditNotes, (c) => invoiceIds.has(c.invoiceId)),
    ewayBills: ds.ewayBills,
    receipts,
    receiptAllocations: keep(ds.receiptAllocations, (a) => receiptIds.has(a.receiptId) && invoiceIds.has(a.invoiceId)),
    collectionFollowUps: keep(ds.collectionFollowUps, (f) => invoiceIds.has(f.invoiceId)),
    employees,
    documents: keep(ds.documents, (d) =>
      d.linkedType === "CUSTOMER" && d.linkedId
        ? customerIds.has(d.linkedId)
        : d.linkedType === "ASSET" && d.linkedId
          ? assetIds.has(d.linkedId)
          : d.linkedType === "PROJECT" && d.linkedId
            ? projectIds.has(d.linkedId)
            : true,
    ),
    approvalRequests: b ? keep(ds.approvalRequests, (a) => a.branchId === b) : ds.approvalRequests,
  };
}

/* ------------------------------------------------------------- buckets */

export interface Bucket extends Period {
  label: string;
  key: string;
}

/** Calendar months ending in the period's final month, most recent last. */
export function monthlyBuckets(to: Date, count: number): Bucket[] {
  const out: Bucket[] = [];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(to.getFullYear(), to.getMonth() - i, 1, 0, 0, 0, 0);
    const end = new Date(to.getFullYear(), to.getMonth() - i + 1, 0, 23, 59, 59, 999);
    out.push({
      from: start,
      to: end.getTime() > to.getTime() ? to : end,
      label: `${MONTHS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`,
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return out;
}
