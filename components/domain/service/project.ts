import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "@/lib/seed/catalog";
import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import type { TicketSeverity } from "@/lib/schemas/enums";
import { PRODUCT_LINE_LABEL } from "@/lib/schemas/enums";
import { formatDate } from "@/lib/format";
import { coverageFrom, resolveSla, type CoverageFacts } from "./sla";
import type { TrailEvent } from "./store";
import type {
  AssetView, CoverageDerivation, EngineerView, JobCardView, PartLineView,
  PlannedVisitView, SiteView, SlaResolution, StockItemView, StockLocationView, TicketView,
} from "./types";
import { OUTCOME_LABEL, TICKET_STATUS_LABEL } from "./types";

/**
 * Server-side projection. Pages read the seeded world once here and hand the
 * client compact, serialisable view models — the 2,137-row job-card table never
 * crosses the wire, only the page being looked at.
 *
 * Nothing in this file derives a number that `/lib/derive` already owns.
 */

export interface ServiceCtx {
  ds: Dataset;
  now: Date;
  nowMs: number;
  holidayKeys: string[];
}

export function serviceCtx(): ServiceCtx {
  const ds = getDataset();
  const now = new Date(ds.meta.today);
  return {
    ds,
    now,
    nowMs: now.getTime(),
    holidayKeys: ds.holidays.map((h) => new Date(h.date).toISOString().slice(0, 10)),
  };
}

/* ---------------------------------------------------------------- lookups */

export function siteOf(ds: Dataset, siteId: string): SiteView {
  const s = ds.sites.find((x) => x.id === siteId);
  if (!s) {
    return {
      id: siteId, name: "Unknown site", address: "", district: "", state: "", pincode: "",
      lat: 0, lng: 0, contactPerson: "", contactPhone: "", notes: "",
    };
  }
  return {
    id: s.id, name: s.name, address: s.address, district: s.district, state: s.state,
    pincode: s.pincode, lat: s.lat, lng: s.lng,
    contactPerson: s.contactPerson, contactPhone: s.contactPhone, notes: s.notes,
  };
}

export function assetOf(ds: Dataset, assetId: string): AssetView {
  const a = ds.assets.find((x) => x.id === assetId);
  if (!a) {
    return {
      id: assetId, serial: "—", principal: "OTHER", productLine: "AIR_ACCESSORY",
      model: "Unknown", capacityValue: 0, capacityUnit: "", ratedKw: null,
      locationInSite: "", runningHours: 0, runningHoursAtMs: 0,
      commissioningDateMs: null, warrantyMonths: 0, status: "RUNNING",
    };
  }
  return {
    id: a.id, serial: a.serial, principal: a.principal, productLine: a.productLine,
    model: a.model, capacityValue: a.capacityValue, capacityUnit: a.capacityUnit,
    ratedKw: a.ratedKw, locationInSite: a.locationInSite, runningHours: a.runningHours,
    runningHoursAtMs: new Date(a.runningHoursAt).getTime(),
    commissioningDateMs: a.commissioningDate ? new Date(a.commissioningDate).getTime() : null,
    warrantyMonths: a.warrantyMonths, status: a.status,
  };
}

/* ------------------------------------------------------- coverage (E4-S1) */

/**
 * FR-M4-03 — coverage is derived from the live warranty and AMC state, and the
 * derivation is shown as evidence rather than asserted.
 */
export function coverageFactsFor(ds: Dataset, asset: T.InstalledAsset, now: Date): CoverageFacts {
  const wEnd = D.warrantyEnd(asset);
  const amc = D.liveAmcFor(ds, asset.id, now);
  return {
    assetStatus: asset.status,
    commissioningDateMs: asset.commissioningDate ? new Date(asset.commissioningDate).getTime() : null,
    warrantyMonths: asset.warrantyMonths,
    warrantyEndMs: wEnd ? wEnd.getTime() : null,
    amc: amc
      ? {
        id: amc.id,
        number: amc.number,
        coverage: amc.coverage,
        startMs: new Date(amc.startDate).getTime(),
        endMs: new Date(amc.endDate).getTime(),
        responseHours: amc.responseHours,
        restorationHours: amc.restorationHours,
      }
      : null,
    nowMs: now.getTime(),
  };
}

export function deriveCoverage(ds: Dataset, asset: T.InstalledAsset, now: Date): CoverageDerivation {
  return coverageFrom(coverageFactsFor(ds, asset, now), D.coverageState(ds, asset, now));
}

/* --------------------------------------------------- intake search index */

export interface AssetIntakeRow {
  id: string;
  serial: string;
  model: string;
  principal: string;
  productLine: string;
  productLineLabel: string;
  capacityValue: number;
  capacityUnit: string;
  ratedKw: number | null;
  locationInSite: string;
  runningHours: number;
  runningHoursAtMs: number;
  status: string;
  customerId: string;
  customerName: string;
  customerType: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  siteDistrict: string;
  sitePincode: string;
  siteLat: number;
  siteLng: number;
  siteContactPerson: string;
  siteContactPhone: string;
  branchId: string;
  branchName: string;
  branchPhone: string;
  branchLat: number;
  branchLng: number;
  coverageState: string;
  facts: CoverageFacts;
}

export interface ContactRow {
  id: string;
  customerId: string;
  name: string;
  designation: string;
  mobile: string;
  isPrimary: boolean;
}

/**
 * E4-S1 — assets are searchable by serial, model or customer, and selecting one
 * populates site, machine particulars and coverage. The whole register is a
 * 286-row index, so the search resolves without a round trip.
 */
export function projectAssetIndex(ds: Dataset, now: Date): AssetIntakeRow[] {
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  const siteById = new Map(ds.sites.map((s) => [s.id, s]));
  const branchById = new Map(ds.branches.map((b) => [b.id, b]));
  return ds.assets.map((a) => {
    const c = custById.get(a.customerId);
    const s = siteById.get(a.siteId);
    const b = branchById.get(a.branchId);
    return {
      id: a.id,
      serial: a.serial,
      model: a.model,
      principal: a.principal,
      productLine: a.productLine,
      productLineLabel: PRODUCT_LINE_LABEL[a.productLine],
      capacityValue: a.capacityValue,
      capacityUnit: a.capacityUnit,
      ratedKw: a.ratedKw,
      locationInSite: a.locationInSite,
      runningHours: a.runningHours,
      runningHoursAtMs: new Date(a.runningHoursAt).getTime(),
      status: a.status,
      customerId: a.customerId,
      customerName: c?.tradeName ?? "—",
      customerType: c?.type ?? "INDUSTRIAL",
      siteId: a.siteId,
      siteName: s?.name ?? "—",
      siteAddress: s?.address ?? "",
      siteDistrict: s?.district ?? "",
      sitePincode: s?.pincode ?? "",
      siteLat: s?.lat ?? 0,
      siteLng: s?.lng ?? 0,
      siteContactPerson: s?.contactPerson ?? "",
      siteContactPhone: s?.contactPhone ?? "",
      branchId: a.branchId,
      branchName: b?.name ?? "—",
      branchPhone: b?.phone ?? "",
      branchLat: b?.lat ?? 0,
      branchLng: b?.lng ?? 0,
      coverageState: D.coverageState(ds, a, now),
      facts: coverageFactsFor(ds, a, now),
    };
  });
}

export function projectContacts(ds: Dataset): ContactRow[] {
  return ds.contacts.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    name: c.name,
    designation: c.designation,
    mobile: c.mobile,
    isPrimary: c.isPrimary,
  }));
}

/* ------------------------------------------------------------ SLA (E4-S1) */

export function resolveSlaFor(
  ds: Dataset,
  asset: T.InstalledAsset,
  severity: TicketSeverity,
  now: Date,
): SlaResolution {
  const amc = D.liveAmcFor(ds, asset.id, now);
  const oemDefinition =
    ds.slaDefinitions.find(
      (d) => d.productLine === asset.productLine && d.severity === severity,
    ) ?? null;
  const severityDefinition =
    ds.slaDefinitions.find((d) => d.productLine === null && d.severity === severity) ?? null;

  return resolveSla({
    severity,
    productLine: PRODUCT_LINE_LABEL[asset.productLine],
    amc: amc
      ? {
        id: amc.id, number: amc.number, responseHours: amc.responseHours,
        restorationHours: amc.restorationHours, coverage: amc.coverage,
      }
      : null,
    oemDefinition,
    severityDefinition,
  });
}

/* --------------------------------------------------------------- tickets */

export function projectTicket(ds: Dataset, t: T.ServiceTicket, _now: Date): TicketView {
  const customer = ds.customers.find((c) => c.id === t.customerId);
  const branch = ds.branches.find((b) => b.id === t.branchId);
  const asset = ds.assets.find((a) => a.id === t.assetId);
  const contact = t.reportedByContactId
    ? ds.contacts.find((c) => c.id === t.reportedByContactId)
    : undefined;
  const engineer = t.assignedEngineerId
    ? ds.employees.find((e) => e.id === t.assignedEngineerId)
    : undefined;
  const amc = t.amcContractId ? ds.amcContracts.find((a) => a.id === t.amcContractId) : undefined;
  const sla = asset ? resolveSlaFor(ds, asset, t.severity, new Date(t.loggedAt)) : null;

  return {
    id: t.id,
    number: t.number,
    status: t.status,
    severity: t.severity,
    category: t.category,
    problem: t.problem,
    channel: t.channel,
    customerId: t.customerId,
    customerName: customer?.tradeName ?? "Unknown customer",
    customerType: customer?.type ?? "INDUSTRIAL",
    site: siteOf(ds, t.siteId),
    asset: assetOf(ds, t.assetId),
    contactName: contact?.name ?? null,
    contactDesignation: contact?.designation ?? null,
    contactPhone: contact?.mobile ?? null,
    branchId: t.branchId,
    branchName: branch?.name ?? "—",
    branchPhone: branch?.phone ?? "",
    branchLat: branch?.lat ?? 0,
    branchLng: branch?.lng ?? 0,
    engineerId: t.assignedEngineerId,
    engineerName: engineer?.name ?? null,
    assignmentOverrideReason: t.assignmentOverrideReason,
    coverage: t.coverage,
    coverageBasis: t.coverageBasis,
    amcContractId: t.amcContractId,
    amcNumber: amc?.number ?? null,
    amcCoverage: amc?.coverage ?? null,
    loggedAtMs: new Date(t.loggedAt).getTime(),
    responseDueMs: new Date(t.responseDue).getTime(),
    restorationDueMs: new Date(t.restorationDue).getTime(),
    firstResponseAtMs: t.firstResponseAt ? new Date(t.firstResponseAt).getTime() : null,
    restoredAtMs: t.restoredAt ? new Date(t.restoredAt).getTime() : null,
    closedAtMs: t.closedAt ? new Date(t.closedAt).getTime() : null,
    breachedAtMs: t.breachedAt ? new Date(t.breachedAt).getTime() : null,
    breachReasonCode: t.breachReasonCode,
    pausedMs: t.pausedMs,
    pauseStartedAtMs: t.pauseStartedAt ? new Date(t.pauseStartedAt).getTime() : null,
    slaRuleApplied: t.slaRuleApplied,
    slaBusinessHours: t.slaBusinessHours,
    slaResponseHours:
      sla?.responseHours ??
      Math.round((new Date(t.responseDue).getTime() - new Date(t.loggedAt).getTime()) / 3_600_000),
    slaRestorationHours:
      sla?.restorationHours ??
      Math.round((new Date(t.restorationDue).getTime() - new Date(t.loggedAt).getTime()) / 3_600_000),
    pauseOnAwaitingParts: sla?.pauseOnAwaitingParts ?? true,
    pauseOnAwaitingCustomer: sla?.pauseOnAwaitingCustomer ?? true,
  };
}

/* ------------------------------------------------------------- engineers */

export function projectEngineers(ds: Dataset, _now: Date): EngineerView[] {
  const open = ds.tickets.filter(D.isOpenTicket);
  const rank: Record<string, number> = {
    ON_SITE: 5, EN_ROUTE: 4, AWAITING_PARTS: 3, AWAITING_CUSTOMER: 2, ASSIGNED: 1,
  };
  return ds.employees
    .filter((e) => e.designation === "Field Service Engineer" && e.active)
    .map((e) => {
      const mine = open.filter((t) => t.assignedEngineerId === e.id);
      const branch = ds.branches.find((b) => b.id === e.branchId);
      let best = "";
      let bestRank = 0;
      for (const t of mine) {
        const r = rank[t.status] ?? 0;
        if (r > bestRank) {
          bestRank = r;
          best = t.status;
        }
      }
      const overCapacity = mine.length >= e.dailyCapacity;
      return {
        id: e.id,
        name: e.name,
        code: e.code,
        branchId: e.branchId,
        branchName: branch?.city ?? "—",
        phone: e.phone,
        dailyCapacity: e.dailyCapacity,
        oemCertifications: e.oemCertifications,
        loadToday: mine.length,
        statusLabel: best ? TICKET_STATUS_LABEL[best as keyof typeof TICKET_STATUS_LABEL] : "Available",
        statusTone: !best
          ? ("ok" as const)
          : overCapacity
            ? ("danger" as const)
            : best === "ON_SITE" || best === "EN_ROUTE"
              ? ("info" as const)
              : ("warn" as const),
      };
    })
    .sort((a, b) => a.loadToday - b.loadToday || a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------- job cards */

export function projectJobCard(ds: Dataset, j: T.JobCard, _now: Date): JobCardView {
  const ticket = ds.tickets.find((t) => t.id === j.ticketId);
  const asset = ds.assets.find((a) => a.id === j.assetId);
  const customer = ticket ? ds.customers.find((c) => c.id === ticket.customerId) : undefined;
  const site = ticket ? ds.sites.find((s) => s.id === ticket.siteId) : undefined;
  const branch = ticket ? ds.branches.find((b) => b.id === ticket.branchId) : undefined;
  const engineer = ds.employees.find((e) => e.id === j.engineerUserId);
  const amc = ticket?.amcContractId
    ? ds.amcContracts.find((a) => a.id === ticket.amcContractId)
    : undefined;

  const stamp = j.checkInAt ? new Date(j.checkInAt).getTime() : new Date(j.scheduledDate).getTime();
  let prev: { value: number; atMs: number; source: string } | null = null;
  for (const other of ds.jobCards) {
    if (other.assetId !== j.assetId || other.id === j.id) continue;
    if (other.runningHoursReading === null) continue;
    const at = other.checkInAt ? new Date(other.checkInAt).getTime() : new Date(other.scheduledDate).getTime();
    if (at >= stamp) continue;
    if (!prev || other.runningHoursReading > prev.value) {
      prev = { value: other.runningHoursReading, atMs: at, source: `Job card ${other.number}` };
    }
  }
  if (asset) {
    const regAt = new Date(asset.runningHoursAt).getTime();
    if (regAt < stamp && (!prev || asset.runningHours > prev.value)) {
      prev = { value: asset.runningHours, atMs: regAt, source: "Asset register" };
    }
  }

  return {
    id: j.id,
    number: j.number,
    ticketId: j.ticketId,
    ticketNumber: ticket?.number ?? "—",
    assetId: j.assetId,
    assetSerial: asset?.serial ?? "—",
    assetModel: asset?.model ?? "—",
    assetProductLine: asset?.productLine ?? "SCREW_COMPRESSOR",
    assetPrincipal: asset?.principal ?? "ELGI",
    customerId: ticket?.customerId ?? "",
    customerName: customer?.tradeName ?? "—",
    siteName: site?.name ?? "—",
    siteAddress: site ? `${site.address}, ${site.district} ${site.pincode}` : "—",
    branchName: branch?.name ?? "—",
    engineerId: j.engineerUserId,
    engineerName: engineer?.name ?? "—",
    visitSequence: j.visitSequence,
    visitType: j.visitType,
    scheduledDateMs: new Date(j.scheduledDate).getTime(),
    checkInAtMs: j.checkInAt ? new Date(j.checkInAt).getTime() : null,
    checkOutAtMs: j.checkOutAt ? new Date(j.checkOutAt).getTime() : null,
    checkInPlace: j.checkInPlace,
    checkInLat: j.checkInLat,
    checkInLng: j.checkInLng,
    observations: j.observations,
    rootCause: j.rootCause,
    workPerformed: j.workPerformed,
    runningHoursReading: j.runningHoursReading,
    meterReplacementNote: null,
    nextVisitRecommendation: j.nextVisitRecommendation,
    outcome: j.outcome,
    customerAckName: j.customerAckName,
    customerAckDesignation: j.customerAckDesignation,
    signatureStrokes: null,
    signatureRef: j.customerSignature,
    photos: j.photos,
    labourAmount: j.labourAmount,
    travelAmount: j.travelAmount,
    submittedAtMs: j.submittedAt ? new Date(j.submittedAt).getTime() : null,
    tapCount: j.tapCount,
    coverage: ticket?.coverage ?? "CHARGEABLE",
    coverageBasis: ticket?.coverageBasis ?? "No ticket linked",
    amcCoverage: amc?.coverage ?? null,
    previousReading: prev?.value ?? null,
    previousReadingAtMs: prev?.atMs ?? null,
    previousReadingSource: prev?.source ?? null,
  };
}

export function projectParts(ds: Dataset, jobCardId: string): PartLineView[] {
  return ds.partConsumptions
    .filter((p) => p.jobCardId === jobCardId)
    .map((p) => {
      const item = ds.items.find((i) => i.id === p.itemId);
      const movement = p.stockMovementId
        ? ds.stockMovements.find((m) => m.id === p.stockMovementId)
        : undefined;
      const loc = movement?.fromLocationId
        ? ds.stockLocations.find((l) => l.id === movement.fromLocationId)
        : undefined;
      return {
        id: p.id,
        jobCardId: p.jobCardId,
        itemId: p.itemId,
        itemCode: item?.code ?? "—",
        description: item?.description ?? "Unknown item",
        uom: item?.uom ?? "Nos",
        qty: p.qty,
        rate: p.rate,
        cost: item?.standardCost ?? 0,
        gstRate: p.gstRate,
        billable: p.billable,
        locationId: loc?.id ?? "SL-CW",
        locationName: loc?.name ?? "Central Warehouse — Patna",
        movementId: p.stockMovementId,
        returned: false,
      };
    });
}

/* ---------------------------------------------------------------- stock */

export function projectStockLocations(ds: Dataset, branchId: string, engineerId: string | null): StockLocationView[] {
  const out: StockLocationView[] = [];
  const cw = ds.stockLocations.find((l) => l.kind === "CENTRAL_WAREHOUSE");
  if (cw) out.push({ id: cw.id, code: cw.code, name: cw.name, kind: cw.kind });
  const branchStore = ds.stockLocations.find((l) => l.kind === "BRANCH" && l.branchId === branchId);
  if (branchStore) {
    out.push({ id: branchStore.id, code: branchStore.code, name: branchStore.name, kind: branchStore.kind });
  }
  if (engineerId) {
    const emp = ds.employees.find((e) => e.id === engineerId);
    const boot = emp ? ds.stockLocations.find((l) => l.kind === "ENGINEER_BOOT" && l.code === `BOOT-${emp.code}`) : undefined;
    if (boot) out.push({ id: boot.id, code: boot.code, name: boot.name, kind: boot.kind });
  }
  return out;
}

const STOCK_ITEM_CAP = 240;

export function projectStockItems(
  ds: Dataset,
  productLine: string,
  locations: StockLocationView[],
): StockItemView[] {
  const critical = new Set(
    ds.partsRequests.filter((r) => r.serviceCritical).flatMap((r) => r.lines.map((l) => l.itemId)),
  );
  const candidates = ds.items.filter(
    (i) =>
      i.active &&
      (i.category === "SPARE" || i.category === "CONSUMABLE" || i.category === "ACCESSORY") &&
      (i.productLine === productLine || i.productLine === null),
  );
  return candidates.slice(0, STOCK_ITEM_CAP).map((i) => {
    const onHand: Record<string, number> = {};
    for (const l of locations) onHand[l.id] = D.stockOnHand(ds, i.id, l.id);
    return {
      id: i.id,
      code: i.code,
      description: i.description,
      uom: i.uom,
      gstRate: i.gstRate,
      standardCost: i.standardCost,
      standardPrice: i.standardPrice,
      productLine: i.productLine,
      principal: i.principal,
      reorderLevel: i.reorderLevel,
      onHand,
      serviceCritical: critical.has(i.id),
    };
  });
}

export function stockItemCandidateCount(ds: Dataset, productLine: string): { shown: number; total: number } {
  const total = ds.items.length;
  const shown = Math.min(
    STOCK_ITEM_CAP,
    ds.items.filter(
      (i) =>
        i.active &&
        (i.category === "SPARE" || i.category === "CONSUMABLE" || i.category === "ACCESSORY") &&
        (i.productLine === productLine || i.productLine === null),
    ).length,
  );
  return { shown, total };
}

/* --------------------------------------------------- preventive schedule */

export function projectPlannedVisits(ds: Dataset, now: Date, withinDays: number): PlannedVisitView[] {
  const horizon = now.getTime() + withinDays * 86_400_000;
  const out: PlannedVisitView[] = [];
  for (const v of ds.scheduledVisits) {
    if (v.completedAt) continue;
    const due = new Date(v.dueDate).getTime();
    if (due < now.getTime() || due > horizon) continue;
    const amc = ds.amcContracts.find((a) => a.id === v.amcContractId);
    const asset = ds.assets.find((a) => a.id === v.assetId);
    if (!amc || !asset) continue;
    const customer = ds.customers.find((c) => c.id === amc.customerId);
    const site = ds.sites.find((s) => s.id === asset.siteId);
    const branch = ds.branches.find((b) => b.id === asset.branchId);
    out.push({
      id: v.id,
      amcContractId: amc.id,
      amcNumber: amc.number,
      assetId: asset.id,
      assetSerial: asset.serial,
      assetModel: asset.model,
      customerName: customer?.tradeName ?? "—",
      siteName: site?.name ?? "—",
      siteDistrict: site?.district ?? "—",
      branchId: asset.branchId,
      branchName: branch?.name ?? "—",
      dueDateMs: due,
      sequence: v.sequence,
      visitsPerYear: amc.visitsPerYear,
    });
  }
  return out.sort((a, b) => a.dueDateMs - b.dueDateMs);
}

/* -------------------------------------------------- seeded activity trail */

/**
 * FR-M4-32 — the chronological trail. Everything the seed knows about a ticket
 * is reconstructed as events so the trail is complete on first load, before the
 * session overlay adds anything.
 */
export function seededTrail(ds: Dataset, t: T.ServiceTicket): TrailEvent[] {
  const events: TrailEvent[] = [];
  const push = (e: Omit<TrailEvent, "id" | "ticketId">) =>
    events.push({ ...e, id: `SEED-${t.id}-${events.length}`, ticketId: t.id });

  const engineer = t.assignedEngineerId
    ? ds.employees.find((e) => e.id === t.assignedEngineerId)
    : undefined;
  const contact = t.reportedByContactId
    ? ds.contacts.find((c) => c.id === t.reportedByContactId)
    : undefined;

  push({
    jobCardId: null,
    atMs: new Date(t.loggedAt).getTime(),
    kind: "CREATED",
    title: `Ticket logged via ${t.channel.toLowerCase().replace(/_/g, " ")}`,
    detail: `${t.problem}. Coverage derived as ${t.coverage === "CHARGEABLE" ? "Chargeable" : t.coverage === "IN_WARRANTY" ? "Warranty" : "AMC"} — ${t.coverageBasis}. SLA rule applied: ${t.slaRuleApplied}.`,
    actor: contact ? `${contact.name}, ${contact.designation}` : "Service desk",
  });

  push({
    jobCardId: null,
    atMs: new Date(t.loggedAt).getTime() + 1000,
    kind: "COMMUNICATION",
    title: "Notification dispatched",
    detail: "Service Manager and the owning branch notified per the notification matrix.",
    actor: "Pravaah",
  });

  if (t.firstResponseAt) {
    push({
      jobCardId: null,
      atMs: new Date(t.firstResponseAt).getTime(),
      kind: "STATUS",
      title: "First response recorded",
      detail: `Response commitment was ${formatDate(t.responseDue)}. ${
        new Date(t.firstResponseAt) <= new Date(t.responseDue) ? "Met." : "Missed."
      }`,
      actor: engineer?.name ?? "Service desk",
    });
  }

  if (engineer) {
    push({
      jobCardId: null,
      atMs: new Date(t.loggedAt).getTime() + 2000,
      kind: "ASSIGNED",
      title: `Assigned to ${engineer.name}`,
      detail: `${engineer.code} · ${engineer.oemCertifications.join(", ") || "no OEM certification recorded"}${
        t.assignmentOverrideReason ? ` · Override reason: ${t.assignmentOverrideReason}` : ""
      }`,
      actor: "Service Manager",
    });
  }

  for (const j of ds.jobCards.filter((x) => x.ticketId === t.id)) {
    if (j.checkInAt) {
      push({
        jobCardId: j.id,
        atMs: new Date(j.checkInAt).getTime(),
        kind: "VISIT",
        title: `Visit ${j.visitSequence} — checked in`,
        detail: `${j.number} at ${j.checkInPlace ?? "site"}.`,
        actor: ds.employees.find((e) => e.id === j.engineerUserId)?.name ?? "Engineer",
      });
    }
    if (j.submittedAt) {
      push({
        jobCardId: j.id,
        atMs: new Date(j.submittedAt).getTime(),
        kind: "VISIT",
        title: `Visit ${j.visitSequence} — job card submitted`,
        detail: `Outcome ${j.outcome ? OUTCOME_LABEL[j.outcome] : "not set"}. ${j.workPerformed}`,
        actor: ds.employees.find((e) => e.id === j.engineerUserId)?.name ?? "Engineer",
      });
    }
    for (const p of ds.partConsumptions.filter((x) => x.jobCardId === j.id)) {
      const item = ds.items.find((i) => i.id === p.itemId);
      const mv = p.stockMovementId ? ds.stockMovements.find((m) => m.id === p.stockMovementId) : undefined;
      push({
        jobCardId: j.id,
        atMs: mv ? new Date(mv.at).getTime() : new Date(j.submittedAt ?? j.scheduledDate).getTime(),
        kind: "PARTS",
        title: `Part consumed — ${item?.description ?? p.itemId}`,
        detail: `${p.qty} ${item?.uom ?? "Nos"} issued against ${j.number}${
          p.billable ? ", billable" : ", non-billable under coverage"
        }.`,
        actor: "Store",
      });
    }
  }

  for (const r of ds.partsRequests.filter((r) => {
    const jc = r.jobCardId ? ds.jobCards.find((j) => j.id === r.jobCardId) : null;
    return jc?.ticketId === t.id;
  })) {
    push({
      jobCardId: r.jobCardId,
      atMs: new Date(r.raisedAt).getTime(),
      kind: "REQUEST",
      title: `Parts request ${r.number} raised`,
      detail: `${r.lines.length} line(s), ${r.serviceCritical ? "flagged service-critical" : "standard priority"}. Store In-charge and Service Manager notified.`,
      actor: "Field engineer",
    });
  }

  if (t.breachedAt) {
    push({
      jobCardId: null,
      atMs: new Date(t.breachedAt).getTime(),
      kind: "BREACH",
      title: "Restoration commitment breached",
      detail: `Reason code ${t.breachReasonCode ?? "not recorded"}. Escalated to the Service Manager and the Director – Business.`,
      actor: "Pravaah",
    });
  }

  if (t.restoredAt) {
    push({
      jobCardId: null,
      atMs: new Date(t.restoredAt).getTime(),
      kind: "CLOSURE",
      title: "Restored",
      detail: "Restoration clock stopped at this timestamp.",
      actor: "Service desk",
    });
  }
  if (t.closedAt) {
    push({
      jobCardId: null,
      atMs: new Date(t.closedAt).getTime(),
      kind: "CLOSURE",
      title: "Ticket closed",
      detail: "No further visits expected against this ticket.",
      actor: "Service Manager",
    });
  }

  return events.sort((a, b) => a.atMs - b.atMs);
}

/* -------------------------------------------------------- route ordering */

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
}

/**
 * E4-S8 — "suggested route order". Nearest-next from the branch, computed on
 * great-circle distance. This is a heuristic ordering, not route optimisation:
 * the E4 scope boundary puts optimisation algorithms explicitly out of scope,
 * and the screen says so.
 */
export function suggestRoute(from: { lat: number; lng: number }, stops: RouteStop[]): string[] {
  const remaining = [...stops];
  const order: string[] = [];
  let cursor = from;
  while (remaining.length) {
    let bestIdx = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cursor, remaining[i]!);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    if (!next) break;
    order.push(next.id);
    cursor = next;
  }
  return order;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* --------------------------------------------------------------- helpers */

export const OEM_WINDOW = OEM_COMMISSIONING_WINDOW_DAYS;

/** A phone number is only offered as tap-to-call when it is genuinely dialable. */
export function dialable(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
