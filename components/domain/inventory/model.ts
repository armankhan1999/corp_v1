"use client";

/**
 * E7 — the inventory view model.
 *
 * Folds the mutation overlay over the immutable seed and precomputes the index
 * structures every inventory screen needs. Two rules govern this file:
 *
 *  1. Balances are never stored. `onHandAt` is built by walking the ledger in
 *     one pass, so a displayed balance is by construction the sum of movements
 *     for that item and location (E7-S2, FR-M6-05).
 *  2. Aggregates that `/lib/derive` already owns are taken from there
 *     (AR-1/AR-2). `D.stockValue`, `D.nonMovingItems` and `D.stockOutIncidencePct`
 *     are called against the merged dataset rather than reimplemented; the maps
 *     below exist only to make per-row lookups O(1) inside a 1,240-row list.
 */

import { useMemo } from "react";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import type { ItemCategory, OEMPrincipal } from "@/lib/schemas/enums";
import {
  DEFAULT_TRAILING_DAYS,
  useActor,
  useOverlay,
  type Actor,
  type CriticalFlag,
  type InvAudit,
  type InvNotice,
  type Overlay,
} from "./store";

const DAY = 86_400_000;

export type StockState = "IN_STOCK" | "BELOW_REORDER" | "OUT_OF_STOCK" | "NON_MOVING";

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  IN_STOCK: "In stock",
  BELOW_REORDER: "Below reorder",
  OUT_OF_STOCK: "Out of stock",
  NON_MOVING: "Non-moving",
};

export const LOCATION_KIND_LABEL: Record<T.StockLocation["kind"], string> = {
  CENTRAL_WAREHOUSE: "Central warehouse",
  BRANCH: "Branch store",
  ENGINEER_BOOT: "Engineer boot stock",
  PROJECT_SITE: "Project site",
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  MACHINE: "Machine",
  SPARE: "Spare",
  CONSUMABLE: "Consumable",
  ACCESSORY: "Accessory",
  PIPE_FITTING: "Pipe & fitting",
  SERVICE: "Service",
};

export const MOVEMENT_TYPE_LABEL: Record<T.StockMovement["type"], string> = {
  RECEIPT: "Receipt",
  ISSUE: "Issue",
  RETURN: "Return",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
  SCRAP: "Scrap",
};

export interface IssueEvent {
  at: number;
  qty: number;
}

/** A shortage that stopped a repair — the VA-08 link. */
export interface CriticalLink {
  itemId: string;
  jobCardId: string | null;
  jobCardNumber: string;
  ticketId: string | null;
  ticketNumber: string | null;
  open: boolean;
  shortfall: number;
  reason: string;
  at: string;
}

export interface InvView {
  /** Merged dataset — a new object; the seed is never mutated. */
  ds: Dataset;
  seed: Dataset;
  ctx: D.DeriveCtx;
  today: Date;
  overlay: Overlay;

  items: T.Item[];
  itemById: Map<string, T.Item>;
  locations: T.StockLocation[];
  locationById: Map<string, T.StockLocation>;

  movements: T.StockMovement[];
  movesByItem: Map<string, T.StockMovement[]>;
  maxSeq: number;

  onHand: Map<string, number>;
  onHandAt: Map<string, number>;
  reserved: Map<string, number>;
  reservedAt: Map<string, number>;
  lastMovementAt: Map<string, number>;
  lastIssueAt: Map<string, number>;
  issueEvents: Map<string, IssueEvent[]>;
  lastPurchase: Map<string, { rate: number; at: number; supplierId: string }>;
  preferredSupplier: Map<string, string>;

  partsRequests: T.PartsRequest[];
  purchaseOrders: T.PurchaseOrder[];
  poLines: T.POLine[];
  poLinesByPo: Map<string, T.POLine[]>;
  goodsReceipts: T.GoodsReceipt[];
  suppliers: T.Supplier[];
  supplierById: Map<string, T.Supplier>;
  stockCounts: T.StockCount[];

  criticalByItem: Map<string, CriticalLink>;
  audit: InvAudit[];
  notices: InvNotice[];

  jobCardById: Map<string, T.JobCard>;
  ticketById: Map<string, T.ServiceTicket>;
  projectById: Map<string, T.Project>;
  boqLineById: Map<string, T.BOQLine>;
  userById: Map<string, T.User>;
  employeeById: Map<string, T.Employee>;

  totalStockValue: number;
}

/* ------------------------------------------------------------ view builder */

let cache: { revision: number; view: InvView } | null = null;

export function buildView(overlay: Overlay, revision: number): InvView {
  if (cache && cache.revision === revision) return cache.view;

  const seed = getDataset();

  /* ------------------------------------------------------------ items */
  const items: T.Item[] = seed.items.map((i) => {
    const patch = overlay.itemPatches[i.id];
    return patch ? { ...i, ...patch } : i;
  });
  for (const created of overlay.newItems) {
    const patch = overlay.itemPatches[created.id];
    items.push(patch ? { ...created, ...patch } : created);
  }
  const itemById = new Map(items.map((i) => [i.id, i]));

  /* -------------------------------------------------------- locations */
  const locations = [...seed.stockLocations, ...overlay.newLocations];
  const locationById = new Map(locations.map((l) => [l.id, l]));

  /* ---------------------------------------------------------- ledger */
  const movements = [...seed.stockMovements, ...overlay.movements].sort((a, b) => a.seq - b.seq);
  const maxSeq = movements.length ? movements[movements.length - 1]!.seq : 0;

  const movesByItem = new Map<string, T.StockMovement[]>();
  const onHand = new Map<string, number>();
  const onHandAt = new Map<string, number>();
  const lastMovementAt = new Map<string, number>();
  const lastIssueAt = new Map<string, number>();
  const issueEvents = new Map<string, IssueEvent[]>();

  for (const m of movements) {
    let bucket = movesByItem.get(m.itemId);
    if (!bucket) {
      bucket = [];
      movesByItem.set(m.itemId, bucket);
    }
    bucket.push(m);

    const delta = (m.toLocationId ? m.qty : 0) - (m.fromLocationId ? m.qty : 0);
    onHand.set(m.itemId, (onHand.get(m.itemId) ?? 0) + delta);
    if (m.toLocationId) {
      const k = `${m.itemId}|${m.toLocationId}`;
      onHandAt.set(k, (onHandAt.get(k) ?? 0) + m.qty);
    }
    if (m.fromLocationId) {
      const k = `${m.itemId}|${m.fromLocationId}`;
      onHandAt.set(k, (onHandAt.get(k) ?? 0) - m.qty);
    }

    const t = new Date(m.at).getTime();
    if ((lastMovementAt.get(m.itemId) ?? 0) < t) lastMovementAt.set(m.itemId, t);
    if (m.type === "ISSUE") {
      if ((lastIssueAt.get(m.itemId) ?? 0) < t) lastIssueAt.set(m.itemId, t);
      let ev = issueEvents.get(m.itemId);
      if (!ev) {
        ev = [];
        issueEvents.set(m.itemId, ev);
      }
      ev.push({ at: t, qty: m.qty });
    }
  }

  /* ---------------------------------------------------- reservations */
  const reserved = new Map<string, number>();
  const reservedAt = new Map<string, number>();
  for (const r of seed.stockReservations) {
    reserved.set(r.itemId, (reserved.get(r.itemId) ?? 0) + r.qty);
    const k = `${r.itemId}|${r.locationId}`;
    reservedAt.set(k, (reservedAt.get(k) ?? 0) + r.qty);
  }

  /* ------------------------------------------------- purchase records */
  const suppliers = [...seed.suppliers.map((s) => {
    const patch = overlay.supplierPatches[s.id];
    return patch ? { ...s, ...patch } : s;
  }), ...overlay.newSuppliers];
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const purchaseOrders = [...seed.purchaseOrders.map((p) => {
    const patch = overlay.poPatches[p.id];
    return patch ? { ...p, ...patch } : p;
  }), ...overlay.newPOs.map((p) => {
    const patch = overlay.poPatches[p.id];
    return patch ? { ...p, ...patch } : p;
  })];

  const poLines = [...seed.poLines, ...overlay.newPOLines].map((l) => {
    const patch = overlay.poLinePatches[l.id];
    return patch ? { ...l, ...patch } : l;
  });
  const poLinesByPo = new Map<string, T.POLine[]>();
  for (const l of poLines) {
    let bucket = poLinesByPo.get(l.purchaseOrderId);
    if (!bucket) {
      bucket = [];
      poLinesByPo.set(l.purchaseOrderId, bucket);
    }
    bucket.push(l);
  }

  const poById = new Map(purchaseOrders.map((p) => [p.id, p]));
  const lastPurchase = new Map<string, { rate: number; at: number; supplierId: string }>();
  const supplierHits = new Map<string, Map<string, number>>();
  for (const l of poLines) {
    const po = poById.get(l.purchaseOrderId);
    if (!po) continue;
    const at = new Date(po.orderDate).getTime();
    const cur = lastPurchase.get(l.itemId);
    if (!cur || cur.at < at) lastPurchase.set(l.itemId, { rate: l.rate, at, supplierId: po.supplierId });
    let hits = supplierHits.get(l.itemId);
    if (!hits) {
      hits = new Map();
      supplierHits.set(l.itemId, hits);
    }
    hits.set(po.supplierId, (hits.get(po.supplierId) ?? 0) + 1);
  }

  /** Preferred supplier: most-used for the line, else the first supplying that category. */
  const byCategory = new Map<ItemCategory, T.Supplier[]>();
  for (const s of suppliers) {
    for (const c of s.categories) {
      let bucket = byCategory.get(c);
      if (!bucket) {
        bucket = [];
        byCategory.set(c, bucket);
      }
      bucket.push(s);
    }
  }
  const preferredSupplier = new Map<string, string>();
  for (const item of items) {
    const hits = supplierHits.get(item.id);
    if (hits && hits.size) {
      let best = "";
      let bestN = -1;
      for (const [sid, n] of hits) {
        if (n > bestN || (n === bestN && sid < best)) {
          best = sid;
          bestN = n;
        }
      }
      preferredSupplier.set(item.id, best);
      continue;
    }
    const pool = byCategory.get(item.category);
    if (pool && pool.length) {
      // Deterministic, not random: a stable hash of the item code picks the line.
      let h = 0;
      for (let i = 0; i < item.code.length; i++) h = (h * 31 + item.code.charCodeAt(i)) >>> 0;
      preferredSupplier.set(item.id, pool[h % pool.length]!.id);
    }
  }

  /* --------------------------------------------------- parts requests */
  const partsRequests = [...seed.partsRequests, ...overlay.newRequests].map((r) => {
    const patch = overlay.requestPatches[r.id];
    return patch ? { ...r, ...patch } : r;
  });

  /* ------------------------------------------------- index by entity */
  const jobCardById = new Map(seed.jobCards.map((j) => [j.id, j]));
  const ticketById = new Map(seed.tickets.map((t) => [t.id, t]));
  const projectById = new Map(seed.projects.map((p) => [p.id, p]));
  const boqLineById = new Map(seed.boqLines.map((b) => [b.id, b]));
  const userById = new Map(seed.users.map((u) => [u.id, u]));
  const employeeById = new Map(seed.employees.map((e) => [e.id, e]));

  /* --------------------------- E7-S5 / VA-08: service-critical links */
  const criticalByItem = new Map<string, CriticalLink>();
  const registerCritical = (link: CriticalLink) => {
    const existing = criticalByItem.get(link.itemId);
    if (!existing || (!existing.open && link.open) ||
      (existing.open === link.open && new Date(link.at) > new Date(existing.at))) {
      criticalByItem.set(link.itemId, link);
    }
  };
  for (const r of partsRequests) {
    if (!r.serviceCritical || !r.jobCardId) continue;
    const jc = jobCardById.get(r.jobCardId);
    const ticket = jc ? ticketById.get(jc.ticketId) : undefined;
    const open = r.status === "PENDING" || r.status === "PARTIAL";
    for (const line of r.lines) {
      registerCritical({
        itemId: line.itemId,
        jobCardId: r.jobCardId,
        jobCardNumber: jc?.number ?? r.jobCardId,
        ticketId: ticket?.id ?? null,
        ticketNumber: ticket?.number ?? null,
        open,
        shortfall: Math.max(0, line.qtyRequested - line.qtyIssued),
        reason: open
          ? `Job card ${jc?.number ?? r.jobCardId} is awaiting this part`
          : `Shortage forced a return visit on job card ${jc?.number ?? r.jobCardId}`,
        at: r.issuedAt ?? r.raisedAt,
      });
    }
  }
  for (const f of overlay.criticalFlags) {
    registerCritical({
      itemId: f.itemId,
      jobCardId: f.jobCardId,
      jobCardNumber: f.jobCardNumber,
      ticketId: null,
      ticketNumber: null,
      open: true,
      shortfall: f.shortfall,
      reason: f.reason,
      at: f.at,
    });
  }

  /* --------------------------------------------- merged Dataset for D.* */
  const ds: Dataset = {
    ...seed,
    items,
    stockLocations: locations,
    stockMovements: movements,
    partsRequests,
    suppliers,
    purchaseOrders,
    poLines,
    goodsReceipts: [...seed.goodsReceipts, ...overlay.newGRNs],
    stockCounts: [...seed.stockCounts, ...overlay.stockCounts],
  };
  const ctx = D.ctxOf(ds);

  const view: InvView = {
    ds,
    seed,
    ctx,
    today: ctx.now,
    overlay,
    items,
    itemById,
    locations,
    locationById,
    movements,
    movesByItem,
    maxSeq,
    onHand,
    onHandAt,
    reserved,
    reservedAt,
    lastMovementAt,
    lastIssueAt,
    issueEvents,
    lastPurchase,
    preferredSupplier,
    partsRequests,
    purchaseOrders,
    poLines,
    poLinesByPo,
    goodsReceipts: ds.goodsReceipts,
    suppliers,
    supplierById,
    stockCounts: ds.stockCounts,
    criticalByItem,
    audit: overlay.audit,
    notices: overlay.notices,
    jobCardById,
    ticketById,
    projectById,
    boqLineById,
    userById,
    employeeById,
    /* AR-1 — the stock-value figure comes from /lib/derive, not from here. */
    totalStockValue: D.stockValue(ds),
  };

  cache = { revision, view };
  return view;
}

/* ------------------------------------------------------------- selectors */

export function onHandOf(view: InvView, itemId: string, locationId?: string | null): number {
  if (!locationId) return view.onHand.get(itemId) ?? 0;
  return view.onHandAt.get(`${itemId}|${locationId}`) ?? 0;
}

export function reservedOf(view: InvView, itemId: string, locationId?: string | null): number {
  if (!locationId) return view.reserved.get(itemId) ?? 0;
  return view.reservedAt.get(`${itemId}|${locationId}`) ?? 0;
}

export function availableOf(view: InvView, itemId: string, locationId?: string | null): number {
  return onHandOf(view, itemId, locationId) - reservedOf(view, itemId, locationId);
}

/** True when the line has any ledger history — i.e. the business carries it. */
export function isCarried(view: InvView, itemId: string): boolean {
  return view.movesByItem.has(itemId);
}

export function isBelowReorder(view: InvView, item: T.Item, locationId?: string | null): boolean {
  if (item.reorderLevel <= 0) return false;
  return onHandOf(view, item.id, locationId) <= item.reorderLevel;
}

export function isNonMoving(view: InvView, item: T.Item, trailingDays: number, locationId?: string | null): boolean {
  if (item.category === "SERVICE") return false;
  if (onHandOf(view, item.id, locationId) <= 0) return false;
  const last = view.lastIssueAt.get(item.id);
  if (!last) return true;
  return (view.today.getTime() - last) / DAY > trailingDays;
}

export function stockStateOf(
  view: InvView, item: T.Item, trailingDays: number, locationId?: string | null,
): StockState {
  const qty = onHandOf(view, item.id, locationId);
  if (qty <= 0) return "OUT_OF_STOCK";
  if (isBelowReorder(view, item, locationId)) return "BELOW_REORDER";
  if (isNonMoving(view, item, trailingDays, locationId)) return "NON_MOVING";
  return "IN_STOCK";
}

export function matchesState(
  view: InvView, item: T.Item, state: StockState, trailingDays: number, locationId?: string | null,
): boolean {
  const qty = onHandOf(view, item.id, locationId);
  switch (state) {
    case "IN_STOCK":
      return qty > 0;
    case "OUT_OF_STOCK":
      return qty <= 0;
    case "BELOW_REORDER":
      return isBelowReorder(view, item, locationId);
    case "NON_MOVING":
      return isNonMoving(view, item, trailingDays, locationId);
  }
}

/**
 * E7-S5 — movement velocity. Issue frequency over the trailing period,
 * normalised to issues per 30 days so the number reads the same whichever
 * window the store keeper selects.
 */
export function velocityOf(view: InvView, itemId: string, trailingDays: number): { score: number; issues: number; qty: number } {
  const events = view.issueEvents.get(itemId);
  if (!events) return { score: 0, issues: 0, qty: 0 };
  const cutoff = view.today.getTime() - trailingDays * DAY;
  let issues = 0;
  let qty = 0;
  for (const e of events) {
    if (e.at < cutoff) continue;
    issues += 1;
    qty += e.qty;
  }
  return { score: Math.round((issues / (trailingDays / 30)) * 100) / 100, issues, qty };
}

export interface NonMovingRow {
  item: T.Item;
  qty: number;
  value: number;
  lastMovementAt: number | null;
  lastIssueAt: number | null;
  locations: { locationId: string; qty: number }[];
}

/**
 * E7-S6. Membership and value come from `D.nonMovingItems` so the report and
 * the KPI engine can never disagree; the per-row location split is added here.
 */
export function nonMovingRows(view: InvView, trailingDays: number): NonMovingRow[] {
  return D.nonMovingItems(view.ctx, trailingDays).map(({ item, qty, value }) => ({
    item,
    qty,
    value,
    lastMovementAt: view.lastMovementAt.get(item.id) ?? null,
    lastIssueAt: view.lastIssueAt.get(item.id) ?? null,
    locations: view.locations
      .map((l) => ({ locationId: l.id, qty: view.onHandAt.get(`${item.id}|${l.id}`) ?? 0 }))
      .filter((x) => x.qty !== 0),
  }));
}

export interface ReorderRow {
  item: T.Item;
  onHand: number;
  reorderLevel: number;
  suggestedQty: number;
  leadTimeDays: number;
  lastPurchaseRate: number | null;
  lastPurchaseAt: number | null;
  supplierId: string | null;
  velocity: number;
  issues: number;
  critical: CriticalLink | null;
  value: number;
}

/**
 * E7-S5 — every carried line at or below its reorder level. Service-critical
 * lines sort above everything ranked only by velocity.
 */
export function reorderRows(view: InvView, trailingDays: number): ReorderRow[] {
  const rows: ReorderRow[] = [];
  for (const item of view.items) {
    if (item.category === "SERVICE" || !item.active) continue;
    if (item.reorderLevel <= 0) continue;
    if (!isCarried(view, item.id)) continue;
    const onHand = view.onHand.get(item.id) ?? 0;
    if (onHand > item.reorderLevel) continue;
    const v = velocityOf(view, item.id, trailingDays);
    const purchase = view.lastPurchase.get(item.id) ?? null;
    const suggestedQty = Math.max(item.reorderQty, Math.max(0, item.reorderLevel - onHand));
    rows.push({
      item,
      onHand,
      reorderLevel: item.reorderLevel,
      suggestedQty,
      leadTimeDays: item.leadTimeDays,
      lastPurchaseRate: purchase?.rate ?? null,
      lastPurchaseAt: purchase?.at ?? null,
      supplierId: view.preferredSupplier.get(item.id) ?? null,
      velocity: v.score,
      issues: v.issues,
      critical: view.criticalByItem.get(item.id) ?? null,
      value: suggestedQty * (purchase?.rate ?? item.standardCost),
    });
  }
  return sortReorder(rows);
}

export function sortReorder(rows: ReorderRow[]): ReorderRow[] {
  return [...rows].sort((a, b) => {
    const ac = a.critical ? (a.critical.open ? 2 : 1) : 0;
    const bc = b.critical ? (b.critical.open ? 2 : 1) : 0;
    if (ac !== bc) return bc - ac;
    if (b.velocity !== a.velocity) return b.velocity - a.velocity;
    if (b.issues !== a.issues) return b.issues - a.issues;
    return a.item.code.localeCompare(b.item.code);
  });
}

/* ------------------------------------------------- E7-S1 reference counts */

export interface ReferenceCount {
  label: string;
  count: number;
  href: string | null;
}

/** Deletion is blocked while any of these are non-zero (E7-S1). */
export function referencesTo(view: InvView, itemId: string): ReferenceCount[] {
  const s = view.seed;
  const counts: ReferenceCount[] = [
    { label: "Stock ledger movements", count: view.movesByItem.get(itemId)?.length ?? 0, href: `/inventory/stock/${itemId}` },
    { label: "Quotation lines", count: s.quotationLines.filter((l) => l.itemId === itemId).length, href: "/sales/quotations" },
    { label: "Sales order lines", count: s.salesOrderLines.filter((l) => l.itemId === itemId).length, href: "/sales/orders" },
    { label: "Job-card parts consumed", count: s.partConsumptions.filter((l) => l.itemId === itemId).length, href: "/service/job-cards" },
    { label: "Project BOQ lines", count: s.boqLines.filter((l) => l.itemId === itemId).length, href: "/projects" },
    { label: "Purchase order lines", count: view.poLines.filter((l) => l.itemId === itemId).length, href: "/inventory/purchase" },
    { label: "Parts requests", count: view.partsRequests.filter((r) => r.lines.some((l) => l.itemId === itemId)).length, href: "/inventory/movements" },
    { label: "Goods receipt lines", count: view.goodsReceipts.filter((g) => g.lines.some((l) => l.itemId === itemId)).length, href: "/inventory/purchase" },
    { label: "Invoice lines", count: s.invoiceLines.filter((l) => l.itemId === itemId).length, href: "/commercial/invoices" },
    { label: "Delivery challan lines", count: s.challans.filter((c) => c.lines.some((l) => l.itemId === itemId)).length, href: "/commercial/challans" },
    { label: "Installed assets", count: s.assets.filter((a) => a.itemId === itemId).length, href: "/service/assets" },
    { label: "Rental fleet units", count: s.rentalAssets.filter((a) => a.itemId === itemId).length, href: "/service/rental" },
    { label: "Price list entries", count: s.priceList.filter((p) => p.itemId === itemId).length, href: "/admin/masters" },
    { label: "Stock count lines", count: view.stockCounts.filter((c) => c.lines.some((l) => l.itemId === itemId)).length, href: "/inventory/stock/count" },
  ];
  return counts.filter((c) => c.count > 0);
}

export function totalReferences(refs: ReferenceCount[]): number {
  return refs.reduce((s, r) => s + r.count, 0);
}

/* --------------------------------------------------------- source linking */

/** E7-S2 — every movement's source document must be a working link. */
export function sourceHref(view: InvView, m: T.StockMovement): string | null {
  switch (m.sourceType) {
    case "JOB_CARD":
      return m.sourceId ? `/service/job-cards/${m.sourceId}` : "/service/job-cards";
    case "PROJECT":
      return m.sourceId ? `/projects/${m.sourceId}` : "/projects";
    case "PURCHASE_ORDER":
      return m.sourceId ? `/inventory/purchase/${m.sourceId}` : "/inventory/purchase";
    case "SALES_ORDER":
      return m.sourceId ? `/sales/orders/${m.sourceId}` : "/sales/orders";
    case "ADJUSTMENT":
      return m.sourceId ? `/inventory/stock/count?count=${m.sourceId}` : "/inventory/stock/count";
    case "TRANSFER":
    case "SCRAP":
    case "RETURN":
      return `/inventory/stock/${m.itemId}`;
    case "OPENING":
    default:
      return null;
  }
}

export const SOURCE_TYPE_LABEL: Record<T.StockMovement["sourceType"], string> = {
  JOB_CARD: "Job card",
  PROJECT: "Project",
  PURCHASE_ORDER: "Purchase order",
  OPENING: "Opening stock",
  TRANSFER: "Stock transfer",
  ADJUSTMENT: "Stock adjustment",
  SCRAP: "Scrap note",
  RETURN: "Return note",
  SALES_ORDER: "Sales order",
};

/* --------------------------------------------------------- PO derivations */

export function poValue(view: InvView, poId: string): number {
  return (view.poLinesByPo.get(poId) ?? []).reduce((s, l) => s + l.qty * l.rate, 0);
}

export function poReceiptState(view: InvView, poId: string): { ordered: number; received: number; pending: number; excess: boolean } {
  const lines = view.poLinesByPo.get(poId) ?? [];
  const ordered = lines.reduce((s, l) => s + l.qty, 0);
  const received = lines.reduce((s, l) => s + l.qtyReceived, 0);
  return {
    ordered,
    received,
    pending: Math.max(0, ordered - received),
    excess: lines.some((l) => l.qtyReceived > l.qty),
  };
}

/* --------------------------------------------------------- search helpers */

/** E7-S1 / FR-M6-15 — code, description and OEM part number are all searchable. */
export function matchesQuery(item: T.Item, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.code.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    item.oemPartNumber.toLowerCase().includes(q)
  );
}

export interface ItemFilters {
  query: string;
  categories: ItemCategory[];
  principals: OEMPrincipal[];
  status: "ALL" | "ACTIVE" | "INACTIVE";
}

export function filterItems(items: T.Item[], f: ItemFilters): T.Item[] {
  return items.filter((i) => {
    if (!matchesQuery(i, f.query)) return false;
    if (f.categories.length && !f.categories.includes(i.category)) return false;
    if (f.principals.length && !f.principals.includes(i.principal)) return false;
    if (f.status === "ACTIVE" && !i.active) return false;
    if (f.status === "INACTIVE" && i.active) return false;
    return true;
  });
}

export function describeFilters(f: ItemFilters, extra: string[] = []): string[] {
  const active: string[] = [];
  if (f.query.trim()) active.push(`search "${f.query.trim()}"`);
  if (f.categories.length) active.push(`category ${f.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}`);
  if (f.principals.length) active.push(`principal ${f.principals.join(", ")}`);
  if (f.status !== "ALL") active.push(f.status === "ACTIVE" ? "status Active" : "status Inactive");
  return [...active, ...extra];
}

/* ------------------------------------------------------------------ hooks */

export interface InventoryContext {
  view: InvView | null;
  ready: boolean;
  actor: Actor;
  trailingDefault: number;
}

export function useInventory(): InventoryContext {
  const { overlay, revision, ready } = useOverlay();
  const actor = useActor();
  const view = useMemo(
    () => (ready ? buildView(overlay, revision) : null),
    [overlay, revision, ready],
  );
  return { view, ready, actor, trailingDefault: DEFAULT_TRAILING_DAYS };
}

export type { CriticalFlag };
