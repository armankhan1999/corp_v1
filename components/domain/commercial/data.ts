import { cookies } from "next/headers";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import { canWrite } from "@/lib/rbac/matrix";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import type { Capability } from "@/lib/rbac/matrix";
import { daysBetween } from "@/lib/format";
import type {
  Actor, BranchRef, ChallanRow, CustomerRef, EwayRow, FollowUpRow, InvoiceRow,
  LineRow, NoteRow, ReceiptRow, SeriesRow, SourceOption, UserRef,
} from "./types";
import { INVOICE_TYPE_LABEL } from "./types";

/**
 * Server-side shaping for Epic E8.
 *
 * Every commercial screen is a server component. It reads the seeded world
 * once here, flattens exactly what the screen needs into plain objects, and
 * hands them to a client component. The generator never reaches the browser.
 */

export function ctx() {
  const ds = getDataset();
  const c = D.ctxOf(ds);
  return { ds, ctx: c, now: c.now, todayIso: c.now.toISOString() };
}

/** The signed-in user, with the write decision already taken from the matrix. */
export async function readActor(cap: Capability): Promise<Actor> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return { userId: "—", name: "Unknown", role: "AUDITOR", branchId: "—", canWrite: false };
  }
  return {
    userId: session.userId, name: session.name, role: session.role,
    branchId: session.branchId, canWrite: canWrite(session.role, cap),
  };
}

/* ------------------------------------------------------------- line models */

/**
 * Line arithmetic reconciles with `/lib/derive` to the rupee:
 *   taxable = round(qty · rate · (1 − discount))   → Σ equals D.invoiceTaxable
 *   total   = round(qty · rate · (1 + gst))        → Σ equals D.invoiceTotal
 *   tax     = total − taxable
 * Deriving tax as the difference rather than computing it separately is what
 * keeps the printed invoice, the ageing table and the KPI deck agreeing.
 */
export function lineRowOf(l: T.InvoiceLine): LineRow {
  const taxable = Math.round(l.qty * l.rate * (1 - l.discountPct / 100));
  const total = Math.round(l.qty * l.rate * (1 + l.gstRate / 100));
  return {
    id: l.id, itemId: l.itemId, description: l.description, hsnSac: l.hsnSac,
    uom: l.uom, qty: l.qty, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate,
    taxable, tax: total - taxable, total,
  };
}

/* ------------------------------------------------------------- lookup maps */

function lookups(ds: Dataset) {
  return {
    customers: new Map(ds.customers.map((c) => [c.id, c])),
    sites: new Map(ds.sites.map((s) => [s.id, s])),
    branches: new Map(ds.branches.map((b) => [b.id, b])),
    users: new Map(ds.users.map((u) => [u.id, u])),
    invoices: new Map(ds.invoices.map((i) => [i.id, i])),
  };
}

function siteOfCustomer(ds: Dataset, customerId: string): T.Site | undefined {
  return ds.sites.find((s) => s.customerId === customerId);
}

/* ------------------------------------------------------------- invoice rows */

export function buildInvoiceRows(ds: Dataset, now: Date): InvoiceRow[] {
  const L = lookups(ds);

  const linesByInvoice = new Map<string, T.InvoiceLine[]>();
  for (const l of ds.invoiceLines) {
    const arr = linesByInvoice.get(l.invoiceId);
    if (arr) arr.push(l); else linesByInvoice.set(l.invoiceId, [l]);
  }
  const allocByInvoice = new Map<string, number>();
  for (const a of ds.receiptAllocations) {
    allocByInvoice.set(a.invoiceId, (allocByInvoice.get(a.invoiceId) ?? 0) + a.amount);
  }
  const creditByInvoice = new Map<string, number>();
  const debitByInvoice = new Map<string, number>();
  for (const n of ds.creditNotes) {
    const m = n.kind === "CREDIT" ? creditByInvoice : debitByInvoice;
    m.set(n.invoiceId, (m.get(n.invoiceId) ?? 0) + n.amount + n.gstAmount);
  }

  return ds.invoices.map((inv) => {
    const lines = (linesByInvoice.get(inv.id) ?? []).map(lineRowOf);
    const taxable = lines.reduce((s, l) => s + l.taxable, 0);
    const total = lines.reduce((s, l) => s + l.total, 0);
    const customer = L.customers.get(inv.customerId);
    const site = inv.siteId ? L.sites.get(inv.siteId) : undefined;
    const branch = L.branches.get(inv.branchId);
    const owner = L.users.get(inv.ownerUserId);
    const ae = customer ? L.users.get(customer.ownerUserId) : undefined;
    const allocated = allocByInvoice.get(inv.id) ?? 0;
    const credited = creditByInvoice.get(inv.id) ?? 0;
    const debited = debitByInvoice.get(inv.id) ?? 0;

    return {
      id: inv.id, number: inv.number, type: inv.type, date: inv.date, dueDate: inv.dueDate,
      customerId: inv.customerId,
      customerName: customer?.legalName ?? "Unknown customer",
      customerType: customer?.type ?? "INDUSTRIAL",
      customerGstin: customer?.gstin ?? null,
      customerCountry: customer?.country ?? "IN",
      siteId: inv.siteId,
      siteName: site?.name ?? "—",
      siteAddress: site ? `${site.address}, ${site.district}, ${site.state} ${site.pincode}` : "—",
      branchId: inv.branchId,
      branchCode: branch?.code ?? "—",
      branchName: branch?.name ?? "—",
      placeOfSupplyStateCode: inv.placeOfSupplyStateCode,
      placeOfSupplyName: inv.placeOfSupplyName,
      taxTreatment: inv.taxTreatment,
      taxable, tax: total - taxable, total, roundOff: inv.roundOff,
      allocatedSeed: allocated, creditedSeed: credited, debitedSeed: debited,
      outstandingSeed: Math.max(0, total - allocated - credited + debited),
      daysOutstanding: daysBetween(new Date(inv.date), now),
      daysPastDue: daysBetween(new Date(inv.dueDate), now),
      bucket: D.ageingBucket(inv.date, now),
      irn: inv.irn, ackNumber: inv.ackNumber, ackDate: inv.ackDate,
      irpReportedAt: inv.irpReportedAt,
      eInvoiceApplicable: inv.eInvoiceApplicable,
      eInvoiceExemptReason: inv.eInvoiceExemptReason,
      ownerUserId: inv.ownerUserId, ownerName: owner?.name ?? "—",
      accountExecutiveId: customer?.ownerUserId ?? inv.ownerUserId,
      accountExecutiveName: ae?.name ?? owner?.name ?? "—",
      source: sourceRefOf(ds, inv),
      simulated: false,
    } satisfies InvoiceRow;
  });
}

function sourceRefOf(ds: Dataset, inv: T.Invoice): InvoiceRow["source"] {
  if (inv.salesOrderId) {
    const so = ds.salesOrders.find((s) => s.id === inv.salesOrderId);
    return { kind: "SALES_ORDER", id: inv.salesOrderId, label: so?.number ?? inv.salesOrderId, href: `/sales/orders/${inv.salesOrderId}` };
  }
  if (inv.jobCardId) {
    const jc = ds.jobCards.find((j) => j.id === inv.jobCardId);
    return { kind: "JOB_CARD", id: inv.jobCardId, label: jc?.number ?? inv.jobCardId, href: `/service/job-cards/${inv.jobCardId}` };
  }
  if (inv.amcContractId) {
    const a = ds.amcContracts.find((x) => x.id === inv.amcContractId);
    return { kind: "AMC_CONTRACT", id: inv.amcContractId, label: a?.number ?? inv.amcContractId, href: `/service/amc/${inv.amcContractId}` };
  }
  if (inv.raBillId) {
    const b = ds.raBills.find((x) => x.id === inv.raBillId);
    return { kind: "RA_BILL", id: inv.raBillId, label: b?.number ?? inv.raBillId, href: b ? `/projects/${b.projectId}` : null };
  }
  if (inv.rentalAgreementId) {
    const r = ds.rentalAgreements.find((x) => x.id === inv.rentalAgreementId);
    return { kind: "RENTAL_AGREEMENT", id: inv.rentalAgreementId, label: r?.number ?? inv.rentalAgreementId, href: "/service/rental" };
  }
  if (inv.challanId) {
    const c = ds.challans.find((x) => x.id === inv.challanId);
    return { kind: "CHALLAN", id: inv.challanId, label: c?.number ?? inv.challanId, href: `/commercial/challans/${inv.challanId}` };
  }
  return null;
}

export function buildInvoiceLines(ds: Dataset, invoiceId: string): LineRow[] {
  return ds.invoiceLines.filter((l) => l.invoiceId === invoiceId).map(lineRowOf);
}

/* ------------------------------------------------------------- challan rows */

export function buildChallanRows(ds: Dataset, now: Date): ChallanRow[] {
  const L = lookups(ds);
  const ewbByBase = new Map(ds.ewayBills.map((e) => [e.baseDocId, e.id]));
  return ds.challans.map((c) => {
    const customer = L.customers.get(c.customerId);
    const site = L.sites.get(c.siteId);
    const branch = L.branches.get(c.branchId);
    const lines = c.lines.map((l) => ({ ...l, lineValue: Math.round(l.qty * l.taxableValue) }));
    return {
      id: c.id, number: c.number, date: c.date,
      customerId: c.customerId,
      customerName: customer?.legalName ?? "Unknown customer",
      customerGstin: customer?.gstin ?? null,
      siteId: c.siteId,
      siteName: site?.name ?? "—",
      siteAddress: site ? `${site.address}, ${site.district}, ${site.state} ${site.pincode}` : "—",
      siteStateCode: site?.stateCode ?? "10",
      siteState: site?.state ?? "Bihar",
      branchId: c.branchId, branchCode: branch?.code ?? "—", branchName: branch?.name ?? "—",
      sourceType: c.sourceType, sourceId: c.sourceId, sourceLabel: c.sourceLabel,
      reasonForTransportation: c.reasonForTransportation,
      transportMode: c.transportMode, vehicleNumber: c.vehicleNumber,
      transporter: c.transporter, transporterGstin: c.transporterGstin,
      lrNumber: c.lrNumber, approxDistanceKm: c.approxDistanceKm,
      lines,
      consignmentValue: lines.reduce((s, l) => s + l.lineValue, 0),
      ageDays: daysBetween(new Date(c.date), now),
      ewayBillId: ewbByBase.get(c.id) ?? null,
      simulated: false,
    } satisfies ChallanRow;
  });
}

/* --------------------------------------------------------------- eway rows */

export function buildEwayRows(ds: Dataset): EwayRow[] {
  const L = lookups(ds);
  const challanById = new Map(ds.challans.map((c) => [c.id, c]));
  return ds.ewayBills.map((e) => {
    const ch = e.baseDocType === "CHALLAN" ? challanById.get(e.baseDocId) : undefined;
    const inv = e.baseDocType === "INVOICE" ? L.invoices.get(e.baseDocId) : undefined;
    const customerId = ch?.customerId ?? inv?.customerId ?? "";
    const value = ch
      ? ch.lines.reduce((s, l) => s + Math.round(l.qty * l.taxableValue), 0)
      : inv ? D.invoiceTotal(ds, inv.id) : 0;
    return {
      id: e.id, ebn: e.ebn, baseDocType: e.baseDocType, baseDocId: e.baseDocId,
      baseDocNumber: ch?.number ?? inv?.number ?? e.baseDocId,
      baseDocDate: e.baseDocDate,
      customerName: L.customers.get(customerId)?.legalName ?? "—",
      supplyType: e.supplyType, subType: e.subType, transportMode: e.transportMode,
      distanceKm: e.distanceKm, transporter: e.transporter, vehicleNumber: e.vehicleNumber,
      generatedAt: e.generatedAt, validUntil: e.validUntil,
      consignmentValue: value, simulated: false,
    } satisfies EwayRow;
  });
}

/* ------------------------------------------------------- receipts and notes */

export function buildReceiptRows(ds: Dataset): ReceiptRow[] {
  const L = lookups(ds);
  const byReceipt = new Map<string, T.ReceiptAllocation[]>();
  for (const a of ds.receiptAllocations) {
    const arr = byReceipt.get(a.receiptId);
    if (arr) arr.push(a); else byReceipt.set(a.receiptId, [a]);
  }
  return ds.receipts.map((r) => {
    const allocs = (byReceipt.get(r.id) ?? []).map((a) => ({
      id: a.id, invoiceId: a.invoiceId,
      invoiceNumber: L.invoices.get(a.invoiceId)?.number ?? a.invoiceId,
      amount: a.amount,
    }));
    const branch = L.branches.get(r.branchId);
    return {
      id: r.id, number: r.number, customerId: r.customerId,
      customerName: L.customers.get(r.customerId)?.legalName ?? "—",
      branchId: r.branchId, branchCode: branch?.code ?? "—",
      date: r.date, amount: r.amount, mode: r.mode, reference: r.reference,
      simulatedUpi: r.simulatedUpi, byUserId: r.byUserId,
      byName: L.users.get(r.byUserId)?.name ?? "—",
      allocationsSeed: allocs,
      allocatedSeed: allocs.reduce((s, a) => s + a.amount, 0),
      simulated: false,
    } satisfies ReceiptRow;
  });
}

export function buildNoteRows(ds: Dataset): NoteRow[] {
  const L = lookups(ds);
  return ds.creditNotes.map((n) => {
    const inv = L.invoices.get(n.invoiceId);
    return {
      id: n.id, number: n.number, kind: n.kind, invoiceId: n.invoiceId,
      invoiceNumber: inv?.number ?? n.invoiceId,
      customerName: inv ? (L.customers.get(inv.customerId)?.legalName ?? "—") : "—",
      date: n.date, reason: n.reason, amount: n.amount, gstAmount: n.gstAmount,
      byUserId: n.byUserId, byName: L.users.get(n.byUserId)?.name ?? "—",
      simulated: false,
    } satisfies NoteRow;
  });
}

export function buildFollowUpRows(ds: Dataset): FollowUpRow[] {
  const L = lookups(ds);
  return ds.collectionFollowUps.map((f) => ({
    id: f.id, invoiceId: f.invoiceId, date: f.date, mode: f.mode,
    personSpokenTo: f.personSpokenTo, outcome: f.outcome,
    promisedDate: f.promisedDate, promisedAmount: f.promisedAmount,
    fulfilled: f.fulfilled, byUserId: f.byUserId,
    byName: L.users.get(f.byUserId)?.name ?? "—",
    simulated: false,
  } satisfies FollowUpRow));
}

/* ------------------------------------------------------------- reference */

export function buildCustomerRefs(ds: Dataset): CustomerRef[] {
  return ds.customers.map((c) => {
    const site = siteOfCustomer(ds, c.id);
    return {
      id: c.id, name: c.legalName, type: c.type, gstin: c.gstin, country: c.country,
      creditTermDays: c.creditTermDays, branchId: c.branchId,
      accountExecutiveId: c.ownerUserId,
      siteId: site?.id ?? null, siteName: site?.name ?? "—",
      siteAddress: site ? `${site.address}, ${site.district}, ${site.state} ${site.pincode}` : "—",
      stateCode: c.country === "NP" ? "96" : (site?.stateCode ?? "10"),
      stateName: c.country === "NP" ? "Nepal (outside India)" : (site?.state ?? "Bihar"),
    } satisfies CustomerRef;
  });
}

export function buildBranchRefs(ds: Dataset): BranchRef[] {
  return ds.branches.map((b) => ({ id: b.id, code: b.code, name: b.name, gstin: b.gstin, address: b.address }));
}

export function buildUserRefs(ds: Dataset, ids: Set<string>): UserRef[] {
  return ds.users.filter((u) => ids.has(u.id)).map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

/* --------------------------------------------------- numbering series state */

const SERIES_LABEL: Record<string, string> = {
  CHALLAN: "Delivery challan",
  INVOICE: "Tax invoice",
  RECEIPT: "Receipt",
  CREDIT_NOTE: "Credit / debit note",
};

/**
 * FR-M7-19 / E8-S7. The state of a series is measured from the documents that
 * exist, not from a counter kept beside them — so "no gaps, no duplicates" is
 * an assertion the screen re-proves on every load rather than a claim.
 */
export function buildSeries(ds: Dataset): SeriesRow[] {
  const docs: Record<string, string[]> = {
    CHALLAN: ds.challans.map((c) => c.number),
    INVOICE: ds.invoices.map((i) => i.number),
    RECEIPT: ds.receipts.map((r) => r.number),
    CREDIT_NOTE: ds.creditNotes.map((n) => n.number),
  };
  const out: SeriesRow[] = [];
  for (const s of ds.numberingSeries) {
    const numbers = docs[s.docType];
    if (!numbers) continue;
    const seqs: number[] = [];
    const seen = new Map<string, number>();
    for (const n of numbers) {
      seen.set(n, (seen.get(n) ?? 0) + 1);
      const tail = n.split("/").pop() ?? "";
      const v = Number(tail);
      if (Number.isFinite(v)) seqs.push(v);
    }
    const present = new Set(seqs);
    const highest = seqs.length ? Math.max(...seqs) : 0;
    const gaps: number[] = [];
    for (let i = 1; i <= highest; i++) if (!present.has(i)) gaps.push(i);
    out.push({
      id: s.id, docType: s.docType, label: SERIES_LABEL[s.docType] ?? s.docType,
      prefix: s.prefix, fySegment: s.fySegment, width: s.width,
      issued: numbers.length, highest, next: highest + 1,
      nextNumber: `${s.prefix}/${s.fySegment}/${String(highest + 1).padStart(s.width, "0")}`,
      gaps: gaps.slice(0, 24),
      duplicates: [...seen].filter(([, n]) => n > 1).map(([k]) => k).slice(0, 12),
    });
  }
  return out;
}

/* ----------------------------------------------- source documents for E8-S2 */

/**
 * E8-S2 — each invoice type pulls its own source document, and an invoice
 * raised from one populates without re-entry. These options carry the lines,
 * so the form never asks for a figure the source already holds.
 */
export function buildSourceOptions(ds: Dataset, now: Date): SourceOption[] {
  const L = lookups(ds);
  const out: SourceOption[] = [];
  const cName = (id: string) => L.customers.get(id)?.legalName ?? "—";

  const soLines = new Map<string, T.SalesOrderLine[]>();
  for (const l of ds.salesOrderLines) {
    const arr = soLines.get(l.salesOrderId);
    if (arr) arr.push(l); else soLines.set(l.salesOrderId, [l]);
  }
  for (const so of ds.salesOrders) {
    if (so.status === "CANCELLED") continue;
    const lines = (soLines.get(so.id) ?? []).filter((l) => l.qty - l.qtyInvoiced > 0);
    if (!lines.length) continue;
    const value = lines.reduce((s, l) => s + Math.round((l.qty - l.qtyInvoiced) * l.rate * (1 + l.gstRate / 100)), 0);
    out.push({
      kind: "SALES_ORDER", id: so.id, label: so.number, customerId: so.customerId,
      customerName: cName(so.customerId), date: so.orderDate, value,
      detail: `${lines.length} line${lines.length === 1 ? "" : "s"} awaiting invoice · customer PO ${so.customerPoRef}`,
      lines: lines.map((l) => ({
        description: l.description, hsnSac: l.hsnSac, uom: l.uom,
        qty: l.qty - l.qtyInvoiced, rate: l.rate, gstRate: l.gstRate,
      })),
    });
  }

  const partsByCard = new Map<string, T.PartConsumption[]>();
  for (const p of ds.partConsumptions) {
    const arr = partsByCard.get(p.jobCardId);
    if (arr) arr.push(p); else partsByCard.set(p.jobCardId, [p]);
  }
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  for (const jc of ds.jobCards) {
    if (!jc.submittedAt) continue;
    const asset = assetById.get(jc.assetId);
    if (!asset) continue;
    const parts = (partsByCard.get(jc.id) ?? []).filter((p) => p.billable);
    const lines = [
      ...(jc.labourAmount > 0 ? [{ description: `Service labour — job card ${jc.number}`, hsnSac: "9987", uom: "Job", qty: 1, rate: jc.labourAmount, gstRate: 18 }] : []),
      ...(jc.travelAmount > 0 ? [{ description: "Travel and conveyance", hsnSac: "9987", uom: "Job", qty: 1, rate: jc.travelAmount, gstRate: 18 }] : []),
      ...parts.map((p) => {
        const item = itemById.get(p.itemId);
        return { description: item?.description ?? p.itemId, hsnSac: item?.hsnSac ?? "8421", uom: item?.uom ?? "Nos", qty: p.qty, rate: p.rate, gstRate: p.gstRate };
      }),
    ];
    if (!lines.length) continue;
    const value = lines.reduce((s, l) => s + Math.round(l.qty * l.rate * (1 + l.gstRate / 100)), 0);
    out.push({
      kind: "JOB_CARD", id: jc.id, label: jc.number, customerId: asset.customerId,
      customerName: cName(asset.customerId), date: jc.submittedAt, value,
      detail: `Service billing summary · ${parts.length} billable part${parts.length === 1 ? "" : "s"} · ${jc.visitType.toLowerCase()} visit`,
      lines,
    });
  }

  for (const a of ds.amcContracts) {
    if (a.terminated) continue;
    const perBill = a.billingSchedule === "ONE_TIME" ? a.contractValue
      : a.billingSchedule === "HALF_YEARLY" ? Math.round(a.contractValue / 2)
        : Math.round(a.contractValue / 4);
    out.push({
      kind: "AMC_CONTRACT", id: a.id, label: a.number, customerId: a.customerId,
      customerName: cName(a.customerId), date: a.startDate,
      value: Math.round(perBill * 1.18),
      detail: `${a.billingSchedule.replace(/_/g, " ").toLowerCase()} schedule · ${a.assetIds.length} asset${a.assetIds.length === 1 ? "" : "s"} · ${a.coverage.replace(/_/g, " ").toLowerCase()}`,
      lines: [{
        description: `Annual maintenance charges — ${a.number} (${a.billingSchedule.replace(/_/g, " ").toLowerCase()} instalment)`,
        hsnSac: "9987", uom: "Contract", qty: 1, rate: perBill, gstRate: 18,
      }],
    });
  }

  const projectById = new Map(ds.projects.map((p) => [p.id, p]));
  for (const b of ds.raBills) {
    if (b.certifiedValue === null) continue;
    const project = projectById.get(b.projectId);
    if (!project) continue;
    out.push({
      kind: "RA_BILL", id: b.id, label: b.number, customerId: project.customerId,
      customerName: cName(project.customerId), date: b.certifiedAt ?? b.periodTo,
      value: Math.round(b.certifiedValue * 1.18),
      detail: `${project.name} · RA ${b.sequence} certified · retention ${b.retentionPct}% · TDS ${b.tdsPct}%`,
      lines: [{
        description: `Work executed and certified — ${project.name}, RA-bill ${b.sequence}`,
        hsnSac: "9954", uom: "LS", qty: 1, rate: b.certifiedValue, gstRate: 18,
      }],
    });
  }

  const rentalAssetById = new Map(ds.rentalAssets.map((r) => [r.id, r]));
  for (const ag of ds.rentalAgreements) {
    const asset = rentalAssetById.get(ag.rentalAssetId);
    const end = ag.actualReturn ? new Date(ag.actualReturn) : now;
    const days = Math.max(1, daysBetween(new Date(ag.startDate), end));
    const qty = ag.rateBasis === "PER_DAY" ? days : Math.max(1, Math.round(days / 30));
    out.push({
      kind: "RENTAL_AGREEMENT", id: ag.id, label: ag.number, customerId: ag.customerId,
      customerName: cName(ag.customerId), date: ag.startDate,
      value: Math.round(qty * ag.rate * 1.18),
      detail: `${asset?.model ?? "Rental unit"} · ${ag.rateBasis === "PER_DAY" ? "daily" : "monthly"} rate · ${days} days on rent`,
      lines: [{
        description: `Rental charges — ${asset?.model ?? ag.number} (${ag.rateBasis === "PER_DAY" ? "per day" : "per month"})`,
        hsnSac: "9973", uom: ag.rateBasis === "PER_DAY" ? "Day" : "Month", qty, rate: ag.rate, gstRate: 18,
      }],
    });
  }

  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Sales orders and projects a challan may be raised against. */
export function buildChallanSources(ds: Dataset) {
  const L = lookups(ds);
  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  const soLines = new Map<string, T.SalesOrderLine[]>();
  for (const l of ds.salesOrderLines) {
    const arr = soLines.get(l.salesOrderId);
    if (arr) arr.push(l); else soLines.set(l.salesOrderId, [l]);
  }
  return ds.salesOrders
    .filter((so) => so.status === "OPEN" || so.status === "PARTIAL")
    .slice(0, 200)
    .map((so) => {
      const lines = (soLines.get(so.id) ?? []).map((l) => {
        const item = itemById.get(l.itemId);
        return {
          itemId: l.itemId, description: l.description,
          hsnSac: l.hsnSac || item?.hsnSac || "8414", uom: l.uom || item?.uom || "Nos",
          qty: Math.max(1, l.qty - l.qtyDelivered), taxableValue: Math.round(l.rate),
          lineValue: Math.round(Math.max(1, l.qty - l.qtyDelivered) * l.rate),
        };
      });
      const site = siteOfCustomer(ds, so.customerId);
      return {
        id: so.id, number: so.number, customerId: so.customerId,
        customerName: L.customers.get(so.customerId)?.legalName ?? "—",
        siteId: so.siteId ?? site?.id ?? "",
        branchId: so.branchId, date: so.orderDate, vertical: so.vertical,
        lines,
        value: lines.reduce((s, l) => s + l.lineValue, 0),
      };
    })
    .filter((s) => s.lines.length > 0);
}

export { INVOICE_TYPE_LABEL };
