import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import { abbreviateINR, daysBetween, formatDate, formatPercent } from "@/lib/format";
import { CERTIFICATION_THRESHOLD_DAYS, DOCUMENT_EXPIRY_WINDOW_DAYS } from "./compute";
import type { ExceptionItem } from "./ExceptionFeedPanel";
import type { PortfolioRow } from "./server";

/**
 * Every project exception in the unified 14-type taxonomy (C-16), built once
 * from the seeded world so the portfolio, the retention register and the
 * Command Centre cannot disagree about what is outstanding.
 */
export function projectExceptions(
  ds: Dataset, rows: PortfolioRow[], now: Date,
): ExceptionItem[] {
  const out: ExceptionItem[] = [];
  const ids = new Set(rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));

  // E6-S4 — At Risk carries the variance magnitude and the responsible manager.
  for (const r of rows) {
    if (!r.atRisk) continue;
    out.push({
      id: `EXC-SV-${r.id}`,
      type: "PROJECT_SCHEDULE_VARIANCE",
      severity: Math.abs(r.scheduleVariancePct) >= 25 ? "CRITICAL" : "HIGH",
      title: `${r.code} — ${r.name}`,
      detail: `Schedule variance ${formatPercent(r.scheduleVariancePct)} against a tolerance of ±${r.varianceTolerancePct}%. Cumulative actual milestone weightage is behind cumulative planned.`,
      owner: r.managerName,
      href: `/projects/${r.id}/milestones`,
    });
  }

  // E6-S5 — a bill in Submitted beyond the threshold, with days elapsed.
  for (const b of ds.raBills) {
    if (!ids.has(b.projectId)) continue;
    if (b.status !== "SUBMITTED" || !b.submittedAt) continue;
    const days = daysBetween(b.submittedAt, now);
    if (days <= CERTIFICATION_THRESHOLD_DAYS) continue;
    const r = byId.get(b.projectId);
    out.push({
      id: `EXC-RA-${b.id}`,
      type: "RABILL_AWAITING_CERTIFICATION",
      severity: days > 60 ? "CRITICAL" : "HIGH",
      title: `${b.number} awaiting certification for ${days} days`,
      detail: `Claimed ${abbreviateINR(b.claimedValue)}, submitted ${formatDate(b.submittedAt)}. Threshold is ${CERTIFICATION_THRESHOLD_DAYS} days.`,
      owner: r?.managerName ?? "Project manager",
      href: `/projects/${b.projectId}/ra-bills/${b.sequence}`,
      clearsOnBillId: b.id,
    });
  }

  // E6-S6 — retention becoming eligible, with days since eligibility.
  for (const e of ds.retentionEntries) {
    if (!ids.has(e.projectId)) continue;
    const state = D.retentionStateOf(e, now);
    if (state !== "ELIGIBLE") continue;
    const days = daysBetween(e.eligibleFrom, now);
    const r = byId.get(e.projectId);
    out.push({
      id: `EXC-RET-${e.id}`,
      type: "RETENTION_ELIGIBLE",
      severity: days > 45 ? "HIGH" : "MEDIUM",
      title: `${r?.code ?? e.projectId} — ${abbreviateINR(e.amount)} retention claimable`,
      detail: `Eligible since ${formatDate(e.eligibleFrom)}, ${days} days ago. No release claim has been raised.`,
      owner: r?.managerName ?? "Project manager",
      href: "/projects/retention",
      clearsOnRetentionId: e.id,
    });
  }

  // E6-S7 — project documents expiring inside the notification window.
  for (const doc of ds.documents) {
    if (doc.linkedType !== "PROJECT" || !doc.linkedId || !ids.has(doc.linkedId)) continue;
    if (!doc.expiresOn || doc.deletedAt) continue;
    const days = daysBetween(now, doc.expiresOn);
    if (days < 0 || days > DOCUMENT_EXPIRY_WINDOW_DAYS) continue;
    const r = byId.get(doc.linkedId);
    out.push({
      id: `EXC-DOC-${doc.id}`,
      type: "DOCUMENT_EXPIRED",
      severity: days <= 14 ? "HIGH" : "LOW",
      title: `${doc.title} expires in ${days} days`,
      detail: `${r?.code ?? ""} — valid to ${formatDate(doc.expiresOn)}. The project manager has been notified.`,
      owner: r?.managerName ?? "Project manager",
      href: `/projects/${doc.linkedId}/documents`,
    });
  }

  return out;
}
