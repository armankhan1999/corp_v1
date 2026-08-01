import type { Dataset, PravaahDocument } from "@/lib/schemas";
import { ROLE_LABEL, type DocumentCategory, type Role } from "@/lib/schemas/enums";
import { can, grantFor, rolesHolding, type Capability, type Scope } from "@/lib/rbac/matrix";
import type { Session } from "@/lib/rbac/session";

/**
 * E10-S1 AC4 / FR-M9-04 — document access inherits from the linked entity.
 *
 * A document is visible only when all three gates pass:
 *   1. the user holds the `vault` capability at all;
 *   2. the document's access level is permitted for the role;
 *   3. the linked entity is one the user may see, under the matrix capability
 *      for that entity type AND that grant's scope.
 *
 * COMPANY-linked and unlinked documents are institutional reference material
 * and pass gate 3 on capability alone — that is a deliberate product decision,
 * stated on screen in the "How access is decided" disclosure so it can be
 * challenged rather than discovered.
 *
 * A denial never returns a title, a type or any other field of the document.
 */

export interface Viewer {
  userId: string;
  role: Role;
  branchId: string;
  name: string;
  employeeId: string | null;
}

export function viewerOf(session: Session, ds: Dataset): Viewer {
  const user = ds.users.find((u) => u.id === session.userId) ?? null;
  return {
    userId: session.userId,
    role: session.role,
    branchId: session.branchId,
    name: session.name,
    employeeId: user?.employeeId ?? null,
  };
}

/* ------------------------------------------------------------ access level */

const ACCESS_LEVEL_CAP: Record<PravaahDocument["accessLevel"], Capability> = {
  GENERAL: "vault",
  COMMERCIAL: "invoices",
  HR: "hrDocuments",
  RESTRICTED: "admin.compliance",
};

export const ACCESS_LEVEL_LABEL: Record<PravaahDocument["accessLevel"], string> = {
  GENERAL: "General",
  COMMERCIAL: "Commercial",
  HR: "HR",
  RESTRICTED: "Restricted",
};

const LINKED_CAP: Record<string, Capability> = {
  CUSTOMER: "customers",
  ASSET: "assets",
  PROJECT: "projects",
  EMPLOYEE: "employees",
  INVOICE: "invoices",
  AMC: "amc",
  SUPPLIER: "purchaseOrders",
};

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  CUSTOMERS: "Customers",
  INSTALLED_ASSETS: "Installed Assets",
  PROJECTS: "Projects",
  OEM_TECHNICAL: "OEM & Technical",
  COMMERCIAL: "Commercial",
  HR: "HR",
  STATUTORY: "Statutory",
  COMPANY: "Company",
};

/** Fixed display order — the eight branches of E10-S1 AC1, in spec order. */
export const CATEGORY_ORDER: DocumentCategory[] = [
  "CUSTOMERS", "INSTALLED_ASSETS", "PROJECTS", "OEM_TECHNICAL",
  "COMMERCIAL", "HR", "STATUTORY", "COMPANY",
];

/* ------------------------------------------------------------------ index */

export interface AccessIndex {
  viewer: Viewer;
  customerVisible: (id: string) => boolean;
  assetVisible: (id: string) => boolean;
  projectVisible: (id: string) => boolean;
  employeeVisible: (id: string) => boolean;
}

function scopeAllows(
  scope: Scope,
  rec: { branchId?: string; ownerUserId?: string; managerUserId?: string; id: string },
  viewer: Viewer,
  assigned: Set<string>,
): boolean {
  switch (scope) {
    case "ALL": return true;
    case "BRANCH": return rec.branchId === viewer.branchId;
    case "OWN":
      if (rec.ownerUserId) return rec.ownerUserId === viewer.userId;
      if (rec.managerUserId) return rec.managerUserId === viewer.userId;
      return rec.branchId === viewer.branchId;
    case "ASSIGNED":
      if (rec.managerUserId) return rec.managerUserId === viewer.userId;
      return assigned.has(rec.id);
    case "SELF": return rec.id === viewer.employeeId;
    default: return false;
  }
}

/**
 * Built once per render pass. The assigned sets are derived from job cards and
 * tickets, so a Field Engineer sees exactly the customers and machines they
 * have actually attended — not an approximation of them.
 */
export function buildAccessIndex(ds: Dataset, viewer: Viewer): AccessIndex {
  const assignedAssets = new Set<string>();
  const assignedCustomers = new Set<string>();
  for (const jc of ds.jobCards) {
    if (jc.engineerUserId !== viewer.userId) continue;
    assignedAssets.add(jc.assetId);
  }
  for (const t of ds.tickets) {
    if (t.assignedEngineerId !== viewer.userId) continue;
    assignedAssets.add(t.assetId);
    assignedCustomers.add(t.customerId);
  }
  for (const a of ds.assets) {
    if (assignedAssets.has(a.id)) assignedCustomers.add(a.customerId);
  }

  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const projById = new Map(ds.projects.map((p) => [p.id, p]));
  const empById = new Map(ds.employees.map((e) => [e.id, e]));

  const gate = (cap: Capability) => grantFor(viewer.role, cap);

  return {
    viewer,
    customerVisible: (id) => {
      const g = gate("customers");
      if (g.level === "NONE") return false;
      const rec = custById.get(id);
      return rec ? scopeAllows(g.scope, rec, viewer, assignedCustomers) : false;
    },
    assetVisible: (id) => {
      const g = gate("assets");
      if (g.level === "NONE") return false;
      const rec = assetById.get(id);
      return rec ? scopeAllows(g.scope, rec, viewer, assignedAssets) : false;
    },
    projectVisible: (id) => {
      const g = gate("projects");
      if (g.level === "NONE") return false;
      const rec = projById.get(id);
      return rec ? scopeAllows(g.scope, rec, viewer, new Set()) : false;
    },
    employeeVisible: (id) => {
      const g = gate("employees");
      if (g.level === "NONE") return false;
      const rec = empById.get(id);
      return rec ? scopeAllows(g.scope, rec, viewer, new Set()) : false;
    },
  };
}

/* ----------------------------------------------------------------- verdict */

export type DenialCode =
  | "NO_VAULT"
  | "ACCESS_LEVEL"
  | "LINKED_ENTITY"
  | "NOT_FOUND";

export interface Denial {
  code: DenialCode;
  capability: Capability | null;
  /** Plain-language cause. Never contains any field of the denied document. */
  reason: string;
  holders: Role[];
}

export interface Verdict {
  allowed: boolean;
  denial: Denial | null;
}

const ALLOWED: Verdict = { allowed: true, denial: null };

export function documentAccess(index: AccessIndex, doc: PravaahDocument): Verdict {
  const { role } = index.viewer;

  if (!can(role, "vault")) {
    return deny("NO_VAULT", "vault", "Your role holds no Document Vault access.");
  }

  const levelCap = ACCESS_LEVEL_CAP[doc.accessLevel];
  if (!can(role, levelCap)) {
    return deny(
      "ACCESS_LEVEL",
      levelCap,
      `This document carries the ${ACCESS_LEVEL_LABEL[doc.accessLevel]} access level, which your role does not hold.`,
    );
  }

  if (doc.linkedType && doc.linkedId && doc.linkedType !== "COMPANY") {
    const cap = LINKED_CAP[doc.linkedType];
    if (!cap) return ALLOWED;
    const visible =
      doc.linkedType === "CUSTOMER" ? index.customerVisible(doc.linkedId)
        : doc.linkedType === "ASSET" ? index.assetVisible(doc.linkedId)
          : doc.linkedType === "PROJECT" ? index.projectVisible(doc.linkedId)
            : doc.linkedType === "EMPLOYEE" ? index.employeeVisible(doc.linkedId)
              : can(role, cap);
    if (!visible) {
      const g = grantFor(role, cap);
      const cause = g.level === "NONE"
        ? `Documents in this branch belong to a record type your role cannot open.`
        : `Documents in this branch belong to a record outside your ${g.scope.toLowerCase()} scope.`;
      return deny("LINKED_ENTITY", cap, cause);
    }
  }

  return ALLOWED;
}

function deny(code: DenialCode, capability: Capability | null, reason: string): Verdict {
  return {
    allowed: false,
    denial: { code, capability, reason, holders: capability ? rolesHolding(capability) : [] },
  };
}

/** The generic denial used when an id does not resolve — existence is never confirmed. */
export function notFoundDenial(): Denial {
  return {
    code: "NOT_FOUND",
    capability: "vault",
    reason: "No document is available at this reference under your permissions.",
    holders: [],
  };
}

export function holderLabels(holders: Role[]): string {
  return holders.map((r) => ROLE_LABEL[r]).join(", ");
}

/* ---------------------------------------------------------------- corpora */

export interface Corpus {
  /** Everything the viewer may see, deleted records excluded. */
  documents: PravaahDocument[];
  /** Category → count, for the tree. Denied categories are absent. */
  counts: Record<string, number>;
  /** Categories the role cannot open at all, with the reason and holders. */
  denied: { category: DocumentCategory; denial: Denial }[];
  totalInVault: number;
}

export function buildCorpus(
  ds: Dataset,
  index: AccessIndex,
  opts: { deletedIds?: Set<string>; extra?: PravaahDocument[] } = {},
): Corpus {
  const deleted = opts.deletedIds ?? new Set<string>();
  const all = opts.extra?.length ? [...ds.documents, ...opts.extra] : ds.documents;
  const documents: PravaahDocument[] = [];
  const counts: Record<string, number> = {};
  const deniedByCategory = new Map<DocumentCategory, Denial>();
  const allowedCategories = new Set<DocumentCategory>();

  for (const doc of all) {
    if (doc.deletedAt || deleted.has(doc.id)) continue;
    const verdict = documentAccess(index, doc);
    if (verdict.allowed) {
      documents.push(doc);
      counts[doc.category] = (counts[doc.category] ?? 0) + 1;
      allowedCategories.add(doc.category);
    } else if (verdict.denial && !deniedByCategory.has(doc.category)) {
      deniedByCategory.set(doc.category, verdict.denial);
    }
  }

  const denied = CATEGORY_ORDER
    .filter((c) => !allowedCategories.has(c) && deniedByCategory.has(c))
    .map((category) => ({ category, denial: deniedByCategory.get(category)! }));

  return { documents, counts, denied, totalInVault: all.length };
}

/* --------------------------------------------------------- AI retrieval scope */

/**
 * AI-G9 / E10-S3 AC7 — employee personal data is *excluded from retrieval*,
 * not retrieved and redacted. A role without HR document permission never has
 * the HR branch loaded into the index at all, and the exclusion is disclosed
 * without revealing how much sits behind it.
 */
export function hrRetrievalPermitted(role: Role): boolean {
  const g = grantFor(role, "hrDocuments");
  return g.level !== "NONE" && g.scope !== "SELF";
}

export interface RetrievalScope {
  documents: PravaahDocument[];
  /** Branches deliberately excluded before retrieval ran. */
  exclusions: string[];
  searchedCount: number;
}

export function retrievalScope(corpus: Corpus, role: Role): RetrievalScope {
  const exclusions: string[] = [];
  let documents = corpus.documents;

  if (!hrRetrievalPermitted(role)) {
    documents = documents.filter((d) => d.category !== "HR" && d.accessLevel !== "HR");
    exclusions.push("HR branch — employee personal data is excluded from retrieval for your role");
  }

  const deniedBranches = corpus.denied.map((d) => CATEGORY_LABEL[d.category]);
  if (deniedBranches.length) {
    exclusions.push(`${deniedBranches.join(", ")} — outside your record permissions`);
  }

  return { documents, exclusions, searchedCount: documents.length };
}
