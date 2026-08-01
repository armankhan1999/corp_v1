import { cookies } from "next/headers";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE, type Session } from "@/lib/rbac/session";
import { canCreate, canWrite, scopeFor } from "@/lib/rbac/matrix";
import type { Dataset } from "@/lib/schemas";
import type { Project } from "@/lib/schemas/entities";
import { dlpExpiry, type BoqLineSeed } from "./compute";

/**
 * Server-side assembly for E6. Pages read the seeded world here, apply the
 * RBAC scope, run every derivation through `/lib/derive`, and hand plain
 * serialisable rows to the client components that layer the overlay on top.
 */

export interface ProjectsViewer {
  userId: string;
  name: string;
  role: Session["role"];
  /** ASSIGNED — a project manager sees only projects they manage. RBAC-3. */
  scope: "ALL" | "ASSIGNED" | "BRANCH" | "OWN" | "SELF";
  canWriteProjects: boolean;
  canCreateProjects: boolean;
  canWriteDpr: boolean;
  canWriteBills: boolean;
  canWriteRetention: boolean;
  canWriteCost: boolean;
}

export async function getViewer(): Promise<ProjectsViewer> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return {
      userId: "-", name: "Unknown", role: "AUDITOR", scope: "ALL",
      canWriteProjects: false, canCreateProjects: false, canWriteDpr: false,
      canWriteBills: false, canWriteRetention: false, canWriteCost: false,
    };
  }
  return {
    userId: session.userId,
    name: session.name,
    role: session.role,
    scope: scopeFor(session.role, "projects"),
    canWriteProjects: canWrite(session.role, "projects"),
    canCreateProjects: canCreate(session.role, "projects"),
    canWriteDpr: canWrite(session.role, "dpr"),
    canWriteBills: canWrite(session.role, "raBills"),
    canWriteRetention: canWrite(session.role, "retention"),
    canWriteCost: canWrite(session.role, "projectCost"),
  };
}

/** E6-S1 — PROJECT_MANAGER sees assigned projects; DIRECTOR_BUSINESS sees all. */
export function inScope(p: Project, v: ProjectsViewer, ds: Dataset): boolean {
  if (v.scope === "ASSIGNED" || v.scope === "OWN" || v.scope === "SELF") {
    return p.managerUserId === v.userId;
  }
  if (v.scope === "BRANCH") {
    const user = ds.users.find((u) => u.id === v.userId);
    return !user || p.branchId === user.branchId;
  }
  return true;
}

/* ---------------------------------------------------------------- rows */

export interface PortfolioRow {
  id: string;
  code: string;
  name: string;
  clientName: string;
  clientType: string;
  siteLocation: string;
  district: string;
  contractValue: number;
  pricedBoqValue: number;
  physicalPct: number;
  physicalBasis: "PROGRESS_ENTRIES" | "RECORDED_COMPLETION";
  executedValue: number;
  certifiedValue: number;
  financialPct: number;
  billingRealisationPct: number;
  scheduleVariancePct: number;
  varianceTolerancePct: number;
  atRisk: boolean;
  retentionOutstanding: number;
  retentionEligible: number;
  status: string;
  managerUserId: string;
  managerName: string;
  startDate: string;
  contractualCompletion: string;
  revisedCompletion: string | null;
  actualCompletion: string | null;
  defectLiabilityMonths: number;
  dlpExpiry: string;
  retentionPct: number;
  live: boolean;
  dprCount: number;
  openBills: number;
}

const COMPLETE_STATES = new Set(["COMPLETED", "DLP", "CLOSED"]);
export const LIVE_STATES = new Set(["MOBILISED", "IN_PROGRESS", "COMMISSIONING"]);

export function buildPortfolioRow(ds: Dataset, p: Project, now: Date): PortfolioRow {
  const progress = D.projectProgress(ds, p.id);
  const bills = ds.raBills.filter((b) => b.projectId === p.id);
  const certified = bills.reduce((s, b) => s + (b.certifiedValue ?? 0), 0);
  const entries = ds.retentionEntries.filter((e) => e.projectId === p.id);
  const outstanding = entries
    .filter((e) => D.retentionStateOf(e, now) !== "RELEASED")
    .reduce((s, e) => s + e.amount, 0);
  const eligible = entries
    .filter((e) => {
      const st = D.retentionStateOf(e, now);
      return st === "ELIGIBLE" || st === "CLAIM_RAISED";
    })
    .reduce((s, e) => s + e.amount, 0);
  const variance = D.scheduleVariancePct(ds, p, now);
  const complete = COMPLETE_STATES.has(p.status);
  const customer = ds.customers.find((c) => c.id === p.customerId);
  const manager = ds.users.find((u) => u.id === p.managerUserId);

  return {
    id: p.id,
    code: p.code,
    name: p.name,
    clientName: customer?.tradeName ?? customer?.legalName ?? "—",
    clientType: p.clientType,
    siteLocation: p.siteLocation,
    district: p.district,
    contractValue: p.contractValue,
    pricedBoqValue: progress.contractedValue,
    // Physical progress is executed value against the priced BOQ. A project
    // with a recorded actual completion reads 100% — the works are done and
    // no further progress entry will be filed against them.
    physicalPct: complete ? 100 : progress.pct,
    physicalBasis: complete ? "RECORDED_COMPLETION" : "PROGRESS_ENTRIES",
    executedValue: complete ? progress.contractedValue : progress.executedValue,
    certifiedValue: certified,
    financialPct: p.contractValue ? (certified / p.contractValue) * 100 : 0,
    billingRealisationPct: D.projectBillingRealisationPct(ds, p.id),
    scheduleVariancePct: variance,
    varianceTolerancePct: p.varianceTolerancePct,
    atRisk: LIVE_STATES.has(p.status) && variance < -p.varianceTolerancePct,
    retentionOutstanding: outstanding,
    retentionEligible: eligible,
    status: p.status,
    managerUserId: p.managerUserId,
    managerName: manager?.name ?? "Unassigned",
    startDate: p.startDate,
    contractualCompletion: p.contractualCompletion,
    revisedCompletion: p.revisedCompletion,
    actualCompletion: p.actualCompletion,
    defectLiabilityMonths: p.defectLiabilityMonths,
    dlpExpiry: dlpExpiry(p).toISOString(),
    retentionPct: p.retentionPct,
    live: LIVE_STATES.has(p.status),
    dprCount: ds.dprs.filter((d) => d.projectId === p.id && !d.supersedesId).length,
    openBills: bills.filter((b) => b.status !== "PAID").length,
  };
}

export function portfolioRows(ds: Dataset, v: ProjectsViewer, now: Date): PortfolioRow[] {
  return ds.projects
    .filter((p) => inScope(p, v, ds))
    .map((p) => buildPortfolioRow(ds, p, now));
}

/* ------------------------------------------------------------------ BOQ */

export function boqSeedLines(ds: Dataset, projectId: string): BoqLineSeed[] {
  return ds.boqLines
    .filter((l) => l.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => ({
      id: l.id,
      section: l.section,
      sortOrder: l.sortOrder,
      code: l.code,
      description: l.description,
      uom: l.uom,
      contractedQty: l.contractedQty,
      rate: l.rate,
      variationQty: l.variationQty,
      variationRef: l.variationRef,
      seedExecutedQty: D.boqExecutedQty(ds, l.id),
    }));
}

/* ------------------------------------------------------------ project head */

export interface ProjectHead extends PortfolioRow {
  scopeSummary: string;
  contractType: string;
  workOrderRef: string;
  workOrderDate: string;
  mobilisationAdvance: number;
  priceVariationClause: boolean;
  liquidatedDamagesTerms: string;
  branchName: string;
  customerId: string;
  createdAt: string;
}

export function projectHead(ds: Dataset, p: Project, now: Date): ProjectHead {
  const branch = ds.branches.find((b) => b.id === p.branchId);
  return {
    ...buildPortfolioRow(ds, p, now),
    scopeSummary: p.scopeSummary,
    contractType: p.contractType,
    workOrderRef: p.workOrderRef,
    workOrderDate: p.workOrderDate,
    mobilisationAdvance: p.mobilisationAdvance,
    priceVariationClause: p.priceVariationClause,
    liquidatedDamagesTerms: p.liquidatedDamagesTerms,
    branchName: branch ? `${branch.name}, ${branch.city}` : "—",
    customerId: p.customerId,
    createdAt: p.createdAt,
  };
}

/* ------------------------------------------------------------- RA-bills */

export function seedBillRows(ds: Dataset, projectId: string) {
  return ds.raBills
    .filter((b) => b.projectId === projectId)
    .sort((a, b) => a.sequence - b.sequence)
    .map((b) => ({
      id: b.id,
      number: b.number,
      projectId: b.projectId,
      sequence: b.sequence,
      periodFrom: b.periodFrom,
      periodTo: b.periodTo,
      cumulativeValue: b.cumulativeValue,
      previousCumulative: b.previousCumulative,
      frozenExecution: b.frozenExecution,
      mobilisationRecovery: b.mobilisationRecovery,
      retentionPct: b.retentionPct,
      tdsPct: b.tdsPct,
      labourCessPct: b.labourCessPct,
      otherDeductions: b.otherDeductions,
      otherDeductionsNote: b.otherDeductionsNote,
      claimedValue: b.claimedValue,
      certifiedValue: b.certifiedValue,
      status: b.status,
      submittedAt: b.submittedAt,
      certifiedAt: b.certifiedAt,
      paidAt: b.paidAt,
      invoiceRef: b.invoiceId,
      createdAt: b.createdAt,
      source: "SEED" as const,
    }));
}

/** Resolves a project and the viewer's right to see it. E6-S7 access denial. */
export async function loadProject(projectId: string): Promise<
  | { ok: true; ds: Dataset; project: Project; head: ProjectHead; viewer: ProjectsViewer; now: Date }
  | { ok: false; reason: "NOT_FOUND" | "DENIED"; viewer: ProjectsViewer; projectId: string }
> {
  const ds = getDataset();
  const viewer = await getViewer();
  const project = ds.projects.find((p) => p.id === projectId || p.code === projectId);
  if (!project) return { ok: false, reason: "NOT_FOUND", viewer, projectId };
  if (!inScope(project, viewer, ds)) {
    return { ok: false, reason: "DENIED", viewer, projectId };
  }
  const now = D.ctxOf(ds).now;
  return { ok: true, ds, project, head: projectHead(ds, project, now), viewer, now };
}
