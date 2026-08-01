"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getDataset } from "@/lib/seed";
import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import type { QuotationStatus, Role } from "@/lib/schemas/enums";
import { STORAGE_NAMESPACE } from "@/lib/rbac/session";
import {
  baselineActivities, checkTransition, derivePlaceOfSupply, discountGate,
  effectiveStatus, groupBy, labelRole, priceListRate, quotationTotals,
  type TransitionCheck,
} from "./calc";

/**
 * E3 mutation layer. This is a frontend prototype: every change the user makes
 * is held as a patch over the seeded dataset and mirrored into localStorage
 * under the pravaah.v1 namespace (AR-5, versioned and schema-guarded). The seed
 * object itself is never mutated — reload with the overlay cleared and the
 * world is byte-identical to the generated baseline.
 */

export const OVERLAY_KEY = `${STORAGE_NAMESPACE}.sales.overlay`;
export const OVERLAY_VERSION = 1;

/* ------------------------------------------------------------- overlay */

interface Patch<V> {
  created: V[];
  updated: Record<string, Partial<V>>;
}

const emptyPatch = <V,>(): Patch<V> => ({ created: [], updated: {} });

export interface SavedView {
  id: string;
  name: string;
  surface: "enquiries";
  filters: Record<string, string>;
  createdAt: string;
}

export interface SalesAuditEntry {
  id: string;
  seq: number;
  at: string;
  actorUserId: string;
  actorName: string;
  actorRole: Role;
  action:
  | "CREATE" | "UPDATE" | "STATE_TRANSITION" | "APPROVE" | "REJECT" | "EXPORT" | "SYSTEM";
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
}

interface Overlay {
  v: number;
  seq: number;
  customers: Patch<T.Customer>;
  sites: Patch<T.Site>;
  contacts: Patch<T.Contact>;
  enquiries: Patch<T.Enquiry>;
  quotations: Patch<T.Quotation>;
  quotationLines: Patch<T.QuotationLine>;
  salesOrders: Patch<T.SalesOrder>;
  salesOrderLines: Patch<T.SalesOrderLine>;
  activities: Patch<T.Activity>;
  approvals: Patch<T.ApprovalRequest>;
  approvalDecisions: Patch<T.ApprovalDecision>;
  /** Lines added with no price-list entry — rate is blank, never zero. */
  pendingRateLineIds: string[];
  savedViews: SavedView[];
  audit: SalesAuditEntry[];
}

function freshOverlay(): Overlay {
  return {
    v: OVERLAY_VERSION,
    seq: 0,
    customers: emptyPatch(), sites: emptyPatch(), contacts: emptyPatch(),
    enquiries: emptyPatch(), quotations: emptyPatch(), quotationLines: emptyPatch(),
    salesOrders: emptyPatch(), salesOrderLines: emptyPatch(),
    activities: emptyPatch(), approvals: emptyPatch(), approvalDecisions: emptyPatch(),
    pendingRateLineIds: [], savedViews: [], audit: [],
  };
}

function readOverlay(): Overlay {
  if (typeof window === "undefined") return freshOverlay();
  try {
    const raw = window.localStorage.getItem(OVERLAY_KEY);
    if (!raw) return freshOverlay();
    const parsed = JSON.parse(raw) as Overlay;
    // AR-5 — a version mismatch resets cleanly rather than corrupting the view.
    if (!parsed || parsed.v !== OVERLAY_VERSION) return freshOverlay();
    return { ...freshOverlay(), ...parsed };
  } catch {
    return freshOverlay();
  }
}

function writeOverlay(o: Overlay) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(o));
  } catch {
    /* quota or private mode — the in-memory overlay still holds for this session */
  }
}

/* ------------------------------------------------------------- the world */

export interface SalesWorld {
  ds: Dataset;
  now: Date;
  customers: T.Customer[];
  sites: T.Site[];
  contacts: T.Contact[];
  enquiries: T.Enquiry[];
  quotations: T.Quotation[];
  quotationLines: T.QuotationLine[];
  salesOrders: T.SalesOrder[];
  salesOrderLines: T.SalesOrderLine[];
  activities: T.Activity[];
  approvals: T.ApprovalRequest[];
  approvalDecisions: T.ApprovalDecision[];
  pendingRateLineIds: Set<string>;
  savedViews: SavedView[];
  audit: SalesAuditEntry[];

  customerById: Map<string, T.Customer>;
  siteById: Map<string, T.Site>;
  contactsByCustomer: Map<string, T.Contact[]>;
  sitesByCustomer: Map<string, T.Site[]>;
  userById: Map<string, T.User>;
  branchById: Map<string, T.Branch>;
  itemById: Map<string, T.Item>;
  enquiryById: Map<string, T.Enquiry>;
  quotationById: Map<string, T.Quotation>;
  linesByQuotation: Map<string, T.QuotationLine[]>;
  quotationsByRoot: Map<string, T.Quotation[]>;
  orderByQuotation: Map<string, T.SalesOrder>;
  orderLinesByOrder: Map<string, T.SalesOrderLine[]>;
}

function merge<V extends { id: string }>(base: readonly V[], p: Patch<V>): V[] {
  const out: V[] = base.map((x) => (p.updated[x.id] ? { ...x, ...p.updated[x.id] } : x));
  for (const c of p.created) out.push(p.updated[c.id] ? { ...c, ...p.updated[c.id] } : c);
  return out;
}

function buildWorld(ds: Dataset, o: Overlay): SalesWorld {
  const now = new Date(ds.meta.today);
  const customers = merge(ds.customers, o.customers);
  const sites = merge(ds.sites, o.sites);
  const contacts = merge(ds.contacts, o.contacts);
  const enquiries = merge(ds.enquiries, o.enquiries);
  const quotations = merge(ds.quotations, o.quotations);
  const quotationLines = merge(ds.quotationLines, o.quotationLines);
  const salesOrders = merge(ds.salesOrders, o.salesOrders);
  const salesOrderLines = merge(ds.salesOrderLines, o.salesOrderLines);
  const activities = merge(
    [...ds.activities, ...baselineActivities(ds.enquiries, ds.quotations, now)],
    o.activities,
  );
  const approvals = merge(ds.approvalRequests, o.approvals);
  const approvalDecisions = merge(ds.approvalDecisions, o.approvalDecisions);

  const quotationsByRoot = groupBy(quotations, (q) => q.rootId);
  for (const list of quotationsByRoot.values()) list.sort((a, b) => a.version - b.version);

  return {
    ds, now,
    customers, sites, contacts, enquiries, quotations, quotationLines,
    salesOrders, salesOrderLines, activities, approvals, approvalDecisions,
    pendingRateLineIds: new Set(o.pendingRateLineIds),
    savedViews: o.savedViews, audit: o.audit,
    customerById: new Map(customers.map((c) => [c.id, c])),
    siteById: new Map(sites.map((s) => [s.id, s])),
    contactsByCustomer: groupBy(contacts, (c) => c.customerId),
    sitesByCustomer: groupBy(sites, (s) => s.customerId),
    userById: new Map(ds.users.map((u) => [u.id, u])),
    branchById: new Map(ds.branches.map((b) => [b.id, b])),
    itemById: new Map(ds.items.map((i) => [i.id, i])),
    enquiryById: new Map(enquiries.map((e) => [e.id, e])),
    quotationById: new Map(quotations.map((q) => [q.id, q])),
    linesByQuotation: groupBy(quotationLines, (l) => l.quotationId),
    quotationsByRoot,
    orderByQuotation: new Map(salesOrders.map((o2) => [o2.quotationId, o2])),
    orderLinesByOrder: groupBy(salesOrderLines, (l) => l.salesOrderId),
  };
}

/* -------------------------------------------------------- external store */

export type StoreState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; world: SalesWorld };

const LOADING: StoreState = { status: "loading" };

let overlay: Overlay = freshOverlay();
let state: StoreState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function rebuild() {
  if (state.status !== "ready") return;
  state = { status: "ready", world: buildWorld(state.world.ds, overlay) };
  emit();
}

function commit(next: Overlay) {
  overlay = next;
  writeOverlay(overlay);
  rebuild();
}

export function ensureLoaded() {
  if (started) return;
  started = true;
  overlay = readOverlay();
  // Deferred a frame so the skeleton paints before the generator runs.
  const run = () => {
    try {
      const ds = getDataset();
      state = { status: "ready", world: buildWorld(ds, overlay) };
    } catch (err) {
      state = { status: "error", message: err instanceof Error ? err.message : "The seeded dataset could not be built." };
    }
    emit();
  };
  if (typeof window === "undefined") run();
  else window.setTimeout(run, 0);
}

export function retryLoad() {
  started = false;
  state = LOADING;
  emit();
  ensureLoaded();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => LOADING;

export function useSalesStore(): StoreState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    ensureLoaded();
  }, []);
  return snap;
}

/** Reads the current world outside render. Throws only if called before load. */
function world(): SalesWorld {
  if (state.status !== "ready") throw new Error("Sales data is still loading.");
  return state.world;
}

export function resetSalesOverlay() {
  commit(freshOverlay());
}

export function overlayCount(): number {
  return (
    overlay.customers.created.length + Object.keys(overlay.customers.updated).length +
    overlay.sites.created.length + Object.keys(overlay.sites.updated).length +
    overlay.contacts.created.length + Object.keys(overlay.contacts.updated).length +
    overlay.enquiries.created.length + Object.keys(overlay.enquiries.updated).length +
    overlay.quotations.created.length + Object.keys(overlay.quotations.updated).length +
    overlay.quotationLines.created.length + Object.keys(overlay.quotationLines.updated).length +
    overlay.salesOrders.created.length + Object.keys(overlay.salesOrders.updated).length +
    overlay.activities.created.length
  );
}

/* ------------------------------------------------------------- plumbing */

export interface Actor {
  userId: string;
  name: string;
  role: Role;
}

function withAudit(
  o: Overlay, actor: Actor, entry: Omit<SalesAuditEntry, "id" | "seq" | "at" | "actorUserId" | "actorName" | "actorRole">,
): Overlay {
  const seq = o.seq + 1;
  return {
    ...o,
    seq,
    audit: [
      {
        id: `SAU-${String(seq).padStart(5, "0")}`, seq,
        at: new Date(world().now.getTime()).toISOString(),
        actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
        ...entry,
      },
      ...o.audit,
    ].slice(0, 400),
  };
}

function put<V extends { id: string }>(p: Patch<V>, value: V): Patch<V> {
  return { created: [...p.created, value], updated: p.updated };
}

function patch<V extends { id: string }>(p: Patch<V>, id: string, delta: Partial<V>): Patch<V> {
  return { created: p.created, updated: { ...p.updated, [id]: { ...p.updated[id], ...delta } } };
}

function nextNumber(existing: readonly string[], prefix: string, width = 4): string {
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    const v = m ? Number.parseInt(m[1]!, 10) : NaN;
    if (Number.isFinite(v) && v > max) max = v;
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

function nextId(existing: readonly { id: string }[], prefix: string, width: number): string {
  let max = 0;
  for (const e of existing) {
    if (!e.id.startsWith(prefix + "-")) continue;
    const v = Number.parseInt(e.id.slice(prefix.length + 1), 10);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

/* ------------------------------------------------------------ customers */

export interface CustomerDraft {
  legalName: string;
  tradeName: string;
  type: T.Customer["type"];
  gstin: string;
  pan: string;
  industry: string;
  creditTermDays: number;
  creditLimit: number;
  branchId: string;
  ownerUserId: string;
  country: string;
  active: boolean;
}

export function createCustomer(draft: CustomerDraft, actor: Actor): T.Customer {
  const w = world();
  const id = nextId(w.customers, "CUS", 3);
  const code = nextNumber(w.customers.map((c) => c.code), "C", 4);
  const customer: T.Customer = {
    id, code,
    legalName: draft.legalName.trim(),
    tradeName: (draft.tradeName || draft.legalName).trim(),
    type: draft.type,
    gstin: draft.gstin.trim() ? draft.gstin.trim().toUpperCase() : null,
    pan: draft.pan.trim() ? draft.pan.trim().toUpperCase() : null,
    industry: draft.industry,
    creditTermDays: draft.creditTermDays,
    creditLimit: draft.creditLimit,
    branchId: draft.branchId,
    ownerUserId: draft.ownerUserId,
    active: draft.active,
    country: draft.country,
    createdAt: w.now.toISOString(),
  };
  commit(
    withAudit({ ...overlay, customers: put(overlay.customers, customer) }, actor, {
      action: "CREATE", entityType: "Customer", entityId: id, entityLabel: customer.legalName,
      summary: `Customer ${code} created — ${customer.type.toLowerCase()}, ${customer.gstin ?? "no GSTIN"}, credit limit ${customer.creditLimit}.`,
    }),
  );
  return customer;
}

export function updateCustomer(id: string, delta: Partial<T.Customer>, actor: Actor) {
  const w = world();
  const before = w.customerById.get(id);
  commit(
    withAudit({ ...overlay, customers: patch(overlay.customers, id, delta) }, actor, {
      action: "UPDATE", entityType: "Customer", entityId: id,
      entityLabel: before?.legalName ?? id,
      summary: `Updated ${Object.keys(delta).join(", ")}.`,
    }),
  );
}

export interface SiteDraft {
  customerId: string;
  name: string;
  address: string;
  district: string;
  state: string;
  stateCode: string;
  pincode: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
}

export function createSite(draft: SiteDraft, actor: Actor): T.Site {
  const w = world();
  const id = nextId(w.sites, "SIT", 3);
  const site: T.Site = { id, ...draft, lat: 0, lng: 0 };
  commit(
    withAudit({ ...overlay, sites: put(overlay.sites, site) }, actor, {
      action: "CREATE", entityType: "Site", entityId: id, entityLabel: `${site.name} — ${site.district}`,
      summary: `Site added to ${w.customerById.get(draft.customerId)?.legalName ?? draft.customerId}.`,
    }),
  );
  return site;
}

export function updateSite(id: string, delta: Partial<T.Site>, actor: Actor) {
  commit(
    withAudit({ ...overlay, sites: patch(overlay.sites, id, delta) }, actor, {
      action: "UPDATE", entityType: "Site", entityId: id,
      entityLabel: world().siteById.get(id)?.name ?? id,
      summary: `Updated ${Object.keys(delta).join(", ")}.`,
    }),
  );
}

export interface ContactDraft {
  customerId: string;
  name: string;
  designation: string;
  mobile: string;
  email: string;
  preferredChannel: T.Contact["preferredChannel"];
  isPrimary: boolean;
}

export function createContact(draft: ContactDraft, actor: Actor): T.Contact {
  const w = world();
  const id = nextId(w.contacts, "CON", 4);
  const contact: T.Contact = { id, ...draft };
  let next: Overlay = { ...overlay, contacts: put(overlay.contacts, contact) };
  if (draft.isPrimary) {
    // Exactly one primary — E3-S1 AC-4.
    for (const c of w.contactsByCustomer.get(draft.customerId) ?? []) {
      if (c.isPrimary) next = { ...next, contacts: patch(next.contacts, c.id, { isPrimary: false }) };
    }
  }
  commit(
    withAudit(next, actor, {
      action: "CREATE", entityType: "Contact", entityId: id, entityLabel: contact.name,
      summary: `Contact added${draft.isPrimary ? " and marked primary" : ""} — ${contact.designation}.`,
    }),
  );
  return contact;
}

export function updateContact(id: string, delta: Partial<T.Contact>, actor: Actor) {
  const w = world();
  const existing = w.contacts.find((c) => c.id === id);
  let next: Overlay = { ...overlay, contacts: patch(overlay.contacts, id, delta) };
  if (delta.isPrimary && existing) {
    for (const c of w.contactsByCustomer.get(existing.customerId) ?? []) {
      if (c.id !== id && c.isPrimary) next = { ...next, contacts: patch(next.contacts, c.id, { isPrimary: false }) };
    }
  }
  commit(
    withAudit(next, actor, {
      action: "UPDATE", entityType: "Contact", entityId: id, entityLabel: existing?.name ?? id,
      summary: `Updated ${Object.keys(delta).join(", ")}.`,
    }),
  );
}

/* ------------------------------------------------------------ enquiries */

export interface EnquiryDraft {
  customerId: string;
  siteId: string | null;
  vertical: T.Enquiry["vertical"];
  source: T.Enquiry["source"];
  requirement: string;
  productLine: T.Enquiry["productLine"];
  paramCfm: number | null;
  paramBar: number | null;
  paramHeadM: number | null;
  paramFlowLpm: number | null;
  expectedValue: number;
  expectedClosure: string;
  ownerUserId: string | null;
}

export function createEnquiry(draft: EnquiryDraft, actor: Actor): T.Enquiry {
  const w = world();
  const id = nextId(w.enquiries, "ENQ", 4);
  const number = nextNumber(w.enquiries.map((e) => e.number), "BC/ENQ/2627/", 4);
  const customer = w.customerById.get(draft.customerId);
  const enquiry: T.Enquiry = {
    id, number,
    customerId: draft.customerId,
    siteId: draft.siteId,
    branchId: customer?.branchId ?? actor.userId,
    vertical: draft.vertical,
    source: draft.source,
    requirement: draft.requirement,
    productLine: draft.productLine,
    paramCfm: draft.paramCfm, paramBar: draft.paramBar,
    paramHeadM: draft.paramHeadM, paramFlowLpm: draft.paramFlowLpm,
    expectedValue: draft.expectedValue,
    expectedClosure: draft.expectedClosure,
    ownerUserId: draft.ownerUserId,
    status: "NEW",
    stageEnteredAt: w.now.toISOString(),
    createdAt: w.now.toISOString(),
  };
  commit(
    withAudit({ ...overlay, enquiries: put(overlay.enquiries, enquiry) }, actor, {
      action: "CREATE", entityType: "Enquiry", entityId: id, entityLabel: number,
      // E3-S3 AC-5 — the audit entry names the source channel.
      summary: `Enquiry captured via ${enquiry.source.replace(/_/g, " ").toLowerCase()} for ${customer?.legalName ?? draft.customerId}; owner ${enquiry.ownerUserId ? w.userById.get(enquiry.ownerUserId)?.name ?? enquiry.ownerUserId : "unassigned"}.`,
    }),
  );
  return enquiry;
}

export function updateEnquiry(id: string, delta: Partial<T.Enquiry>, actor: Actor) {
  const w = world();
  commit(
    withAudit({ ...overlay, enquiries: patch(overlay.enquiries, id, delta) }, actor, {
      action: delta.status ? "STATE_TRANSITION" : "UPDATE",
      entityType: "Enquiry", entityId: id,
      entityLabel: w.enquiryById.get(id)?.number ?? id,
      summary: delta.status
        ? `Stage moved to ${delta.status.toLowerCase()}.`
        : `Updated ${Object.keys(delta).join(", ")}.`,
    }),
  );
}

export function assignEnquiry(id: string, ownerUserId: string, actor: Actor) {
  const w = world();
  commit(
    withAudit(
      { ...overlay, enquiries: patch(overlay.enquiries, id, { ownerUserId, stageEnteredAt: w.now.toISOString() }) },
      actor,
      {
        action: "UPDATE", entityType: "Enquiry", entityId: id,
        entityLabel: w.enquiryById.get(id)?.number ?? id,
        summary: `Owner set to ${w.userById.get(ownerUserId)?.name ?? ownerUserId}; left the unassigned queue.`,
      },
    ),
  );
}

/* ----------------------------------------------------------- quotations */

export function createQuotationFromEnquiry(enquiryId: string, actor: Actor): T.Quotation {
  const w = world();
  const enq = w.enquiryById.get(enquiryId);
  if (!enq) throw new Error("Enquiry not found");
  const id = nextId(w.quotations, "QT", 4);
  const number = nextNumber(w.quotations.map((q) => q.number), "BC/QT/2627/", 4);
  const q: T.Quotation = {
    id, number, version: 1, rootId: id, supersedesId: null, changeSummary: null,
    enquiryId, customerId: enq.customerId, siteId: enq.siteId, branchId: enq.branchId,
    ownerUserId: enq.ownerUserId ?? actor.userId, vertical: enq.vertical,
    status: "DRAFT",
    quotationDate: w.now.toISOString(),
    validityDays: 30,
    paymentTerms: "30% advance, balance against delivery",
    deliveryTerms: "4-6 weeks ex-works",
    warrantyTerms: "12 months from commissioning",
    inclusions: "Supply, installation supervision, commissioning and operator training.",
    exclusions: "Civil foundation, electrical cabling up to panel, and unloading at site.",
    technicalNotes: enq.paramCfm
      ? `Sized for ${enq.paramCfm} CFM at ${enq.paramBar ?? "—"} bar working pressure.`
      : enq.paramHeadM
        ? `Sized for ${enq.paramHeadM} m head at ${enq.paramFlowLpm ?? "—"} LPM.`
        : "Sizing to be confirmed against site survey.",
    lossReason: null, competitor: null,
    approvalRequestId: null, approvedByUserId: null, approvedAt: null,
    sourceAmcContractId: null,
    stageEnteredAt: w.now.toISOString(),
    createdAt: w.now.toISOString(),
  };
  let next: Overlay = { ...overlay, quotations: put(overlay.quotations, q) };
  if (enq.status === "NEW" || enq.status === "QUALIFIED") {
    next = { ...next, enquiries: patch(next.enquiries, enquiryId, { status: "QUOTED", stageEnteredAt: w.now.toISOString() }) };
  }
  commit(
    withAudit(next, actor, {
      action: "CREATE", entityType: "Quotation", entityId: id, entityLabel: number,
      summary: `Draft quotation raised against enquiry ${enq.number}.`,
    }),
  );
  return q;
}

export function updateQuotation(id: string, delta: Partial<T.Quotation>, actor: Actor) {
  const w = world();
  commit(
    withAudit({ ...overlay, quotations: patch(overlay.quotations, id, delta) }, actor, {
      action: "UPDATE", entityType: "Quotation", entityId: id,
      entityLabel: w.quotationById.get(id)?.number ?? id,
      summary: `Updated ${Object.keys(delta).join(", ")}.`,
    }),
  );
}

export function addQuotationLineFromItem(quotationId: string, itemId: string, actor: Actor) {
  const w = world();
  const item = w.itemById.get(itemId);
  const q = w.quotationById.get(quotationId);
  if (!item || !q) return;
  const id = nextId(w.quotationLines, "QTL", 4);
  const rate = priceListRate(w.ds, itemId, new Date(q.quotationDate));
  const line: T.QuotationLine = {
    id, quotationId, itemId,
    description: item.description, hsnSac: item.hsnSac, uom: item.uom,
    qty: 1, rate: rate ?? 0, discountPct: 0, gstRate: item.gstRate,
  };
  const next: Overlay = {
    ...overlay,
    quotationLines: put(overlay.quotationLines, line),
    pendingRateLineIds: rate === null ? [...overlay.pendingRateLineIds, id] : overlay.pendingRateLineIds,
  };
  commit(
    withAudit(next, actor, {
      action: "UPDATE", entityType: "Quotation", entityId: quotationId, entityLabel: q.number,
      summary: rate === null
        ? `Line added — ${item.code}; no price-list entry effective on the quotation date, rate left blank for manual entry.`
        : `Line added — ${item.code} at price-list rate.`,
    }),
  );
}

export function addCustomQuotationLine(quotationId: string, description: string, actor: Actor) {
  const w = world();
  const q = w.quotationById.get(quotationId);
  if (!q) return;
  const id = nextId(w.quotationLines, "QTL", 4);
  const line: T.QuotationLine = {
    id, quotationId, itemId: "CUSTOM",
    description, hsnSac: "", uom: "Nos", qty: 1, rate: 0, discountPct: 0, gstRate: 18,
  };
  commit(
    withAudit(
      {
        ...overlay,
        quotationLines: put(overlay.quotationLines, line),
        pendingRateLineIds: [...overlay.pendingRateLineIds, id],
      },
      actor,
      {
        action: "UPDATE", entityType: "Quotation", entityId: quotationId, entityLabel: q.number,
        summary: `Non-catalogue line added — no price-list entry exists, rate flagged for manual entry.`,
      },
    ),
  );
}

export function updateQuotationLine(lineId: string, delta: Partial<T.QuotationLine>) {
  let pending = overlay.pendingRateLineIds;
  if (delta.rate !== undefined && delta.rate > 0) pending = pending.filter((x) => x !== lineId);
  commit({
    ...overlay,
    quotationLines: patch(overlay.quotationLines, lineId, delta),
    pendingRateLineIds: pending,
  });
}

export function removeQuotationLine(lineId: string, quotationId: string, actor: Actor) {
  const w = world();
  const q = w.quotationById.get(quotationId);
  const created = overlay.quotationLines.created.filter((l) => l.id !== lineId);
  const isSeeded = w.ds.quotationLines.some((l) => l.id === lineId);
  const next: Overlay = {
    ...overlay,
    quotationLines: isSeeded
      ? patch({ created, updated: overlay.quotationLines.updated }, lineId, { quotationId: "__removed__" })
      : { created, updated: overlay.quotationLines.updated },
    pendingRateLineIds: overlay.pendingRateLineIds.filter((x) => x !== lineId),
  };
  commit(
    withAudit(next, actor, {
      action: "UPDATE", entityType: "Quotation", entityId: quotationId, entityLabel: q?.number ?? quotationId,
      summary: "Line removed.",
    }),
  );
}

/** E3-S5 AC-1 — a revision is a new version; the prior version becomes read-only. */
export function reviseQuotation(sourceId: string, changeSummary: string, actor: Actor): T.Quotation {
  const w = world();
  const src = w.quotationById.get(sourceId);
  if (!src) throw new Error("Quotation not found");
  const family = w.quotationsByRoot.get(src.rootId) ?? [src];
  const version = Math.max(...family.map((q) => q.version)) + 1;
  const id = nextId(w.quotations, "QT", 4);
  const revised: T.Quotation = {
    ...src, id, version, rootId: src.rootId, supersedesId: src.id,
    changeSummary,
    status: "DRAFT",
    quotationDate: w.now.toISOString(),
    lossReason: null, competitor: null,
    approvalRequestId: null, approvedByUserId: null, approvedAt: null,
    ownerUserId: actor.userId,
    stageEnteredAt: w.now.toISOString(),
    createdAt: w.now.toISOString(),
  };
  let next: Overlay = { ...overlay, quotations: put(overlay.quotations, revised) };
  let n = 0;
  for (const l of w.linesByQuotation.get(sourceId) ?? []) {
    n++;
    const lineId = `${id}-L${String(n).padStart(2, "0")}`;
    next = { ...next, quotationLines: put(next.quotationLines, { ...l, id: lineId, quotationId: id }) };
  }
  commit(
    withAudit(next, actor, {
      action: "CREATE", entityType: "Quotation", entityId: id, entityLabel: `${revised.number} v${version}`,
      summary: `Revision v${version} created from v${src.version}. ${changeSummary} Prior version is now read-only.`,
    }),
  );
  return revised;
}

/* -------------------------------------------------- lifecycle + approval */

export interface TransitionOptions {
  lossReason?: T.Quotation["lossReason"];
  competitor?: string | null;
}

export interface TransitionResult extends TransitionCheck {
  orderId?: string;
  approvalId?: string;
}

export function transitionQuotation(
  quotationId: string,
  to: QuotationStatus,
  opts: TransitionOptions,
  actor: Actor,
): TransitionResult {
  const w = world();
  const q = w.quotationById.get(quotationId);
  if (!q) return { ok: false, reason: "Quotation not found." };
  const lines = (w.linesByQuotation.get(quotationId) ?? []).filter((l) => l.quotationId === quotationId);
  const customer = w.customerById.get(q.customerId);
  const site = q.siteId ? w.siteById.get(q.siteId) : undefined;
  const pos = derivePlaceOfSupply(customer, site);
  const totals = quotationTotals(lines, pos.treatment);
  const approval = q.approvalRequestId ? w.approvals.find((a) => a.id === q.approvalRequestId) : undefined;
  const pendingRole = approval
    ? approval.resolvedSteps.find((s) => s.order === approval.currentStep)?.approverRole ?? null
    : null;

  const check = checkTransition(q, to, {
    now: w.now,
    lines,
    pendingRateLineIds: w.pendingRateLineIds,
    lossReason: opts.lossReason ?? q.lossReason,
    effectiveDiscountPct: totals.effectiveDiscountPct,
    role: actor.role,
    approvalPendingRole: pendingRole,
  });
  if (!check.ok) return check;

  let next: Overlay = overlay;
  const delta: Partial<T.Quotation> = { status: to, stageEnteredAt: w.now.toISOString() };
  let orderId: string | undefined;
  let approvalId: string | undefined;

  if (to === "LOST") {
    delta.lossReason = opts.lossReason ?? q.lossReason;
    delta.competitor = opts.competitor ?? q.competitor;
  }

  if (to === "PENDING_APPROVAL") {
    const gate = discountGate(totals.effectiveDiscountPct, actor.role);
    const chain =
      w.ds.approvalChains.find(
        (c) =>
          c.requestType === "QUOTATION_DISCOUNT" &&
          totals.effectiveDiscountPct > c.minValue &&
          (c.maxValue === null || totals.effectiveDiscountPct <= c.maxValue),
      ) ?? w.ds.approvalChains.find((c) => c.requestType === "QUOTATION_DISCOUNT");
    const steps = chain
      ? w.ds.approvalChainSteps
        .filter((s) => s.chainId === chain.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ order: s.order, approverRole: s.approverRole, escalationHours: s.escalationHours }))
      : gate.band.chainRoles.map((r, i) => ({ order: i + 1, approverRole: r, escalationHours: 8 }));
    approvalId = nextId(w.approvals, "APR", 3);
    const request: T.ApprovalRequest = {
      id: approvalId,
      number: nextNumber(w.approvals.map((a) => a.number), "BC/APR/2627/", 4),
      type: "QUOTATION_DISCOUNT",
      subjectType: "QUOTATION", subjectId: quotationId,
      subjectLabel: `Discount ${totals.effectiveDiscountPct.toFixed(2)}% on ${q.number} v${q.version} — ${customer?.legalName ?? ""}`,
      value: totals.grandTotal,
      requesterUserId: actor.userId,
      branchId: q.branchId,
      resolvedChainId: chain?.id ?? "APC-01",
      resolvedSteps: steps,
      currentStep: 1,
      status: "PENDING",
      raisedAt: w.now.toISOString(),
      decidedAt: null, escalatedAt: null,
      context: {
        quotation: q.number, version: q.version,
        effectiveDiscountPct: totals.effectiveDiscountPct,
        maxLineDiscountPct: totals.maxLineDiscountPct,
        grandTotal: totals.grandTotal,
        band: gate.band.label,
        requester: actor.name,
      },
    };
    next = { ...next, approvals: put(next.approvals, request) };
    delta.approvalRequestId = approvalId;
  }

  if (to === "WON") {
    // E3-S7 AC-1 — the order is pre-populated; nothing is re-entered.
    orderId = nextId(w.salesOrders, "SO", 4);
    const order: T.SalesOrder = {
      id: orderId,
      number: nextNumber(w.salesOrders.map((o) => o.number), "BC/SO/2627/", 4),
      quotationId, customerId: q.customerId, siteId: q.siteId, branchId: q.branchId,
      ownerUserId: q.ownerUserId, vertical: q.vertical,
      orderDate: w.now.toISOString(),
      customerPoRef: "", customerPoDate: w.now.toISOString(),
      deliverySchedule: q.deliveryTerms,
      advanceReceived: 0,
      status: "OPEN",
      createdAt: w.now.toISOString(),
    };
    next = { ...next, salesOrders: put(next.salesOrders, order) };
    let n = 0;
    for (const l of lines) {
      n++;
      next = {
        ...next,
        salesOrderLines: put(next.salesOrderLines, {
          id: `${orderId}-L${String(n).padStart(2, "0")}`,
          salesOrderId: orderId, itemId: l.itemId, description: l.description,
          hsnSac: l.hsnSac, uom: l.uom, qty: l.qty, rate: l.rate,
          discountPct: l.discountPct, gstRate: l.gstRate,
          qtyDelivered: 0, qtyInvoiced: 0,
        }),
      };
    }
    if (q.enquiryId) {
      next = { ...next, enquiries: patch(next.enquiries, q.enquiryId, { status: "WON", stageEnteredAt: w.now.toISOString() }) };
    }
  }

  if (to === "LOST" && q.enquiryId) {
    next = { ...next, enquiries: patch(next.enquiries, q.enquiryId, { status: "LOST", stageEnteredAt: w.now.toISOString() }) };
  }
  if (to === "NEGOTIATION" && q.enquiryId) {
    next = { ...next, enquiries: patch(next.enquiries, q.enquiryId, { status: "NEGOTIATION", stageEnteredAt: w.now.toISOString() }) };
  }

  next = { ...next, quotations: patch(next.quotations, quotationId, delta) };
  next = withAudit(next, actor, {
    action: "STATE_TRANSITION", entityType: "Quotation", entityId: quotationId,
    entityLabel: `${q.number} v${q.version}`,
    summary:
      to === "WON"
        ? `Won. Sales order created and linked bidirectionally.`
        : to === "LOST"
          ? `Lost — ${(opts.lossReason ?? q.lossReason ?? "reason not recorded").toString().replace(/_/g, " ").toLowerCase()}${opts.competitor ? ` to ${opts.competitor}` : ""}.`
          : to === "PENDING_APPROVAL"
            ? `Sent for discount approval at ${totals.effectiveDiscountPct.toFixed(2)}% effective discount.`
            : `Moved to ${to.replace(/_/g, " ").toLowerCase()}.`,
  });
  commit(next);
  return { ok: true, orderId, approvalId };
}

export interface ApprovalDecisionInput {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  comment: string;
}

export function decideQuotationApproval(input: ApprovalDecisionInput, actor: Actor): TransitionCheck {
  const w = world();
  const req = w.approvals.find((a) => a.id === input.requestId);
  if (!req) return { ok: false, reason: "Approval request not found." };
  if (req.status !== "PENDING" && req.status !== "ESCALATED") {
    return { ok: false, reason: `This request was already ${req.status.toLowerCase()}.`, remedy: "No further decision is possible." };
  }
  const step = req.resolvedSteps.find((s) => s.order === req.currentStep);
  if (step && step.approverRole !== actor.role) {
    return {
      ok: false,
      reason: `Step ${req.currentStep} of this chain is held by ${labelRole(step.approverRole)}. You are signed in as ${labelRole(actor.role)}.`,
      remedy: `Switch to the ${labelRole(step.approverRole)} persona to record this decision.`,
    };
  }

  const decisionId = nextId(w.approvalDecisions, "APD", 4);
  const decision: T.ApprovalDecision = {
    id: decisionId, requestId: req.id, stepOrder: req.currentStep,
    approverUserId: actor.userId, onBehalfOfUserId: null,
    decision: input.decision, comment: input.comment,
    channel: "IN_APP", at: w.now.toISOString(),
  };
  let next: Overlay = { ...overlay, approvalDecisions: put(overlay.approvalDecisions, decision) };

  const isLastStep = req.currentStep >= req.resolvedSteps.length;
  const quotation = w.quotations.find((q) => q.id === req.subjectId);

  if (input.decision === "REJECTED") {
    next = { ...next, approvals: patch(next.approvals, req.id, { status: "REJECTED", decidedAt: w.now.toISOString() }) };
    if (quotation) {
      next = {
        ...next,
        quotations: patch(next.quotations, quotation.id, {
          status: "DRAFT", stageEnteredAt: w.now.toISOString(),
          approvedByUserId: null, approvedAt: null,
        }),
      };
    }
  } else if (!isLastStep) {
    next = { ...next, approvals: patch(next.approvals, req.id, { currentStep: req.currentStep + 1 }) };
  } else {
    next = { ...next, approvals: patch(next.approvals, req.id, { status: "APPROVED", decidedAt: w.now.toISOString() }) };
    if (quotation) {
      next = {
        ...next,
        quotations: patch(next.quotations, quotation.id, {
          status: "ISSUED",
          stageEnteredAt: w.now.toISOString(),
          quotationDate: w.now.toISOString(),
          approvedByUserId: actor.userId,
          approvedAt: w.now.toISOString(),
        }),
      };
    }
  }

  next = withAudit(next, actor, {
    action: input.decision === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "Approval", entityId: req.id, entityLabel: req.number,
    summary:
      input.decision === "APPROVED"
        ? isLastStep
          ? `Approved at step ${req.currentStep}; quotation issued with the approval reference recorded.`
          : `Approved at step ${req.currentStep}; advanced to step ${req.currentStep + 1}.`
        : `Rejected at step ${req.currentStep} — ${input.comment || "no reason given"}. Quotation returned to Draft.`,
  });
  commit(next);
  return { ok: true };
}

/* -------------------------------------------------------- sales orders */

export function updateSalesOrder(id: string, delta: Partial<T.SalesOrder>, actor: Actor) {
  const w = world();
  commit(
    withAudit({ ...overlay, salesOrders: patch(overlay.salesOrders, id, delta) }, actor, {
      action: "UPDATE", entityType: "SalesOrder", entityId: id,
      entityLabel: w.salesOrders.find((o) => o.id === id)?.number ?? id,
      summary: `Updated ${Object.keys(delta).join(", ")}.`,
    }),
  );
}

export function recordDespatch(
  orderId: string, lineId: string, qty: number, actor: Actor,
): TransitionCheck {
  const w = world();
  const order = w.salesOrders.find((o) => o.id === orderId);
  const line = w.salesOrderLines.find((l) => l.id === lineId);
  if (!order || !line) return { ok: false, reason: "Order line not found." };
  if (qty <= 0) return { ok: false, reason: "A despatch must be for a positive quantity.", remedy: "Enter a quantity above zero." };
  const remaining = line.qty - line.qtyDelivered;
  if (qty > remaining) {
    return {
      ok: false,
      reason: `Only ${remaining} ${line.uom} remain undespatched on this line.`,
      remedy: `Despatch ${remaining} ${line.uom} or less, or raise a variation on the order.`,
    };
  }
  const delivered = line.qtyDelivered + qty;
  let next: Overlay = { ...overlay, salesOrderLines: patch(overlay.salesOrderLines, lineId, { qtyDelivered: delivered }) };

  const lines = (w.orderLinesByOrder.get(orderId) ?? []).map((l) => (l.id === lineId ? { ...l, qtyDelivered: delivered } : l));
  const allDone = lines.every((l) => l.qtyDelivered >= l.qty);
  const anyDone = lines.some((l) => l.qtyDelivered > 0);
  const status: T.SalesOrder["status"] = allDone ? "FULFILLED" : anyDone ? "PARTIAL" : "OPEN";
  if (status !== order.status) next = { ...next, salesOrders: patch(next.salesOrders, orderId, { status }) };

  commit(
    withAudit(next, actor, {
      action: "UPDATE", entityType: "SalesOrder", entityId: orderId, entityLabel: order.number,
      summary: `Despatched ${qty} ${line.uom} of ${line.description}; line now ${delivered}/${line.qty}. Order ${status.toLowerCase()}.`,
    }),
  );
  return { ok: true };
}

/* ------------------------------------------------------------ activities */

export interface FollowUpDraft {
  subjectType: T.Activity["subjectType"];
  subjectId: string;
  customerId: string;
  mode: T.Activity["mode"];
  outcome: string;
  notes: string;
  nextActionDate: string | null;
}

export function recordFollowUp(draft: FollowUpDraft, actor: Actor): T.Activity {
  const w = world();
  const id = nextId(w.activities, "ACT", 4);
  const activity: T.Activity = {
    id, subjectType: draft.subjectType, subjectId: draft.subjectId,
    customerId: draft.customerId, mode: draft.mode, outcome: draft.outcome,
    notes: draft.notes, nextActionDate: draft.nextActionDate,
    byUserId: actor.userId, at: w.now.toISOString(),
  };
  commit(
    withAudit({ ...overlay, activities: put(overlay.activities, activity) }, actor, {
      action: "CREATE", entityType: "Activity", entityId: id,
      entityLabel: `${draft.mode} — ${draft.outcome}`,
      summary: `Follow-up recorded against ${draft.subjectType.toLowerCase()} ${draft.subjectId}${draft.nextActionDate ? `; next action ${draft.nextActionDate.slice(0, 10)}` : ""}.`,
    }),
  );
  return activity;
}

/* ----------------------------------------------------------- saved views */

export function saveEnquiryView(name: string, filters: Record<string, string>) {
  const view: SavedView = {
    id: `VIEW-${Date.now().toString(36)}`,
    name, surface: "enquiries", filters,
    createdAt: new Date().toISOString(),
  };
  commit({ ...overlay, savedViews: [...overlay.savedViews.filter((v) => v.name !== name), view] });
}

export function deleteSavedView(id: string) {
  commit({ ...overlay, savedViews: overlay.savedViews.filter((v) => v.id !== id) });
}

/* --------------------------------------------------------------- lookups */

export function quotationFamily(w: SalesWorld, q: T.Quotation): T.Quotation[] {
  return (w.quotationsByRoot.get(q.rootId) ?? [q]).slice().sort((a, b) => a.version - b.version);
}

export function currentVersion(w: SalesWorld, q: T.Quotation): T.Quotation {
  const fam = quotationFamily(w, q);
  return fam[fam.length - 1] ?? q;
}

export function linesOf(w: SalesWorld, quotationId: string): T.QuotationLine[] {
  return (w.linesByQuotation.get(quotationId) ?? []).filter((l) => l.quotationId === quotationId);
}

export function statusOf(w: SalesWorld, q: T.Quotation): QuotationStatus {
  return effectiveStatus(q, w.now);
}
