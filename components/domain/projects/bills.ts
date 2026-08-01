import type { ProjectsOverlay } from "./store";

/** Serialisable RA-bill shape shared by the list, the builder and the print sheet. */
export interface BillRow {
  id: string;
  number: string;
  projectId: string;
  sequence: number;
  periodFrom: string;
  periodTo: string;
  cumulativeValue: number;
  previousCumulative: number;
  frozenExecution: { boqLineId: string; cumulativeQty: number }[];
  mobilisationRecovery: number;
  retentionPct: number;
  tdsPct: number;
  labourCessPct: number;
  otherDeductions: number;
  otherDeductionsNote: string;
  claimedValue: number;
  certifiedValue: number | null;
  status: "DRAFT" | "SUBMITTED" | "UNDER_CERTIFICATION" | "CERTIFIED" | "PAID";
  submittedAt: string | null;
  certifiedAt: string | null;
  paidAt: string | null;
  invoiceRef: string | null;
  createdAt: string;
  source: "SEED" | "OVERLAY";
}

/**
 * Seeded bills with their overlay patches applied, plus any bill raised through
 * this workspace, in sequence order. The seed object is never touched.
 */
export function mergeBills(seed: BillRow[], overlay: ProjectsOverlay, projectId: string): BillRow[] {
  const patched = seed.map((b) => {
    const p = overlay.billPatches[b.id];
    return p ? { ...b, ...p } : b;
  });
  const created = overlay.bills
    .filter((b) => b.projectId === projectId)
    .map<BillRow>((b) => ({ ...b, source: "OVERLAY" }));
  return [...patched, ...created].sort((a, b) => a.sequence - b.sequence);
}
