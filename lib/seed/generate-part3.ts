import { Rng, allocateExactWhole, round2, id, hashHex, hashDigits } from "./rng";
import * as C from "./catalog";
import type { Dataset } from "../schemas";
import type * as T from "../schemas/entities";
import type { AttendanceState, TaxTreatment, Vertical } from "../schemas/enums";
import type { GenContext, Helpers } from "./generator-types";

const DAY = 86_400_000;


/** Revenue plan — every figure the PRD publishes, split so the totals close exactly. */
const REV = {
  // FY 2025-26 = ₹8.62 Cr, split by vertical then by period
  aprJul25: { EQUIPMENT_SALES: 14_700_000, SERVICE_AMC: 5_900_000, PROJECTS: 5_400_000, RENTAL: 800_000 },
  augMar26: { EQUIPMENT_SALES: 32_700_000, SERVICE_AMC: 13_100_000, PROJECTS: 11_800_000, RENTAL: 1_800_000 },
  // FY 2026-27 year to date (Apr–Jul 2026) = ₹3.05 Cr
  aprJul26: { EQUIPMENT_SALES: 16_800_000, SERVICE_AMC: 6_800_000, PROJECTS: 6_000_000, RENTAL: 900_000 },
} as const;

const VERTICALS: Vertical[] = ["EQUIPMENT_SALES", "SERVICE_AMC", "PROJECTS", "RENTAL"];

export function finishCommerce(
  ds: Dataset, rng: Rng, now: Date, ctx: GenContext, h: Helpers,
): Dataset {
  const { iso, daysAgo, shift, between, fullName, addMonths, custById, itemById, allocateProportionalCapped } = h;
  const { users, cw, spareItems, serviceItems, machineItems, institutionalIds } = ctx;
  const { uDB, uSM, uAC, uPM, uST, uSE, uHR } = users;

  /* ==================================================== projects (7) + BOQ */
  const projectDefs = [
    { name: "Sewage Treatment Plant Package — 1200 KLD", value: 13_500_000, status: "IN_PROGRESS" as const, live: true, atRisk: true, months: 14 },
    { name: "Effluent Treatment Plant Package — 250 KLD", value: 8_600_000, status: "IN_PROGRESS" as const, live: true, atRisk: false, months: 11 },
    { name: "Sewage Pipeline Works — Zone 4", value: 4_200_000, status: "MOBILISED" as const, live: true, atRisk: false, months: 8 },
    { name: "Water Treatment Package — 400 KLD", value: 7_400_000, status: "DLP" as const, live: false, atRisk: false, months: 12 },
    { name: "Effluent Recycling Upgrade", value: 5_100_000, status: "DLP" as const, live: false, atRisk: false, months: 9 },
    { name: "Compressed Air Distribution Network", value: 2_900_000, status: "CLOSED" as const, live: false, atRisk: false, months: 6 },
    { name: "Raw Water Pumping Station", value: 6_300_000, status: "CLOSED" as const, live: false, atRisk: false, months: 10 },
  ];
  const instCustomers = ds.customers.filter((c) => institutionalIds.has(c.id));
  let boqN = 0, msN = 0;
  projectDefs.forEach((p, i) => {
    const cust = instCustomers[i % instCustomers.length]!;
    const start = p.live ? daysAgo(rng.int(120, 420)) : daysAgo(rng.int(430, 900));
    const completion = addMonths(start, p.months);
    ds.projects.push({
      id: id("PRJ", i + 1, 2), code: `BC/PRJ/${String(start.getFullYear()).slice(2)}/${String(i + 1).padStart(2, "0")}`,
      name: p.name, customerId: cust.id, clientType: cust.type,
      siteLocation: `${rng.pick(["Sector", "Zone", "Ward"])} ${rng.int(1, 12)}, ${ds.sites.find((s) => s.customerId === cust.id)?.district ?? "Patna"}`,
      district: ds.sites.find((s) => s.customerId === cust.id)?.district ?? "Patna",
      scopeSummary: "Design, supply, erection, testing and commissioning of the treatment package including civil works, mechanical equipment, electrical and instrumentation, followed by the contracted O&M period.",
      contractType: rng.pick(["Item rate", "EPC lump sum", "Item rate with price variation"]),
      workOrderRef: `WO/${String(start.getFullYear()).slice(2)}/${hashDigits(`wo${i}`, 5)}`,
      workOrderDate: iso(shift(start, -rng.int(8, 30))),
      contractValue: p.value, startDate: iso(start),
      contractualCompletion: iso(completion),
      revisedCompletion: p.atRisk ? iso(addMonths(completion, 2)) : null,
      actualCompletion: p.live ? null : iso(addMonths(completion, rng.int(0, 2))),
      defectLiabilityMonths: 12, retentionPct: 5,
      mobilisationAdvance: Math.round(p.value * 0.1),
      priceVariationClause: rng.bool(0.4),
      liquidatedDamagesTerms: "0.5% of contract value per week of delay, capped at 5%.",
      managerUserId: uPM.id, branchId: cust.branchId, status: p.status,
      varianceTolerancePct: 5, createdAt: iso(start),
    });
  });

  // 240 BOQ lines across 7 projects, sectioned
  const perProject = [52, 44, 28, 34, 30, 24, 28]; // = 240
  ds.projects.forEach((prj, pi) => {
    const count = perProject[pi]!;
    const sections = C.BOQ_SECTIONS;
    const valueParts = allocateExactWhole(rng, prj.contractValue, count, 0.7);
    for (let i = 0; i < count; i++) {
      boqN++;
      const section = sections[i % sections.length]!;
      const tmpl = rng.pick(C.BOQ_TEMPLATES[section]!);
      const rate = Math.round(rng.float(tmpl.rate[0], tmpl.rate[1], 0));
      const qty = round2(Math.max(1, valueParts[i]! / rate));
      ds.boqLines.push({
        id: id("BOQ", boqN, 4), projectId: prj.id, section, sortOrder: i,
        code: `${section.slice(0, 2).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
        description: tmpl.desc, uom: tmpl.uom, contractedQty: qty, rate,
        variationQty: 0, variationRef: null, itemId: null,
      });
    }
    // milestones
    const msNames = ["Mobilisation", "Civil works complete", "Equipment delivered", "Erection complete", "Trial run", "Handover"];
    const weights = [10, 25, 20, 25, 10, 10];
    msNames.forEach((nm, mi) => {
      msN++;
      const planned = new Date(new Date(prj.startDate).getTime() + ((new Date(prj.contractualCompletion).getTime() - new Date(prj.startDate).getTime()) * (mi + 1)) / msNames.length);
      const done = planned < now && (prj.status !== "IN_PROGRESS" || mi < 3);
      ds.milestones.push({
        id: id("MST", msN, 3), projectId: prj.id, name: nm,
        plannedDate: iso(planned),
        actualDate: done ? iso(shift(planned, rng.int(-3, 18))) : null,
        weightage: weights[mi]!,
        status: done ? "COMPLETE" : planned < now ? "SLIPPED" : "PENDING",
      });
    });
  });

  // Executed quantities via DPRs (420 across live projects), 6 hindrances
  const liveProjects = ds.projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "MOBILISED");
  const executed = new Map<string, number>();
  let dprN = 0;
  const dprPerProject = [180, 150, 90]; // = 420
  liveProjects.forEach((prj, pi) => {
    const lines = ds.boqLines.filter((l) => l.projectId === prj.id);
    // Physical progress target: the flagged project sits at -11% schedule variance.
    const elapsed = (now.getTime() - new Date(prj.startDate).getTime()) /
      (new Date(prj.contractualCompletion).getTime() - new Date(prj.startDate).getTime());
    const planned = Math.min(0.95, Math.max(0.05, elapsed));
    const actualPct = pi === 0 ? planned - 0.11 : planned + rng.float(-0.02, 0.03, 3);
    lines.forEach((l) => executed.set(l.id, round2(l.contractedQty * Math.max(0, actualPct))));

    const count = dprPerProject[pi] ?? 60;
    for (let i = 0; i < count; i++) {
      dprN++;
      const date = between(new Date(prj.startDate), now);
      const hasHindrance = dprN % 70 === 0;
      const hin = hasHindrance ? rng.pick(C.HINDRANCE_CAUSES) : null;
      const touched = rng.sample(lines, rng.int(1, 3));
      ds.dprs.push({
        id: id("DPR", dprN, 4), number: `DPR/${prj.code.split("/").pop()}/${String(i + 1).padStart(3, "0")}`,
        projectId: prj.id, date: iso(date),
        weather: rng.pick(["Clear", "Hot and humid", "Intermittent rain", "Overcast", "Heavy rain"]),
        manpower: [
          { trade: "Mason", count: rng.int(2, 12) }, { trade: "Fitter", count: rng.int(2, 10) },
          { trade: "Welder", count: rng.int(1, 6) }, { trade: "Helper", count: rng.int(4, 20) },
          { trade: "Electrician", count: rng.int(0, 4) },
        ],
        plant: [{ name: rng.pick(["Excavator", "Concrete mixer", "Welding set", "Crane 12T", "Vibrator"]), count: rng.int(1, 3) }],
        execution: touched.map((l) => ({ boqLineId: l.id, qty: round2((executed.get(l.id) ?? 0) / count) })),
        materialsReceived: rng.pick(["Cement 120 bags, steel 2.4 MT", "Diffuser assemblies 40 nos", "MS pipe 6 m lengths — 18 nos", "Nil", "Cable drum 200 m"]),
        siteInstructions: rng.pick(["Client engineer inspected reinforcement", "Instructed to raise chamber level by 150 mm", "Nil", "Third-party sampling carried out"]),
        hindrance: hin?.text ?? null, hindranceCause: hin?.cause ?? null,
        safetyObservations: rng.pick(["Toolbox talk conducted", "PPE compliance satisfactory", "Barricading reinforced at excavation", "Nil reportable"]),
        photos: rng.bool(0.3) ? [{ caption: "Progress view", tone: "slate" }] : [],
        byUserId: uPM.id, supersedesId: null, supersedeReason: null,
        submittedAt: iso(shift(date, 0, 19)),
      });
    }
  });
  // Completed projects: fully executed
  ds.projects.filter((p) => !liveProjects.includes(p)).forEach((prj) => {
    ds.boqLines.filter((l) => l.projectId === prj.id).forEach((l) => executed.set(l.id, l.contractedQty));
  });

  /* ================================== RA-bills (22) + retention ₹34.6 L exact */
  // Retention: 5 projects hold outstanding. 2 of them (DLP-expired) are eligible = ₹11.2 L.
  const retentionPlan: { projectIdx: number; amount: number; eligible: boolean }[] = [
    { projectIdx: 0, amount: 1_050_000, eligible: false },
    { projectIdx: 1, amount: 780_000, eligible: false },
    { projectIdx: 2, amount: 510_000, eligible: false },
    { projectIdx: 3, amount: 640_000, eligible: true },
    { projectIdx: 4, amount: 480_000, eligible: true },
  ];
  // 1,050,000 + 780,000 + 510,000 = 2,340,000 not eligible
  // 640,000 + 480,000 = 1,120,000 eligible  -> total 3,460,000 = ₹34.6 L ✓

  let raN = 0, retN = 0;
  const billsPerProject = [5, 4, 2, 4, 3, 2, 2]; // = 22
  ds.projects.forEach((prj, pi) => {
    const count = billsPerProject[pi]!;
    const lines = ds.boqLines.filter((l) => l.projectId === prj.id);
    const totalExecutedValue = round2(lines.reduce((s, l) => s + (executed.get(l.id) ?? 0) * l.rate, 0));
    const cumParts = allocateExactWhole(rng, Math.round(totalExecutedValue), count, 0.35);
    const retPlan = retentionPlan.find((r) => r.projectIdx === pi);
    const retParts = retPlan ? allocateExactWhole(rng, retPlan.amount, count, 0.3) : [];
    let prevCum = 0;
    for (let i = 0; i < count; i++) {
      raN++;
      const cum = prevCum + cumParts[i]!;
      const claimed = cum - prevCum;
      const isLast = i === count - 1;
      const awaitingLong = pi === 1 && isLast; // one bill awaiting certification > 45 days
      const varianceCase = pi === 0 && i === count - 2; // one certified 7% below claim
      const certified = awaitingLong ? null : varianceCase ? Math.round(claimed * 0.93) : claimed;
      const submitted = daysAgo(awaitingLong ? 47 : rng.int(20, 400));
      const status: T.RABill["status"] = awaitingLong ? "SUBMITTED" : isLast && prj.status === "IN_PROGRESS" ? "CERTIFIED" : "PAID";
      const bill: T.RABill = {
        id: id("RAB", raN, 3), number: `BC/RA/${prj.code.split("/").pop()}/${String(i + 1).padStart(2, "0")}`,
        projectId: prj.id, sequence: i + 1,
        periodFrom: iso(shift(submitted, -30)), periodTo: iso(submitted),
        cumulativeValue: cum, previousCumulative: prevCum,
        frozenExecution: lines.slice(0, 6).map((l) => ({ boqLineId: l.id, cumulativeQty: round2((executed.get(l.id) ?? 0) * ((i + 1) / count)) })),
        mobilisationRecovery: Math.round(prj.mobilisationAdvance / count),
        retentionPct: prj.retentionPct, tdsPct: 2, labourCessPct: 1,
        otherDeductions: 0, otherDeductionsNote: "",
        claimedValue: claimed, certifiedValue: certified,
        status,
        submittedAt: iso(submitted),
        certifiedAt: certified === null ? null : iso(shift(submitted, rng.int(8, 24))),
        paidAt: status === "PAID" ? iso(shift(submitted, rng.int(30, 70))) : null,
        invoiceId: null, createdAt: iso(shift(submitted, -4)),
      };
      ds.raBills.push(bill);
      prevCum = cum;

      if (retPlan && certified !== null) {
        retN++;
        const eligibleFrom = retPlan.eligible
          ? daysAgo(rng.int(12, 60))
          : addMonths(new Date(prj.contractualCompletion), prj.defectLiabilityMonths);
        ds.retentionEntries.push({
          id: id("RET", retN, 3), projectId: prj.id, raBillId: bill.id,
          amount: retParts[i]!, withheldOn: bill.certifiedAt!,
          eligibleFrom: iso(eligibleFrom),
          claimRaisedAt: null, releasedAt: null, releasedAmount: null, releaseRef: null,
        });
      }
    }
  });
  // Bills awaiting certification post no retention, so the per-project totals
  // drift below plan. Reconcile the last entry of each project back to plan.
  for (const plan of retentionPlan) {
    const prj = ds.projects[plan.projectIdx]!;
    const entries = ds.retentionEntries.filter((e) => e.projectId === prj.id);
    if (!entries.length) continue;
    const actual = entries.reduce((s, e) => s + e.amount, 0);
    const delta = plan.amount - actual;
    if (delta !== 0) entries[entries.length - 1]!.amount += delta;
  }

  // ₹6.8 L released historically on the two closed projects
  const releasedParts = allocateExactWhole(rng, 680_000, 2, 0.2);
  ds.projects.filter((p) => p.status === "CLOSED").forEach((prj, i) => {
    retN++;
    const bill = ds.raBills.find((b) => b.projectId === prj.id)!;
    const rel = daysAgo(rng.int(40, 260));
    ds.retentionEntries.push({
      id: id("RET", retN, 3), projectId: prj.id, raBillId: bill.id,
      amount: releasedParts[i]!, withheldOn: bill.certifiedAt ?? bill.submittedAt!,
      eligibleFrom: iso(shift(rel, -30)), claimRaisedAt: iso(shift(rel, -20)),
      releasedAt: iso(rel), releasedAmount: releasedParts[i]!,
      releaseRef: `REL/${hashDigits(`rel${i}`, 6)}`,
    });
  });

  // Project cost capture (X-16c / BR-031)
  let pcostN = 0;
  ds.projects.forEach((prj) => {
    (["MATERIAL", "SUBCONTRACT", "LABOUR", "PLANT", "OVERHEAD"] as const).forEach((cat) => {
      pcostN++;
      const share = { MATERIAL: 0.44, SUBCONTRACT: 0.2, LABOUR: 0.16, PLANT: 0.08, OVERHEAD: 0.06 }[cat];
      const committed = Math.round(prj.contractValue * share * rng.float(0.92, 1.05));
      ds.projectCosts.push({
        id: id("PCS", pcostN, 3), projectId: prj.id, category: cat,
        committed, incurred: Math.round(committed * rng.float(0.55, 0.98)),
        asOf: iso(now), note: "",
      });
    });
  });

  /* ============================================ invoices, receipts, ageing */
  let invN = 0, ilN = 0, rcN = 0, raAllocN = 0, chN = 0, ewN = 0, cnN = 0, cfN = 0;

  const invoiceOf = (opts: {
    date: Date; vertical: Vertical; customer: T.Customer; total: number;
    type: T.Invoice["type"]; sourceLabel?: Partial<T.Invoice>;
  }): T.Invoice => {
    invN++;
    const { date, customer, total, type } = opts;
    const site = ds.sites.find((s) => s.customerId === customer.id)!;
    const isExport = customer.country === "NP";
    const treatment: TaxTreatment = isExport
      ? "EXPORT_ZERO_RATED"
      : site.stateCode === "10" ? "INTRA_STATE_CGST_SGST" : "INTER_STATE_IGST";
    const gstRate = isExport ? 0 : 18;
    const taxable = Math.round(total / (1 + gstRate / 100));
    const inv: T.Invoice = {
      id: id("INV", invN, 4),
      number: `BC/INV/${String(date.getFullYear()).slice(2)}${String((date.getFullYear() + 1) % 100)}/${String(invN).padStart(4, "0")}`,
      type, date: iso(date),
      dueDate: iso(shift(date, customer.creditTermDays || 30)),
      customerId: customer.id, siteId: site.id, branchId: customer.branchId,
      placeOfSupplyStateCode: site.stateCode, placeOfSupplyName: site.state,
      taxTreatment: treatment,
      salesOrderId: null, jobCardId: null, amcContractId: null, raBillId: null,
      rentalAgreementId: null, challanId: null,
      roundOff: 0,
      irn: null, ackNumber: null, ackDate: null, irpReportedAt: null,
      eInvoiceApplicable: !isExport && customer.gstin !== null,
      eInvoiceExemptReason: isExport ? "Export supply — e-invoicing not applicable under LUT" : customer.gstin === null ? "Unregistered recipient (B2C)" : null,
      ownerUserId: uAC.id, createdAt: iso(date),
      ...opts.sourceLabel,
    };
    if (inv.eInvoiceApplicable) {
      inv.irn = hashHex(`irn${inv.number}`, 64);
      inv.ackNumber = hashDigits(`ack${inv.number}`, 15);
      inv.ackDate = iso(shift(date, 0, 3));
      inv.irpReportedAt = iso(shift(date, rng.int(0, 6)));
    }
    ds.invoices.push(inv);

    /**
     * Lines are allocated on the GROSS figure and the rate is back-derived, so
     * that Σ round(qty · rate · (1+gst)) equals the planned total to the rupee.
     * Allocating on taxable and rounding the rate drifted the FY totals.
     */
    const lineCount = rng.int(1, 4);
    const pool = type === "SERVICE" || type === "AMC" ? serviceItems : type === "SPARES" ? spareItems : machineItems;
    const grossParts = allocateExactWhole(rng, total, lineCount, 0.5);
    for (let li = 0; li < lineCount; li++) {
      ilN++;
      const item = rng.pick(pool);
      const qty = rng.int(1, 3);
      ds.invoiceLines.push({
        id: id("INL", ilN, 5), invoiceId: inv.id, itemId: item.id,
        description: item.description, hsnSac: item.hsnSac, uom: item.uom,
        qty, rate: grossParts[li]! / qty / (1 + gstRate / 100), discountPct: 0, gstRate,
      });
    }
    void taxable;
    return inv;
  };

  // Nepal customers are reached only through the explicit export path below,
  // so the export-transaction count stays at the seeded 12.
  const custPoolFor = (vertical: Vertical, institutional: boolean) => {
    const pool = ds.customers.filter(
      (c) =>
        c.country !== "NP" &&
        (institutional ? institutionalIds.has(c.id) : !institutionalIds.has(c.id)),
    );
    return vertical === "PROJECTS" ? instCustomers : pool;
  };

  // ---- FY 2025-26: exact vertical split, dates spread across the year ------
  const priorBlocks: { from: Date; to: Date; plan: Record<Vertical, number>; count: number }[] = [
    { from: new Date(2025, 3, 1), to: new Date(2025, 6, 31), plan: REV.aprJul25 as unknown as Record<Vertical, number>, count: 140 },
    { from: new Date(2025, 7, 1), to: new Date(2026, 2, 31), plan: REV.augMar26 as unknown as Record<Vertical, number>, count: 260 },
  ];
  // The 12 Nepal export transactions are drawn from inside the planned totals,
  // not added on top of them, so the FY figures still close exactly.
  const nepalCustomers = ds.customers.filter((c) => c.country === "NP");
  let nepalUsed = 0;
  for (const block of priorBlocks) {
    const perVertical: Record<Vertical, number> = {
      EQUIPMENT_SALES: Math.round(block.count * 0.5),
      SERVICE_AMC: Math.round(block.count * 0.3),
      PROJECTS: Math.round(block.count * 0.1),
      RENTAL: 0,
    };
    perVertical.RENTAL = block.count - perVertical.EQUIPMENT_SALES - perVertical.SERVICE_AMC - perVertical.PROJECTS;
    for (const v of VERTICALS) {
      const n = Math.max(1, perVertical[v]);
      const amounts = allocateExactWhole(rng, block.plan[v], n, 0.8);
      for (let i = 0; i < n; i++) {
        const useNepal = v === "EQUIPMENT_SALES" && nepalUsed < 12 && i % 9 === 0;
        const institutional = v === "PROJECTS" || rng.bool(0.34);
        const pool = custPoolFor(v, institutional);
        const customer = useNepal
          ? nepalCustomers[nepalUsed++ % nepalCustomers.length]!
          : pool[(invN + i) % pool.length]!;
        invoiceOf({
          date: between(block.from, block.to), vertical: v, customer, total: amounts[i]!,
          type: v === "EQUIPMENT_SALES" ? (rng.bool(0.7) ? "EQUIPMENT" : "SPARES")
            : v === "SERVICE_AMC" ? (rng.bool(0.55) ? "SERVICE" : "AMC")
              : v === "PROJECTS" ? "PROJECT_RA" : "RENTAL",
        });
      }
    }
  }

  /**
   * FY 2026-27 year to date — ₹3.05 Cr, stratified by ageing window so each
   * bucket/segment has enough invoice value to carry its outstanding target.
   * The PRD publishes a vertical split only for FY 2025-26, so verticals here
   * are free; the date strata and the institutional share are what must hold.
   */
  const strata: { from: Date; to: Date; inst: number; priv: number; count: number }[] = [
    { from: shift(now, -30), to: now, inst: 4_800_000, priv: 3_700_000, count: 46 },
    { from: shift(now, -60), to: shift(now, -31), inst: 3_800_000, priv: 2_400_000, count: 38 },
    { from: shift(now, -90), to: shift(now, -61), inst: 2_600_000, priv: 1_500_000, count: 30 },
    { from: new Date(2026, 3, 1), to: shift(now, -91), inst: 6_000_000, priv: 5_700_000, count: 49 },
  ];
  // 8.5 + 6.2 + 4.1 + 11.7 = ₹30.5 L*10 = ₹3.05 Cr; counts 46+38+30+49 = 163
  for (const s of strata) {
    const instCount = Math.round(s.count / 2);
    for (const [segment, total] of [["inst", s.inst], ["priv", s.priv]] as const) {
      const n = segment === "inst" ? instCount : s.count - instCount;
      const amounts = allocateExactWhole(rng, total, n, 0.75);
      const pool = custPoolFor("EQUIPMENT_SALES", segment === "inst");
      for (let i = 0; i < n; i++) {
        const v: Vertical = rng.weighted([["EQUIPMENT_SALES", 52], ["SERVICE_AMC", 26], ["PROJECTS", 14], ["RENTAL", 8]]);
        invoiceOf({
          date: between(s.from, s.to), vertical: v,
          customer: pool[(invN + i) % pool.length]!, total: amounts[i]!,
          type: v === "EQUIPMENT_SALES" ? (rng.bool(0.7) ? "EQUIPMENT" : "SPARES")
            : v === "SERVICE_AMC" ? (rng.bool(0.55) ? "SERVICE" : "AMC")
              : v === "PROJECTS" ? "PROJECT_RA" : "RENTAL",
        });
      }
    }
  }
  // 55 pre-FY invoices (Feb–Mar 2025) so the 18-month history is genuine
  const domesticPool = ds.customers.filter((c) => c.country !== "NP");
  for (let i = 0; i < 55; i++) {
    const customer = domesticPool[(i * 7) % domesticPool.length]!;
    invoiceOf({
      date: between(new Date(2025, 1, 1), new Date(2025, 2, 31)),
      vertical: "EQUIPMENT_SALES", customer,
      total: rng.int(40, 900) * 1000, type: rng.bool(0.6) ? "EQUIPMENT" : "SPARES",
    });
  }
  /* ------------------------- receivables: exact buckets, exact institutional */
  const totalOf = (inv: T.Invoice) =>
    ds.invoiceLines.filter((l) => l.invoiceId === inv.id)
      .reduce((s, l) => s + Math.round(l.qty * l.rate * (1 + l.gstRate / 100)), 0);

  const invoiceTotals = new Map<string, number>();
  ds.invoices.forEach((inv) => invoiceTotals.set(inv.id, totalOf(inv)));

  const bucketWindows: { key: string; from: Date; to: Date; inst: number; priv: number }[] = [
    { key: "b0_30", from: shift(now, -30), to: now, inst: 3_600_000, priv: 2_800_000 },
    { key: "b31_60", from: shift(now, -60), to: shift(now, -31), inst: 2_900_000, priv: 1_800_000 },
    { key: "b61_90", from: shift(now, -90), to: shift(now, -61), inst: 2_000_000, priv: 1_100_000 },
    { key: "b90p", from: new Date(2026, 0, 1), to: shift(now, -91), inst: 2_700_000, priv: 1_300_000 },
  ];

  const outstandingByInvoice = new Map<string, number>();
  for (const w of bucketWindows) {
    for (const [segment, target] of [["inst", w.inst], ["priv", w.priv]] as const) {
      const candidates = ds.invoices.filter((inv) => {
        const d = new Date(inv.date);
        if (d < w.from || d > w.to) return false;
        if (outstandingByInvoice.has(inv.id)) return false;
        const isInst = institutionalIds.has(inv.customerId);
        return segment === "inst" ? isInst : !isInst;
      });
      const chosen: T.Invoice[] = [];
      let capacity = 0;
      for (const inv of candidates) {
        chosen.push(inv);
        capacity += invoiceTotals.get(inv.id)!;
        if (capacity >= target * 1.25 && chosen.length >= 5) break;
      }
      if (capacity < target) {
        throw new Error(`Seed: insufficient invoice capacity for ${w.key}/${segment} (${capacity} < ${target})`);
      }
      const parts = allocateProportionalCapped(target, chosen.map((c) => invoiceTotals.get(c.id)!));
      chosen.forEach((inv, i) => { if (parts[i]! > 0) outstandingByInvoice.set(inv.id, parts[i]!); });
    }
  }

  // Receipts: everything not left outstanding is collected.
  for (const inv of ds.invoices) {
    const total = invoiceTotals.get(inv.id)!;
    const outstanding = outstandingByInvoice.get(inv.id) ?? 0;
    const paid = total - outstanding;
    if (paid <= 0) continue;
    rcN++;
    const payDate = shift(new Date(inv.date), rng.int(6, 55));
    const receipt: T.Receipt = {
      id: id("RCT", rcN, 4), number: `BC/RCPT/2627/${String(rcN).padStart(4, "0")}`,
      customerId: inv.customerId, branchId: inv.branchId,
      date: iso(payDate > now ? shift(new Date(inv.date), 5) : payDate),
      amount: paid,
      mode: rng.weighted([["NEFT", 46], ["RTGS", 24], ["CHEQUE", 16], ["UPI", 8], ["CASH", 4], ["ADJUSTMENT", 2]]),
      reference: `UTR${hashDigits(`utr${rcN}`, 12)}`, simulatedUpi: false, byUserId: uAC.id,
    };
    ds.receipts.push(receipt);
    raAllocN++;
    ds.receiptAllocations.push({
      id: id("RAL", raAllocN, 4), receiptId: receipt.id, invoiceId: inv.id, amount: paid,
    });
  }

  // 4 broken payment promises on 90+ invoices
  const overdue = [...outstandingByInvoice.keys()]
    .map((iid) => ds.invoices.find((i) => i.id === iid)!)
    .filter((inv) => (now.getTime() - new Date(inv.date).getTime()) / DAY > 90)
    .slice(0, 12);
  overdue.forEach((inv, i) => {
    cfN++;
    const broken = i < 4;
    ds.collectionFollowUps.push({
      id: id("CFU", cfN, 3), invoiceId: inv.id,
      date: iso(daysAgo(rng.int(12, 40))),
      mode: rng.pick(["CALL", "VISIT", "EMAIL", "WHATSAPP"]),
      personSpokenTo: fullName(),
      outcome: broken ? "Committed payment by the promised date; not received." : "Awaiting internal bill passing at client end.",
      promisedDate: broken ? iso(daysAgo(rng.int(3, 20))) : iso(shift(now, rng.int(5, 25))),
      promisedAmount: Math.round(outstandingByInvoice.get(inv.id)! * rng.float(0.5, 1)),
      fulfilled: false, byUserId: uAC.id,
    });
  });

  // Credit notes (X-16f / FR-M7-10) — load-bearing for the outstanding formula
  for (let i = 0; i < 6; i++) {
    cnN++;
    const inv = ds.invoices[(i * 53) % ds.invoices.length]!;
    ds.creditNotes.push({
      id: id("CRN", cnN, 3), number: `BC/CN/2627/${String(cnN).padStart(3, "0")}`,
      kind: i < 5 ? "CREDIT" : "DEBIT", invoiceId: inv.id,
      date: iso(shift(new Date(inv.date), rng.int(5, 30))),
      reason: rng.pick(["Rate difference agreed post-delivery", "Short supply adjustment", "Freight charged in error", "Discount honoured retrospectively"]),
      amount: 0, gstAmount: 0, byUserId: uAC.id,
    });
  }

  /* ==================================================== challans + e-way bills */
  const challanSources = ds.salesOrders.slice(0, 400);
  for (let i = 0; i < 540; i++) {
    chN++;
    const so = challanSources[i % challanSources.length];
    const customer = so ? custById.get(so.customerId)! : ds.customers[i % ds.customers.length]!;
    const site = ds.sites.find((s) => s.customerId === customer.id)!;
    const date = i === 539 ? daysAgo(190) : between(new Date(2025, 1, 1), now); // one stale base doc
    const lines = rng.sample(machineItems, rng.int(1, 3)).map((it) => ({
      itemId: it.id, description: it.description, hsnSac: it.hsnSac, uom: it.uom,
      qty: rng.int(1, 4), taxableValue: it.standardPrice,
    }));
    ds.challans.push({
      id: id("DCH", chN, 4), number: `BC/DC/2627/${String(chN).padStart(4, "0")}`,
      date: iso(date), customerId: customer.id, siteId: site.id, branchId: customer.branchId,
      sourceType: so ? "SALES_ORDER" : "SERVICE_PART", sourceId: so?.id ?? "—",
      sourceLabel: so ? so.number : "Service part despatch",
      reasonForTransportation: rng.pick(["Supply against order", "Service replacement", "Rental despatch", "Project supply"]),
      transportMode: "ROAD",
      vehicleNumber: `BR${String(rng.int(1, 40)).padStart(2, "0")}${rng.pick(["AB", "CD", "GH", "KL"])}${hashDigits(`v${i}`, 4)}`,
      transporter: rng.pick(["Ganga Roadlines", "Magadh Carriers", "Bihar Transport Co", "Sone Logistics"]),
      transporterGstin: `10AABCT${hashDigits(`t${i}`, 4)}K1Z${i % 10}`,
      lrNumber: `LR${hashDigits(`lr${i}`, 7)}`,
      approxDistanceKm: rng.int(8, 460),
      lines,
    });
  }
  const eligibleChallans = ds.challans.filter((c) => c.lines.reduce((s, l) => s + l.taxableValue * l.qty, 0) > 50_000);
  for (let i = 0; i < Math.min(312, eligibleChallans.length); i++) {
    ewN++;
    const ch = eligibleChallans[i]!;
    const gen = shift(new Date(ch.date), rng.int(0, 1));
    ds.ewayBills.push({
      id: id("EWB", ewN, 4), ebn: hashDigits(`ebn${ewN}`, 12),
      baseDocType: "CHALLAN", baseDocId: ch.id, baseDocDate: ch.date,
      supplyType: "OUTWARD", subType: "Supply", transportMode: "ROAD",
      distanceKm: ch.approxDistanceKm, transporter: ch.transporter,
      vehicleNumber: ch.vehicleNumber, generatedAt: iso(gen),
      validUntil: iso(shift(gen, Math.max(1, Math.ceil(ch.approxDistanceKm / 200)))),
    });
  }

  /* ============================================ stock: ledger + ₹41.8 L exact */
  let smN = 0;
  // Machines are supplied against order, not carried in stock — including them
  // forced a minimum of one lakh-value unit per SKU and blew the stock figure.
  const openingItems = ds.items.filter(
    (i) => i.category === "SPARE" || i.category === "CONSUMABLE" ||
      i.category === "ACCESSORY" || i.category === "PIPE_FITTING",
  );
  // 61 non-moving items worth ₹6.4 L; 168 items at or below reorder.
  // Stock only what a warehouse actually shelves. Value is the budget; quantity
  // is derived from it, so an expensive SKU never forces a lakh onto the total.
  const stockable = rng.shuffle(openingItems.filter((i) => i.standardCost <= 26_000));
  const nonMoving = stockable.slice(0, 61);
  const belowReorder = stockable.slice(61, 61 + 168);
  const others = stockable.slice(61 + 168);
  const nonMovingValues = allocateExactWhole(rng, 640_000, 61, 0.6);
  const remainingValue = 4_180_000 - 640_000;
  const belowBudget = Math.round(remainingValue * 0.22);
  const belowValues = allocateExactWhole(rng, belowBudget, 168, 0.7);
  const otherValues = allocateExactWhole(rng, remainingValue - belowBudget, others.length, 0.7);

  const pushOpening = (item: T.Item, value: number, at: Date, capToReorder = false) => {
    let qty = Math.round(value / Math.max(1, item.standardCost));
    // Items on the reorder list must genuinely sit at or below their level.
    if (capToReorder) qty = Math.max(1, Math.min(qty, Math.max(1, item.reorderLevel - 1)));
    if (qty <= 0) return;
    smN++;
    ds.stockMovements.push({
      id: id("STM", smN, 5), seq: smN, itemId: item.id, type: "RECEIPT", qty,
      fromLocationId: null, toLocationId: cw.id, sourceType: "OPENING", sourceId: null,
      sourceLabel: "Opening stock", rate: item.standardCost, byUserId: uST.id,
      at: iso(at), reason: null,
    });
  };
  nonMoving.forEach((it, i) => pushOpening(it, nonMovingValues[i]!, daysAgo(rng.int(210, 520))));
  belowReorder.forEach((it, i) => pushOpening(it, belowValues[i]!, daysAgo(rng.int(60, 400)), true));
  others.forEach((it, i) => pushOpening(it, otherValues[i]!, daysAgo(rng.int(30, 400))));

  // Issues against job cards, so balances move and reconcile to the ledger.
  ds.partConsumptions.forEach((pc) => {
    const jc = ds.jobCards.find((j) => j.id === pc.jobCardId)!;
    smN++;
    const mv: T.StockMovement = {
      id: id("STM", smN, 5), seq: smN, itemId: pc.itemId, type: "ISSUE", qty: pc.qty,
      fromLocationId: cw.id, toLocationId: null, sourceType: "JOB_CARD", sourceId: jc.id,
      sourceLabel: jc.number, rate: itemById.get(pc.itemId)?.standardCost ?? 0,
      byUserId: uST.id, at: jc.submittedAt ?? jc.createdAt, reason: null,
    };
    ds.stockMovements.push(mv);
    pc.stockMovementId = mv.id;
  });
  // Replenishment receipts so on-hand stays sane after issues.
  const issuedByItem = new Map<string, number>();
  ds.stockMovements.filter((m) => m.type === "ISSUE").forEach((m) => {
    issuedByItem.set(m.itemId, (issuedByItem.get(m.itemId) ?? 0) + m.qty);
  });
  issuedByItem.forEach((qty, itemId) => {
    const item = itemById.get(itemId)!;
    smN++;
    ds.stockMovements.push({
      id: id("STM", smN, 5), seq: smN, itemId, type: "RECEIPT", qty,
      fromLocationId: null, toLocationId: cw.id, sourceType: "PURCHASE_ORDER",
      sourceId: null, sourceLabel: "Replenishment against consumption",
      rate: item.standardCost, byUserId: uST.id, at: iso(daysAgo(rng.int(2, 300))), reason: null,
    });
  });

  // Close the rounding gap so stock value lands on ₹41.8 L exactly. Quantities
  // are integers, so the budget is met with one final opening top-up on the
  // cheapest stocked line; any residue is below that item's unit cost.
  {
    const balanceItem = [...stockable].sort((a, b) => a.standardCost - b.standardCost)[0]!;
    const current = ds.stockMovements.reduce((s, m) => {
      const it = itemById.get(m.itemId);
      if (!it) return s;
      return s + ((m.toLocationId ? m.qty : 0) - (m.fromLocationId ? m.qty : 0)) * it.standardCost;
    }, 0);
    const gap = 4_180_000 - current;
    const topUp = Math.round(gap / Math.max(1, balanceItem.standardCost));
    if (topUp !== 0) {
      smN++;
      ds.stockMovements.push({
        id: id("STM", smN, 5), seq: smN, itemId: balanceItem.id,
        type: topUp > 0 ? "RECEIPT" : "ISSUE", qty: Math.abs(topUp),
        fromLocationId: topUp > 0 ? null : cw.id, toLocationId: topUp > 0 ? cw.id : null,
        sourceType: "OPENING", sourceId: null, sourceLabel: "Opening stock — balancing entry",
        rate: balanceItem.standardCost, byUserId: uST.id,
        at: iso(daysAgo(540)), reason: "Opening balance reconciliation",
      });
    }
  }

  /* ================================================ purchase orders (84) */
  let poN = 0, polN = 0, grnN = 0;
  for (let i = 0; i < 84; i++) {
    poN++;
    const supplier = ds.suppliers[i % ds.suppliers.length]!;
    const orderDate = daysAgo(rng.int(5, 360));
    const status: T.PurchaseOrder["status"] = i < 8 ? "SENT" : i < 14 ? "PARTIALLY_RECEIVED" : i < 18 ? "DRAFT" : "RECEIVED";
    const po: T.PurchaseOrder = {
      id: id("PO", poN, 3), number: `BC/PO/2627/${String(poN).padStart(4, "0")}`,
      supplierId: supplier.id, toLocationId: cw.id, orderDate: iso(orderDate),
      expectedDelivery: iso(shift(orderDate, rng.int(7, 45))),
      terms: supplier.paymentTerms, status,
      approvalRequestId: null, raisedByUserId: uST.id,
    };
    ds.purchaseOrders.push(po);
    const lineItems = rng.sample(spareItems, rng.int(2, 6));
    const grnLines: { poLineId: string; itemId: string; qtyReceived: number }[] = [];
    lineItems.forEach((it) => {
      polN++;
      const qty = rng.int(4, 40);
      const received = status === "RECEIVED" ? qty : status === "PARTIALLY_RECEIVED" ? Math.floor(qty * 0.6) : 0;
      ds.poLines.push({
        id: id("POL", polN, 4), purchaseOrderId: po.id, itemId: it.id,
        qty, rate: it.standardCost, qtyReceived: received,
      });
      if (received > 0) grnLines.push({ poLineId: id("POL", polN, 4), itemId: it.id, qtyReceived: received });
    });
    if (grnLines.length) {
      grnN++;
      ds.goodsReceipts.push({
        id: id("GRN", grnN, 3), number: `BC/GRN/2627/${String(grnN).padStart(4, "0")}`,
        purchaseOrderId: po.id, receivedAt: iso(shift(orderDate, rng.int(6, 40))),
        byUserId: uST.id, lines: grnLines,
        shortReceipt: status === "PARTIALLY_RECEIVED", excessReceipt: false, overrideReason: null,
      });
    }
  }

  /* ==================================================== rental (11 assets) */
  for (let i = 0; i < 11; i++) {
    const item = machineItems.find((m) => m.productLine === "PORTABLE_COMPRESSOR") ?? machineItems[0]!;
    ds.rentalAssets.push({
      id: id("RNA", i + 1, 2), serial: `RNT${hashHex(`r${i}`, 6).toUpperCase()}`,
      itemId: item.id, model: `Portable Diesel ${rng.int(180, 420)}CFM`,
      capacityValue: rng.int(180, 420), capacityUnit: "CFM",
      condition: rng.pick(["Good", "Fair", "Excellent"]),
      branchId: ds.branches[i % ds.branches.length]!.id,
      availableFrom: iso(daysAgo(rng.int(200, 700))),
    });
  }
  ds.rentalAssets.slice(0, 6).forEach((ra, i) => {
    const cust = ds.customers[(i * 11) % ds.customers.length]!;
    const site = ds.sites.find((s) => s.customerId === cust.id)!;
    const start = daysAgo(rng.int(20, 120));
    const overdue = i < 2;
    ds.rentalAgreements.push({
      id: id("RNG", i + 1, 2), number: `BC/RENT/2627/${String(i + 1).padStart(3, "0")}`,
      rentalAssetId: ra.id, customerId: cust.id, siteId: site.id,
      startDate: iso(start),
      expectedReturn: iso(overdue ? daysAgo(rng.int(4, 20)) : shift(now, rng.int(10, 60))),
      actualReturn: null, rateBasis: "PER_MONTH", rate: rng.int(38, 96) * 1000,
      deposit: rng.int(50, 200) * 1000, returnCondition: null, damageNote: null,
    });
  });

  /* ======================================================= attendance + leave */
  const attStart = daysAgo(545);
  let attN = 0;
  for (let d = 0; d <= 545; d++) {
    const date = shift(attStart, d);
    if (date > now) break;
    const isSunday = date.getDay() === 0;
    const holiday = ds.holidays.find((hh) => hh.date.slice(0, 10) === date.toISOString().slice(0, 10));
    // Full fidelity for the last 60 days; weekly sampling before that keeps volume sane.
    const recent = (now.getTime() - date.getTime()) / DAY <= 60;
    if (!recent && d % 7 !== 0) continue;
    for (const emp of ds.employees) {
      attN++;
      let state: AttendanceState = "PRESENT";
      if (holiday) state = "HOLIDAY";
      else if (isSunday) state = "WEEK_OFF";
      else if (rng.bool(0.04)) state = "ON_LEAVE";
      else if (rng.bool(0.02)) state = "ABSENT";
      else if (emp.workLocationType === "FIELD" && rng.bool(0.72)) state = "ON_FIELD";
      const working = state === "PRESENT" || state === "ON_FIELD";
      const inAt = working ? shift(date, 0, 9 + rng.float(0, 1.4, 2)) : null;
      const isToday = date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
      const late = working ? inAt!.getHours() >= 10 : false;
      const missingOut = working && isToday && attN % 97 === 0;
      const jc = state === "ON_FIELD"
        ? ds.jobCards.find((j) => j.engineerUserId === emp.id && j.checkInAt?.slice(0, 10) === date.toISOString().slice(0, 10))
        : undefined;
      const site = jc ? ds.sites.find((s) => s.id === ds.tickets.find((t) => t.id === jc.ticketId)?.siteId) : undefined;
      ds.attendance.push({
        id: id("ATT", attN, 6), employeeId: emp.id, date: iso(date), state,
        checkInAt: inAt ? iso(inAt) : null,
        checkOutAt: working && !missingOut ? iso(shift(date, 0, 18 + rng.float(0, 1.6, 2))) : null,
        lat: state === "ON_FIELD" && site ? round2(site.lat + rng.float(-0.01, 0.01, 5)) : null,
        lng: state === "ON_FIELD" && site ? round2(site.lng + rng.float(-0.01, 0.01, 5)) : null,
        placeLabel: state === "ON_FIELD" && site ? `${site.name}, ${site.district}` : null,
        jobCardId: jc?.id ?? null,
        source: rng.weighted([["APP", 78], ["DEVICE", 20], ["MANUAL", 2]]),
        selfieCaptured: state === "ON_FIELD",
        geofenceBreachKm: state === "ON_FIELD" && attN % 211 === 0 ? round2(rng.float(1.2, 4.5, 1)) : null,
        lateMark: late, missingCheckOut: missingOut,
        regularisedByUserId: null, regularisationReason: null, originalState: null,
      });
    }
  }

  let lvN = 0;
  for (let i = 0; i < 214; i++) {
    lvN++;
    const emp = ds.employees[i % ds.employees.length]!;
    const lt = ds.leaveTypes[i % ds.leaveTypes.length]!;
    const from = daysAgo(rng.int(-40, 350));
    const days = rng.int(1, 4);
    const pending = i < 6;
    const coverageCase = i === 0;
    ds.leaveRequests.push({
      id: id("LVR", lvN, 3), number: `BC/LV/2627/${String(lvN).padStart(4, "0")}`,
      employeeId: coverageCase ? (ctx.fieldEngineers[0]?.id ?? emp.id) : emp.id,
      leaveTypeId: lt.id, fromDate: iso(from), toDate: iso(shift(from, days - 1)), days,
      reason: rng.pick(["Family function", "Medical", "Personal work", "Travel", "Festival"]),
      coverageArrangement: rng.pick(["Handover to colleague", "Calls diverted", "None required"]),
      status: pending ? "PENDING" : rng.weighted([["APPROVED", 88], ["REJECTED", 8], ["CANCELLED", 4]]),
      approvalRequestId: null,
      coverageWarning: coverageCase ? "Approving this request drops Gaya below the configured minimum of 1 available field engineer." : null,
      raisedAt: iso(shift(from, -rng.int(2, 14))),
      decidedAt: pending ? null : iso(shift(from, -rng.int(0, 2))),
    });
  }

  // Employee documents — appointment letter is first-class and must be present
  let edN = 0;
  ds.employees.forEach((emp, i) => {
    const set: [T.EmployeeDocument["type"], string][] = [
      ["APPOINTMENT_LETTER", "Appointment Letter"],
      ["OTHER", "Offer Letter"],
      ["OTHER", "Identity Proof Reference"],
    ];
    if (emp.workLocationType === "FIELD") set.push(["OTHER", "OEM Training Certificate"]);
    set.forEach(([type, title], k) => {
      // A handful of deliberate gaps so the completeness dashboard has something to show
      if (i % 17 === 0 && k === 0) return;
      edN++;
      ds.employeeDocuments.push({
        id: id("EMD", edN, 4), employeeId: emp.id, type, title,
        issuedOn: emp.dateOfJoining,
        expiresOn: title.includes("Training") ? iso(shift(now, rng.int(-60, 400))) : null,
        documentId: null,
      });
    });
  });

  /* ============================================== documents (1,860 in vault) */
  const docPlan: [T.PravaahDocument["category"], T.PravaahDocument["type"], number][] = [
    ["OEM_TECHNICAL", "OEM_MANUAL", 210], ["OEM_TECHNICAL", "TECHNICAL_LITERATURE", 180],
    ["OEM_TECHNICAL", "WARRANTY_TERMS", 60], ["CUSTOMERS", "CUSTOMER_AGREEMENT", 160],
    ["CUSTOMERS", "PURCHASE_ORDER_COPY", 220], ["INSTALLED_ASSETS", "COMMISSIONING_CERTIFICATE", 240],
    ["PROJECTS", "PROJECT_DRAWING", 190], ["PROJECTS", "TEST_CERTIFICATE", 120],
    ["PROJECTS", "CLIENT_APPROVAL", 90], ["PROJECTS", "MEASUREMENT_RECORD", 110],
    ["COMMERCIAL", "OTHER", 130], ["HR", "APPOINTMENT_LETTER", 52],
    ["STATUTORY", "STATUTORY_RETURN", 48], ["COMPANY", "INSURANCE", 24],
    ["COMPANY", "LICENCE", 26],
  ]; // = 1860
  let docN = 0;
  let expiringPlaced = 0;
  for (const [category, type, count] of docPlan) {
    for (let i = 0; i < count; i++) {
      docN++;
      const uploaded = daysAgo(rng.int(5, 900));
      const wantsExpiry = type === "TEST_CERTIFICATE" || type === "INSURANCE" || type === "LICENCE" || type === "WARRANTY_TERMS";
      let expiresOn: string | null = null;
      if (wantsExpiry) {
        if (expiringPlaced < 11 && i % 9 === 0) { expiresOn = iso(shift(now, rng.int(4, 58))); expiringPlaced++; }
        else expiresOn = iso(shift(now, rng.int(90, 700)));
      }
      const linked = category === "INSTALLED_ASSETS" ? ds.assets[docN % ds.assets.length]
        : category === "PROJECTS" ? ds.projects[docN % ds.projects.length]
          : category === "CUSTOMERS" ? ds.customers[docN % ds.customers.length]
            : category === "HR" ? ds.employees[docN % ds.employees.length] : null;
      ds.documents.push({
        id: id("DOC", docN, 4),
        title: buildDocTitle(type, docN, linked),
        type, category,
        linkedType: category === "INSTALLED_ASSETS" ? "ASSET" : category === "PROJECTS" ? "PROJECT"
          : category === "CUSTOMERS" ? "CUSTOMER" : category === "HR" ? "EMPLOYEE" : "COMPANY",
        linkedId: linked?.id ?? null,
        ownerUserId: category === "HR" ? uHR.id : category === "PROJECTS" ? uPM.id : uSM.id,
        uploadedAt: iso(uploaded), version: rng.weighted([[1, 80], [2, 15], [3, 5]]),
        supersedesId: null,
        effectiveFrom: iso(uploaded), expiresOn,
        tags: rng.sample(["compressor", "pump", "treatment", "warranty", "amc", "drawing", "test", "statutory", "elgi", "ksb"], rng.int(1, 3)),
        accessLevel: category === "HR" ? "HR" : category === "COMMERCIAL" ? "COMMERCIAL" : "GENERAL",
        mime: "application/pdf", sizeKb: rng.int(80, 5200), pageCount: rng.int(1, 64),
        revision: category === "PROJECTS" && type === "PROJECT_DRAWING" ? `R${rng.int(0, 4)}` : null,
        approvalState: category === "PROJECTS" ? rng.pick(["APPROVED", "SUBMITTED", "DRAFT", "SUPERSEDED"]) : null,
        passages: buildPassages(type, rng),
        deletedAt: null, deletedReason: null,
      });
    }
  }

  /* ================================================ approvals + notifications */
  const chainDefs: [T.ApprovalChain["requestType"], string, number, number | null, T.ApprovalChainStep["approverRole"][]][] = [
    ["QUOTATION_DISCOUNT", "Discount up to 5%", 0, 5, ["BRANCH_MANAGER"]],
    ["QUOTATION_DISCOUNT", "Discount 5–10%", 5, 10, ["BRANCH_MANAGER", "DIRECTOR_BUSINESS"]],
    ["QUOTATION_DISCOUNT", "Discount above 10%", 10, null, ["BRANCH_MANAGER", "DIRECTOR_BUSINESS", "DIRECTOR_STRATEGY"]],
    ["PURCHASE_ORDER", "Purchase order above threshold", 100000, null, ["DIRECTOR_BUSINESS"]],
    ["LEAVE", "Leave request", 0, null, ["BRANCH_MANAGER"]],
    ["CREDIT_LIMIT_OVERRIDE", "Credit limit override", 0, null, ["ACCOUNTS_EXECUTIVE", "DIRECTOR_BUSINESS"]],
    ["STOCK_ADJUSTMENT", "Stock adjustment", 0, null, ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"]],
    ["RA_BILL_SUBMISSION", "RA-bill submission", 0, null, ["DIRECTOR_BUSINESS"]],
    ["AMC_PRICING_EXCEPTION", "AMC pricing exception", 0, null, ["SERVICE_MANAGER", "DIRECTOR_BUSINESS"]],
    ["PRICE_LIST_CHANGE", "Price list change", 0, null, ["DIRECTOR_BUSINESS"]],
    ["USER_ROLE_CHANGE", "User role change", 0, null, ["DIRECTOR_BUSINESS"]],
    ["EXPENSE_CLAIM", "Expense claim", 0, null, ["BRANCH_MANAGER"]],
  ];
  let acN = 0, acsN = 0;
  chainDefs.forEach(([requestType, name, minValue, maxValue, roles]) => {
    acN++;
    const chainId = id("APC", acN, 2);
    ds.approvalChains.push({ id: chainId, requestType, name, minValue, maxValue });
    roles.forEach((role, i) => {
      acsN++;
      ds.approvalChainSteps.push({
        id: id("ACS", acsN, 3), chainId, order: i + 1, approverRole: role,
        minValue: null, maxValue: null, escalationHours: [8, 16, 24][i] ?? 24, parallel: false,
      });
    });
  });

  let arN = 0;
  const pendingSpecs: [T.ApprovalRequest["type"], string, number, number][] = [
    ["QUOTATION_DISCOUNT", "Discount 12% on screw compressor package", 1_450_000, 30],
    ["QUOTATION_DISCOUNT", "Discount 8% on garage equipment order", 640_000, 12],
    ["PURCHASE_ORDER", "Spares replenishment — service critical", 386_000, 6],
    ["LEAVE", "Leave request — field engineer, Gaya", 0, 20],
    ["CREDIT_LIMIT_OVERRIDE", "Credit limit override — institutional client", 2_100_000, 40],
    ["RA_BILL_SUBMISSION", "RA-bill 05 submission", 1_820_000, 4],
    ["STOCK_ADJUSTMENT", "Physical count variance — central warehouse", 74_000, 3],
    ["AMC_PRICING_EXCEPTION", "AMC renewal at held pricing", 224_000, 9],
    ["EXPENSE_CLAIM", "Field travel claim — July", 18_400, 2],
  ];
  pendingSpecs.forEach(([type, label, value, ageHours], i) => {
    arN++;
    const chain = ds.approvalChains.find((c) =>
      c.requestType === type && value >= c.minValue && (c.maxValue === null || value <= c.maxValue),
    ) ?? ds.approvalChains.find((c) => c.requestType === type)!;
    const steps = ds.approvalChainSteps.filter((s) => s.chainId === chain.id);
    ds.approvalRequests.push({
      id: id("APR", arN, 3), number: `BC/APR/2627/${String(arN).padStart(4, "0")}`,
      type, subjectType: type, subjectId: id("QT", i + 1, 4), subjectLabel: label,
      value, requesterUserId: uSE.id, branchId: ds.branches[i % ds.branches.length]!.id,
      resolvedChainId: chain.id,
      resolvedSteps: steps.map((s) => ({ order: s.order, approverRole: s.approverRole, escalationHours: s.escalationHours })),
      currentStep: 1, status: i < 2 ? "ESCALATED" : "PENDING",
      raisedAt: iso(new Date(now.getTime() - ageHours * 3_600_000)),
      decidedAt: null, escalatedAt: i < 2 ? iso(new Date(now.getTime() - 2 * 3_600_000)) : null,
      context: { requester: uSE.name, note: label },
    });
  });

  const notifTypes = [
    "SLA_BREACHED", "AMC_EXPIRING", "COMMISSIONING_OVERDUE", "RETENTION_ELIGIBLE",
    "APPROVAL_PENDING", "STOCK_SERVICE_CRITICAL", "INVOICE_OVER_90", "PAYMENT_PROMISE_BROKEN",
  ];
  for (let i = 0; i < 40; i++) {
    ds.notifications.push({
      id: id("NTF", i + 1, 3), userId: [uDB, uSM, uAC, uPM, uST][i % 5]!.id,
      type: notifTypes[i % notifTypes.length]!,
      title: notifTypes[i % notifTypes.length]!.replace(/_/g, " ").toLowerCase(),
      body: "Requires attention. Open the linked record for full context.",
      entityType: "TICKET", entityId: ds.tickets[i % ds.tickets.length]!.id,
      href: `/service/tickets/${ds.tickets[i % ds.tickets.length]!.id}`,
      read: i > 14, at: iso(daysAgo(rng.int(0, 9), rng.int(8, 19))), digest: false,
    });
  }
  ds.approvalRequests.forEach((ar, i) => {
    ds.messageLog.push({
      id: id("MSG", i + 1, 3), channel: "WHATSAPP", recipientUserId: uDB.id,
      recipientContactId: null, recipientLabel: uDB.name, recipientPhone: uDB.phone,
      template: "approval_request_v1",
      content: `*Pravaah — Approval required*\n${ar.subjectLabel}\nValue: ₹${ar.value.toLocaleString("en-IN")}\nRaised by ${uSE.name}`,
      approvalRequestId: ar.id, entityType: "APPROVAL", entityId: ar.id,
      state: i < 3 ? "READ" : i < 6 ? "DELIVERED" : "SENT",
      at: ar.raisedAt, simulated: true,
    });
  });

  const prefTypes = ["SLA_BREACHED", "AMC_EXPIRING", "APPROVAL_PENDING", "INVOICE_OVER_90", "STOCK_SERVICE_CRITICAL"];
  prefTypes.forEach((t, i) => {
    (["DIRECTOR_BUSINESS", "SERVICE_MANAGER", "ACCOUNTS_EXECUTIVE"] as const).forEach((role, k) => {
      ds.channelPreferences.push({
        id: id("CHP", i * 3 + k + 1, 3), notificationType: t, role,
        channels: k === 0 ? ["IN_APP", "WHATSAPP"] : ["IN_APP"],
      });
    });
  });

  /* ============================================== compliance + audit trail */
  (["ACCESS", "CORRECTION", "ERASURE", "WITHDRAW_CONSENT", "GRIEVANCE"] as const).forEach((rt, i) => {
    ds.dsrRequests.push({
      id: id("DSR", i + 1, 2), number: `BC/DSR/2627/${String(i + 1).padStart(3, "0")}`,
      requestType: rt, requester: fullName(), receivedOn: iso(daysAgo(rng.int(5, 120))),
      status: i < 2 ? "IN_PROGRESS" : "CLOSED",
      closedOn: i < 2 ? null : iso(daysAgo(rng.int(1, 40))),
      note: "Handled under the DPDP data-principal request process.",
    });
  });
  [
    ["Customer & contact records", 96, "Contract term plus 7 years (limitation)"],
    ["Employee records", 120, "Statutory retention under labour law"],
    ["Attendance records", 36, "Payroll audit window"],
    ["Service & job card records", 84, "Warranty and product liability"],
    ["Commercial documents", 96, "GST record retention"],
    ["Audit log", 120, "Governance"],
  ].forEach(([entityClass, months, basis], i) => {
    ds.retentionPolicies.push({
      id: id("RTP", i + 1, 2), entityClass: entityClass as string,
      retentionMonths: months as number, basis: basis as string,
    });
  });

  let auN = 0;
  const auditFor = (
    actor: T.User, action: T.AuditLog["action"], entityType: string,
    entityId: string, entityLabel: string, summary: string, at: string,
  ) => {
    auN++;
    ds.auditLog.push({
      id: id("AUD", auN, 5), seq: auN, actorUserId: actor.id, actorName: actor.name,
      actorRole: actor.role, impersonatedBy: null, action, entityType, entityId,
      entityLabel, summary, before: null, after: null, at,
      ip: `10.${rng.int(0, 4)}.${rng.int(1, 250)}.${rng.int(2, 250)}`,
    });
  };
  ds.quotations.slice(0, 214).forEach((q) => auditFor(uSE, "CREATE", "Quotation", q.id, q.number, `Quotation raised for ${custById.get(q.customerId)?.tradeName}`, q.createdAt));
  ds.invoices.slice(0, 618).forEach((i) => auditFor(uAC, "CREATE", "Invoice", i.id, i.number, `Tax invoice issued (${i.taxTreatment})`, i.createdAt));
  ds.jobCards.slice(0, 1400).forEach((j) => auditFor(uSM, "STATE_TRANSITION", "JobCard", j.id, j.number, `Job card submitted with outcome ${j.outcome ?? "in progress"}`, j.submittedAt ?? j.createdAt));
  ds.tickets.slice(0, 512).forEach((t) => auditFor(uSM, "CREATE", "ServiceTicket", t.id, t.number, `Ticket logged — ${t.severity}, coverage ${t.coverage}`, t.loggedAt));
  ds.receipts.slice(0, 400).forEach((r) => auditFor(uAC, "CREATE", "Receipt", r.id, r.number, `Receipt recorded via ${r.mode}`, r.date));
  ds.raBills.forEach((b) => auditFor(uPM, "CREATE", "RABill", b.id, b.number, `RA-bill raised, claimed ₹${b.claimedValue.toLocaleString("en-IN")}`, b.createdAt));
  ds.approvalRequests.forEach((a) => auditFor(uSE, "CREATE", "ApprovalRequest", a.id, a.number, a.subjectLabel, a.raisedAt));
  ds.commissioningReports.forEach((c) => auditFor(uSM, "CREATE", "CommissioningReport", c.id, c.number, "Commissioning report recorded", c.createdAt));

  return ds;
}

function buildDocTitle(
  type: T.PravaahDocument["type"], n: number,
  linked: { id: string } & Record<string, unknown> | null,
): string {
  const name = (linked as { name?: string; legalName?: string; serial?: string } | null);
  switch (type) {
    case "OEM_MANUAL": return `ELGi Operation & Maintenance Manual — Screw Series (Rev ${(n % 4) + 1})`;
    case "TECHNICAL_LITERATURE": return `Technical Datasheet — ${["Screw", "Piston", "Oil Free", "Portable"][n % 4]} Compressor Range`;
    case "WARRANTY_TERMS": return `OEM Warranty Terms & Conditions — ${["ELGi", "ATS-ELGi", "KSB", "Ion Exchange"][n % 4]}`;
    case "CUSTOMER_AGREEMENT": return `Supply Agreement — ${name?.legalName ?? "Customer"}`;
    case "PURCHASE_ORDER_COPY": return `Customer Purchase Order Copy — PO/${String(n).padStart(5, "0")}`;
    case "COMMISSIONING_CERTIFICATE": return `Commissioning Certificate — Serial ${name?.serial ?? "—"}`;
    case "PROJECT_DRAWING": return `General Arrangement Drawing — ${name?.name ?? "Project"}`;
    case "TEST_CERTIFICATE": return `Third-Party Test Certificate — ${["Tank", "Pump", "Blower", "Panel"][n % 4]}`;
    case "CLIENT_APPROVAL": return `Client Approval Note — ${name?.name ?? "Project"}`;
    case "MEASUREMENT_RECORD": return `Measurement Book Extract — Sheet ${n % 40 + 1}`;
    case "APPOINTMENT_LETTER": return `Appointment Letter — Employee Record`;
    case "STATUTORY_RETURN": return `Statutory Filing Acknowledgement — ${["GSTR-1", "GSTR-3B", "PF ECR", "ESIC"][n % 4]}`;
    case "INSURANCE": return `Insurance Policy — ${["Warehouse Fire", "Vehicle Fleet", "Public Liability", "Transit"][n % 4]}`;
    case "LICENCE": return `Licence — ${["Trade", "Pollution Control Consent", "Shops & Establishment", "Electrical Contractor"][n % 4]}`;
    default: return `Commercial Document ${String(n).padStart(4, "0")}`;
  }
}

/** Passages the vault retrieval simulation quotes and highlights. */
function buildPassages(type: T.PravaahDocument["type"], rng: Rng): { id: string; heading: string; text: string }[] {
  const mk = (heading: string, text: string) => ({ id: `p${rng.int(1000, 9999)}`, heading, text });
  switch (type) {
    case "WARRANTY_TERMS":
      return [
        mk("Clause 3 — Warranty Period", "The standard warranty period for electric lubricated screw compressors is 18 months from the date of commissioning or 4,000 running hours, whichever occurs earlier. Piston compressors carry 12 months from commissioning."),
        mk("Clause 7 — Conditions", "Warranty is valid only where the dealer-completed installation and commissioning report reaches the principal within seven days of commissioning, and where genuine consumables have been used throughout."),
      ];
    case "AMC_AGREEMENT":
      return [
        mk("Schedule B — Inclusions", "Four scheduled preventive maintenance visits per contract year, unlimited breakdown attendance during working hours, and genuine OEM spares under the comprehensive variant."),
        mk("Schedule C — Exclusions", "Consumable oil beyond the first fill, air-end overhaul, damage arising from incorrect utility supply, and any work arising from unauthorised third-party intervention are excluded from the scope of this contract."),
      ];
    case "COMMISSIONING_CERTIFICATE":
      return [
        mk("Recorded Parameters", "Free air delivery measured at 412 CFM against a rated 420 CFM at 7.5 bar working pressure. Full-load current recorded at 148 A on a 415 V three-phase supply."),
        mk("Customer Acknowledgement", "Operator training completed and acknowledged by the customer representative at handover."),
      ];
    case "TEST_CERTIFICATE":
      return [
        mk("Test Result", "Hydraulic test conducted at 1.5 times working pressure for 30 minutes with no observed pressure drop or visible leakage. Certificate valid for twelve months from the date of test."),
      ];
    case "OEM_MANUAL":
      return [
        mk("Section 4 — Maintenance Intervals", "Air filter element replacement at 2,000 hours, oil filter at 2,000 hours, air-oil separator at 4,000 hours, and compressor oil change at 4,000 hours or annually, whichever is earlier."),
      ];
    default:
      return [mk("Summary", "Reference document retained in the Bhushan Corp vault against the linked entity.")];
  }
}
