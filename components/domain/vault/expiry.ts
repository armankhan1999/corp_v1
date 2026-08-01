import type { Dataset, PravaahDocument } from "@/lib/schemas";
import { daysBetween } from "@/lib/format";
import type { DocumentType, Role } from "@/lib/schemas/enums";
import type { DocumentException } from "./store";

/**
 * E10-S2 AC3–AC5 / FR-M9-05 — expiry awareness.
 *
 * Ordered by days remaining, already-expired separated from forthcoming, the
 * linked entity and owner shown, the owner and the functional lead notified,
 * and a materially operational lapse raised to the Command Centre feed.
 */

export type ExpiryBand = "EXPIRED" | "D30" | "D60" | "LATER" | "NONE";

export interface ExpiringDoc {
  doc: PravaahDocument;
  daysRemaining: number;
  band: ExpiryBand;
  linkedLabel: string;
  linkedHref: string | null;
  ownerName: string;
  /** Owner plus the functional lead for the branch this document sits in. */
  notifies: { role: Role; name: string; why: string }[];
  material: boolean;
  materialReason: string | null;
}

/** Which functional lead owns each branch of the tree for notification. */
const FUNCTIONAL_LEAD: Record<string, Role> = {
  CUSTOMERS: "BRANCH_MANAGER",
  INSTALLED_ASSETS: "SERVICE_MANAGER",
  PROJECTS: "PROJECT_MANAGER",
  OEM_TECHNICAL: "SERVICE_MANAGER",
  COMMERCIAL: "ACCOUNTS_EXECUTIVE",
  HR: "HR_ADMIN",
  STATUTORY: "ACCOUNTS_EXECUTIVE",
  COMPANY: "DIRECTOR_BUSINESS",
};

const LIVE_PROJECT_STATUS = new Set(["MOBILISED", "IN_PROGRESS"]);

/** E10-S2 AC4 — materially operational: a live-project test certificate, or a statutory licence. */
export function materiality(
  doc: PravaahDocument,
  ds: Dataset,
): { material: boolean; reason: string | null } {
  const type: DocumentType = doc.type;
  if (type === "TEST_CERTIFICATE" && doc.linkedType === "PROJECT" && doc.linkedId) {
    const project = ds.projects.find((p) => p.id === doc.linkedId);
    if (project && LIVE_PROJECT_STATUS.has(project.status)) {
      return { material: true, reason: `Test certificate on a live project — ${project.name}` };
    }
    return { material: false, reason: null };
  }
  if (type === "LICENCE") return { material: true, reason: "Statutory licence — operating authority lapses on expiry" };
  if (type === "INSURANCE") return { material: true, reason: "Insurance cover — exposure becomes uninsured on expiry" };
  return { material: false, reason: null };
}

export function bandFor(daysRemaining: number): ExpiryBand {
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= 30) return "D30";
  if (daysRemaining <= 60) return "D60";
  return "LATER";
}

export const BAND_LABEL: Record<ExpiryBand, string> = {
  EXPIRED: "Expired",
  D30: "Within 30 days",
  D60: "Within 60 days",
  LATER: "Beyond 60 days",
  NONE: "No expiry",
};

function linkedLabelFor(doc: PravaahDocument, ds: Dataset): { label: string; href: string | null } {
  if (!doc.linkedId || !doc.linkedType || doc.linkedType === "COMPANY") {
    return { label: "Bhushancorp Private Limited", href: null };
  }
  switch (doc.linkedType) {
    case "PROJECT": {
      const p = ds.projects.find((x) => x.id === doc.linkedId);
      return p ? { label: p.name, href: `/projects/${p.id}` } : { label: doc.linkedId, href: null };
    }
    case "CUSTOMER": {
      const c = ds.customers.find((x) => x.id === doc.linkedId);
      return c ? { label: c.tradeName, href: `/sales/customers/${c.id}` } : { label: doc.linkedId, href: null };
    }
    case "ASSET": {
      const a = ds.assets.find((x) => x.id === doc.linkedId);
      return a ? { label: `${a.model} · ${a.serial}`, href: `/service/assets/${a.serial}` } : { label: doc.linkedId, href: null };
    }
    case "EMPLOYEE": {
      const e = ds.employees.find((x) => x.id === doc.linkedId);
      return e ? { label: e.code, href: null } : { label: doc.linkedId, href: null };
    }
    default:
      return { label: doc.linkedId, href: null };
  }
}

export function linkedEntityLabel(doc: PravaahDocument, ds: Dataset): { label: string; href: string | null } {
  return linkedLabelFor(doc, ds);
}

export function expiringDocuments(
  documents: PravaahDocument[],
  ds: Dataset,
  now: Date,
  withinDays = 60,
): ExpiringDoc[] {
  const out: ExpiringDoc[] = [];
  for (const doc of documents) {
    if (!doc.expiresOn) continue;
    const daysRemaining = daysBetween(now, doc.expiresOn);
    if (daysRemaining > withinDays) continue;

    const band = bandFor(daysRemaining);
    const { label, href } = linkedLabelFor(doc, ds);
    const owner = ds.users.find((u) => u.id === doc.ownerUserId);
    const leadRole = FUNCTIONAL_LEAD[doc.category] ?? "DIRECTOR_BUSINESS";
    const lead = ds.users.find((u) => u.role === leadRole);
    const { material, reason } = materiality(doc, ds);

    const notifies: ExpiringDoc["notifies"] = [];
    if (owner) notifies.push({ role: owner.role, name: owner.name, why: "Document owner" });
    if (lead && lead.id !== owner?.id) {
      notifies.push({ role: lead.role, name: lead.name, why: "Functional lead for this branch" });
    }

    out.push({
      doc, daysRemaining, band, linkedLabel: label, linkedHref: href,
      ownerName: owner?.name ?? doc.ownerUserId, notifies,
      material, materialReason: reason,
    });
  }
  return out.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function toExceptions(list: ExpiringDoc[], now: Date): DocumentException[] {
  return list
    .filter((e) => e.material)
    .map((e) => ({
      id: `VEX-${e.doc.id}`,
      documentId: e.doc.id,
      documentTitle: e.doc.title,
      type: "DOCUMENT_EXPIRED" as const,
      severity: (e.daysRemaining < 0 ? "CRITICAL" : e.daysRemaining <= 30 ? "HIGH" : "MEDIUM") as DocumentException["severity"],
      daysRemaining: e.daysRemaining,
      reason: e.materialReason ?? "Materially operational document approaching expiry",
      linkedLabel: e.linkedLabel,
      ownerName: e.ownerName,
      raisedAt: now.toISOString(),
    }));
}
