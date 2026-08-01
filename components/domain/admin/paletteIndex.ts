import type { Dataset } from "@/lib/schemas";
import { PRODUCT_LINE_LABEL, ROLE_LABEL, type Role } from "@/lib/schemas/enums";
import { enumLabel } from "@/lib/format";
import { can, canCreate, grantFor, type Capability, type Scope } from "@/lib/rbac/matrix";
import type { PaletteRecord } from "@/components/patterns/CommandPalette";

/**
 * E1-S5 — the palette index, built once per navigation on the server.
 *
 * The RBAC rule the acceptance criteria state is structural here: a record the
 * role cannot access is never placed in the index, so it cannot be surfaced and
 * then blocked. Scope narrows it further — an "own records only" role indexes
 * only its own rows, a branch-scoped role only its branch.
 */

export interface PaletteViewer {
  userId: string;
  role: Role;
  branchId: string;
  /** Employee id for the signed-in user, where one exists. */
  employeeId: string | null;
}

/** Documents are the largest set; the index carries the most recent slice. */
const DOCUMENT_LIMIT = 300;

interface ScopeInput {
  branchId?: string | null;
  ownerUserId?: string | null;
  assignedUserId?: string | null;
}

function allows(scope: Scope, v: PaletteViewer, row: ScopeInput): boolean {
  switch (scope) {
    case "ALL":
      return true;
    case "BRANCH":
      return row.branchId === v.branchId;
    case "OWN":
      return row.ownerUserId === v.userId;
    case "ASSIGNED":
      return row.assignedUserId === v.userId || row.ownerUserId === v.userId;
    case "SELF":
      return row.ownerUserId === v.userId;
    default:
      return false;
  }
}

interface ScreenSpec {
  label: string;
  href: string;
  cap: Capability;
  section: string;
}

/** Mirrors the rail so the palette can reach every screen the role holds. */
const SCREENS: ScreenSpec[] = [
  { label: "Command Centre", href: "/command", cap: "command", section: "Command" },
  { label: "Branch League Table", href: "/command/branches", cap: "command.league", section: "Command" },
  { label: "Exception Feed", href: "/command/exceptions", cap: "command.exceptions", section: "Command" },
  { label: "My Desk", href: "/sales/my-desk", cap: "enquiries", section: "Sales" },
  { label: "Pipeline", href: "/sales/pipeline", cap: "enquiries", section: "Sales" },
  { label: "Enquiries", href: "/sales/enquiries", cap: "enquiries", section: "Sales" },
  { label: "Quotations", href: "/sales/quotations", cap: "quotations", section: "Sales" },
  { label: "Sales Orders", href: "/sales/orders", cap: "salesOrders", section: "Sales" },
  { label: "Customers", href: "/sales/customers", cap: "customers", section: "Sales" },
  { label: "Dispatch Board", href: "/service/dispatch", cap: "dispatch", section: "Service" },
  { label: "Tickets", href: "/service/tickets", cap: "tickets", section: "Service" },
  { label: "Job Cards", href: "/service/job-cards", cap: "jobCards", section: "Service" },
  { label: "Installed Assets", href: "/service/assets", cap: "assets", section: "Service" },
  { label: "AMC Contracts", href: "/service/amc", cap: "amc", section: "Service" },
  { label: "Renewal Radar", href: "/service/renewals", cap: "renewals", section: "Service" },
  { label: "Commissioning Register", href: "/service/commissioning", cap: "commissioning", section: "Service" },
  { label: "Rental Fleet", href: "/service/rental", cap: "rental", section: "Service" },
  { label: "Project Portfolio", href: "/projects", cap: "projects", section: "Projects" },
  { label: "Retention Register", href: "/projects/retention", cap: "retention", section: "Projects" },
  { label: "Stock Balances", href: "/inventory/stock", cap: "stock", section: "Inventory" },
  { label: "Issue & Receipt", href: "/inventory/movements", cap: "stock", section: "Inventory" },
  { label: "Reorder List", href: "/inventory/reorder", cap: "reorder", section: "Inventory" },
  { label: "Item Master", href: "/inventory/items", cap: "items", section: "Inventory" },
  { label: "Suppliers & Purchase Orders", href: "/inventory/purchase", cap: "purchaseOrders", section: "Inventory" },
  { label: "Receivables", href: "/commercial/receivables", cap: "receivables", section: "Commercial" },
  { label: "Invoices", href: "/commercial/invoices", cap: "invoices", section: "Commercial" },
  { label: "Delivery Challans", href: "/commercial/challans", cap: "challans", section: "Commercial" },
  { label: "E-Way Bills", href: "/commercial/eway", cap: "eway", section: "Commercial" },
  { label: "Receipts", href: "/commercial/receipts", cap: "receipts", section: "Commercial" },
  { label: "Ledger Hand-off", href: "/commercial/handoff", cap: "handoff", section: "Commercial" },
  { label: "Attendance Board", href: "/people/attendance", cap: "attendance", section: "People" },
  { label: "Leave", href: "/people/leave", cap: "leave", section: "People" },
  { label: "Employees", href: "/people/employees", cap: "employees", section: "People" },
  { label: "Statutory Documents", href: "/people/documents", cap: "hrDocuments", section: "People" },
  { label: "Document Vault", href: "/vault", cap: "vault", section: "Knowledge" },
  { label: "Ask the Vault", href: "/vault/ask", cap: "vaultAsk", section: "Knowledge" },
  { label: "My Approvals", href: "/workflow/approvals", cap: "approvals", section: "Workflow" },
  { label: "Approval Chains", href: "/workflow/chains", cap: "chainDesigner", section: "Workflow" },
  { label: "Notifications", href: "/workflow/notifications", cap: "notifications", section: "Workflow" },
  { label: "Sales Analytics", href: "/analytics/sales", cap: "analytics.sales", section: "Analytics" },
  { label: "Service Analytics", href: "/analytics/service", cap: "analytics.service", section: "Analytics" },
  { label: "Projects Analytics", href: "/analytics/projects", cap: "analytics.projects", section: "Analytics" },
  { label: "Cash Analytics", href: "/analytics/cash", cap: "analytics.cash", section: "Analytics" },
  { label: "Inventory Analytics", href: "/analytics/inventory", cap: "analytics.inventory", section: "Analytics" },
  { label: "AI Assistant", href: "/assistant", cap: "assistant", section: "Assistant" },
  { label: "Users & Roles", href: "/admin/users", cap: "admin.users", section: "Admin" },
  { label: "Permission Matrix", href: "/admin/permissions", cap: "admin.permissions", section: "Admin" },
  { label: "Reference Data Masters", href: "/admin/masters", cap: "admin.masters", section: "Admin" },
  { label: "Integration Readiness", href: "/admin/integrations", cap: "admin.integrations", section: "Admin" },
  { label: "Compliance & Consent", href: "/admin/compliance", cap: "admin.compliance", section: "Admin" },
  { label: "Audit Log", href: "/admin/audit", cap: "admin.audit", section: "Admin" },
  { label: "Demo Controls", href: "/admin/demo", cap: "admin.demo", section: "Admin" },
];

interface ActionSpec {
  label: string;
  detail: string;
  href: string;
  cap: Capability;
  needsCreate?: boolean;
}

const ACTIONS: ActionSpec[] = [
  { label: "Capture a new enquiry", detail: "Sales · opens the intake form", href: "/sales/enquiries?new=1", cap: "enquiries", needsCreate: true },
  { label: "Build a quotation", detail: "Sales · new quotation with GST derivation", href: "/sales/quotations?new=1", cap: "quotations", needsCreate: true },
  { label: "Log a service ticket", detail: "Service · SLA derives from severity and coverage", href: "/service/tickets?new=1", cap: "tickets", needsCreate: true },
  { label: "Raise a purchase order", detail: "Inventory · approval routes above threshold", href: "/inventory/purchase?new=1", cap: "purchaseOrders", needsCreate: true },
  { label: "Record a receipt", detail: "Commercial · allocate against outstanding invoices", href: "/commercial/receipts?new=1", cap: "receipts", needsCreate: true },
  { label: "Apply for leave", detail: "People · coverage warning is checked on submit", href: "/people/leave?new=1", cap: "leave", needsCreate: true },
  { label: "Add a user account", detail: "Admin · role and branch assignment", href: "/admin/users?new=1", cap: "admin.users", needsCreate: true },
  { label: "Export the permission matrix", detail: "Admin · CSV of the full role × capability grid", href: "/admin/permissions?export=1", cap: "admin.permissions" },
  { label: "Export the audit log", detail: "Admin · CSV of exactly the filtered rows", href: "/admin/audit?export=1", cap: "admin.audit" },
  { label: "Open Integration Readiness", detail: "Admin · what is simulated and what Phase 2 needs", href: "/admin/integrations", cap: "admin.integrations" },
  { label: "Open the compliance posture", detail: "Admin · consent notice, DSR register, retention", href: "/admin/compliance", cap: "admin.compliance" },
  { label: "Reset the demonstration data", detail: "Admin · returns every figure to the seeded baseline", href: "/admin/demo", cap: "admin.demo" },
];

export interface PaletteIndex {
  records: PaletteRecord[];
  note: string;
}

export function buildPaletteIndex(ds: Dataset, v: PaletteViewer): PaletteIndex {
  const out: PaletteRecord[] = [];
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  const siteById = new Map(ds.sites.map((s) => [s.id, s]));
  const branchById = new Map(ds.branches.map((b) => [b.id, b]));

  /* engineer-assigned customers and assets, for ASSIGNED scope */
  const assignedCustomers = new Set<string>();
  const assignedAssets = new Set<string>();
  for (const t of ds.tickets) {
    if (t.assignedEngineerId === v.userId) {
      assignedCustomers.add(t.customerId);
      assignedAssets.add(t.assetId);
    }
  }

  /* --------------------------------------------------------- customers */
  if (can(v.role, "customers")) {
    const scope = grantFor(v.role, "customers").scope;
    for (const c of ds.customers) {
      const ok =
        scope === "ASSIGNED"
          ? assignedCustomers.has(c.id)
          : allows(scope, v, { branchId: c.branchId, ownerUserId: c.ownerUserId });
      if (!ok) continue;
      out.push({
        id: c.id,
        type: "customer",
        title: c.tradeName,
        subtitle: `${c.legalName} · ${enumLabel(c.type)} · ${branchById.get(c.branchId)?.name ?? "—"}`,
        href: `/sales/customers/${c.id}`,
        hint: `${c.code} ${c.gstin ?? ""} ${c.industry}`,
      });
    }
  }

  /* ------------------------------------------------------ assets by serial */
  if (can(v.role, "assets")) {
    const scope = grantFor(v.role, "assets").scope;
    for (const a of ds.assets) {
      const ok =
        scope === "ASSIGNED"
          ? assignedAssets.has(a.id)
          : allows(scope, v, { branchId: a.branchId });
      if (!ok) continue;
      const cust = custById.get(a.customerId);
      out.push({
        id: a.id,
        type: "asset",
        title: a.serial,
        subtitle: `${a.model} · ${cust?.tradeName ?? "—"} · ${siteById.get(a.siteId)?.name ?? "—"}`,
        href: `/service/assets/${a.serial}`,
        hint: `${PRODUCT_LINE_LABEL[a.productLine]} ${a.principal} ${cust?.tradeName ?? ""}`,
      });
    }
  }

  /* ------------------------------------------------------------- tickets */
  if (can(v.role, "tickets")) {
    const scope = grantFor(v.role, "tickets").scope;
    for (const t of ds.tickets) {
      const cust = custById.get(t.customerId);
      const ok =
        scope === "ASSIGNED"
          ? t.assignedEngineerId === v.userId
          : scope === "OWN"
            ? cust?.ownerUserId === v.userId
            : allows(scope, v, { branchId: t.branchId });
      if (!ok) continue;
      out.push({
        id: t.id,
        type: "ticket",
        title: t.number,
        subtitle: `${cust?.tradeName ?? "—"} · ${enumLabel(t.severity)} · ${enumLabel(t.status)}`,
        href: `/service/tickets/${t.id}`,
        hint: `${t.problem} ${enumLabel(t.category)}`,
      });
    }
  }

  /* ---------------------------------------------------------- quotations */
  if (can(v.role, "quotations")) {
    const scope = grantFor(v.role, "quotations").scope;
    for (const q of ds.quotations) {
      if (!allows(scope, v, { branchId: q.branchId, ownerUserId: q.ownerUserId })) continue;
      out.push({
        id: q.id,
        type: "quotation",
        title: q.number,
        subtitle: `${custById.get(q.customerId)?.tradeName ?? "—"} · v${q.version} · ${enumLabel(q.status)}`,
        href: `/sales/quotations/${q.id}`,
        hint: `${custById.get(q.customerId)?.legalName ?? ""} ${enumLabel(q.vertical)}`,
      });
    }
  }

  /* ------------------------------------------------------------ invoices */
  if (can(v.role, "invoices")) {
    const scope = grantFor(v.role, "invoices").scope;
    for (const inv of ds.invoices) {
      if (!allows(scope, v, { branchId: inv.branchId, ownerUserId: inv.ownerUserId })) continue;
      out.push({
        id: inv.id,
        type: "invoice",
        title: inv.number,
        subtitle: `${custById.get(inv.customerId)?.tradeName ?? "—"} · ${enumLabel(inv.type)} · ${enumLabel(inv.taxTreatment)}`,
        href: `/commercial/invoices/${inv.id}`,
        hint: `${inv.irn ?? ""} ${custById.get(inv.customerId)?.legalName ?? ""}`,
      });
    }
  }

  /* ------------------------------------------------------------ projects */
  if (can(v.role, "projects")) {
    const scope = grantFor(v.role, "projects").scope;
    for (const p of ds.projects) {
      if (!allows(scope, v, { branchId: p.branchId, assignedUserId: p.managerUserId, ownerUserId: p.managerUserId }))
        continue;
      out.push({
        id: p.id,
        type: "project",
        title: p.name,
        subtitle: `${p.code} · ${custById.get(p.customerId)?.tradeName ?? "—"} · ${enumLabel(p.status)}`,
        href: `/projects/${p.id}`,
        hint: `${p.workOrderRef} ${p.district} ${p.siteLocation}`,
      });
    }
  }

  /* ----------------------------------------------------------- documents */
  if (can(v.role, "vault")) {
    const scope = grantFor(v.role, "vault").scope;
    const hrOk = can(v.role, "hrDocuments") || v.role === "HR_ADMIN";
    const commercialOk = can(v.role, "invoices");
    const restrictedOk = v.role === "SUPER_ADMIN" || v.role === "AUDITOR" || v.role.startsWith("DIRECTOR");
    let taken = 0;
    for (let i = ds.documents.length - 1; i >= 0 && taken < DOCUMENT_LIMIT; i--) {
      const d = ds.documents[i]!;
      if (d.deletedAt) continue;
      if (d.accessLevel === "HR" && !hrOk) continue;
      if (d.accessLevel === "COMMERCIAL" && !commercialOk) continue;
      if (d.accessLevel === "RESTRICTED" && !restrictedOk) continue;
      if (!allows(scope === "BRANCH" ? "ALL" : scope, v, { ownerUserId: d.ownerUserId, assignedUserId: d.ownerUserId }))
        continue;
      out.push({
        id: d.id,
        type: "document",
        title: d.title,
        subtitle: `${enumLabel(d.category)} · v${d.version} · ${d.pageCount} pp`,
        href: `/vault?doc=${d.id}`,
        hint: d.tags.join(" "),
      });
      taken++;
    }
  }

  /* ----------------------------------------------------------- employees */
  if (can(v.role, "employees")) {
    const scope = grantFor(v.role, "employees").scope;
    for (const e of ds.employees) {
      const isSelf = v.employeeId === e.id;
      const ok =
        scope === "SELF"
          ? isSelf
          : scope === "ASSIGNED"
            ? e.reportingManagerId === v.employeeId || isSelf
            : allows(scope, v, { branchId: e.branchId });
      if (!ok) continue;
      out.push({
        id: e.id,
        type: "employee",
        title: e.name,
        subtitle: `${e.designation} · ${e.department} · ${branchById.get(e.branchId)?.name ?? "—"}`,
        href: `/people/employees/${e.id}`,
        hint: `${e.code} ${e.email}`,
      });
    }
  }

  /* ------------------------------------------------------------- screens */
  for (const s of SCREENS) {
    if (!can(v.role, s.cap)) continue;
    out.push({
      id: s.href,
      type: "screen",
      title: s.label,
      subtitle: `${s.section} · ${s.href}`,
      href: s.href,
      hint: s.section,
    });
  }

  /* ------------------------------------------------------------- actions */
  for (const a of ACTIONS) {
    if (!can(v.role, a.cap)) continue;
    if (a.needsCreate && !canCreate(v.role, a.cap)) continue;
    out.push({
      id: a.href,
      type: "action",
      title: a.label,
      subtitle: a.detail,
      href: a.href,
      hint: "action",
    });
  }

  const recordCount = out.filter((r) => r.type !== "screen" && r.type !== "action").length;
  return {
    records: out,
    note: `${recordCount.toLocaleString("en-IN")} records visible to ${ROLE_LABEL[v.role]} · documents capped at ${DOCUMENT_LIMIT}`,
  };
}
