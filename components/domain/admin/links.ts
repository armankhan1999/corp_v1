import { can, rolesHolding, type Capability } from "@/lib/rbac/matrix";
import { ROLE_LABEL, type Role } from "@/lib/schemas/enums";

/**
 * Entity reference → route, resolved against the *viewer's* capabilities.
 *
 * E1-S6: clicking an entity reference in the audit log navigates to that entity
 * subject to the user's own permissions. Resolution and permission check
 * therefore happen together, once per entity type rather than once per row, so
 * a 3,000-row log costs one table rather than 3,000 checks.
 */

interface Target {
  cap: Capability;
  /** `{id}` is substituted with the entity id. */
  template: string;
  /** Plain-language plural used when access is refused. */
  noun: string;
}

const TARGETS: Record<string, Target> = {
  Quotation: { cap: "quotations", template: "/sales/quotations/{id}", noun: "quotations" },
  Invoice: { cap: "invoices", template: "/commercial/invoices/{id}", noun: "invoices" },
  JobCard: { cap: "jobCards", template: "/service/job-cards/{id}", noun: "job cards" },
  ServiceTicket: { cap: "tickets", template: "/service/tickets/{id}", noun: "service tickets" },
  Receipt: { cap: "receipts", template: "/commercial/receipts?focus={id}", noun: "receipts" },
  RABill: { cap: "raBills", template: "/projects/retention?raBill={id}", noun: "RA-bills" },
  ApprovalRequest: {
    cap: "approvals",
    template: "/workflow/approvals?request={id}",
    noun: "approval requests",
  },
  CommissioningReport: {
    cap: "commissioning",
    template: "/service/commissioning?focus={id}",
    noun: "commissioning reports",
  },
  Customer: { cap: "customers", template: "/sales/customers/{id}", noun: "customers" },
  InstalledAsset: { cap: "assets", template: "/service/assets/{id}", noun: "installed assets" },
  Project: { cap: "projects", template: "/projects/{id}", noun: "projects" },
  Employee: { cap: "employees", template: "/people/employees/{id}", noun: "employee records" },
  Document: { cap: "vault", template: "/vault?doc={id}", noun: "vault documents" },
  PurchaseOrder: {
    cap: "purchaseOrders",
    template: "/inventory/purchase?focus={id}",
    noun: "purchase orders",
  },
  LeaveRequest: { cap: "leave", template: "/people/leave?focus={id}", noun: "leave requests" },

  /* Admin-owned subjects — the entity types this epic writes. */
  User: { cap: "admin.users", template: "/admin/users?focus={id}", noun: "user accounts" },
  Master: { cap: "admin.masters", template: "/admin/masters?set={id}", noun: "reference data" },
  SLADefinition: { cap: "admin.masters", template: "/admin/masters?set=sla", noun: "SLA definitions" },
  NumberingSeries: {
    cap: "admin.masters",
    template: "/admin/masters?set=numbering",
    noun: "numbering series",
  },
  RetentionPolicy: {
    cap: "admin.compliance",
    template: "/admin/compliance#retention",
    noun: "retention policies",
  },
  DSRRequest: {
    cap: "admin.compliance",
    template: "/admin/compliance#dsr",
    noun: "data-principal requests",
  },
  BreachChecklist: {
    cap: "admin.compliance",
    template: "/admin/compliance#breach",
    noun: "the breach-response checklist",
  },
  AuditLog: { cap: "admin.audit", template: "/admin/audit", noun: "the audit log" },
  PermissionMatrix: {
    cap: "admin.permissions",
    template: "/admin/permissions",
    noun: "the permission matrix",
  },
  Integration: {
    cap: "admin.integrations",
    template: "/admin/integrations#{id}",
    noun: "integration records",
  },
};

export interface LinkRule {
  template: string | null;
  /** Set when the viewer may see the reference but not open the record. */
  blocked: string | null;
}

export type LinkTable = Record<string, LinkRule>;

/** One pass over the target table, evaluated against the viewer's role. */
export function linkTableFor(role: Role): LinkTable {
  const out: LinkTable = {};
  for (const [entityType, t] of Object.entries(TARGETS)) {
    if (can(role, t.cap)) {
      out[entityType] = { template: t.template, blocked: null };
    } else {
      const holders = rolesHolding(t.cap)
        .slice(0, 3)
        .map((r) => ROLE_LABEL[r])
        .join(", ");
      out[entityType] = {
        template: null,
        blocked: `Your role cannot open ${t.noun}${holders ? ` — held by ${holders}` : ""}.`,
      };
    }
  }
  return out;
}

export function resolveLink(
  table: LinkTable,
  entityType: string,
  entityId: string,
): { href: string | null; blocked: string | null } {
  const rule = table[entityType];
  if (!rule) {
    return { href: null, blocked: "No screen holds this entity type in Phase 1." };
  }
  if (!rule.template) return { href: null, blocked: rule.blocked };
  return { href: rule.template.replace("{id}", encodeURIComponent(entityId)), blocked: null };
}
