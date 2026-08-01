import { Rng, allocateExactWhole, round2, id, hashHex, hashDigits } from "./rng";
import * as C from "./catalog";
import { finishCommerce } from "./generate-part3";
import type { GenContext } from "./generator-types";
import type { Dataset } from "../schemas";
import type * as T from "../schemas/entities";
import type {
  CoverageType, JobOutcome, ProductLine, RootCause,
  TicketSeverity, TicketStatus, Vertical,
} from "../schemas/enums";

const DAY = 86_400_000;


/** Exact split of `total` across weights, each part <= its weight. */
function allocateProportionalCapped(total: number, weights: number[]): number[] {
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum < total) throw new Error(`allocateProportionalCapped: capacity ${wSum} < target ${total}`);
  const parts: number[] = [];
  let running = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    const v = Math.min(weights[i]!, Math.round((total * weights[i]!) / wSum));
    parts.push(v);
    running += v;
  }
  const last = total - running;
  parts.push(last);
  // Repair if the tail overflowed its cap.
  const lastCap = weights[weights.length - 1]!;
  if (last > lastCap) {
    let excess = last - lastCap;
    parts[parts.length - 1] = lastCap;
    for (let i = 0; i < parts.length - 1 && excess > 0; i++) {
      const room = weights[i]! - parts[i]!;
      const take = Math.min(room, excess);
      parts[i] = parts[i]! + take;
      excess -= take;
    }
    if (excess > 0) throw new Error("allocateProportionalCapped: unable to place residue");
  }
  return parts;
}

export function finish(ds: Dataset, rng: Rng, now: Date, ctx: GenContext): Dataset {
  const {
    machineItems, spareItems, serviceItems, custById, sitesByCustomer,
    fieldEngineers, amcByAsset, users, cw,
  } = ctx;
  const { uSM, uSE, uBM } = users;

  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number, h = 10, m = 0) => {
    const d = new Date(now.getTime() - n * DAY);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const shift = (base: Date, days: number, hours = 0) =>
    new Date(base.getTime() + days * DAY + hours * 3_600_000);
  const between = (from: Date, to: Date) =>
    new Date(from.getTime() + rng.next() * (to.getTime() - from.getTime()));
  const fullName = () => `${rng.pick(C.FIRST_NAMES)} ${rng.pick(C.LAST_NAMES)}`;
  const addMonths = (d: Date, m: number) => {
    const x = new Date(d.getTime()); const day = x.getDate();
    x.setMonth(x.getMonth() + m); if (x.getDate() < day) x.setDate(0);
    return x;
  };

  const branchIds = ds.branches.map((b) => b.id);
  const assetById = new Map(ds.assets.map((a) => [a.id, a]));
  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  const salesUsers = [uSE, uBM];
  const fyStart2526 = new Date(2025, 3, 1);
  const fyEnd2526 = new Date(2026, 2, 31, 23, 59);
  const fy2627Start = new Date(2026, 3, 1);

  /* ================================================ numbering series */
  const seriesDefs: [string, string][] = [
    ["QUOTATION", "BC/QT"], ["SALES_ORDER", "BC/SO"], ["CHALLAN", "BC/DC"],
    ["INVOICE", "BC/INV"], ["RECEIPT", "BC/RCPT"], ["CREDIT_NOTE", "BC/CN"],
    ["TICKET", "BC/TKT"], ["JOB_CARD", "BC/JC"], ["COMMISSIONING", "BC/CR"],
    ["AMC", "BC/AMC"], ["RA_BILL", "BC/RA"], ["PURCHASE_ORDER", "BC/PO"],
    ["ENQUIRY", "BC/ENQ"], ["PARTS_REQUEST", "BC/PR"], ["GRN", "BC/GRN"],
    ["LEAVE", "BC/LV"], ["APPROVAL", "BC/APR"], ["DSR", "BC/DSR"], ["STOCK_COUNT", "BC/SC"],
  ];
  seriesDefs.forEach(([docType, prefix], i) => {
    ds.numberingSeries.push({
      id: id("NS", i + 1, 2), docType, prefix, fySegment: "2627", width: 4, current: 0,
    });
  });

  /* ====================================================== commissioning (74) */
  /**
   * Ordered deliberately: assets outside warranty come first and keep
   * pre-warranty commissioning dates, so writing a commissioning report never
   * silently moves an asset back into warranty and breaks the 38/104/144 split.
   */
  const inWarrantySet = new Set(ctx.inWarranty.map((a) => a.id));
  const nonWarrantyPool = rng.shuffle(ds.assets.filter((a) => !inWarrantySet.has(a.id))).slice(0, 36);
  const commissionPool = [...nonWarrantyPool, ...ctx.inWarranty];

  commissionPool.forEach((asset, i) => {
    const windowDays = C.OEM_COMMISSIONING_WINDOW_DAYS[asset.principal];
    const keepsWarranty = inWarrantySet.has(asset.id);
    let commDate: Date;
    let submittedAt: Date | null;
    if (i >= 72) {
      // 2 currently overdue — the exception-feed hook. Recent by necessity, so
      // these are drawn from the in-warranty group.
      commDate = daysAgo(windowDays + rng.int(2, 6));
      submittedAt = null;
    } else if (i >= 68) {
      commDate = keepsWarranty
        ? new Date(asset.commissioningDate!)
        : addMonths(now, -(asset.warrantyMonths + rng.int(3, 28)));
      submittedAt = shift(commDate, windowDays + rng.int(2, 14));
    } else {
      commDate = keepsWarranty
        ? new Date(asset.commissioningDate!)
        : addMonths(now, -(asset.warrantyMonths + rng.int(2, 30)));
      submittedAt = shift(commDate, rng.int(1, windowDays));
    }
    asset.commissioningDate = iso(commDate);
    asset.installationDate = iso(shift(commDate, -rng.int(1, 8)));
    const engineer = rng.pick(fieldEngineers);
    ds.commissioningReports.push({
      id: id("CMR", i + 1, 3),
      number: `BC/CR/2627/${String(i + 1).padStart(4, "0")}`,
      assetId: asset.id, commissioningDate: iso(commDate),
      engineerUserId: engineer.id,
      siteConditions: rng.pick(["Covered utility room, adequate ventilation", "Open shed, dust exposure moderate", "Dedicated compressor house, good access", "Terrace plant room, ambient high"]),
      supplyVoltage: rng.pick(["415 V ± 5%", "410 V", "420 V"]),
      supplyPhase: "3 Phase, 4 Wire",
      earthingOhms: round2(rng.float(0.4, 3.8, 2)),
      accessoriesFitted: rng.pick(["Air receiver, moisture separator, line filter", "Refrigerated dryer and pre-filter", "Auto drain and pressure gauge", "Receiver tank only"]),
      checklist: C.COMMISSIONING_CHECKLIST.map((item, ci) => {
        const pass = !(i % 11 === 0 && ci === 9);
        return { item, pass, remark: pass ? "" : "Full-load current 6% above nameplate; customer advised to check supply balance." };
      }),
      initialPressureBar: round2(rng.float(6.2, 8.6, 1)),
      initialFadCfm: asset.capacityUnit === "CFM" ? round2(asset.capacityValue * rng.float(0.94, 1.02, 2)) : null,
      loadCurrentAmp: round2(rng.float(8, 180, 1)),
      trainingAcknowledged: true,
      customerSignatory: fullName(),
      customerDesignation: rng.pick(C.DESIGNATIONS_CUSTOMER),
      dealerAuthorisedBy: engineer.name,
      submittedAt: submittedAt ? iso(submittedAt) : null,
      acknowledgementRef: submittedAt ? `OEM-ACK-${hashHex(`ack${i}`, 8).toUpperCase()}` : null,
      createdAt: iso(commDate),
    });
  });

  /* ================================================= tickets (512) + open 41 */
  const openPlan: { state: "BREACHED" | "IMMINENT" | "APPROACHING" | "COMFORTABLE"; count: number }[] = [
    { state: "BREACHED", count: 7 }, { state: "IMMINENT", count: 5 },
    { state: "APPROACHING", count: 9 }, { state: "COMFORTABLE", count: 20 },
  ];
  const severityFor = (): TicketSeverity =>
    rng.weighted([["CRITICAL", 14], ["HIGH", 28], ["NORMAL", 44], ["LOW", 14]]);
  const slaHours = (sev: TicketSeverity): [number, number] =>
    sev === "CRITICAL" ? [4, 24] : sev === "HIGH" ? [8, 48] : sev === "NORMAL" ? [24, 96] : [48, 168];

  const coverageOf = (asset: T.InstalledAsset): { cov: CoverageType; basis: string; amc: T.AMCContract | null } => {
    const comm = asset.commissioningDate ? new Date(asset.commissioningDate) : null;
    const wEnd = comm ? addMonths(comm, asset.warrantyMonths) : null;
    if (wEnd && wEnd > now) {
      return { cov: "IN_WARRANTY", basis: `Warranty runs to ${wEnd.toISOString().slice(0, 10)} (commissioning + ${asset.warrantyMonths} months)`, amc: null };
    }
    const amc = amcByAsset.get(asset.id);
    if (amc && new Date(amc.startDate) <= now && new Date(amc.endDate) >= now) {
      return { cov: "UNDER_AMC", basis: `Live ${amc.coverage === "COMPREHENSIVE" ? "comprehensive" : "non-comprehensive"} AMC ${amc.number}`, amc };
    }
    return { cov: "CHARGEABLE", basis: "No live warranty or AMC on this serial", amc: null };
  };

  let tktN = 0;
  const closedTicketCount = 512 - 41;
  const allTickets: T.ServiceTicket[] = [];

  const makeTicket = (opts: {
    asset: T.InstalledAsset; loggedAt: Date; severity: TicketSeverity;
    status: TicketStatus; engineer: T.Employee | null;
  }): T.ServiceTicket => {
    tktN++;
    const { asset, loggedAt, severity, status, engineer } = opts;
    const { cov, basis, amc } = coverageOf(asset);
    let [respH, restH] = slaHours(severity);
    let rule = `Default by severity (${severity})`;
    if (amc) { respH = amc.responseHours; restH = amc.restorationHours; rule = `AMC contract terms — ${amc.number}`; }
    else if (asset.productLine === "SCREW_COMPRESSOR" && severity === "CRITICAL") {
      respH = 4; restH = 48; rule = "OEM commitment — ELGi air-restoration programme";
    }
    const t: T.ServiceTicket = {
      id: id("TKT", tktN, 4), number: `BC/TKT/2627/${String(tktN).padStart(4, "0")}`,
      customerId: asset.customerId, siteId: asset.siteId, assetId: asset.id,
      branchId: asset.branchId,
      category: rng.weighted([["BREAKDOWN", 46], ["PREVENTIVE_MAINTENANCE", 30], ["INSTALLATION_COMMISSIONING", 8], ["WARRANTY_CLAIM", 7], ["INSPECTION", 6], ["RENTAL_SUPPORT", 3]]),
      severity,
      problem: rng.pick(C.OBSERVATION_PRESETS[C.machineFamily(asset.productLine)]!),
      reportedByContactId: ds.contacts.find((c) => c.customerId === asset.customerId)?.id ?? null,
      channel: rng.weighted([["PHONE", 46], ["WHATSAPP", 34], ["WEBSITE", 8], ["WALK_IN", 6], ["OEM_LEAD", 3], ["REFERRAL", 3]]),
      coverage: cov, coverageBasis: basis, amcContractId: amc?.id ?? null,
      scheduledVisitId: null, status,
      assignedEngineerId: engineer?.id ?? null, assignmentOverrideReason: null,
      loggedAt: iso(loggedAt),
      responseDue: iso(new Date(loggedAt.getTime() + respH * 3_600_000)),
      restorationDue: iso(new Date(loggedAt.getTime() + restH * 3_600_000)),
      slaRuleApplied: rule, slaBusinessHours: false,
      firstResponseAt: null, restoredAt: null, closedAt: null,
      breachedAt: null, breachReasonCode: null, pausedMs: 0, pauseStartedAt: null,
    };
    return t;
  };

  const engineerForBranch = (branchId: string) =>
    fieldEngineers.find((f) => f.branchId === branchId) ?? rng.pick(fieldEngineers);

  // Closed history
  for (let i = 0; i < closedTicketCount; i++) {
    const asset = ds.assets[i % ds.assets.length]!;
    const loggedAt = daysAgo(rng.int(3, 360), rng.int(8, 18), rng.int(0, 59));
    const severity = severityFor();
    const eng = engineerForBranch(asset.branchId);
    const t = makeTicket({ asset, loggedAt, severity, status: "CLOSED", engineer: eng });
    const [respH, restH] = [new Date(t.responseDue).getTime() - loggedAt.getTime(), new Date(t.restorationDue).getTime() - loggedAt.getTime()];
    const onTime = rng.bool(0.86); // trailing SLA compliance 86%
    t.firstResponseAt = iso(new Date(loggedAt.getTime() + respH * rng.float(0.2, onTime ? 0.85 : 1.4)));
    const restoredAt = new Date(loggedAt.getTime() + restH * rng.float(0.25, onTime ? 0.9 : 1.6));
    t.restoredAt = iso(restoredAt);
    t.closedAt = iso(shift(restoredAt, rng.int(0, 2)));
    if (!onTime) {
      t.breachedAt = t.restorationDue;
      t.breachReasonCode = rng.pick(["PARTS_UNAVAILABLE", "SITE_ACCESS_DENIED", "ENGINEER_UNAVAILABLE", "CUSTOMER_DEFERRED"]);
    }
    allTickets.push(t);
  }

  // Open 41, with the exact SLA-state distribution
  const openStatuses: TicketStatus[] = ["LOGGED", "ASSIGNED", "EN_ROUTE", "ON_SITE", "AWAITING_PARTS", "AWAITING_CUSTOMER"];
  for (const plan of openPlan) {
    for (let i = 0; i < plan.count; i++) {
      const asset = rng.pick(ds.assets);
      const severity = plan.state === "BREACHED" ? rng.pick(["CRITICAL", "HIGH"] as TicketSeverity[]) : severityFor();
      const [, restH] = slaHours(severity);
      const amc = amcByAsset.get(asset.id);
      const effRest = amc ? amc.restorationHours : restH;
      // Choose loggedAt so remaining/effRest lands in the intended band.
      const fraction =
        plan.state === "BREACHED" ? rng.float(1.05, 2.1)
          : plan.state === "IMMINENT" ? rng.float(0.91, 0.985)
            : plan.state === "APPROACHING" ? rng.float(0.77, 0.9)
              : rng.float(0.05, 0.7);
      const loggedAt = new Date(now.getTime() - effRest * 3_600_000 * fraction);
      const status = plan.state === "BREACHED"
        ? rng.pick(["AWAITING_PARTS", "ON_SITE", "ASSIGNED"] as TicketStatus[])
        : rng.pick(openStatuses);
      const eng = status === "LOGGED" ? null : engineerForBranch(asset.branchId);
      const t = makeTicket({ asset, loggedAt, severity, status, engineer: eng });
      if (status !== "LOGGED") {
        t.firstResponseAt = iso(new Date(loggedAt.getTime() + (new Date(t.responseDue).getTime() - loggedAt.getTime()) * rng.float(0.2, 0.8)));
      }
      if (plan.state === "BREACHED") {
        t.breachedAt = t.restorationDue;
        t.breachReasonCode = rng.pick(["PARTS_UNAVAILABLE", "SITE_ACCESS_DENIED", "ENGINEER_UNAVAILABLE"]);
      }
      allTickets.push(t);
    }
  }
  ds.tickets = allTickets;
  const openTickets = ds.tickets.filter((t) => !["CLOSED", "CANCELLED", "RESOLVED"].includes(t.status));

  /* ============================================ job cards (2140) — C-12 fix */
  let jcN = 0, pcN = 0;
  const closedTickets = ds.tickets.filter((t) => t.status === "CLOSED");
  const targetJobCards = 2140;
  // Distribute visits: FTFR 78% => 22% of tickets need >1 visit.
  const visitsPerTicket = new Map<string, number>();
  closedTickets.forEach((t) => visitsPerTicket.set(t.id, rng.bool(0.78) ? 1 : rng.int(2, 3)));
  let placed = [...visitsPerTicket.values()].reduce((a, b) => a + b, 0) + openTickets.length;
  // Top up with extra revisits until we reach the target volume.
  const ticketIds = closedTickets.map((t) => t.id);
  let cursor = 0;
  while (placed < targetJobCards && ticketIds.length) {
    const tid = ticketIds[cursor % ticketIds.length]!;
    visitsPerTicket.set(tid, (visitsPerTicket.get(tid) ?? 1) + 1);
    placed++; cursor++;
  }

  const partsAwaitedItems = new Set<string>();
  const makeJobCard = (t: T.ServiceTicket, seq: number, outcome: JobOutcome, withParts: boolean): T.JobCard => {
    jcN++;
    const asset = assetById.get(t.assetId)!;
    const fam = C.machineFamily(asset.productLine);
    const eng = t.assignedEngineerId ? ds.employees.find((e) => e.id === t.assignedEngineerId)! : engineerForBranch(t.branchId);
    const site = ds.sites.find((s) => s.id === t.siteId)!;
    const base = new Date(t.loggedAt);
    const checkIn = shift(base, seq - 1 + rng.int(0, 2), rng.int(1, 8));
    const durH = rng.float(1.2, 4.5, 1);
    const jc: T.JobCard = {
      id: id("JC", jcN, 4), number: `BC/JC/2627/${String(jcN).padStart(4, "0")}`,
      ticketId: t.id, assetId: asset.id, engineerUserId: eng.id, visitSequence: seq,
      visitType: t.category === "PREVENTIVE_MAINTENANCE" ? "PM" : t.category === "INSTALLATION_COMMISSIONING" ? "INSTALLATION" : seq > 1 ? "REVISIT" : "BREAKDOWN",
      scheduledDate: iso(checkIn),
      checkInAt: iso(checkIn), checkOutAt: iso(new Date(checkIn.getTime() + durH * 3_600_000)),
      checkInLat: round2(site.lat + rng.float(-0.004, 0.004, 5)),
      checkInLng: round2(site.lng + rng.float(-0.004, 0.004, 5)),
      checkInPlace: `${site.name}, ${site.district}`,
      observations: rng.pick(C.OBSERVATION_PRESETS[fam]!),
      rootCause: rng.pick(["AIR_END_WEAR", "OIL_LEAK", "FILTER_CHOKED", "BELT_SLIP", "MOTOR_OVERLOAD", "PRESSURE_SWITCH", "VALVE_FAILURE", "COOLER_FOULING", "CONTROLLER_FAULT", "SEAL_FAILURE", "IMPELLER_WEAR", "ELECTRICAL_SUPPLY", "OPERATOR_ERROR", "SCHEDULED_SERVICE"] as RootCause[]),
      workPerformed: rng.pick(C.WORK_PRESETS[fam]!),
      runningHoursReading: asset.runningHours - rng.int(0, 900),
      nextVisitRecommendation: rng.pick(["Next PM due in 3 months or 2000 running hours", "Monitor discharge temperature weekly", "Plan air-end inspection at next shutdown", "Replace filters at next service", ""]),
      outcome, resolvedOnThisVisit: outcome === "RESOLVED" && seq === 1,
      customerAckName: fullName(), customerAckDesignation: rng.pick(C.DESIGNATIONS_CUSTOMER),
      customerSignature: `sig:${hashHex(`s${jcN}`, 10)}`,
      photos: rng.bool(0.35) ? [{ caption: rng.pick(["Nameplate", "Installed condition", "Replaced part", "Panel reading"]), tone: rng.pick(["steel", "amber", "slate"]) }] : [],
      labourAmount: 0, travelAmount: 0,
      submittedAt: iso(new Date(checkIn.getTime() + durH * 3_600_000 + 600_000)),
      tapCount: rng.int(5, 6),
      createdAt: iso(checkIn),
    };
    if (withParts) {
      const parts = rng.sample(spareItems.filter((s) => !s.productLine || s.productLine === asset.productLine), rng.int(1, 3));
      const chargeable = t.coverage === "CHARGEABLE" || (t.coverage === "UNDER_AMC" && amcByAsset.get(asset.id)?.coverage === "NON_COMPREHENSIVE");
      for (const p of parts) {
        pcN++;
        ds.partConsumptions.push({
          id: id("PCN", pcN, 4), jobCardId: jc.id, itemId: p.id,
          qty: rng.int(1, 3), rate: p.standardPrice, gstRate: p.gstRate,
          billable: chargeable, stockMovementId: null,
        });
      }
      if (chargeable) {
        jc.labourAmount = rng.int(1200, 9600);
        jc.travelAmount = rng.int(400, 3200);
      }
    }
    return jc;
  };

  for (const t of closedTickets) {
    const visits = visitsPerTicket.get(t.id) ?? 1;
    for (let v = 1; v <= visits; v++) {
      const last = v === visits;
      const outcome: JobOutcome = last ? "RESOLVED" : rng.pick(["PARTIALLY_RESOLVED", "PARTS_AWAITED", "REVISIT_REQUIRED"] as JobOutcome[]);
      ds.jobCards.push(makeJobCard(t, v, outcome, rng.bool(0.61)));
    }
  }
  for (const t of openTickets) {
    if (t.status === "LOGGED") continue;
    const outcome: JobOutcome | null = t.status === "AWAITING_PARTS" ? "PARTS_AWAITED" : null;
    const jc = makeJobCard(t, 1, outcome ?? "PARTIALLY_RESOLVED", t.status === "AWAITING_PARTS");
    if (!outcome) { jc.outcome = null; jc.checkOutAt = null; jc.submittedAt = null; }
    ds.jobCards.push(jc);
  }

  /* ============================== parts requests + 9 service-critical items */
  const serviceCriticalItems = rng.sample(spareItems.filter((s) => s.category === "SPARE"), 9);
  serviceCriticalItems.forEach((it) => partsAwaitedItems.add(it.id));
  let prN = 0;
  const awaitingTickets = ds.tickets.filter((t) => t.status === "AWAITING_PARTS");
  awaitingTickets.forEach((t, i) => {
    prN++;
    const jc = ds.jobCards.find((j) => j.ticketId === t.id);
    const item = serviceCriticalItems[i % serviceCriticalItems.length]!;
    ds.partsRequests.push({
      id: id("PRQ", prN, 3), number: `BC/PR/2627/${String(prN).padStart(4, "0")}`,
      jobCardId: jc?.id ?? null, projectId: null, boqLineId: null,
      requestedByUserId: ds.users.find((u) => u.employeeId === jc?.engineerUserId)?.id ?? uSM.id,
      stockLocationId: cw.id,
      lines: [{ itemId: item.id, qtyRequested: rng.int(1, 2), qtyIssued: 0 }],
      serviceCritical: true, status: "PENDING",
      raisedAt: iso(daysAgo(rng.int(1, 6))), issuedAt: null,
    });
  });
  // 28 historical parts-driven revisits (C-13) so the stock-out ↔ FTFR chart has signal
  for (let i = 0; i < 28; i++) {
    prN++;
    const item = serviceCriticalItems[i % serviceCriticalItems.length]!;
    const jc = ds.jobCards[(i * 37) % ds.jobCards.length]!;
    const raised = daysAgo(rng.int(20, 320));
    ds.partsRequests.push({
      id: id("PRQ", prN, 3), number: `BC/PR/2627/${String(prN).padStart(4, "0")}`,
      jobCardId: jc.id, projectId: null, boqLineId: null,
      requestedByUserId: uSM.id, stockLocationId: cw.id,
      lines: [{ itemId: item.id, qtyRequested: 1, qtyIssued: 1 }],
      serviceCritical: true, status: "ISSUED",
      raisedAt: iso(raised), issuedAt: iso(shift(raised, rng.int(2, 9))),
    });
  }

  /* ============================================ enquiries / quotations / orders */
  let enqN = 0, qtN = 0, qlN = 0, soN = 0, solN = 0;
  const verticalPick = (): Vertical =>
    rng.weighted([["EQUIPMENT_SALES", 62], ["SERVICE_AMC", 22], ["PROJECTS", 10], ["RENTAL", 6]]);

  for (let i = 0; i < 340; i++) {
    enqN++;
    const cust = ds.customers[i % ds.customers.length]!;
    const sites = sitesByCustomer.get(cust.id)!;
    const v = verticalPick();
    const created = daysAgo(rng.int(1, 360), rng.int(9, 18));
    const pl: ProductLine | null = v === "EQUIPMENT_SALES"
      ? rng.pick(["PISTON_COMPRESSOR", "SCREW_COMPRESSOR", "OIL_FREE_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR", "PUMP", "LIFTING_EQUIPMENT"] as ProductLine[])
      : null;
    const unassigned = i % 47 === 0;
    ds.enquiries.push({
      id: id("ENQ", enqN, 4), number: `BC/ENQ/2627/${String(enqN).padStart(4, "0")}`,
      customerId: cust.id, siteId: sites[0]!.id, branchId: cust.branchId, vertical: v,
      source: rng.weighted([["PHONE", 30], ["WHATSAPP", 24], ["WEBSITE", 14], ["WALK_IN", 10], ["REFERRAL", 10], ["EXHIBITION", 6], ["OEM_LEAD", 6]]),
      requirement: v === "EQUIPMENT_SALES"
        ? `Requirement for ${pl ? C.productLineLabel(pl) : "equipment"} to replace ageing unit; customer seeking energy-efficient option.`
        : v === "SERVICE_AMC" ? "Enquiry for annual maintenance cover on installed machines."
          : v === "PROJECTS" ? "Enquiry for effluent treatment package including erection and commissioning."
            : "Enquiry for compressor on monthly rental for shutdown work.",
      productLine: pl,
      paramCfm: pl && pl !== "PUMP" ? rng.int(25, 480) : null,
      paramBar: pl && pl !== "PUMP" ? round2(rng.float(6, 10, 1)) : null,
      paramHeadM: pl === "PUMP" ? rng.int(12, 90) : null,
      paramFlowLpm: pl === "PUMP" ? rng.int(200, 4200) : null,
      expectedValue: rng.int(45, 3200) * 1000,
      expectedClosure: iso(shift(created, rng.int(15, 120))),
      ownerUserId: unassigned ? null : rng.pick(salesUsers).id,
      status: "NEW", stageEnteredAt: iso(created), createdAt: iso(created),
    });
  }

  const quotationPlan = [
    { status: "WON" as const, count: 71 }, { status: "LOST" as const, count: 88 },
    { status: "ISSUED" as const, count: 26 }, { status: "NEGOTIATION" as const, count: 15 },
    { status: "EXPIRED" as const, count: 14 },
  ]; // open = 26 + 15 = 41

  const quotationsForEnquiry = rng.shuffle(ds.enquiries).slice(0, 214);
  let qIdx = 0;
  for (const plan of quotationPlan) {
    for (let i = 0; i < plan.count; i++) {
      qtN++;
      const enq = quotationsForEnquiry[qIdx++]!;
      const cust = custById.get(enq.customerId)!;
      const qDate = new Date(new Date(enq.createdAt).getTime() + rng.int(1, 12) * DAY);
      const validity = rng.pick([15, 30, 45]);
      const lineCount = rng.int(1, 5);
      const q: T.Quotation = {
        id: id("QT", qtN, 4), number: `BC/QT/2627/${String(qtN).padStart(4, "0")}`,
        version: 1, rootId: id("QT", qtN, 4), supersedesId: null, changeSummary: null,
        enquiryId: enq.id, customerId: cust.id, siteId: enq.siteId, branchId: cust.branchId,
        ownerUserId: enq.ownerUserId ?? uSE.id, vertical: enq.vertical,
        status: plan.status, quotationDate: iso(qDate), validityDays: validity,
        paymentTerms: rng.pick(["30% advance, balance against delivery", "50% advance, 50% on commissioning", "100% against proforma", "45 days from invoice"]),
        deliveryTerms: rng.pick(["4-6 weeks ex-works", "2-3 weeks from PO", "Ready stock", "8-10 weeks"]),
        warrantyTerms: rng.pick(["12 months from commissioning", "18 months from commissioning or 4000 hours", "24 months on structure, 12 on components"]),
        inclusions: "Supply, installation supervision, commissioning and operator training.",
        exclusions: "Civil foundation, electrical cabling up to panel, and unloading at site.",
        technicalNotes: enq.paramCfm ? `Sized for ${enq.paramCfm} CFM at ${enq.paramBar} bar working pressure.` : "Sizing confirmed against site survey.",
        lossReason: plan.status === "LOST" ? rng.weighted(C.LOSS_REASON_WEIGHTS.map(([r, w]) => [r, w] as const)) : null,
        competitor: plan.status === "LOST" && rng.bool(0.62) ? rng.pick(C.COMPETITORS) : null,
        approvalRequestId: null, approvedByUserId: null, approvedAt: null,
        sourceAmcContractId: null,
        stageEnteredAt: iso(qDate), createdAt: iso(qDate),
      };
      if (plan.status === "EXPIRED") {
        const old = daysAgo(rng.int(validity + 5, validity + 90));
        q.quotationDate = iso(old); q.stageEnteredAt = iso(old); q.createdAt = iso(old);
      }
      ds.quotations.push(q);
      enq.status = plan.status === "WON" ? "WON" : plan.status === "LOST" ? "LOST" : "QUOTED";

      for (let l = 0; l < lineCount; l++) {
        qlN++;
        const pool = enq.vertical === "SERVICE_AMC" ? serviceItems : machineItems;
        const item = rng.pick(pool);
        ds.quotationLines.push({
          id: id("QTL", qlN, 4), quotationId: q.id, itemId: item.id,
          description: item.description, hsnSac: item.hsnSac, uom: item.uom,
          qty: rng.int(1, 4), rate: item.standardPrice,
          discountPct: rng.weighted([[0, 40], [2, 20], [5, 22], [8, 10], [12, 8]]),
          gstRate: item.gstRate,
        });
      }
    }
  }

  // A revised quotation pair so version history is demonstrable (E3-S5)
  const revBase = ds.quotations.find((q) => q.status === "NEGOTIATION")!;
  qtN++;
  const revised: T.Quotation = {
    ...revBase, id: id("QT", qtN, 4), number: revBase.number, version: 2,
    rootId: revBase.rootId, supersedesId: revBase.id,
    changeSummary: "Revised after site visit: dryer capacity increased and payment terms relaxed to 45 days.",
    quotationDate: iso(shift(new Date(revBase.quotationDate), 6)),
  };
  revBase.status = "ISSUED";
  ds.quotations.push(revised);
  ds.quotationLines.filter((l) => l.quotationId === revBase.id).forEach((l) => {
    qlN++;
    ds.quotationLines.push({ ...l, id: id("QTL", qlN, 4), quotationId: revised.id, discountPct: l.discountPct + 2 });
  });

  // Sales orders from won quotations; order book exactly ₹2.38 Cr
  const wonQuotes = ds.quotations.filter((q) => q.status === "WON");
  const orderBookParts = allocateExactWhole(rng, 23_800_000, 24, 0.6);
  wonQuotes.forEach((q, i) => {
    soN++;
    const orderDate = shift(new Date(q.quotationDate), rng.int(3, 24));
    const so: T.SalesOrder = {
      id: id("SO", soN, 4), number: `BC/SO/2627/${String(soN).padStart(4, "0")}`,
      quotationId: q.id, customerId: q.customerId, siteId: q.siteId, branchId: q.branchId,
      ownerUserId: q.ownerUserId, vertical: q.vertical, orderDate: iso(orderDate),
      customerPoRef: `PO/${String(orderDate.getFullYear()).slice(2)}/${hashDigits(`po${i}`, 4)}`,
      customerPoDate: iso(shift(orderDate, -rng.int(1, 8))),
      deliverySchedule: rng.pick(["Single lot within 6 weeks", "Two lots — 60% / 40%", "Against release schedule", "Immediate ex-stock"]),
      advanceReceived: 0,
      status: i < 24 ? "OPEN" : "FULFILLED",
      createdAt: iso(orderDate),
    };
    ds.salesOrders.push(so);
    const qLines = ds.quotationLines.filter((l) => l.quotationId === q.id);
    // The 24 open orders carry the order-book value exactly.
    const targetValue = i < 24 ? orderBookParts[i]! : 0;
    const lineValues = i < 24 ? allocateExactWhole(rng, targetValue, qLines.length, 0.4) : [];
    qLines.forEach((l, li) => {
      solN++;
      const rate = i < 24 ? Math.round(lineValues[li]! / Math.max(1, l.qty)) : l.rate;
      ds.salesOrderLines.push({
        id: id("SOL", solN, 4), salesOrderId: so.id, itemId: l.itemId,
        description: l.description, hsnSac: l.hsnSac, uom: l.uom, qty: l.qty,
        rate, discountPct: 0, gstRate: l.gstRate,
        qtyDelivered: i < 24 ? 0 : l.qty, qtyInvoiced: i < 24 ? 0 : l.qty,
      });
    });
  });

  /* ================================================================ targets */
  const fyStartCur = new Date(2026, 3, 1), fyEndCur = new Date(2027, 2, 31);
  ds.branches.forEach((b, i) => {
    ds.targets.push({
      id: id("TGT", i + 1, 3), branchId: b.id, userId: null,
      periodStart: iso(fyStartCur), periodEnd: iso(fyEndCur),
      amount: [42_000_000, 24_000_000, 18_000_000, 12_000_000][i]!,
      label: `${b.city} — FY 2026-27 revenue target`,
    });
  });
  [uSE, uBM].forEach((u, i) => {
    ds.targets.push({
      id: id("TGT", 10 + i, 3), branchId: null, userId: u.id,
      periodStart: iso(fyStartCur), periodEnd: iso(fyEndCur),
      amount: [9_600_000, 14_400_000][i]!, label: `${u.name} — FY 2026-27 personal target`,
    });
  });

  return finishCommerce(ds, rng, now, ctx, {
    iso, daysAgo, shift, between, fullName, addMonths, custById, itemById,
    assetById, branchIds, fyStart2526, fyEnd2526, fy2627Start,
    serviceCriticalItems, partsAwaitedItems, allocateProportionalCapped,
  });
}
export type { GenContext } from "./generator-types";
