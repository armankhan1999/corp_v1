import type { Role } from "../schemas/enums";

/**
 * RBAC — PRD §7.2, with the four matrix defects found in review corrected
 * (see PLAN.md §3 minor corrections):
 *   • Audit log: DB/DS read removed. RBAC-5 says the Auditor is the ONLY
 *     non-admin role with audit-log access; the published matrix contradicted it.
 *   • Director – Strategy: granted the 5 cells its stated "full visibility"
 *     scope implies (e-way, reorder, dispatch, ledger hand-off, inventory analytics).
 *   • Attendance: office check-in granted to AC/SE/ST. The published matrix left
 *     ACCOUNTS_EXECUTIVE with no attendance access at all, making FR-M8-04
 *     unreachable for every office role.
 *   • Branch league table: explicit exception to RBAC-2 per E2-S5 — a branch
 *     manager sees all branches for comparison but drills into their own only.
 */

export type Level = "NONE" | "R" | "RU" | "CRU" | "F";
export type Scope = "ALL" | "BRANCH" | "OWN" | "ASSIGNED" | "SELF";

export interface Grant {
  level: Level;
  scope: Scope;
  /** Approval authority is separate from data access. RBAC-4. */
  approve?: boolean;
  /** Value ceiling for approval authority, where the role is threshold-bound. */
  approveLimit?: number;
  note?: string;
}

export const CAPABILITIES = [
  "command",
  "command.league",
  "command.exceptions",
  "customers",
  "enquiries",
  "quotations",
  "salesOrders",
  "assets",
  "tickets",
  "dispatch",
  "jobCards",
  "commissioning",
  "amc",
  "renewals",
  "rental",
  "projects",
  "dpr",
  "raBills",
  "retention",
  "projectCost",
  "items",
  "stock",
  "reorder",
  "purchaseOrders",
  "challans",
  "invoices",
  "eway",
  "receipts",
  "receivables",
  "handoff",
  "employees",
  "attendance",
  "leave",
  "hrDocuments",
  "vault",
  "vaultAsk",
  "approvals",
  "chainDesigner",
  "notifications",
  "analytics.sales",
  "analytics.service",
  "analytics.projects",
  "analytics.cash",
  "analytics.inventory",
  "assistant",
  "admin.users",
  "admin.permissions",
  "admin.masters",
  "admin.integrations",
  "admin.compliance",
  "admin.audit",
  "admin.demo",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const N: Grant = { level: "NONE", scope: "ALL" };
const g = (level: Level, scope: Scope = "ALL", extra: Partial<Grant> = {}): Grant => ({
  level,
  scope,
  ...extra,
});

type Matrix = Record<Role, Partial<Record<Capability, Grant>>>;

export const MATRIX: Matrix = {
  SUPER_ADMIN: {
    command: g("R"), "command.league": g("R"), "command.exceptions": g("R"),
    customers: g("F"), enquiries: g("F"), quotations: g("F"), salesOrders: g("F"),
    assets: g("F"), tickets: g("F"), dispatch: g("F"), jobCards: g("F"),
    commissioning: g("F"), amc: g("F"), renewals: g("R"), rental: g("F"),
    projects: g("F"), dpr: g("F"), raBills: g("F"), retention: g("F"), projectCost: g("F"),
    items: g("F"), stock: g("F"), reorder: g("R"), purchaseOrders: g("F"),
    challans: g("F"), invoices: g("F"), eway: g("F"), receipts: g("F"),
    receivables: g("F"), handoff: g("R"),
    employees: g("F"), attendance: g("F"), leave: g("F"), hrDocuments: g("R"),
    vault: g("F"), vaultAsk: g("R"),
    approvals: g("NONE", "ALL", { note: "Platform admin holds no business approval authority" }),
    chainDesigner: g("F"), notifications: g("F"),
    "analytics.sales": g("R"), "analytics.service": g("R"), "analytics.projects": g("R"),
    "analytics.cash": g("R"), "analytics.inventory": g("R"), assistant: g("R"),
    "admin.users": g("F"), "admin.permissions": g("F"), "admin.masters": g("F"),
    "admin.integrations": g("F"), "admin.compliance": g("F"),
    "admin.audit": g("R", "ALL", { note: "Append-only; no edit path exists for any role" }),
    "admin.demo": g("F"),
  },

  DIRECTOR_BUSINESS: {
    command: g("R"), "command.league": g("R"), "command.exceptions": g("RU", "ALL", { approve: true }),
    customers: g("R"), enquiries: g("R"), quotations: g("R", "ALL", { approve: true }),
    salesOrders: g("R"),
    assets: g("R"), tickets: g("R"), dispatch: g("R"), jobCards: g("R"),
    commissioning: g("R"), amc: g("R", "ALL", { approve: true }), renewals: g("R"), rental: g("R"),
    projects: g("R"), dpr: g("R"), raBills: g("R", "ALL", { approve: true }),
    retention: g("R"), projectCost: g("R"),
    items: g("R"), stock: g("R"), reorder: g("R"), purchaseOrders: g("R", "ALL", { approve: true }),
    challans: g("R"), invoices: g("R"), eway: g("R"), receipts: g("R"),
    receivables: g("R"), handoff: g("R"),
    employees: g("R"), attendance: g("R"), leave: g("R", "ALL", { approve: true }), hrDocuments: g("R"),
    vault: g("R"), vaultAsk: g("R"),
    approvals: g("R", "ALL", { approve: true }), chainDesigner: g("RU"), notifications: g("R"),
    "analytics.sales": g("R"), "analytics.service": g("R"), "analytics.projects": g("R"),
    "analytics.cash": g("R"), "analytics.inventory": g("R"), assistant: g("R"),
    "admin.users": g("R"), "admin.permissions": g("R"), "admin.masters": g("R"),
    "admin.integrations": g("R"), "admin.compliance": g("R"),
    "admin.demo": g("RU"),
  },

  DIRECTOR_STRATEGY: {
    command: g("R"), "command.league": g("R"), "command.exceptions": g("RU"),
    customers: g("R"), enquiries: g("R"), quotations: g("R", "ALL", { approve: true }),
    salesOrders: g("R"),
    assets: g("R"), tickets: g("R"),
    dispatch: g("R", "ALL", { note: "DS holds full visibility per PRD §7.1" }),
    jobCards: g("R"), commissioning: g("R"), amc: g("R"), renewals: g("R"), rental: g("R"),
    projects: g("R"), dpr: g("R"), raBills: g("R"), retention: g("R"), projectCost: g("R"),
    items: g("R"), stock: g("R"), reorder: g("R"), purchaseOrders: g("R"),
    challans: g("R"), invoices: g("R"), eway: g("R"), receipts: g("R"),
    receivables: g("R"), handoff: g("R"),
    employees: g("R"), attendance: g("R"), leave: g("R"), hrDocuments: g("R"),
    vault: g("R"), vaultAsk: g("R"),
    approvals: g("R", "ALL", { approve: true }), chainDesigner: g("R"), notifications: g("R"),
    "analytics.sales": g("R"), "analytics.service": g("R"), "analytics.projects": g("R"),
    "analytics.cash": g("R"), "analytics.inventory": g("R"), assistant: g("R"),
    "admin.users": g("R"), "admin.permissions": g("R"), "admin.masters": g("R"),
    "admin.integrations": g("R"), "admin.compliance": g("R"),
  },

  BRANCH_MANAGER: {
    command: g("R", "BRANCH"),
    "command.league": g("R", "ALL", { note: "E2-S5 exception to RBAC-2: compare all, drill own" }),
    "command.exceptions": g("RU", "BRANCH"),
    customers: g("F", "BRANCH"), enquiries: g("F", "BRANCH"),
    quotations: g("CRU", "BRANCH", { approve: true, approveLimit: 5 }),
    salesOrders: g("CRU", "BRANCH"),
    assets: g("R", "BRANCH"), tickets: g("R", "BRANCH"), dispatch: g("R", "BRANCH"),
    jobCards: g("R", "BRANCH"), commissioning: g("R", "BRANCH"),
    amc: g("CRU", "BRANCH"), renewals: g("R", "BRANCH"), rental: g("R", "BRANCH"),
    projects: g("R"), items: g("R"), stock: g("R", "BRANCH"), reorder: g("R", "BRANCH"),
    challans: g("R", "BRANCH"), invoices: g("R", "BRANCH"), eway: g("R", "BRANCH"),
    receipts: g("R", "BRANCH"), receivables: g("RU", "BRANCH"),
    employees: g("R", "BRANCH"), attendance: g("RU", "BRANCH"),
    leave: g("CRU", "SELF", { approve: true }),
    vault: g("R", "BRANCH"), vaultAsk: g("R"),
    approvals: g("R", "BRANCH", { approve: true, approveLimit: 5 }), notifications: g("R"),
    "analytics.sales": g("R", "BRANCH"), "analytics.service": g("R", "BRANCH"),
    "analytics.cash": g("R", "BRANCH"), "analytics.inventory": g("R", "BRANCH"),
    assistant: g("R", "BRANCH"), "admin.permissions": g("R"), "admin.masters": g("R"),
  },

  SALES_EXECUTIVE: {
    customers: g("CRU", "OWN"), enquiries: g("CRU", "OWN"), quotations: g("CRU", "OWN"),
    salesOrders: g("CRU", "OWN"),
    assets: g("R", "BRANCH"), tickets: g("CRU", "OWN"), jobCards: g("R", "BRANCH"),
    commissioning: g("R", "BRANCH"), amc: g("CRU", "OWN"), renewals: g("R", "OWN"),
    rental: g("R", "BRANCH"),
    items: g("R"), stock: g("R", "BRANCH"),
    challans: g("R", "BRANCH"), invoices: g("R", "OWN"), receipts: g("R", "OWN"),
    receivables: g("R", "OWN"),
    attendance: g("CRU", "SELF", { note: "C-fix: office check-in was unreachable" }),
    leave: g("CRU", "SELF"),
    vault: g("R", "OWN"), vaultAsk: g("R"), notifications: g("R"),
    "analytics.sales": g("R", "OWN"), assistant: g("R", "OWN"),
  },

  SERVICE_MANAGER: {
    command: g("R", "BRANCH"), "command.league": g("R"), "command.exceptions": g("RU"),
    customers: g("R"), enquiries: g("R"), quotations: g("R"), salesOrders: g("R"),
    assets: g("F"), tickets: g("F"), dispatch: g("F"), jobCards: g("F"),
    commissioning: g("F"), amc: g("F"), renewals: g("F"), rental: g("F"),
    items: g("R"), stock: g("RU"), reorder: g("RU"), purchaseOrders: g("R"),
    challans: g("R"), invoices: g("R"),
    employees: g("R"), attendance: g("RU", "ASSIGNED", { note: "engineers" }),
    leave: g("CRU", "SELF", { approve: true }),
    vault: g("R"), vaultAsk: g("R"),
    approvals: g("R", "ALL", { approve: true }), notifications: g("R"),
    "analytics.service": g("R"), "analytics.inventory": g("R"),
    assistant: g("R"), "admin.permissions": g("R"),
    "admin.masters": g("RU", "ALL", { note: "SLA definitions, ticket categories" }),
  },

  FIELD_ENGINEER: {
    customers: g("R", "ASSIGNED"),
    assets: g("RU", "ASSIGNED"), tickets: g("RU", "ASSIGNED"),
    dispatch: g("R", "OWN"), jobCards: g("CRU", "OWN"), commissioning: g("CRU", "OWN"),
    amc: g("R", "ASSIGNED"), rental: g("R"),
    items: g("R"), stock: g("R", "OWN", { note: "boot stock" }),
    employees: g("R", "SELF"), attendance: g("CRU", "SELF"), leave: g("CRU", "SELF"),
    hrDocuments: g("R", "SELF"),
    vault: g("R", "ASSIGNED"), vaultAsk: g("R"), notifications: g("R"),
    "analytics.service": g("R", "OWN"),
  },

  PROJECT_MANAGER: {
    "command.exceptions": g("RU", "ASSIGNED"),
    customers: g("R"), assets: g("R"),
    projects: g("F", "ASSIGNED"), dpr: g("CRU", "ASSIGNED"), raBills: g("CRU", "ASSIGNED"),
    retention: g("RU", "ASSIGNED"), projectCost: g("CRU", "ASSIGNED"),
    items: g("R"), stock: g("R"), purchaseOrders: g("R"),
    challans: g("R"), invoices: g("R"), receivables: g("R"),
    attendance: g("R", "ASSIGNED", { note: "team" }),
    leave: g("CRU", "SELF", { approve: true }),
    vault: g("R", "ASSIGNED"), vaultAsk: g("R"),
    approvals: g("R", "ASSIGNED", { approve: true }), notifications: g("R"),
    "analytics.projects": g("R", "ASSIGNED"), "analytics.cash": g("R"),
    "analytics.inventory": g("R"), assistant: g("R", "ASSIGNED"),
  },

  ACCOUNTS_EXECUTIVE: {
    "command.exceptions": g("RU"),
    customers: g("R"), enquiries: g("NONE"), quotations: g("R"), salesOrders: g("R"),
    tickets: g("R"), jobCards: g("R"), amc: g("R"), rental: g("R"),
    projects: g("R"), raBills: g("RU"), retention: g("RU"), projectCost: g("R"),
    items: g("R"), stock: g("R"), purchaseOrders: g("R"),
    challans: g("F"), invoices: g("F"), eway: g("F"), receipts: g("F"),
    receivables: g("F"), handoff: g("F"),
    attendance: g("CRU", "SELF", { note: "C-fix: matrix had no attendance access at all" }),
    leave: g("CRU", "SELF"),
    vault: g("R"), vaultAsk: g("R"),
    approvals: g("R", "ALL", { approve: true }), notifications: g("R"),
    "analytics.sales": g("R"), "analytics.projects": g("R"), "analytics.cash": g("R"),
    "analytics.inventory": g("R"), assistant: g("R"),
    "admin.permissions": g("R"),
    "admin.masters": g("RU", "ALL", { note: "tax rates, numbering series" }),
    "admin.integrations": g("R"), "admin.compliance": g("R"),
  },

  HR_ADMIN: {
    employees: g("F"), attendance: g("F"), leave: g("F", "ALL", { approve: true }),
    hrDocuments: g("F"),
    vault: g("R", "OWN", { note: "HR scope" }), vaultAsk: g("R"),
    approvals: g("R", "ALL", { approve: true }), notifications: g("R"),
    assistant: g("R"), "admin.users": g("R"), "admin.permissions": g("R"),
    "admin.masters": g("RU", "ALL", { note: "leave types, holiday calendar" }),
    "admin.compliance": g("R"),
  },

  STORE_INCHARGE: {
    assets: g("R"), tickets: g("R"), jobCards: g("R"),
    items: g("CRU"), stock: g("F", "ASSIGNED"), reorder: g("F", "ASSIGNED"),
    purchaseOrders: g("CRU"), challans: g("CRU"), eway: g("CRU"), rental: g("RU"),
    projects: g("R"),
    attendance: g("CRU", "SELF", { note: "C-fix: was read-only, could not check in" }),
    leave: g("CRU", "SELF"),
    vault: g("R"), vaultAsk: g("R"), notifications: g("R"),
    "analytics.service": g("R"), "analytics.inventory": g("R"),
    "admin.masters": g("RU", "ALL", { note: "items" }),
  },

  AUDITOR: {
    command: g("R"), "command.league": g("R"), "command.exceptions": g("R"),
    customers: g("R"), enquiries: g("R"), quotations: g("R"), salesOrders: g("R"),
    assets: g("R"), tickets: g("R"), dispatch: g("R"), jobCards: g("R"),
    commissioning: g("R"), amc: g("R"), renewals: g("R"), rental: g("R"),
    projects: g("R"), dpr: g("R"), raBills: g("R"), retention: g("R"), projectCost: g("R"),
    items: g("R"), stock: g("R"), reorder: g("R"), purchaseOrders: g("R"),
    challans: g("R"), invoices: g("R"), eway: g("R"), receipts: g("R"),
    receivables: g("R"), handoff: g("R"),
    employees: g("R"), attendance: g("R"), leave: g("R"), hrDocuments: g("R"),
    vault: g("R"), vaultAsk: g("R"),
    approvals: g("R"), chainDesigner: g("R"), notifications: g("R"),
    "analytics.sales": g("R"), "analytics.service": g("R"), "analytics.projects": g("R"),
    "analytics.cash": g("R"), "analytics.inventory": g("R"), assistant: g("R"),
    "admin.users": g("R"), "admin.permissions": g("R"), "admin.masters": g("R"),
    "admin.integrations": g("R"), "admin.compliance": g("R"),
    "admin.audit": g("R", "ALL", { note: "RBAC-5: only non-admin role with audit access" }),
  },
};

export function grantFor(role: Role, cap: Capability): Grant {
  return MATRIX[role][cap] ?? N;
}

export function can(role: Role, cap: Capability): boolean {
  return grantFor(role, cap).level !== "NONE";
}

export function canWrite(role: Role, cap: Capability): boolean {
  const lvl = grantFor(role, cap).level;
  return lvl === "CRU" || lvl === "F" || lvl === "RU";
}

export function canCreate(role: Role, cap: Capability): boolean {
  const lvl = grantFor(role, cap).level;
  return lvl === "CRU" || lvl === "F";
}

export function canDelete(role: Role, cap: Capability): boolean {
  return grantFor(role, cap).level === "F";
}

export function canApprove(role: Role, cap: Capability = "approvals"): boolean {
  return grantFor(role, cap).approve === true;
}

/** RBAC-5: the Auditor is read-only everywhere, with no write path anywhere. */
export function isReadOnlyRole(role: Role): boolean {
  return role === "AUDITOR";
}

export function scopeFor(role: Role, cap: Capability): Scope {
  return grantFor(role, cap).scope;
}

/** RBAC-2: branch-scoped roles have the branch selector locked. */
export const BRANCH_LOCKED_ROLES: Role[] = ["BRANCH_MANAGER", "SALES_EXECUTIVE"];

export function isBranchLocked(role: Role): boolean {
  return BRANCH_LOCKED_ROLES.includes(role);
}

/* -------------------------------------------------- route → capability map */

interface RouteRule {
  prefix: string;
  cap: Capability;
}

/** Longest prefix wins, so specific routes override their section. */
const ROUTE_RULES: RouteRule[] = [
  { prefix: "/command/branches", cap: "command.league" },
  { prefix: "/command/exceptions", cap: "command.exceptions" },
  { prefix: "/command", cap: "command" },
  { prefix: "/sales/my-desk", cap: "enquiries" },
  { prefix: "/sales/pipeline", cap: "enquiries" },
  { prefix: "/sales/enquiries", cap: "enquiries" },
  { prefix: "/sales/quotations", cap: "quotations" },
  { prefix: "/sales/orders", cap: "salesOrders" },
  { prefix: "/sales/customers", cap: "customers" },
  { prefix: "/service/dispatch", cap: "dispatch" },
  { prefix: "/service/tickets", cap: "tickets" },
  { prefix: "/service/job-cards", cap: "jobCards" },
  { prefix: "/service/assets", cap: "assets" },
  { prefix: "/service/amc", cap: "amc" },
  { prefix: "/service/renewals", cap: "renewals" },
  { prefix: "/service/commissioning", cap: "commissioning" },
  { prefix: "/service/rental", cap: "rental" },
  { prefix: "/projects/retention", cap: "retention" },
  { prefix: "/projects", cap: "projects" },
  { prefix: "/inventory/stock", cap: "stock" },
  { prefix: "/inventory/movements", cap: "stock" },
  { prefix: "/inventory/reorder", cap: "reorder" },
  { prefix: "/inventory/items", cap: "items" },
  { prefix: "/inventory/purchase", cap: "purchaseOrders" },
  { prefix: "/commercial/receivables", cap: "receivables" },
  { prefix: "/commercial/invoices", cap: "invoices" },
  { prefix: "/commercial/challans", cap: "challans" },
  { prefix: "/commercial/eway", cap: "eway" },
  { prefix: "/commercial/receipts", cap: "receipts" },
  { prefix: "/commercial/handoff", cap: "handoff" },
  { prefix: "/people/attendance", cap: "attendance" },
  { prefix: "/people/leave", cap: "leave" },
  { prefix: "/people/employees", cap: "employees" },
  { prefix: "/people/documents", cap: "hrDocuments" },
  { prefix: "/vault/ask", cap: "vaultAsk" },
  { prefix: "/vault", cap: "vault" },
  { prefix: "/workflow/approvals", cap: "approvals" },
  { prefix: "/workflow/chains", cap: "chainDesigner" },
  { prefix: "/workflow/notifications", cap: "notifications" },
  { prefix: "/analytics/sales", cap: "analytics.sales" },
  { prefix: "/analytics/service", cap: "analytics.service" },
  { prefix: "/analytics/projects", cap: "analytics.projects" },
  { prefix: "/analytics/cash", cap: "analytics.cash" },
  { prefix: "/analytics/inventory", cap: "analytics.inventory" },
  { prefix: "/assistant", cap: "assistant" },
  { prefix: "/field/today", cap: "jobCards" },
  { prefix: "/field/job", cap: "jobCards" },
  { prefix: "/field/commissioning", cap: "commissioning" },
  { prefix: "/field/attendance", cap: "attendance" },
  { prefix: "/admin/users", cap: "admin.users" },
  { prefix: "/admin/permissions", cap: "admin.permissions" },
  { prefix: "/admin/masters", cap: "admin.masters" },
  { prefix: "/admin/integrations", cap: "admin.integrations" },
  { prefix: "/admin/compliance", cap: "admin.compliance" },
  { prefix: "/admin/audit", cap: "admin.audit" },
  { prefix: "/admin/demo", cap: "admin.demo" },
  { prefix: "/admin", cap: "admin.users" },
];

export function capabilityForPath(pathname: string): Capability | null {
  let best: RouteRule | null = null;
  for (const r of ROUTE_RULES) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) {
      if (!best || r.prefix.length > best.prefix.length) best = r;
    }
  }
  return best?.cap ?? null;
}

/** Persona landing routes. PRD §2.1. */
export const LANDING_ROUTE: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  DIRECTOR_BUSINESS: "/command",
  DIRECTOR_STRATEGY: "/command?view=executive",
  BRANCH_MANAGER: "/sales/pipeline",
  SALES_EXECUTIVE: "/sales/my-desk",
  SERVICE_MANAGER: "/service/dispatch",
  FIELD_ENGINEER: "/field/today",
  PROJECT_MANAGER: "/projects",
  ACCOUNTS_EXECUTIVE: "/commercial/receivables",
  HR_ADMIN: "/people/attendance",
  STORE_INCHARGE: "/inventory/movements",
  AUDITOR: "/admin/audit",
};

export const DEFAULT_THEME: Record<Role, "dark" | "light"> = {
  SUPER_ADMIN: "dark",
  DIRECTOR_BUSINESS: "dark",
  DIRECTOR_STRATEGY: "light",
  BRANCH_MANAGER: "dark",
  SALES_EXECUTIVE: "dark",
  SERVICE_MANAGER: "dark",
  FIELD_ENGINEER: "light",
  PROJECT_MANAGER: "dark",
  ACCOUNTS_EXECUTIVE: "light",
  HR_ADMIN: "light",
  STORE_INCHARGE: "light",
  AUDITOR: "light",
};

export const DEFAULT_DENSITY: Record<Role, "compact" | "comfortable"> = {
  SUPER_ADMIN: "compact",
  DIRECTOR_BUSINESS: "comfortable",
  DIRECTOR_STRATEGY: "comfortable",
  BRANCH_MANAGER: "compact",
  SALES_EXECUTIVE: "compact",
  SERVICE_MANAGER: "compact",
  FIELD_ENGINEER: "comfortable",
  PROJECT_MANAGER: "compact",
  ACCOUNTS_EXECUTIVE: "compact",
  HR_ADMIN: "compact",
  STORE_INCHARGE: "compact",
  AUDITOR: "compact",
};

/** Which role a denied user should be told holds the access. E14-S2. */
export function rolesHolding(cap: Capability): Role[] {
  return (Object.keys(MATRIX) as Role[]).filter((r) => can(r, cap));
}
