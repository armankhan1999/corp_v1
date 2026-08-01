import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import type { ProductLine, RootCause } from "@/lib/schemas/enums";
import * as D from "@/lib/derive";
import {
  MACHINE_SPECS,
  OEM_COMMISSIONING_WINDOW_DAYS,
  productLineLabel,
} from "@/lib/seed/catalog";
import type {
  AmcAssetOption,
  AmcRow,
  AmcVisitRow,
  AssetRow,
  BranchOption,
  CommissioningDetail,
  CommissioningRow,
  CoverageBand,
  CustomerOption,
  DocumentRow,
  InvoiceOption,
  ItemOption,
  OrderLineOption,
  PartRow,
  ProductLineConfig,
  RentalAgreementRow,
  RentalAssetRow,
  TicketRow,
  UncoveredRow,
  VisitRow,
  WarrantyOpportunityRow,
} from "./types";

/**
 * Server-side projections for Epic E5. Every derived value here comes from
 * `lib/derive` — nothing is recomputed with a second implementation (AR-1).
 * The output is plain JSON so it crosses the server/client boundary intact.
 */

const DAY = 86_400_000;

export const PRODUCT_LINE_CONFIGS: ProductLineConfig[] = MACHINE_SPECS.map((s) => ({
  productLine: s.productLine,
  principal: s.principal,
  warrantyMonths: s.warrantyMonths,
  capacityUnit: s.capacityUnit,
  series: s.series,
}));

export function warrantyMonthsFor(productLine: ProductLine): number {
  return MACHINE_SPECS.find((s) => s.productLine === productLine)?.warrantyMonths ?? 12;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

interface Indexes {
  customerById: Map<string, T.Customer>;
  siteById: Map<string, T.Site>;
  itemById: Map<string, T.Item>;
  branchById: Map<string, T.Branch>;
  invoiceById: Map<string, T.Invoice>;
  userName: (id: string) => string;
  liveAmcByAsset: Map<string, T.AMCContract>;
  reportByAsset: Map<string, T.CommissioningReport>;
  ticketsByAsset: Map<string, T.ServiceTicket[]>;
  jobCardsByAsset: Map<string, T.JobCard[]>;
}

export function buildIndexes(ds: Dataset, now: Date): Indexes {
  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const siteById = new Map(ds.sites.map((s) => [s.id, s]));
  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  const branchById = new Map(ds.branches.map((b) => [b.id, b]));
  const invoiceById = new Map(ds.invoices.map((i) => [i.id, i]));
  const employeeName = new Map(ds.employees.map((e) => [e.id, e.name]));
  const userNameById = new Map(ds.users.map((u) => [u.id, u.name]));

  const liveAmcByAsset = new Map<string, T.AMCContract>();
  for (const a of ds.amcContracts) {
    if (a.terminated) continue;
    if (new Date(a.startDate) > now || new Date(a.endDate) < now) continue;
    for (const id of a.assetIds) if (!liveAmcByAsset.has(id)) liveAmcByAsset.set(id, a);
  }

  const reportByAsset = new Map(ds.commissioningReports.map((r) => [r.assetId, r]));

  const ticketsByAsset = new Map<string, T.ServiceTicket[]>();
  for (const t of ds.tickets) {
    const list = ticketsByAsset.get(t.assetId);
    if (list) list.push(t);
    else ticketsByAsset.set(t.assetId, [t]);
  }

  const jobCardsByAsset = new Map<string, T.JobCard[]>();
  for (const j of ds.jobCards) {
    const list = jobCardsByAsset.get(j.assetId);
    if (list) list.push(j);
    else jobCardsByAsset.set(j.assetId, [j]);
  }

  return {
    customerById,
    siteById,
    itemById,
    branchById,
    invoiceById,
    userName: (id) => employeeName.get(id) ?? userNameById.get(id) ?? id,
    liveAmcByAsset,
    reportByAsset,
    ticketsByAsset,
    jobCardsByAsset,
  };
}

function lastServiceOf(cards: T.JobCard[] | undefined): string | null {
  if (!cards || !cards.length) return null;
  let best = 0;
  for (const c of cards) {
    const t = new Date(c.checkOutAt ?? c.checkInAt ?? c.scheduledDate).getTime();
    if (t > best) best = t;
  }
  return best ? new Date(best).toISOString() : null;
}

/* ---------------------------------------------------------- asset rows */

export function buildAssetRows(ds: Dataset, now: Date, idx = buildIndexes(ds, now)): AssetRow[] {
  return ds.assets.map((a) => {
    const customer = idx.customerById.get(a.customerId);
    const site = idx.siteById.get(a.siteId);
    const item = idx.itemById.get(a.itemId);
    const branch = idx.branchById.get(a.branchId);
    const invoice = a.saleInvoiceId ? idx.invoiceById.get(a.saleInvoiceId) : undefined;
    const amc = idx.liveAmcByAsset.get(a.id) ?? null;
    const report = idx.reportByAsset.get(a.id) ?? null;
    const tickets = idx.ticketsByAsset.get(a.id) ?? [];
    const cards = idx.jobCardsByAsset.get(a.id);
    const windowDays = OEM_COMMISSIONING_WINDOW_DAYS[a.principal];
    const deadline = report ? D.commissioningDeadline(report, windowDays) : null;

    return {
      id: a.id,
      serial: a.serial,
      principal: a.principal,
      productLine: a.productLine,
      model: a.model,
      capacityValue: a.capacityValue,
      capacityUnit: a.capacityUnit,
      ratedKw: a.ratedKw,
      customerId: a.customerId,
      customerName: customer?.tradeName ?? a.customerId,
      siteId: a.siteId,
      siteName: site?.name ?? a.siteId,
      siteDistrict: site?.district ?? "",
      locationInSite: a.locationInSite,
      itemId: a.itemId,
      itemCode: item?.code ?? a.itemId,
      itemDescription: item?.description ?? productLineLabel(a.productLine),
      saleInvoiceId: a.saleInvoiceId,
      saleInvoiceNumber: invoice?.number ?? null,
      installationDate: a.installationDate,
      commissioningDate: a.commissioningDate,
      warrantyMonths: a.warrantyMonths,
      warrantyEnd: iso(D.warrantyEnd(a)),
      runningHours: a.runningHours,
      runningHoursAt: a.runningHoursAt,
      status: a.status,
      branchId: a.branchId,
      branchCode: branch?.code ?? a.branchId,
      branchName: branch?.name ?? a.branchId,
      decommissionReason: a.decommissionReason,
      coverage: D.coverageState(ds, a, now),
      amcId: amc?.id ?? null,
      amcNumber: amc?.number ?? null,
      amcStart: amc?.startDate ?? null,
      amcEnd: amc?.endDate ?? null,
      openTickets: tickets.filter(D.isOpenTicket).length,
      totalTickets: tickets.length,
      lastServiceAt: lastServiceOf(cards),
      commissioningReportId: report?.id ?? null,
      commissioningNumber: report?.number ?? null,
      commissioningDeadline: iso(deadline),
      commissioningSubmission:
        report && deadline ? D.commissioningSubmissionState(report, deadline, now) : null,
    } satisfies AssetRow;
  });
}

/* -------------------------------------------------------------- options */

export function buildCustomerOptions(ds: Dataset): CustomerOption[] {
  const sitesByCustomer = new Map<string, { id: string; name: string; district: string }[]>();
  for (const s of ds.sites) {
    const list = sitesByCustomer.get(s.customerId) ?? [];
    list.push({ id: s.id, name: s.name, district: s.district });
    sitesByCustomer.set(s.customerId, list);
  }
  return ds.customers
    .map((c) => ({
      id: c.id,
      name: c.tradeName,
      branchId: c.branchId,
      sites: sitesByCustomer.get(c.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildItemOptions(ds: Dataset): ItemOption[] {
  return ds.items
    .filter((i) => i.category === "MACHINE")
    .map((i) => ({
      id: i.id,
      code: i.code,
      description: i.description,
      principal: i.principal,
      productLine: i.productLine,
    }));
}

export function buildInvoiceOptions(ds: Dataset): InvoiceOption[] {
  return ds.invoices
    .filter((i) => i.type === "EQUIPMENT")
    .map((i) => ({ id: i.id, number: i.number, customerId: i.customerId, date: i.date }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildBranchOptions(ds: Dataset): BranchOption[] {
  return ds.branches.map((b) => ({ id: b.id, code: b.code, name: b.name }));
}

/** E5-S1 — sales-order lines an asset can be generated from with no re-entry. */
export function buildOrderLineOptions(ds: Dataset, idx: Indexes): OrderLineOption[] {
  const orderById = new Map(ds.salesOrders.map((o) => [o.id, o]));
  const invoiceByOrder = new Map<string, T.Invoice>();
  for (const inv of ds.invoices) {
    if (inv.salesOrderId && !invoiceByOrder.has(inv.salesOrderId)) invoiceByOrder.set(inv.salesOrderId, inv);
  }
  const out: OrderLineOption[] = [];
  for (const line of ds.salesOrderLines) {
    const item = idx.itemById.get(line.itemId);
    if (!item || item.category !== "MACHINE") continue;
    const order = orderById.get(line.salesOrderId);
    if (!order || order.status === "CANCELLED") continue;
    const customer = idx.customerById.get(order.customerId);
    const site = order.siteId ? idx.siteById.get(order.siteId) : undefined;
    const invoice = invoiceByOrder.get(order.id) ?? null;
    const spec = item.productLine
      ? MACHINE_SPECS.find((s) => s.productLine === item.productLine)
      : undefined;
    out.push({
      lineId: line.id,
      orderId: order.id,
      orderNumber: order.number,
      orderDate: order.orderDate,
      customerId: order.customerId,
      customerName: customer?.tradeName ?? order.customerId,
      siteId: site?.id ?? null,
      siteName: site?.name ?? null,
      itemId: item.id,
      itemCode: item.code,
      description: line.description,
      qty: line.qty,
      branchId: order.branchId,
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.number ?? null,
      principal: item.principal,
      productLine: item.productLine,
      capacityUnit: spec?.capacityUnit ?? "CFM",
      warrantyMonths: spec?.warrantyMonths ?? 12,
    });
  }
  return out.sort((a, b) => b.orderDate.localeCompare(a.orderDate)).slice(0, 120);
}

/* ------------------------------------------------------- commissioning */

export function buildCommissioningRows(
  ds: Dataset,
  now: Date,
  idx = buildIndexes(ds, now),
): CommissioningRow[] {
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const rows: CommissioningRow[] = [];
  for (const r of ds.commissioningReports) {
    const asset = assetById.get(r.assetId);
    if (!asset) continue;
    const customer = idx.customerById.get(asset.customerId);
    const site = idx.siteById.get(asset.siteId);
    const branch = idx.branchById.get(asset.branchId);
    const windowDays = OEM_COMMISSIONING_WINDOW_DAYS[asset.principal];
    const deadline = D.commissioningDeadline(r, windowDays);
    const failedItems = r.checklist.filter((c) => !c.pass).length;
    rows.push({
      id: r.id,
      number: r.number,
      assetId: asset.id,
      serial: asset.serial,
      model: asset.model,
      principal: asset.principal,
      customerId: asset.customerId,
      customerName: customer?.tradeName ?? asset.customerId,
      siteName: site?.name ?? asset.siteId,
      branchId: asset.branchId,
      branchCode: branch?.code ?? asset.branchId,
      commissioningDate: r.commissioningDate,
      windowDays,
      deadline: deadline.toISOString(),
      submittedAt: r.submittedAt,
      acknowledgementRef: r.acknowledgementRef,
      submission: D.commissioningSubmissionState(r, deadline, now),
      engineerName: idx.userName(r.engineerUserId),
      warrantyMonths: asset.warrantyMonths,
      warrantyEnd: iso(D.warrantyEnd(asset)),
      cleanReport: failedItems === 0,
      failedItems,
    });
  }
  return rows;
}

export function buildCommissioningDetail(
  ds: Dataset,
  now: Date,
  assetId: string,
  idx = buildIndexes(ds, now),
): CommissioningDetail | null {
  const asset = ds.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  const report = idx.reportByAsset.get(assetId) ?? null;
  const rows = report ? buildCommissioningRows(ds, now, idx).find((r) => r.id === report.id) : null;
  const customer = idx.customerById.get(asset.customerId);
  const site = idx.siteById.get(asset.siteId);
  const branch = idx.branchById.get(asset.branchId);
  const item = idx.itemById.get(asset.itemId);
  const windowDays = OEM_COMMISSIONING_WINDOW_DAYS[asset.principal];

  const base: CommissioningRow =
    rows ??
    ({
      id: `DRAFT-${asset.id}`,
      number: "Not yet numbered",
      assetId: asset.id,
      serial: asset.serial,
      model: asset.model,
      principal: asset.principal,
      customerId: asset.customerId,
      customerName: customer?.tradeName ?? asset.customerId,
      siteName: site?.name ?? asset.siteId,
      branchId: asset.branchId,
      branchCode: branch?.code ?? asset.branchId,
      commissioningDate: asset.commissioningDate ?? now.toISOString(),
      windowDays,
      deadline: new Date(
        new Date(asset.commissioningDate ?? now).getTime() + windowDays * DAY,
      ).toISOString(),
      submittedAt: null,
      acknowledgementRef: null,
      submission: "NOT_SUBMITTED",
      engineerName: "",
      warrantyMonths: asset.warrantyMonths,
      warrantyEnd: iso(D.warrantyEnd(asset)),
      cleanReport: true,
      failedItems: 0,
    } satisfies CommissioningRow);

  return {
    ...base,
    siteConditions: report?.siteConditions ?? "",
    supplyVoltage: report?.supplyVoltage ?? "415 V ± 5%",
    supplyPhase: report?.supplyPhase ?? "3 Phase, 4 Wire",
    earthingOhms: report?.earthingOhms ?? 0,
    accessoriesFitted: report?.accessoriesFitted ?? "",
    checklist: report ? report.checklist.map((c) => ({ ...c })) : [],
    initialPressureBar: report?.initialPressureBar ?? null,
    initialFadCfm: report?.initialFadCfm ?? null,
    loadCurrentAmp: report?.loadCurrentAmp ?? null,
    trainingAcknowledged: report?.trainingAcknowledged ?? false,
    customerSignatory: report?.customerSignatory ?? "",
    customerDesignation: report?.customerDesignation ?? "",
    dealerAuthorisedBy: report?.dealerAuthorisedBy ?? "",
    installationDate: asset.installationDate,
    locationInSite: asset.locationInSite,
    siteAddress: site ? `${site.address}, ${site.district}, ${site.state} ${site.pincode}` : "",
    capacityValue: asset.capacityValue,
    capacityUnit: asset.capacityUnit,
    ratedKw: asset.ratedKw,
    itemCode: item?.code ?? asset.itemId,
  };
}

/* ------------------------------------------------------------------ AMC */

export function buildAmcVisits(ds: Dataset, amcId: string): AmcVisitRow[] {
  const serialById = new Map(ds.assets.map((a) => [a.id, a.serial]));
  const ticketNumberById = new Map(ds.tickets.map((t) => [t.id, t.number]));
  return ds.scheduledVisits
    .filter((v) => v.amcContractId === amcId)
    .map((v) => ({
      id: v.id,
      assetId: v.assetId,
      serial: serialById.get(v.assetId) ?? v.assetId,
      sequence: v.sequence,
      dueDate: v.dueDate,
      completedAt: v.completedAt,
      ticketId: v.ticketId,
      ticketNumber: v.ticketId ? (ticketNumberById.get(v.ticketId) ?? null) : null,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function buildAmcRows(ds: Dataset, now: Date, idx = buildIndexes(ds, now)): AmcRow[] {
  const serialById = new Map(ds.assets.map((a) => [a.id, a.serial]));
  const visitsByContract = new Map<string, T.ScheduledVisit[]>();
  for (const v of ds.scheduledVisits) {
    const list = visitsByContract.get(v.amcContractId);
    if (list) list.push(v);
    else visitsByContract.set(v.amcContractId, [v]);
  }
  return ds.amcContracts.map((c) => {
    const visits = visitsByContract.get(c.id) ?? [];
    const customer = idx.customerById.get(c.customerId);
    const branch = idx.branchById.get(c.branchId);
    return {
      id: c.id,
      number: c.number,
      customerId: c.customerId,
      customerName: customer?.tradeName ?? c.customerId,
      branchId: c.branchId,
      branchCode: branch?.code ?? c.branchId,
      assetIds: [...c.assetIds],
      assetSerials: c.assetIds.map((a) => serialById.get(a) ?? a),
      coverage: c.coverage,
      startDate: c.startDate,
      endDate: c.endDate,
      contractValue: c.contractValue,
      billingSchedule: c.billingSchedule,
      visitsPerYear: c.visitsPerYear,
      responseHours: c.responseHours,
      restorationHours: c.restorationHours,
      inclusions: c.inclusions,
      exclusions: c.exclusions,
      ownerUserId: c.ownerUserId,
      ownerName: idx.userName(c.ownerUserId),
      terminated: c.terminated,
      terminationReason: c.terminationReason,
      renewedIntoId: c.renewedIntoId,
      renewalQuotationId: c.renewalQuotationId,
      status: D.amcStatus(c, now),
      committedVisits: visits.length,
      completedVisits: visits.filter((v) => v.completedAt).length,
      dueToDate: visits.filter((v) => new Date(v.dueDate) <= now).length,
      daysRemaining: Math.floor((new Date(c.endDate).getTime() - now.getTime()) / DAY),
    } satisfies AmcRow;
  });
}


export function buildAmcAssetOptions(ds: Dataset, now: Date): AmcAssetOption[] {
  return ds.assets.map((a) => ({
    id: a.id,
    serial: a.serial,
    model: a.model,
    customerId: a.customerId,
    branchId: a.branchId,
    coverage: D.coverageState(ds, a, now),
    status: a.status,
    ratedKw: a.ratedKw,
  }));
}

/* ------------------------------------------------------------- passport */

export function buildTicketRows(ds: Dataset, assetId: string, idx: Indexes): TicketRow[] {
  const cards = idx.jobCardsByAsset.get(assetId) ?? [];
  const causesByTicket = new Map<string, RootCause[]>();
  for (const c of cards) {
    if (!c.rootCause) continue;
    const list = causesByTicket.get(c.ticketId) ?? [];
    if (!list.includes(c.rootCause)) list.push(c.rootCause);
    causesByTicket.set(c.ticketId, list);
  }
  return (idx.ticketsByAsset.get(assetId) ?? [])
    .map((t) => ({
      id: t.id,
      number: t.number,
      category: t.category,
      severity: t.severity,
      status: t.status,
      problem: t.problem,
      coverage: t.coverage,
      coverageBasis: t.coverageBasis,
      loggedAt: t.loggedAt,
      closedAt: t.closedAt,
      breached: Boolean(t.breachedAt),
      rootCauses: causesByTicket.get(t.id) ?? [],
    }))
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export function buildVisitRows(ds: Dataset, assetId: string, idx: Indexes): VisitRow[] {
  const ticketNumberById = new Map(ds.tickets.map((t) => [t.id, t.number]));
  return (idx.jobCardsByAsset.get(assetId) ?? [])
    .map((j) => ({
      id: j.id,
      number: j.number,
      ticketId: j.ticketId,
      ticketNumber: ticketNumberById.get(j.ticketId) ?? j.ticketId,
      visitType: j.visitType,
      scheduledDate: j.scheduledDate,
      engineerName: idx.userName(j.engineerUserId),
      outcome: j.outcome,
      rootCause: j.rootCause,
      workPerformed: j.workPerformed,
      observations: j.observations,
      runningHoursReading: j.runningHoursReading,
      resolvedOnThisVisit: j.resolvedOnThisVisit,
      submittedAt: j.submittedAt,
    }))
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
}

export function buildPartRows(ds: Dataset, assetId: string, idx: Indexes): PartRow[] {
  const cards = idx.jobCardsByAsset.get(assetId) ?? [];
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const out: PartRow[] = [];
  for (const p of ds.partConsumptions) {
    const card = cardById.get(p.jobCardId);
    if (!card) continue;
    const item = idx.itemById.get(p.itemId);
    out.push({
      id: p.id,
      itemCode: item?.code ?? p.itemId,
      description: item?.description ?? p.itemId,
      qty: p.qty,
      uom: item?.uom ?? "Nos",
      rate: p.rate,
      amount: Math.round(p.qty * p.rate),
      billable: p.billable,
      at: card.checkOutAt ?? card.scheduledDate,
      jobCardId: card.id,
      jobCardNumber: card.number,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function buildDocumentRows(ds: Dataset, assetId: string): DocumentRow[] {
  return ds.documents
    .filter((d) => d.linkedType === "ASSET" && d.linkedId === assetId && !d.deletedAt)
    .map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      uploadedAt: d.uploadedAt,
      version: d.version,
      sizeKb: d.sizeKb,
      pageCount: d.pageCount,
    }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * E5-S2 — the coverage timeline. Warranty and every AMC period become bands on
 * a single date axis; the intervals no band covers become explicit gaps.
 */
export function buildCoverageBands(ds: Dataset, asset: T.InstalledAsset, now: Date): CoverageBand[] {
  const spans: { kind: "WARRANTY" | "AMC"; label: string; from: number; to: number }[] = [];
  const wEnd = D.warrantyEnd(asset);
  if (asset.commissioningDate && wEnd) {
    spans.push({
      kind: "WARRANTY",
      label: `Warranty — ${asset.warrantyMonths} months`,
      from: new Date(asset.commissioningDate).getTime(),
      to: wEnd.getTime(),
    });
  }
  for (const c of ds.amcContracts) {
    if (!c.assetIds.includes(asset.id)) continue;
    spans.push({
      kind: "AMC",
      label: `${c.number} — ${c.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"}`,
      from: new Date(c.startDate).getTime(),
      to: new Date(c.terminated ? c.endDate : c.endDate).getTime(),
    });
  }
  if (!spans.length) return [];

  spans.sort((a, b) => a.from - b.from);
  const bands: CoverageBand[] = [];
  // Merged cover, so a gap means genuinely nothing was in force.
  const merged: { from: number; to: number }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else merged.push({ from: s.from, to: s.to });
  }
  for (const s of spans) {
    bands.push({
      kind: s.kind,
      label: s.label,
      from: new Date(s.from).toISOString(),
      to: new Date(s.to).toISOString(),
      live: s.from <= now.getTime() && s.to >= now.getTime(),
    });
  }
  for (let i = 1; i < merged.length; i++) {
    const gapFrom = merged[i - 1]!.to;
    const gapTo = merged[i]!.from;
    if (gapTo - gapFrom < DAY) continue;
    bands.push({
      kind: "GAP",
      label: "Uncovered",
      from: new Date(gapFrom).toISOString(),
      to: new Date(gapTo).toISOString(),
      live: gapFrom <= now.getTime() && gapTo >= now.getTime(),
    });
  }
  const lastEnd = merged[merged.length - 1]!.to;
  if (lastEnd < now.getTime() - DAY) {
    bands.push({
      kind: "GAP",
      label: "Uncovered",
      from: new Date(lastEnd).toISOString(),
      to: new Date(now.getTime()).toISOString(),
      live: true,
    });
  }
  return bands.sort((a, b) => a.from.localeCompare(b.from));
}

/** Running hours over time — engineer readings plus the current meter. */
export function buildRunningHoursSeries(
  asset: T.InstalledAsset,
  visits: VisitRow[],
): { at: string; hours: number }[] {
  const points = visits
    .filter((v) => typeof v.runningHoursReading === "number")
    .map((v) => ({ at: v.scheduledDate, hours: v.runningHoursReading as number }));
  points.push({ at: asset.runningHoursAt, hours: asset.runningHours });
  if (asset.commissioningDate) points.push({ at: asset.commissioningDate, hours: 0 });
  const byDay = new Map<string, { at: string; hours: number }>();
  for (const p of points) {
    const key = p.at.slice(0, 10);
    const prev = byDay.get(key);
    if (!prev || p.hours > prev.hours) byDay.set(key, p);
  }
  return [...byDay.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/* ------------------------------------------------------------ renewals */

/**
 * Estimated AMC value for an uncovered machine, priced off the live book:
 * total live contract value ÷ total covered rated kW, applied to this machine.
 * The basis is printed on screen so the figure is not a guess.
 */
export function amcRatePerKw(ds: Dataset, now: Date): number {
  const kwById = new Map(ds.assets.map((a) => [a.id, a.ratedKw ?? 10]));
  let value = 0;
  let kw = 0;
  for (const c of ds.amcContracts) {
    if (c.terminated) continue;
    if (new Date(c.startDate) > now || new Date(c.endDate) < now) continue;
    value += c.contractValue;
    for (const id of c.assetIds) kw += kwById.get(id) ?? 10;
  }
  return kw > 0 ? value / kw : 2400;
}

export function estimateAmcValue(ratedKw: number | null, perKw: number): number {
  const raw = (ratedKw ?? 10) * perKw;
  return Math.max(18_000, Math.round(raw / 500) * 500);
}

export function buildWarrantyOpportunities(
  ds: Dataset,
  now: Date,
  idx: Indexes,
  perKw: number,
): WarrantyOpportunityRow[] {
  const out: WarrantyOpportunityRow[] = [];
  for (const a of ds.assets) {
    if (a.status === "DECOMMISSIONED") continue;
    const end = D.warrantyEnd(a);
    if (!end) continue;
    const days = Math.floor((end.getTime() - now.getTime()) / DAY);
    if (days < 0 || days > 90) continue;
    const cards = idx.jobCardsByAsset.get(a.id) ?? [];
    const cardIds = new Set(cards.map((c) => c.id));
    let spend = 0;
    for (const p of ds.partConsumptions) {
      if (cardIds.has(p.jobCardId)) spend += Math.round(p.qty * p.rate);
    }
    const customer = idx.customerById.get(a.customerId);
    const site = idx.siteById.get(a.siteId);
    const branch = idx.branchById.get(a.branchId);
    out.push({
      assetId: a.id,
      serial: a.serial,
      model: a.model,
      principal: a.principal,
      customerId: a.customerId,
      customerName: customer?.tradeName ?? a.customerId,
      siteName: site?.name ?? a.siteId,
      branchId: a.branchId,
      branchCode: branch?.code ?? a.branchId,
      warrantyEnd: end.toISOString(),
      daysRemaining: days,
      tickets: (idx.ticketsByAsset.get(a.id) ?? []).length,
      visits: cards.length,
      partsSpend: spend,
      lastServiceAt: lastServiceOf(cards),
      estimatedAmcValue: estimateAmcValue(a.ratedKw, perKw),
    });
  }
  return out.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function buildUncoveredRows(
  ds: Dataset,
  now: Date,
  idx: Indexes,
  perKw: number,
): UncoveredRow[] {
  const out: UncoveredRow[] = [];
  for (const a of ds.assets) {
    if (a.status === "DECOMMISSIONED") continue;
    if (D.coverageState(ds, a, now) !== "OUT_OF_COVERAGE") continue;
    const cards = idx.jobCardsByAsset.get(a.id);
    const last = lastServiceOf(cards);
    const customer = idx.customerById.get(a.customerId);
    const site = idx.siteById.get(a.siteId);
    const branch = idx.branchById.get(a.branchId);
    out.push({
      assetId: a.id,
      serial: a.serial,
      model: a.model,
      principal: a.principal,
      customerId: a.customerId,
      customerName: customer?.tradeName ?? a.customerId,
      siteName: site?.name ?? a.siteId,
      branchId: a.branchId,
      branchCode: branch?.code ?? a.branchId,
      monthsSinceLastService: last
        ? Math.floor((now.getTime() - new Date(last).getTime()) / (DAY * 30.44))
        : null,
      lastServiceAt: last,
      estimatedAmcValue: estimateAmcValue(a.ratedKw, perKw),
      status: a.status,
    });
  }
  return out.sort((a, b) => (b.monthsSinceLastService ?? 999) - (a.monthsSinceLastService ?? 999));
}

/* ------------------------------------------------------------- rental */

export function buildRentalAssets(ds: Dataset, idx: Indexes): RentalAssetRow[] {
  return ds.rentalAssets.map((r) => ({
    id: r.id,
    serial: r.serial,
    model: r.model,
    capacityValue: r.capacityValue,
    capacityUnit: r.capacityUnit,
    condition: r.condition,
    branchId: r.branchId,
    branchCode: idx.branchById.get(r.branchId)?.code ?? r.branchId,
    availableFrom: r.availableFrom,
    itemCode: idx.itemById.get(r.itemId)?.code ?? r.itemId,
  }));
}

export function buildRentalAgreements(ds: Dataset, idx: Indexes): RentalAgreementRow[] {
  return ds.rentalAgreements.map((a) => ({
    id: a.id,
    number: a.number,
    rentalAssetId: a.rentalAssetId,
    customerId: a.customerId,
    customerName: idx.customerById.get(a.customerId)?.tradeName ?? a.customerId,
    siteId: a.siteId,
    siteName: idx.siteById.get(a.siteId)?.name ?? a.siteId,
    startDate: a.startDate,
    expectedReturn: a.expectedReturn,
    actualReturn: a.actualReturn,
    rateBasis: a.rateBasis,
    rate: a.rate,
    deposit: a.deposit,
    returnCondition: a.returnCondition,
    damageNote: a.damageNote,
  }));
}
