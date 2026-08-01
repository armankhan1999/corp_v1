import type { Dataset } from "@/lib/schemas";
import {
  PRODUCT_LINE_LABEL,
  ROLE_LABEL,
  zItemCategory,
  zLossReason,
  zOEMPrincipal,
  zProductLine,
  zTicketCategory,
  zTicketSeverity,
  type ItemCategory,
  type OEMPrincipal,
  type TicketSeverity,
} from "@/lib/schemas/enums";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "@/lib/seed/catalog";
import { enumLabel, formatCount } from "@/lib/format";
import type { MasterRow, MasterSet, SeriesState } from "./types";

/**
 * E1-S7 — reference data, assembled from the seeded world so that every value
 * carries a live reference count. The count is what makes the deletion block
 * truthful: it names the number of records that point at the value.
 */

const CLOCK_OPTIONS = [
  { value: "ELAPSED", label: "Elapsed hours — the clock runs around the calendar" },
  { value: "BUSINESS", label: "Business hours — 09:30–18:30, Mon–Sat, branch holidays excluded" },
];

function options(values: readonly string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: enumLabel(v) }));
}

function sentence(parts: { n: number; noun: string }[]): string {
  const live = parts.filter((p) => p.n > 0).map((p) => `${formatCount(p.n)} ${p.noun}`);
  if (live.length === 0) return "Nothing references this value yet";
  if (live.length === 1) return `${live[0]} reference this value`;
  return `${live.slice(0, -1).join(", ")} and ${live[live.length - 1]} reference this value`;
}

function tally<T>(rows: T[], key: (r: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k === null || k === undefined) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/* ------------------------------------------------------- numbering series */

const SERIES_SOURCE: Record<string, (ds: Dataset) => string[]> = {
  QUOTATION: (ds) => ds.quotations.map((x) => x.number),
  SALES_ORDER: (ds) => ds.salesOrders.map((x) => x.number),
  CHALLAN: (ds) => ds.challans.map((x) => x.number),
  INVOICE: (ds) => ds.invoices.map((x) => x.number),
  RECEIPT: (ds) => ds.receipts.map((x) => x.number),
  CREDIT_NOTE: (ds) => ds.creditNotes.map((x) => x.number),
  TICKET: (ds) => ds.tickets.map((x) => x.number),
  JOB_CARD: (ds) => ds.jobCards.map((x) => x.number),
  COMMISSIONING: (ds) => ds.commissioningReports.map((x) => x.number),
  AMC: (ds) => ds.amcContracts.map((x) => x.number),
  RA_BILL: (ds) => ds.raBills.map((x) => x.number),
  PURCHASE_ORDER: (ds) => ds.purchaseOrders.map((x) => x.number),
  ENQUIRY: (ds) => ds.enquiries.map((x) => x.number),
  PARTS_REQUEST: (ds) => ds.partsRequests.map((x) => x.number),
  GRN: (ds) => ds.goodsReceipts.map((x) => x.number),
  LEAVE: (ds) => ds.leaveRequests.map((x) => x.number),
  APPROVAL: (ds) => ds.approvalRequests.map((x) => x.number),
  DSR: (ds) => ds.dsrRequests.map((x) => x.number),
  STOCK_COUNT: (ds) => ds.stockCounts.map((x) => x.number),
};

function tailNumber(n: string): number | null {
  const m = /(\d+)\s*$/.exec(n);
  return m ? Number(m[1]) : null;
}

export function buildSeriesState(ds: Dataset): SeriesState[] {
  return ds.numberingSeries.map((s) => {
    const issued = (SERIES_SOURCE[s.docType]?.(ds) ?? [])
      .map(tailNumber)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const n of issued) {
      if (seen.has(n)) duplicates.push(n);
      seen.add(n);
    }
    const highest = issued.length > 0 ? issued[issued.length - 1]! : 0;
    const gaps: number[] = [];
    for (let i = 1; i <= highest && gaps.length < 12; i++) if (!seen.has(i)) gaps.push(i);

    return {
      id: s.id,
      docType: s.docType,
      prefix: s.prefix,
      fySegment: s.fySegment,
      width: s.width,
      issuedCount: issued.length,
      highest,
      gaps,
      duplicates,
      nextPreview: `${s.prefix}/${s.fySegment}/${String(highest + 1).padStart(s.width, "0")}`,
    };
  });
}

export function formatSeriesNumber(s: SeriesState, n: number): string {
  return `${s.prefix}/${s.fySegment}/${String(n).padStart(s.width, "0")}`;
}

/* ------------------------------------------------------------- the sets */

export interface MastersModel {
  sets: MasterSet[];
  series: SeriesState[];
}

export function buildMasters(ds: Dataset): MastersModel {
  const itemsByCategory = tally(ds.items, (i) => i.category);
  const itemsByPrincipal = tally(ds.items, (i) => i.principal);
  const assetsByPrincipal = tally(ds.assets, (a) => a.principal);
  const itemsByUom = tally(ds.items, (i) => i.uom);
  const itemsByHsn = tally(ds.items, (i) => i.hsnSac);
  const linesByHsn = tally(ds.invoiceLines, (l) => l.hsnSac);
  const itemsByGst = tally(ds.items, (i) => String(i.gstRate));
  const linesByGst = tally(ds.invoiceLines, (l) => String(l.gstRate));
  const ticketsByCategory = tally(ds.tickets, (t) => t.category);
  const ticketsBySeverity = tally(ds.tickets, (t) => t.severity);
  const quotesByLoss = tally(ds.quotations, (q) => q.lossReason);
  const leaveByType = tally(ds.leaveRequests, (l) => l.leaveTypeId);
  const customersByBranch = tally(ds.customers, (c) => c.branchId);
  const employeesByBranch = tally(ds.employees, (e) => e.branchId);
  const invoicesByBranch = tally(ds.invoices, (i) => i.branchId);
  const assetsByBranch = tally(ds.assets, (a) => a.branchId);
  const ticketsBySlaRule = tally(ds.tickets, (t) => t.slaRuleApplied);
  const projectsByClientType = tally(ds.projects, (p) => p.clientType);
  const reportsByPrincipal = new Map<string, number>();
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  for (const r of ds.commissioningReports) {
    const p = assetById.get(r.assetId)?.principal;
    if (p) reportsByPrincipal.set(p, (reportsByPrincipal.get(p) ?? 0) + 1);
  }
  const holidayAttendance = new Map<string, number>();
  for (const a of ds.attendance) {
    if (a.state !== "HOLIDAY") continue;
    const day = a.date.slice(0, 10);
    holidayAttendance.set(day, (holidayAttendance.get(day) ?? 0) + 1);
  }

  const branchOptions = [
    { value: "", label: "All branches" },
    ...ds.branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const series = buildSeriesState(ds);
  const seriesById = new Map(series.map((s) => [s.id, s]));

  const sets: MasterSet[] = [];

  /* ------------------------------------------------------- 1. branches */
  sets.push({
    key: "branches",
    label: "Branches",
    group: "Organisation",
    entityType: "Branch",
    labelField: "name",
    description:
      "The four operating locations. A branch drives RBAC scoping, document numbering and the branch league table, so it can never be removed while records point at it.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "name", label: "Branch", type: "text", required: true },
      { key: "city", label: "City", type: "text", required: true },
      { key: "district", label: "District", type: "text" },
      { key: "state", label: "State", type: "text", readOnly: true },
      { key: "gstin", label: "GSTIN", type: "text", mono: true, readOnly: true, help: "Registration is per state; all four branches share the Bihar registration." },
      { key: "phone", label: "Phone", type: "text", mono: true },
      { key: "hasCentralWarehouse", label: "Central warehouse", type: "boolean" },
    ],
    rows: ds.branches.map<MasterRow>((b) => {
      const refCount =
        (customersByBranch.get(b.id) ?? 0) +
        (employeesByBranch.get(b.id) ?? 0) +
        (invoicesByBranch.get(b.id) ?? 0) +
        (assetsByBranch.get(b.id) ?? 0);
      return {
        id: b.id,
        active: true,
        system: b.isHeadOffice,
        refCount,
        refLabel: sentence([
          { n: customersByBranch.get(b.id) ?? 0, noun: "customers" },
          { n: employeesByBranch.get(b.id) ?? 0, noun: "employees" },
          { n: assetsByBranch.get(b.id) ?? 0, noun: "installed assets" },
          { n: invoicesByBranch.get(b.id) ?? 0, noun: "invoices" },
        ]),
        values: {
          code: b.code,
          name: b.name,
          city: b.city,
          district: b.district,
          state: b.state,
          gstin: b.gstin,
          phone: b.phone,
          hasCentralWarehouse: b.hasCentralWarehouse,
        },
      };
    }),
    note: "The head office row is structural — the company GSTIN and the central warehouse hang off it.",
  });

  /* ------------------------------------------- 2. holiday calendar (X-16g) */
  sets.push({
    key: "holidays",
    label: "Holiday calendar",
    group: "Organisation",
    entityType: "Holiday",
    labelField: "name",
    description:
      "Per-branch holiday calendar. Business-hour SLA clocks pause on these dates and attendance marks them Holiday rather than Absent. Leave a branch blank to apply the day company-wide.",
    canCreate: true,
    fields: [
      { key: "date", label: "Date", type: "text", mono: true, required: true, help: "YYYY-MM-DD" },
      { key: "name", label: "Observance", type: "text", required: true },
      { key: "branchId", label: "Branch", type: "select", options: branchOptions },
    ],
    rows: ds.holidays.map<MasterRow>((h) => {
      const day = h.date.slice(0, 10);
      const n = holidayAttendance.get(day) ?? 0;
      return {
        id: h.id,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "attendance rows marked Holiday" }]),
        values: { date: day, name: h.name, branchId: h.branchId ?? "" },
      };
    }),
    note: "FR-M8-12. Bihar observances — Chhath Puja is a two-day closure in this calendar.",
  });

  /* ------------------------------------------ 3. sales targets (FR-M3-22) */
  sets.push({
    key: "targets",
    label: "Sales targets",
    group: "Organisation",
    entityType: "Target",
    labelField: "label",
    description:
      "Revenue targets per branch and per executive for the financial year. The branch league table and the sales analytics attainment column read from here.",
    canCreate: true,
    fields: [
      { key: "label", label: "Target", type: "text", required: true },
      { key: "branchId", label: "Branch", type: "select", options: branchOptions },
      { key: "userId", label: "Owner", type: "select", options: [{ value: "", label: "Branch-wide" }, ...ds.users.map((u) => ({ value: u.id, label: u.name }))] },
      { key: "periodStart", label: "Period from", type: "text", mono: true, required: true },
      { key: "periodEnd", label: "Period to", type: "text", mono: true, required: true },
      { key: "amount", label: "Target (₹)", type: "number", numeric: true, required: true, min: 0, step: 100000 },
    ],
    rows: ds.targets.map<MasterRow>((t) => ({
      id: t.id,
      active: true,
      refCount: 0,
      refLabel: "Nothing references a target directly — it is read by analytics, never pointed at",
      values: {
        label: t.label,
        branchId: t.branchId ?? "",
        userId: t.userId ?? "",
        periodStart: t.periodStart.slice(0, 10),
        periodEnd: t.periodEnd.slice(0, 10),
        amount: t.amount,
      },
    })),
    note:
      "FR-M3-22 had no story in the source backlog; it is built here because the league table cannot show attainment without it.",
  });

  /* ------------------------------------------------ 4. product categories */
  sets.push({
    key: "productCategories",
    label: "Product categories",
    group: "Catalogue",
    entityType: "Master",
    labelField: "label",
    description:
      "The top-level split of the item master. Category drives valuation treatment, the reorder policy default and whether an item can be sold as a machine.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "label", label: "Category", type: "text", required: true },
      { key: "note", label: "Treatment", type: "text" },
    ],
    rows: zItemCategory.options.map<MasterRow>((c) => {
      const n = itemsByCategory.get(c) ?? 0;
      return {
        id: c,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "items" }]),
        values: {
          code: c,
          label: enumLabel(c),
          note: CATEGORY_NOTE[c] ?? "",
        },
      };
    }),
  });

  /* ------------------------------------------------- 5. OEM principals */
  sets.push({
    key: "principals",
    label: "OEM principals",
    group: "Catalogue",
    entityType: "Master",
    labelField: "label",
    description:
      "The manufacturers Bhushan Corp is authorised for. Principal determines warranty terms, the commissioning submission window and which channel portal a claim goes to.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "label", label: "Principal", type: "text", required: true },
      { key: "portal", label: "Channel portal", type: "text", help: "Simulated in Phase 1 — see INT-11." },
    ],
    rows: zOEMPrincipal.options.map<MasterRow>((p) => {
      const items = itemsByPrincipal.get(p) ?? 0;
      const assets = assetsByPrincipal.get(p) ?? 0;
      return {
        id: p,
        active: true,
        refCount: items + assets,
        refLabel: sentence([
          { n: items, noun: "items" },
          { n: assets, noun: "installed assets" },
        ]),
        values: { code: p, label: enumLabel(p), portal: PRINCIPAL_PORTAL[p] ?? "" },
      };
    }),
  });

  /* ------------------------------------------------- 6. units of measure */
  sets.push({
    key: "uom",
    label: "Units of measure",
    group: "Catalogue",
    entityType: "Master",
    labelField: "code",
    description:
      "Units used on items, quotation lines, BOQ lines and invoices. The unit is printed on the statutory document, so it cannot change once a document has been issued against it.",
    canCreate: true,
    fields: [
      { key: "code", label: "Unit", type: "text", mono: true, required: true },
      { key: "name", label: "Description", type: "text", required: true },
    ],
    rows: [...itemsByUom.keys()].sort().map<MasterRow>((u) => ({
      id: u,
      active: true,
      refCount: itemsByUom.get(u) ?? 0,
      refLabel: sentence([{ n: itemsByUom.get(u) ?? 0, noun: "items" }]),
      values: { code: u, name: UOM_NAME[u] ?? u },
    })),
  });

  /* ------------------------------------------------------- 7. HSN / SAC */
  sets.push({
    key: "hsn",
    label: "HSN / SAC codes",
    group: "Catalogue",
    entityType: "Master",
    labelField: "code",
    description:
      "Harmonised codes carried onto every tax invoice line. Goods take an HSN, services take a SAC; the code and its rate must agree or the invoice cannot be issued.",
    canCreate: true,
    fields: [
      { key: "code", label: "HSN / SAC", type: "text", mono: true, required: true },
      { key: "description", label: "Description", type: "text", required: true },
      { key: "gstRate", label: "Default GST %", type: "number", numeric: true, min: 0, max: 28, step: 1 },
    ],
    rows: [...itemsByHsn.keys()].sort().map<MasterRow>((h) => {
      const items = itemsByHsn.get(h) ?? 0;
      const lines = linesByHsn.get(h) ?? 0;
      return {
        id: h,
        active: true,
        refCount: items + lines,
        refLabel: sentence([
          { n: items, noun: "items" },
          { n: lines, noun: "issued invoice lines" },
        ]),
        values: { code: h, description: HSN_DESC[h] ?? "Compressed-air and allied equipment", gstRate: 18 },
      };
    }),
  });

  /* --------------------------------------------------------- 8. GST rates */
  const gstSlabs = ["0", "5", "12", "18", "28"];
  sets.push({
    key: "gstRates",
    label: "GST rates",
    group: "Catalogue",
    entityType: "Master",
    labelField: "rate",
    description:
      "The statutory slabs available to the item master and invoice lines. Tax is derived from place of supply against these rates and never typed on a document.",
    canCreate: true,
    fields: [
      { key: "rate", label: "Rate %", type: "number", numeric: true, required: true, min: 0, max: 28, step: 0.5 },
      { key: "label", label: "Slab", type: "text", required: true },
      { key: "note", label: "Applies to", type: "text" },
    ],
    rows: gstSlabs.map<MasterRow>((r) => {
      const items = itemsByGst.get(r) ?? 0;
      const lines = linesByGst.get(r) ?? 0;
      return {
        id: `GST-${r}`,
        active: true,
        refCount: items + lines,
        refLabel: sentence([
          { n: items, noun: "items" },
          { n: lines, noun: "issued invoice lines" },
        ]),
        values: {
          rate: Number(r),
          label: `${r}%`,
          note: GST_NOTE[r] ?? "",
        },
      };
    }),
    note: "Only the 18% slab is in use across this catalogue; the other slabs are held so a future item can take them.",
  });

  /* -------------------------------------------- 9. reorder policy defaults */
  sets.push({
    key: "reorder",
    label: "Reorder policy defaults",
    group: "Catalogue",
    entityType: "Master",
    labelField: "category",
    description:
      "Defaults applied when a new item is created. The reorder list ranks service-critical categories first, so this table decides which stock-out becomes an exception.",
    canCreate: true,
    fields: [
      { key: "category", label: "Category", type: "text", readOnly: true },
      { key: "coverDays", label: "Cover (days)", type: "number", numeric: true, min: 0, step: 1 },
      { key: "leadTimeDays", label: "Lead time (days)", type: "number", numeric: true, min: 0, step: 1 },
      { key: "reorderMultiple", label: "Order multiple", type: "number", numeric: true, min: 1, step: 1 },
      { key: "serviceCritical", label: "Service-critical", type: "boolean" },
    ],
    rows: zItemCategory.options.map<MasterRow>((c) => {
      const rows = ds.items.filter((i) => i.category === c);
      const avgLead = rows.length
        ? Math.round(rows.reduce((s, i) => s + i.leadTimeDays, 0) / rows.length)
        : 0;
      const n = itemsByCategory.get(c) ?? 0;
      return {
        id: `RP-${c}`,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "items inherit this default" }]),
        values: {
          category: enumLabel(c),
          coverDays: REORDER_COVER[c] ?? 30,
          leadTimeDays: avgLead,
          reorderMultiple: c === "CONSUMABLE" ? 5 : 1,
          serviceCritical: c === "SPARE" || c === "CONSUMABLE",
        },
      };
    }),
  });

  /* --------------------------------------------------- 10. ticket categories */
  sets.push({
    key: "ticketCategories",
    label: "Ticket categories",
    group: "Service",
    entityType: "Master",
    labelField: "label",
    description:
      "Why a ticket exists. Category decides whether the visit is billable by default, whether a scheduled AMC visit is consumed, and which report template the engineer gets.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "label", label: "Category", type: "text", required: true },
      { key: "billableByDefault", label: "Billable by default", type: "boolean" },
    ],
    rows: zTicketCategory.options.map<MasterRow>((c) => {
      const n = ticketsByCategory.get(c) ?? 0;
      return {
        id: c,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "service tickets" }]),
        values: {
          code: c,
          label: enumLabel(c),
          billableByDefault: c === "BREAKDOWN" || c === "INSPECTION",
        },
      };
    }),
  });

  /* --------------------------------------------------- 11. ticket severities */
  const slaBySeverity = new Map(ds.slaDefinitions.filter((s) => !s.productLine).map((s) => [s.severity, s]));
  sets.push({
    key: "ticketSeverities",
    label: "Ticket severities",
    group: "Service",
    entityType: "Master",
    labelField: "label",
    description:
      "How badly the customer is hurt. Severity selects the SLA definition, the escalation ladder and the position on the dispatch board.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "label", label: "Severity", type: "text", required: true },
      { key: "definition", label: "Plain-language test", type: "text" },
      { key: "responseHours", label: "Default response (h)", type: "number", numeric: true, readOnly: true },
      { key: "restorationHours", label: "Default restoration (h)", type: "number", numeric: true, readOnly: true },
    ],
    rows: zTicketSeverity.options.map<MasterRow>((s) => {
      const n = ticketsBySeverity.get(s) ?? 0;
      const sla = slaBySeverity.get(s);
      return {
        id: s,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "service tickets" }]),
        values: {
          code: s,
          label: enumLabel(s),
          definition: SEVERITY_TEST[s],
          responseHours: sla?.responseHours ?? 0,
          restorationHours: sla?.restorationHours ?? 0,
        },
      };
    }),
    note: "Default hours are shown from the SLA definitions and are edited there, so the two can never disagree.",
  });

  /* ------------------------------------------------- 12. SLA definitions */
  sets.push({
    key: "sla",
    kind: "sla",
    label: "SLA definitions",
    group: "Service",
    entityType: "SLADefinition",
    labelField: "label",
    description:
      "The commitment clock. A definition captures product line, severity, coverage type, response and restoration hours, and whether the clock counts business hours or elapsed hours. The most specific matching definition wins.",
    canCreate: true,
    fields: [
      { key: "label", label: "Definition", type: "text", required: true },
      {
        key: "productLine",
        label: "Product line",
        type: "select",
        options: [{ value: "", label: "Any product line" }, ...zProductLine.options.map((p) => ({ value: p, label: PRODUCT_LINE_LABEL[p] }))],
      },
      { key: "severity", label: "Severity", type: "select", required: true, options: options(zTicketSeverity.options) },
      {
        key: "coverage",
        label: "Coverage type",
        type: "select",
        options: [
          { value: "", label: "Any coverage" },
          { value: "IN_WARRANTY", label: "In warranty" },
          { value: "UNDER_AMC", label: "Under AMC" },
          { value: "CHARGEABLE", label: "Chargeable" },
        ],
      },
      { key: "responseHours", label: "Response (h)", type: "number", numeric: true, required: true, min: 0, step: 1 },
      { key: "restorationHours", label: "Restoration (h)", type: "number", numeric: true, required: true, min: 0, step: 1 },
      {
        key: "clockBasis",
        label: "Clock basis",
        type: "select",
        required: true,
        options: CLOCK_OPTIONS,
        help: "Elapsed runs around the calendar; business hours pause overnight, on Sundays and on branch holidays.",
      },
      { key: "pauseOnAwaitingParts", label: "Pause while awaiting parts", type: "boolean" },
      { key: "pauseOnAwaitingCustomer", label: "Pause while awaiting customer", type: "boolean" },
    ],
    rows: ds.slaDefinitions.map<MasterRow>((s) => {
      const ruleText = s.productLine
        ? "OEM commitment — ELGi air-restoration programme"
        : `Default by severity (${s.severity})`;
      const n = ticketsBySlaRule.get(ruleText) ?? 0;
      return {
        id: s.id,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "service tickets have their clock set by this definition" }]),
        values: {
          label: s.label,
          productLine: s.productLine ?? "",
          severity: s.severity,
          coverage: s.coverage ?? "",
          responseHours: s.responseHours,
          restorationHours: s.restorationHours,
          clockBasis: s.businessHoursOnly ? "BUSINESS" : "ELAPSED",
          pauseOnAwaitingParts: s.pauseOnAwaitingParts,
          pauseOnAwaitingCustomer: s.pauseOnAwaitingCustomer,
        },
      };
    }),
    note:
      "An AMC contract may carry its own response and restoration hours; where it does, the contract overrides these definitions and the ticket records which rule it applied.",
  });

  /* -------------------------------------- 13. OEM commissioning windows */
  sets.push({
    key: "commissioningWindows",
    label: "OEM commissioning windows",
    group: "Service",
    entityType: "Master",
    labelField: "principal",
    description:
      "How long after commissioning the dealer has to lodge the report with the principal. Miss the window and the warranty claim is refused — the commissioning register counts down against these numbers.",
    canCreate: true,
    fields: [
      { key: "principal", label: "Principal", type: "text", readOnly: true },
      { key: "windowDays", label: "Window (days)", type: "number", numeric: true, required: true, min: 1, max: 90, step: 1 },
      { key: "basis", label: "Basis", type: "text" },
    ],
    rows: (Object.keys(OEM_COMMISSIONING_WINDOW_DAYS) as OEMPrincipal[]).map<MasterRow>((p) => {
      const n = reportsByPrincipal.get(p) ?? 0;
      return {
        id: `CW-${p}`,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "commissioning reports are timed against this window" }]),
        values: {
          principal: enumLabel(p),
          windowDays: OEM_COMMISSIONING_WINDOW_DAYS[p],
          basis: "Days from commissioning date to submission acknowledgement",
        },
      };
    }),
    note: "Client decision B5 / PD-006. Held as data so a principal's answer is a data edit, not a code change.",
  });

  /* ------------------------------------------------------ 14. loss reasons */
  sets.push({
    key: "lossReasons",
    label: "Loss reasons",
    group: "Sales & commercial",
    entityType: "Master",
    labelField: "label",
    description:
      "Why a quotation was lost. Mandatory on a loss, and the only input to the win/loss analysis, so the list must stay short enough that people choose honestly.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "label", label: "Reason", type: "text", required: true },
      { key: "coachable", label: "Addressable by us", type: "boolean" },
    ],
    rows: zLossReason.options.map<MasterRow>((r) => {
      const n = quotesByLoss.get(r) ?? 0;
      return {
        id: r,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "lost quotations" }]),
        values: {
          code: r,
          label: enumLabel(r),
          coachable: r === "PRICE" || r === "DELIVERY_LEAD_TIME" || r === "COMPETITOR_RELATIONSHIP",
        },
      };
    }),
  });

  /* --------------------------------------- 15. discount approval thresholds */
  const discountChains = ds.approvalChains.filter((c) => c.requestType === "QUOTATION_DISCOUNT");
  const stepsByChain = new Map<string, string[]>();
  for (const s of ds.approvalChainSteps.slice().sort((a, b) => a.order - b.order)) {
    const list = stepsByChain.get(s.chainId) ?? [];
    list.push(ROLE_LABEL[s.approverRole]);
    stepsByChain.set(s.chainId, list);
  }
  const requestsByChain = tally(ds.approvalRequests, (r) => r.resolvedChainId);
  sets.push({
    key: "discountThresholds",
    label: "Discount approval thresholds",
    group: "Sales & commercial",
    entityType: "Master",
    labelField: "band",
    description:
      "The discount bands and who must approve each. A quotation cannot leave draft above its band without the named chain clearing it.",
    canCreate: true,
    fields: [
      { key: "band", label: "Band", type: "text", required: true },
      { key: "minPct", label: "From %", type: "number", numeric: true, min: 0, max: 100, step: 0.5 },
      { key: "maxPct", label: "To %", type: "number", numeric: true, min: 0, max: 100, step: 0.5, help: "Leave blank for no ceiling." },
      { key: "approvers", label: "Approval chain", type: "text", readOnly: true },
      { key: "escalationHours", label: "Escalate after (h)", type: "number", numeric: true, min: 1, step: 1 },
    ],
    rows: discountChains.map<MasterRow>((c) => {
      const n = requestsByChain.get(c.id) ?? 0;
      const steps = ds.approvalChainSteps.filter((s) => s.chainId === c.id);
      return {
        id: c.id,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "approval requests resolved to this band" }]),
        values: {
          band: c.name,
          minPct: c.minValue,
          maxPct: c.maxValue,
          approvers: (stepsByChain.get(c.id) ?? []).join(" → "),
          escalationHours: steps.length > 0 ? steps[0]!.escalationHours : 8,
        },
      };
    }),
    note: "Client decision B4 / PD-005. The chain itself is designed in Workflow; the bands live here.",
  });

  /* ----------------------------------------------- 16. numbering series */
  sets.push({
    key: "numbering",
    kind: "numbering",
    label: "Document numbering series",
    group: "Sales & commercial",
    entityType: "NumberingSeries",
    labelField: "docType",
    description:
      "Prefix, financial-year segment, width and the current counter for every statutory and internal document. The counter is advanced only by issuing a number — it cannot be typed, which is what prevents gaps and duplicates.",
    canCreate: true,
    fields: [
      { key: "docType", label: "Document", type: "text", readOnly: true },
      { key: "prefix", label: "Prefix", type: "text", mono: true, required: true },
      { key: "fySegment", label: "FY segment", type: "text", mono: true, required: true },
      { key: "width", label: "Width", type: "number", numeric: true, required: true, min: 3, max: 8, step: 1 },
      { key: "current", label: "Current", type: "number", numeric: true, readOnly: true, help: "Derived from the numbers already issued. Not editable — that is the anti-duplicate rule." },
      { key: "next", label: "Next number", type: "text", mono: true, readOnly: true },
    ],
    rows: ds.numberingSeries.map<MasterRow>((s) => {
      const st = seriesById.get(s.id)!;
      return {
        id: s.id,
        active: true,
        system: true,
        refCount: st.issuedCount,
        refLabel: sentence([{ n: st.issuedCount, noun: "documents carry a number from this series" }]),
        values: {
          docType: enumLabel(s.docType),
          prefix: s.prefix,
          fySegment: s.fySegment,
          width: s.width,
          current: st.highest,
          next: st.nextPreview,
        },
      };
    }),
  });

  /* ------------------------------------------ 17. retention percentages */
  sets.push({
    key: "retentionPct",
    label: "Retention percentages",
    group: "Projects",
    entityType: "Master",
    labelField: "clientType",
    description:
      "Default retention withheld on each RA-bill and the defect-liability period after which it becomes claimable. ₹34.6 L of the locked-cash figure sits behind this table.",
    canCreate: true,
    fields: [
      { key: "clientType", label: "Client type", type: "text", readOnly: true },
      { key: "retentionPct", label: "Retention %", type: "number", numeric: true, required: true, min: 0, max: 20, step: 0.5 },
      { key: "defectLiabilityMonths", label: "Defect liability (months)", type: "number", numeric: true, min: 0, max: 60, step: 1 },
      { key: "releaseBasis", label: "Release basis", type: "text" },
    ],
    rows: (["GOVERNMENT", "INSTITUTIONAL", "INDUSTRIAL", "DEALER", "RETAIL"] as const).map<MasterRow>((ct) => {
      const rows = ds.projects.filter((p) => p.clientType === ct);
      const n = projectsByClientType.get(ct) ?? 0;
      return {
        id: `RET-${ct}`,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "projects use this default" }]),
        values: {
          clientType: enumLabel(ct),
          retentionPct: rows.length > 0 ? rows[0]!.retentionPct : 5,
          defectLiabilityMonths: rows.length > 0 ? rows[0]!.defectLiabilityMonths : 12,
          releaseBasis: "Released on expiry of the defect-liability period against a claim",
        },
      };
    }),
    note: "Client decision B7 / PD-008.",
  });

  /* --------------------------------------------------------- 18. leave types */
  sets.push({
    key: "leaveTypes",
    label: "Leave types",
    group: "People",
    entityType: "Master",
    labelField: "name",
    description:
      "Entitlement and monthly accrual per leave type. The leave balance, the coverage warning and the payroll-input summary all read from here.",
    canCreate: true,
    fields: [
      { key: "code", label: "Code", type: "text", mono: true, required: true },
      { key: "name", label: "Leave type", type: "text", required: true },
      { key: "annualEntitlement", label: "Annual entitlement (days)", type: "number", numeric: true, min: 0, max: 60, step: 0.5 },
      { key: "accrualPerMonth", label: "Accrual per month", type: "number", numeric: true, min: 0, max: 5, step: 0.5 },
    ],
    rows: ds.leaveTypes.map<MasterRow>((l) => {
      const n = leaveByType.get(l.id) ?? 0;
      return {
        id: l.id,
        active: true,
        refCount: n,
        refLabel: sentence([{ n, noun: "leave requests" }]),
        values: {
          code: l.code,
          name: l.name,
          annualEntitlement: l.annualEntitlement,
          accrualPerMonth: l.accrualPerMonth,
        },
      };
    }),
  });

  return { sets, series };
}

/* --------------------------------------------------------------- copy */

const CATEGORY_NOTE: Record<ItemCategory, string> = {
  MACHINE: "Serialised on sale; creates an installed asset and a warranty clock",
  SPARE: "Consumed against a job card; stock-out drives the first-time-fix rate",
  CONSUMABLE: "Issued in bulk; carried on the reorder list by cover days",
  ACCESSORY: "Sold with a machine or standalone; not serialised",
  PIPE_FITTING: "Project material; issued against a BOQ line",
  SERVICE: "Non-stock; carries a SAC rather than an HSN",
};

const PRINCIPAL_PORTAL: Record<OEMPrincipal, string> = {
  ELGI: "ELGi channel portal — commissioning and warranty claims",
  ATS_ELGI: "ATS-ELGi channel portal — garage equipment",
  KSB: "KSB partner portal — pumps",
  ION_EXCHANGE: "Ion Exchange partner desk — water treatment",
  OTHER: "No principal portal; handled by e-mail",
};

const UOM_NAME: Record<string, string> = {
  Nos: "Numbers — discrete units",
  Set: "Set — matched group supplied together",
  Can: "Can — sealed container, typically 20 litres",
  Kg: "Kilogram",
  Mtr: "Metre",
  Ltr: "Litre",
  Job: "Job — a whole piece of work, priced as one",
};

const HSN_DESC: Record<string, string> = {
  "8414": "Air or vacuum pumps, air compressors and fans",
  "8419": "Machinery for treatment of materials by change of temperature — dryers, coolers",
  "8421": "Filtering or purifying machinery and parts",
  "8413": "Pumps for liquids; liquid elevators",
  "8424": "Mechanical appliances for projecting or spraying liquids",
  "8425": "Pulley tackle and hoists; jacks and lifting equipment",
  "8467": "Tools for working in the hand, pneumatic",
  "8481": "Taps, cocks, valves and similar appliances",
  "8482": "Ball or roller bearings",
  "8484": "Gaskets and mechanical seals",
  "8412": "Other engines and motors, including hydraulic cylinders",
  "8409": "Parts suitable for use with internal combustion engines",
  "8537": "Boards, panels and consoles for electric control",
  "9026": "Instruments for measuring or checking flow, level and pressure",
  "9032": "Automatic regulating or controlling instruments",
  "4010": "Conveyor or transmission belts of vulcanised rubber",
  "4009": "Tubes, pipes and hoses of vulcanised rubber",
  "3917": "Tubes, pipes and hoses of plastics — PPR distribution",
  "3914": "Ion exchangers based on polymers",
  "2710": "Petroleum oils — compressor lubricants",
  "2903": "Halogenated derivatives of hydrocarbons — refrigerant charge",
  "9987": "SAC — maintenance, repair and installation services",
};

const GST_NOTE: Record<string, string> = {
  "0": "Exempt and nil-rated supplies; export under LUT is zero-rated separately",
  "5": "Specified goods and job work",
  "12": "Specified machinery parts",
  "18": "Compressors, pumps, allied equipment and maintenance services — the working slab here",
  "28": "Not used by this catalogue",
};

const REORDER_COVER: Record<ItemCategory, number> = {
  MACHINE: 0,
  SPARE: 45,
  CONSUMABLE: 30,
  ACCESSORY: 30,
  PIPE_FITTING: 21,
  SERVICE: 0,
};

const SEVERITY_TEST: Record<TicketSeverity, string> = {
  CRITICAL: "Plant is stopped or a safety risk exists",
  HIGH: "Production is degraded or a redundant unit has failed",
  NORMAL: "Fault present, production continuing",
  LOW: "Cosmetic, advisory or scheduled work",
};
