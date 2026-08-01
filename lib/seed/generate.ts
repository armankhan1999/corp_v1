import { Rng, allocateExactWhole, round2, id, hashHex, hashDigits } from "./rng";
import * as C from "./catalog";
import type { Dataset } from "../schemas";
import type * as T from "../schemas/entities";
import type { ItemCategory, OEMPrincipal, ProductLine, Role, TicketSeverity } from "../schemas/enums";
import { finish } from "./generate-part2";

export const SEED = 20260731;
export const TODAY_ISO = "2026-07-31T09:15:00.000+05:30";

/* --------------------------------------------------------------- targets */
/** Every figure the PRD publishes, in one place, so the validator can assert them. */
export const TARGETS = {
  receivables: { total: 18_200_000, b0_30: 6_400_000, b31_60: 4_700_000, b61_90: 3_100_000, b90p: 4_000_000, institutional: 11_200_000 },
  retention: { outstanding: 3_460_000, eligible: 1_120_000, released: 680_000 },
  lockedCash: 21_660_000,
  revenueFy2526: { total: 86_200_000, equipment: 47_400_000, service: 19_000_000, projects: 17_200_000, rental: 2_600_000 },
  revenueFy2627Ytd: 30_500_000,
  priorComparable: 26_800_000,
  orderBook: 23_800_000,
  stockValue: 4_180_000,
  nonMovingValue: 640_000,
  amcExpiring60Value: 1_840_000,
  counts: {
    branches: 4, users: 12, employees: 52, fieldEngineers: 9,
    customers: 128, sites: 164, assets: 286, items: 1240,
    amcLive: 96, amcExpiring60: 14, amcLapsed: 8,
    assetsInWarranty: 38, assetsUnderAmc: 104, assetsOutOfCoverage: 144,
    tickets: 512, openTickets: 41, breached: 7, imminent: 5, approaching: 9, comfortable: 20,
    jobCards: 2140, commissioning: 74, commissioningInWindow: 68, commissioningLate: 4, commissioningOverdue: 2,
    enquiries: 340, quotations: 214, quotationsWon: 71, quotationsLost: 88, quotationsOpen: 41, quotationsExpired: 14,
    invoices: 618, challans: 540, ewayBills: 312, nepalExports: 12,
    projects: 7, boqLines: 240, dprs: 420, raBills: 22,
    suppliers: 22, purchaseOrders: 84, belowReorder: 168, serviceCritical: 9, nonMovingItems: 61,
    documents: 1860, documentsExpiring60: 11,
    leaveRequests: 214, leavePending: 6,
    approvalsPending: 9, approvalsBreaching: 2,
    notifications: 40, rentalAssets: 11, rentalOnRent: 6, rentalOverdue: 2,
    brokenPromises: 4, partsDrivenRevisits: 28,
  },
} as const;

/* ------------------------------------------------------------ date helpers */
const DAY = 86_400_000;
const today = new Date(TODAY_ISO);
const iso = (d: Date) => d.toISOString();
const shift = (base: Date, days: number, hours = 0) =>
  new Date(base.getTime() + days * DAY + hours * 3_600_000);
const daysAgo = (n: number, h = 10, m = 0) => {
  const d = new Date(today.getTime() - n * DAY);
  d.setHours(h, m, 0, 0);
  return d;
};

function addMonths(d: Date, m: number): Date {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setMonth(x.getMonth() + m);
  if (x.getDate() < day) x.setDate(0);
  return x;
}

export function generate(seedValue: number = SEED, todayIso: string = TODAY_ISO): Dataset {
  const rng = new Rng(seedValue);
  const now = new Date(todayIso);
  const HISTORY_DAYS = 545; // ~18 months, SD-8

  const ds: Dataset = {
    meta: { seed: seedValue, today: todayIso, generatedAt: todayIso, historyMonths: 18 },
    branches: [], users: [], holidays: [], customers: [], sites: [], contacts: [],
    items: [], priceList: [], enquiries: [], quotations: [], quotationLines: [],
    salesOrders: [], salesOrderLines: [], targets: [], activities: [],
    assets: [], commissioningReports: [], amcContracts: [], scheduledVisits: [],
    rentalAssets: [], rentalAgreements: [], tickets: [], jobCards: [],
    partConsumptions: [], partsRequests: [], projects: [], boqLines: [], dprs: [],
    milestones: [], raBills: [], retentionEntries: [], projectCosts: [],
    stockLocations: [], stockMovements: [], stockReservations: [], suppliers: [],
    purchaseOrders: [], poLines: [], goodsReceipts: [], stockCounts: [],
    challans: [], invoices: [], invoiceLines: [], creditNotes: [], ewayBills: [],
    receipts: [], receiptAllocations: [], collectionFollowUps: [], numberingSeries: [],
    employees: [], employeeDocuments: [], attendance: [], leaveTypes: [], leaveRequests: [],
    documents: [], approvalChains: [], approvalChainSteps: [], approvalRequests: [],
    approvalDecisions: [], delegations: [], notifications: [], messageLog: [],
    channelPreferences: [], auditLog: [], slaDefinitions: [], dsrRequests: [],
    retentionPolicies: [], aiFeedback: [],
  };

  const fullName = () => `${rng.pick(C.FIRST_NAMES)} ${rng.pick(C.LAST_NAMES)}`;
  const mobile = () => `9${rng.int(1, 9)}${hashDigits(String(rng.int(1, 999999)), 8)}`;

  /* ================================================================ branches */
  C.BRANCHES.forEach((b, i) => {
    ds.branches.push({
      id: id("BR", i + 1, 2), code: b.code, name: b.name, city: b.city,
      district: b.district, state: "Bihar", stateCode: "10",
      isHeadOffice: b.isHeadOffice, hasCentralWarehouse: b.hasCentralWarehouse,
      gstin: C.COMPANY.gstin,
      address: b.isHeadOffice ? C.COMPANY.address : `Industrial Area, ${b.city}, Bihar`,
      phone: C.COMPANY.phone, lat: b.lat, lng: b.lng,
    });
  });
  const branchByCode = new Map(ds.branches.map((b) => [b.code, b]));
  const patna = branchByCode.get("PAT")!;

  /* ======================================================= stock locations */
  ds.stockLocations.push({
    id: "SL-CW", code: "CW-PAT", name: "Central Warehouse — Patna",
    kind: "CENTRAL_WAREHOUSE", branchId: patna.id, ownerUserId: null, projectId: null,
  });
  ds.branches.forEach((b, i) => {
    ds.stockLocations.push({
      id: id("SL-BR", i + 1, 2), code: `ST-${b.code}`, name: `${b.city} Branch Store`,
      kind: "BRANCH", branchId: b.id, ownerUserId: null, projectId: null,
    });
  });

  /* =============================================================== employees */
  interface EmpPlan { dept: string; designation: string; count: number; field: boolean }
  const empPlan: EmpPlan[] = [
    { dept: "Management", designation: "Director", count: 2, field: false },
    { dept: "Sales", designation: "Sales Executive", count: 11, field: false },
    { dept: "Service", designation: "Field Service Engineer", count: 9, field: true },
    { dept: "Service", designation: "Service Coordinator", count: 3, field: false },
    { dept: "Projects", designation: "Project Engineer", count: 5, field: false },
    { dept: "Accounts", designation: "Accounts Executive", count: 6, field: false },
    { dept: "Stores", designation: "Store Assistant", count: 4, field: false },
    { dept: "HR & Admin", designation: "HR Executive", count: 3, field: false },
    { dept: "Service", designation: "Service Technician", count: 5, field: true },
    { dept: "Sales", designation: "Sales Coordinator", count: 4, field: false },
  ];
  // 2+11+9+3+5+6+4+3+5+4 = 52
  const feBranchPlan: string[] = [];
  C.BRANCHES.forEach((b) => { for (let i = 0; i < b.fieldEngineers; i++) feBranchPlan.push(b.code); });

  let empN = 0;
  let feIdx = 0;
  for (const plan of empPlan) {
    for (let i = 0; i < plan.count; i++) {
      empN++;
      const isFE = plan.designation === "Field Service Engineer";
      const branch = isFE
        ? branchByCode.get(feBranchPlan[feIdx++]!)!
        : plan.dept === "Management" || rng.bool(0.55) ? patna : rng.pick(ds.branches);
      const doj = daysAgo(rng.int(200, 3200));
      const certs: OEMPrincipal[] = isFE
        ? rng.sample(["ELGI", "ATS_ELGI", "KSB", "ION_EXCHANGE"] as OEMPrincipal[], rng.int(1, 3))
        : [];
      if (isFE && !certs.includes("ELGI") && rng.bool(0.75)) certs.push("ELGI");
      ds.employees.push({
        id: id("EMP", empN, 3), code: `BC${String(empN).padStart(3, "0")}`,
        name: fullName(), designation: plan.designation, department: plan.dept,
        branchId: branch.id, reportingManagerId: null, dateOfJoining: iso(doj),
        employmentType: rng.weighted([["PERMANENT", 82], ["FIXED_TERM", 10], ["PROBATION", 5], ["CONTRACT", 3]]),
        workLocationType: plan.field ? "FIELD" : "OFFICE",
        phone: mobile(), email: `emp${empN}@bhushancorp.in`,
        emergencyContactName: fullName(), emergencyContactPhone: mobile(),
        pfNumberMasked: `BR/PAT/••••${hashDigits("pf" + empN, 4)}`,
        esicNumberMasked: `••••••${hashDigits("es" + empN, 5)}`,
        uanMasked: `1002••••${hashDigits("ua" + empN, 4)}`,
        oemCertifications: certs, dailyCapacity: isFE ? rng.int(3, 4) : 0, active: true,
      });
    }
  }
  const directors = ds.employees.filter((e) => e.department === "Management");
  ds.employees.forEach((e) => {
    if (e.department !== "Management") {
      const mgr = ds.employees.find(
        (m) => m.department === e.department && m.branchId === e.branchId && m.id !== e.id,
      );
      e.reportingManagerId = mgr?.id ?? directors[0]!.id;
    }
  });
  const fieldEngineers = ds.employees.filter((e) => e.designation === "Field Service Engineer");

  /* =================================================================== users */
  const demoRoles: { role: Role; designation: string; branchCode: string }[] = [
    { role: "DIRECTOR_BUSINESS", designation: "Director – Business (Managing Director)", branchCode: "PAT" },
    { role: "DIRECTOR_STRATEGY", designation: "Director – Strategy (Founder)", branchCode: "PAT" },
    { role: "BRANCH_MANAGER", designation: "Branch Manager — Muzaffarpur", branchCode: "MUZ" },
    { role: "SALES_EXECUTIVE", designation: "Sales Executive", branchCode: "PAT" },
    { role: "SERVICE_MANAGER", designation: "Service Manager", branchCode: "PAT" },
    { role: "FIELD_ENGINEER", designation: "Field Service Engineer", branchCode: "PAT" },
    { role: "PROJECT_MANAGER", designation: "Projects Manager (EPC)", branchCode: "PAT" },
    { role: "ACCOUNTS_EXECUTIVE", designation: "Accounts & Commercial Executive", branchCode: "PAT" },
    { role: "HR_ADMIN", designation: "HR & Admin Executive", branchCode: "PAT" },
    { role: "STORE_INCHARGE", designation: "Store In-charge — Central Warehouse", branchCode: "PAT" },
    { role: "AUDITOR", designation: "Internal Auditor", branchCode: "PAT" },
    { role: "SUPER_ADMIN", designation: "Platform Administrator", branchCode: "PAT" },
  ];
  demoRoles.forEach((d, i) => {
    const branch = branchByCode.get(d.branchCode)!;
    let emp: T.Employee | undefined;
    if (d.role === "FIELD_ENGINEER") emp = fieldEngineers.find((f) => f.branchId === branch.id);
    else if (d.role === "DIRECTOR_BUSINESS") emp = directors[0];
    else if (d.role === "DIRECTOR_STRATEGY") emp = directors[1];
    else emp = ds.employees.find((e) => e.branchId === branch.id && !ds.users.some((u) => u.employeeId === e.id));
    ds.users.push({
      id: id("USR", i + 1, 2), name: emp?.name ?? fullName(), role: d.role,
      branchId: branch.id, employeeId: emp?.id ?? null,
      email: `${d.role.toLowerCase().replace(/_/g, ".")}@bhushancorp.in`,
      phone: emp?.phone ?? mobile(), designation: d.designation, active: true,
      stockLocationIds: d.role === "STORE_INCHARGE" ? ds.stockLocations.map((s) => s.id) : [],
    });
  });
  const userByRole = new Map(ds.users.map((u) => [u.role, u]));
  const uDB = userByRole.get("DIRECTOR_BUSINESS")!;
  const uSM = userByRole.get("SERVICE_MANAGER")!;
  const uAC = userByRole.get("ACCOUNTS_EXECUTIVE")!;
  const uPM = userByRole.get("PROJECT_MANAGER")!;
  const uST = userByRole.get("STORE_INCHARGE")!;
  const uSE = userByRole.get("SALES_EXECUTIVE")!;
  const uHR = userByRole.get("HR_ADMIN")!;
  const uBM = userByRole.get("BRANCH_MANAGER")!;
  const uSA = userByRole.get("SUPER_ADMIN")!;

  // Engineer boot stock, one per field engineer
  fieldEngineers.forEach((fe, i) => {
    ds.stockLocations.push({
      id: id("SL-FE", i + 1, 2), code: `BOOT-${fe.code}`, name: `Boot Stock — ${fe.name}`,
      kind: "ENGINEER_BOOT", branchId: fe.branchId, ownerUserId: null, projectId: null,
    });
  });
  const cw = ds.stockLocations[0]!;

  /* ================================================================ holidays */
  C.HOLIDAYS_2026.forEach((h, i) => {
    ds.holidays.push({ id: id("HOL", i + 1, 3), branchId: null, date: `${h.date}T00:00:00.000+05:30`, name: h.name });
  });

  /* =============================================================== leave types */
  C.LEAVE_TYPES.forEach((lt, i) => {
    ds.leaveTypes.push({ id: id("LVT", i + 1, 2), code: lt.code, name: lt.name, annualEntitlement: lt.annualEntitlement, accrualPerMonth: lt.accrualPerMonth });
  });

  /* =================================================================== items */
  const N = TARGETS.counts;
  const itemPlan: { category: ItemCategory; count: number }[] = [
    { category: "MACHINE", count: 96 }, { category: "SPARE", count: 742 },
    { category: "CONSUMABLE", count: 168 }, { category: "ACCESSORY", count: 134 },
    { category: "PIPE_FITTING", count: 78 }, { category: "SERVICE", count: 22 },
  ];
  let itemN = 0;
  const machineItems: T.Item[] = [];
  const spareItems: T.Item[] = [];
  const serviceItems: T.Item[] = [];

  for (const plan of itemPlan) {
    for (let i = 0; i < plan.count; i++) {
      itemN++;
      let description = "", principal: OEMPrincipal = "OTHER", productLine: ProductLine | null = null;
      let uom = "Nos", hsn = "8414", gstRate = 18, cost = 1000, price = 1300, fast = false;

      if (plan.category === "MACHINE") {
        const spec = C.MACHINE_SPECS[i % C.MACHINE_SPECS.length]!;
        const cap = Math.round(rng.float(spec.capacityRange[0], spec.capacityRange[1], 0));
        description = `${C.productLineLabel(spec.productLine)} — ${spec.series} ${cap} ${spec.capacityUnit}`;
        principal = spec.principal; productLine = spec.productLine;
        hsn = spec.hsn; gstRate = spec.gstRate;
        cost = Math.round(rng.float(spec.priceRange[0], spec.priceRange[1], 0) * 0.78);
        price = Math.round(cost / 0.78);
      } else if (plan.category === "SPARE" || plan.category === "CONSUMABLE") {
        const spec = C.SPARE_SPECS[i % C.SPARE_SPECS.length]!;
        if ((plan.category === "CONSUMABLE") !== (spec.category === "CONSUMABLE")) {
          // keep vocabulary sensible but allow either bucket to draw from the list
        }
        const variant = ["", " (Standard)", " (Heavy Duty)", " (OEM Genuine)", " — Small Frame", " — Large Frame"][i % 6];
        description = `${spec.name}${variant}`;
        principal = spec.principal; productLine = spec.productLines[i % spec.productLines.length]!;
        uom = spec.uom; hsn = spec.hsn; gstRate = spec.gstRate; fast = spec.fastMoving;
        cost = Math.round(rng.float(spec.costRange[0], spec.costRange[1], 0));
        price = Math.round(cost * rng.float(1.28, 1.62));
      } else if (plan.category === "ACCESSORY") {
        description = `${C.ACCESSORY_NAMES[i % C.ACCESSORY_NAMES.length]} — ${rng.int(1, 12)}"`;
        principal = rng.pick(["ELGI", "ATS_ELGI", "OTHER"] as OEMPrincipal[]);
        hsn = "8481"; cost = rng.int(600, 42000); price = Math.round(cost * 1.4);
      } else if (plan.category === "PIPE_FITTING") {
        description = `${C.PIPE_NAMES[i % C.PIPE_NAMES.length]} ${[20, 25, 32, 40, 50, 63, 75, 90, 110, 160][i % 10]} mm`;
        productLine = "PPR_PIPING"; hsn = "3917"; uom = i % 10 === 0 ? "Mtr" : "Nos";
        cost = rng.int(120, 4800); price = Math.round(cost * 1.35);
      } else {
        description = C.SERVICE_ITEM_NAMES[i % C.SERVICE_ITEM_NAMES.length]!;
        uom = "Job"; hsn = "9987"; gstRate = 18;
        cost = rng.int(1500, 48000); price = Math.round(cost * 1.55);
      }

      const item: T.Item = {
        id: id("ITM", itemN, 4),
        code: `${plan.category.slice(0, 3)}-${String(itemN).padStart(4, "0")}`,
        description, category: plan.category, principal, productLine,
        oemPartNumber: `${principal.slice(0, 3)}${hashDigits(`p${itemN}`, 7)}`,
        uom, hsnSac: hsn, gstRate, standardCost: cost, standardPrice: price,
        reorderLevel: plan.category === "SPARE" || plan.category === "CONSUMABLE" ? rng.int(4, 28) : plan.category === "MACHINE" ? 0 : rng.int(2, 16),
        reorderQty: rng.int(6, 48), leadTimeDays: rng.int(4, 45),
        storageLocation: `${String.fromCharCode(65 + (itemN % 8))}-${rng.int(1, 24)}-${rng.int(1, 6)}`,
        active: true,
      };
      ds.items.push(item);
      if (plan.category === "MACHINE") machineItems.push(item);
      if (plan.category === "SPARE" || plan.category === "CONSUMABLE") spareItems.push(item);
      if (plan.category === "SERVICE") serviceItems.push(item);
      if (fast) (item as T.Item & { _fast?: boolean })._fast = true;

      ds.priceList.push({
        id: id("PLE", itemN, 4), itemId: item.id, principal,
        rate: price, effectiveFrom: iso(daysAgo(400)), effectiveTo: null,
      });
    }
  }

  /* =============================================================== suppliers */
  C.SUPPLIER_NAMES.forEach((name, i) => {
    ds.suppliers.push({
      id: id("SUP", i + 1, 3), code: `SUP${String(i + 1).padStart(3, "0")}`, name,
      gstin: `10${["AAB", "AAC", "AAD", "AAE"][i % 4]}${["CS", "FS", "PS"][i % 3]}${hashDigits("s" + i, 4)}${["K", "L", "M"][i % 3]}1Z${i % 10}`,
      contactPerson: fullName(), phone: mobile(), email: `sales${i + 1}@supplier.example`,
      paymentTerms: rng.pick(["30 days", "45 days", "Advance", "15 days", "60 days"]),
      categories: rng.sample(["SPARE", "CONSUMABLE", "ACCESSORY", "PIPE_FITTING"] as ItemCategory[], rng.int(1, 3)),
      stateCode: rng.weighted([["10", 55], ["27", 15], ["33", 12], ["29", 10], ["07", 8]]),
    });
  });

  /* =============================================================== customers */
  const custPlan: { type: T.Customer["type"]; count: number }[] = [
    { type: "INDUSTRIAL", count: 92 }, { type: "INSTITUTIONAL", count: 8 },
    { type: "GOVERNMENT", count: 6 }, { type: "DEALER", count: 8 }, { type: "RETAIL", count: 14 },
  ];
  let custN = 0;
  const nepalTargets = 6;
  let nepalAssigned = 0;
  for (const plan of custPlan) {
    for (let i = 0; i < plan.count; i++) {
      custN++;
      const inst = plan.type === "INSTITUTIONAL" || plan.type === "GOVERNMENT";
      const useNepal = plan.type === "INDUSTRIAL" && nepalAssigned < nepalTargets && custN % 15 === 0;
      if (useNepal) nepalAssigned++;
      const district = useNepal
        ? C.DISTRICTS.find((d) => d.country === "NP")!
        : rng.weighted(C.DISTRICTS.filter((d) => d.country === "IN").map((d) => [d, d.branchCode === "PAT" ? 3 : 2] as const));
      const branch = branchByCode.get(district.branchCode)!;
      const legalName = inst
        ? `${C.INSTITUTIONAL_ARCHETYPES[custN % C.INSTITUTIONAL_ARCHETYPES.length]} — ${district.name}`
        : `${rng.pick(C.INDUSTRIAL_PREFIX)} ${rng.pick(C.INDUSTRIAL_SUFFIX)}${plan.type === "INDUSTRIAL" ? " Pvt Ltd" : ""}`;
      const salesUsers = [uSE, uBM];
      ds.customers.push({
        id: id("CUS", custN, 3), code: `C${String(custN).padStart(4, "0")}`,
        legalName, tradeName: legalName.replace(" Pvt Ltd", ""),
        type: plan.type,
        gstin: useNepal ? null : `10${["AAA", "AAB", "AAC", "AAD", "AAE", "AAF"][custN % 6]}${["CB", "CS", "FP", "PL"][custN % 4]}${hashDigits("g" + custN, 4)}${["A", "B", "C", "K", "M"][custN % 5]}1Z${custN % 10}`,
        pan: useNepal ? null : `${["AAA", "AAB", "AAC", "AAD"][custN % 4]}${["CB", "CS", "FP", "PL"][custN % 4]}${hashDigits("g" + custN, 4)}${["A", "B", "C", "K", "M"][custN % 5]}`,
        industry: inst ? "Municipal Body" : rng.pick(C.INDUSTRIES),
        creditTermDays: inst ? rng.pick([45, 60, 90]) : rng.pick([0, 15, 30, 45]),
        creditLimit: inst ? rng.int(20, 90) * 100_000 : rng.int(2, 40) * 100_000,
        branchId: branch.id, ownerUserId: rng.pick(salesUsers).id, active: true,
        country: district.country, createdAt: iso(daysAgo(rng.int(30, 2600))),
      });
    }
  }
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  const institutionalIds = new Set(
    ds.customers.filter((c) => c.type === "INSTITUTIONAL" || c.type === "GOVERNMENT").map((c) => c.id),
  );

  /* =================================================================== sites */
  let siteN = 0;
  const sitesByCustomer = new Map<string, T.Site[]>();
  // 128 customers -> 164 sites: everyone gets 1, then 36 get a second.
  const extraSiteCustomers = new Set(rng.sample(ds.customers.map((c) => c.id), N.sites - N.customers));
  for (const cust of ds.customers) {
    const count = extraSiteCustomers.has(cust.id) ? 2 : 1;
    const list: T.Site[] = [];
    for (let k = 0; k < count; k++) {
      siteN++;
      const branch = ds.branches.find((b) => b.id === cust.branchId)!;
      const district = C.DISTRICTS.find((d) =>
        cust.country === "NP" ? d.country === "NP" : d.branchCode === branch.code,
      ) ?? C.DISTRICTS[0]!;
      const site: T.Site = {
        id: id("SIT", siteN, 3), customerId: cust.id,
        name: k === 0 ? "Main Plant" : rng.pick(["Unit II", "Workshop", "Godown", "Annexe Plant"]),
        address: `Plot ${rng.int(1, 240)}, ${rng.pick(["Industrial Area", "Growth Centre", "Bypass Road", "Station Road", "Bela Industrial Estate"])}, ${district.name}`,
        district: district.name, state: district.state, stateCode: district.stateCode,
        pincode: district.country === "NP" ? "44300" : `8${hashDigits("pin" + siteN, 5)}`,
        contactPerson: fullName(), contactPhone: mobile(),
        notes: rng.pick(["Entry via gate 2, PPE mandatory", "Plant shuts Sunday", "Contact security for gate pass", "Utility block behind main shed", ""]),
        lat: round2(district.lat + rng.float(-0.09, 0.09, 4)),
        lng: round2(district.lng + rng.float(-0.09, 0.09, 4)),
      };
      ds.sites.push(site);
      list.push(site);
    }
    sitesByCustomer.set(cust.id, list);

    const contactCount = rng.int(1, 3);
    for (let k = 0; k < contactCount; k++) {
      ds.contacts.push({
        id: id("CON", ds.contacts.length + 1, 4), customerId: cust.id, name: fullName(),
        designation: rng.pick(C.DESIGNATIONS_CUSTOMER), mobile: mobile(),
        email: `contact${ds.contacts.length + 1}@customer.example`,
        preferredChannel: rng.weighted([["WHATSAPP", 55], ["IN_APP", 5], ["EMAIL", 30], ["SMS", 10]]),
        isPrimary: k === 0,
      });
    }
  }

  /* ============================================== SLA definitions (masters) */
  const slaDefaults: [TicketSeverity, number, number][] = [
    ["CRITICAL", 4, 24], ["HIGH", 8, 48], ["NORMAL", 24, 96], ["LOW", 48, 168],
  ];
  slaDefaults.forEach(([sev, resp, rest], i) => {
    ds.slaDefinitions.push({
      id: id("SLA", i + 1, 2), productLine: null, severity: sev, coverage: null,
      responseHours: resp, restorationHours: rest, businessHoursOnly: false,
      pauseOnAwaitingParts: true, pauseOnAwaitingCustomer: true,
      label: `Default — ${sev}`,
    });
  });
  // OEM commitment tier for compressors: the ~48h air-restoration programme (BRD §2.3)
  ds.slaDefinitions.push({
    id: "SLA-OEM", productLine: "SCREW_COMPRESSOR", severity: "CRITICAL", coverage: null,
    responseHours: 4, restorationHours: 48, businessHoursOnly: false,
    pauseOnAwaitingParts: true, pauseOnAwaitingCustomer: true,
    label: "ELGi air-restoration commitment",
  });

  /* ================================================================== assets */
  const assetPlan: { line: ProductLine[]; count: number }[] = [
    { line: ["PISTON_COMPRESSOR", "SCREW_COMPRESSOR", "OIL_FREE_COMPRESSOR", "PORTABLE_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR", "AIR_ACCESSORY"], count: 172 },
    { line: ["BODY_SHOP_EQUIPMENT", "LUBE_EQUIPMENT", "WASHING_EQUIPMENT", "LIFTING_EQUIPMENT", "PNEUMATIC_TOOL", "TYRE_INFLATOR"], count: 61 },
    { line: ["PUMP"], count: 44 },
    { line: ["WATER_TREATMENT"], count: 9 },
  ];
  let assetN = 0;
  for (const plan of assetPlan) {
    for (let i = 0; i < plan.count; i++) {
      assetN++;
      const productLine = plan.line[i % plan.line.length]!;
      const spec = C.MACHINE_SPECS.find((s) => s.productLine === productLine)!;
      const site = ds.sites[assetN % ds.sites.length]!;
      const cust = custById.get(site.customerId)!;
      const item = machineItems.find((m) => m.productLine === productLine) ?? machineItems[0]!;
      const commissioned = daysAgo(rng.int(20, 2200));
      const cap = Math.round(rng.float(spec.capacityRange[0], spec.capacityRange[1], 0));
      ds.assets.push({
        id: id("AST", assetN, 3),
        serial: `${spec.principal === "ATS_ELGI" ? "ATS" : spec.principal.slice(0, 3)}${String(commissioned.getFullYear()).slice(2)}${hashHex(`sn${assetN}`, 5).toUpperCase()}`,
        principal: spec.principal, productLine, model: `${spec.series} ${cap}${spec.capacityUnit}`,
        capacityValue: cap, capacityUnit: spec.capacityUnit,
        ratedKw: spec.kwRange ? round2(rng.float(spec.kwRange[0], spec.kwRange[1], 1)) : null,
        customerId: cust.id, siteId: site.id,
        locationInSite: rng.pick(["Utility room", "Compressor house", "Workshop bay 1", "Workshop bay 2", "Pump house", "Terrace plant room", "Near DG set"]),
        itemId: item.id, saleInvoiceId: null,
        installationDate: iso(shift(commissioned, -rng.int(1, 12))),
        commissioningDate: iso(commissioned),
        warrantyMonths: spec.warrantyMonths,
        runningHours: rng.int(200, 41000), runningHoursAt: iso(daysAgo(rng.int(1, 120))),
        status: "RUNNING", branchId: cust.branchId, decommissionReason: null,
        createdAt: iso(commissioned),
      });
    }
  }

  /* ========================================== coverage: 38 / 104 / 144 exact */
  const shuffledAssets = rng.shuffle(ds.assets);
  const inWarranty = shuffledAssets.slice(0, N.assetsInWarranty);
  const underAmc = shuffledAssets.slice(N.assetsInWarranty, N.assetsInWarranty + N.assetsUnderAmc);
  // remainder (144) is out of coverage by construction

  // In-warranty assets: commissioned recently enough that warranty is still live.
  for (const a of inWarranty) {
    const monthsLeft = rng.int(1, 11);
    const comm = addMonths(now, monthsLeft - a.warrantyMonths);
    a.commissioningDate = iso(comm);
    a.installationDate = iso(shift(comm, -rng.int(1, 10)));
    a.createdAt = iso(comm);
  }
  // Assets under AMC and assets out of coverage must both have EXPIRED warranty,
  // otherwise coverageState() resolves them to IN_WARRANTY (which takes
  // precedence) and the 38 / 104 / 144 split does not hold.
  for (const a of shuffledAssets.slice(N.assetsInWarranty)) {
    const comm = new Date(a.commissioningDate!);
    if (addMonths(comm, a.warrantyMonths) > now) {
      const newComm = addMonths(now, -(a.warrantyMonths + rng.int(2, 40)));
      a.commissioningDate = iso(newComm);
      a.installationDate = iso(shift(newComm, -rng.int(1, 10)));
      a.createdAt = iso(newComm);
    }
  }

  /* ============================================================ AMC contracts */
  // 96 live contracts covering exactly 104 assets; 14 expiring in <=60d worth 18.4L
  const amcAssetGroups: T.InstalledAsset[][] = [];
  {
    const pool = [...underAmc];
    // 8 contracts cover 2 assets each (16), 88 cover 1 each (88) -> 104
    for (let i = 0; i < 8; i++) amcAssetGroups.push([pool.shift()!, pool.shift()!]);
    while (pool.length) amcAssetGroups.push([pool.shift()!]);
  }
  const expiringValues = allocateExactWhole(rng, TARGETS.amcExpiring60Value, N.amcExpiring60, 0.5);
  let amcN = 0;
  amcAssetGroups.forEach((group, idx) => {
    amcN++;
    const isExpiring = idx < N.amcExpiring60;
    const cust = custById.get(group[0]!.customerId)!;
    // Non-expiring contracts must end more than 60 days out, or amcStatus()
    // classifies them EXPIRING too and the radar count overshoots.
    const start = isExpiring
      ? addMonths(shift(now, rng.int(3, 58)), -12)
      : daysAgo(rng.int(70, 292));
    const end = addMonths(start, 12);
    const coverage = amcN <= 61 ? "COMPREHENSIVE" : "NON_COMPREHENSIVE";
    const value = isExpiring
      ? expiringValues[idx]!
      : Math.round(group.reduce((s, a) => s + (a.ratedKw ?? 10) * rng.int(1400, 3200), 0));
    ds.amcContracts.push({
      id: id("AMC", amcN, 3), number: `BC/AMC/${String(start.getFullYear()).slice(2)}/${String(amcN).padStart(3, "0")}`,
      customerId: cust.id, branchId: cust.branchId, assetIds: group.map((a) => a.id),
      coverage, startDate: iso(start), endDate: iso(end), contractValue: value,
      billingSchedule: rng.weighted([["ONE_TIME", 55], ["QUARTERLY", 25], ["HALF_YEARLY", 20]]),
      visitsPerYear: coverage === "COMPREHENSIVE" ? rng.pick([4, 6]) : rng.pick([2, 4]),
      responseHours: rng.pick([4, 8]), restorationHours: rng.pick([24, 48]),
      inclusions: coverage === "COMPREHENSIVE"
        ? "All scheduled preventive visits, breakdown attendance, and genuine OEM spares except consumables listed as excluded."
        : "Scheduled preventive visits and breakdown attendance (labour only). Spares chargeable at prevailing rates.",
      exclusions: "Consumable oil beyond first fill, air-end overhaul, damage from incorrect utility supply, and any work arising from unauthorised third-party intervention.",
      ownerUserId: uSM.id, terminated: false, terminationReason: null,
      renewedIntoId: null, renewalQuotationId: null, createdAt: iso(start),
    });
  });
  // 8 lapsed contracts in the trailing 6 months — the visible leak
  for (let i = 0; i < N.amcLapsed; i++) {
    amcN++;
    const asset = shuffledAssets[N.assetsInWarranty + N.assetsUnderAmc + i]!;
    const end = daysAgo(rng.int(15, 175));
    const start = addMonths(end, -12);
    ds.amcContracts.push({
      id: id("AMC", amcN, 3), number: `BC/AMC/${String(start.getFullYear()).slice(2)}/${String(amcN).padStart(3, "0")}`,
      customerId: asset.customerId, branchId: asset.branchId, assetIds: [asset.id],
      coverage: rng.bool(0.5) ? "COMPREHENSIVE" : "NON_COMPREHENSIVE",
      startDate: iso(start), endDate: iso(end),
      contractValue: rng.int(28, 165) * 1000,
      billingSchedule: "ONE_TIME", visitsPerYear: 4,
      responseHours: 8, restorationHours: 48,
      inclusions: "Scheduled preventive visits and breakdown attendance.",
      exclusions: "Consumables and major overhaul.",
      ownerUserId: uSM.id, terminated: false, terminationReason: null,
      renewedIntoId: null, renewalQuotationId: null, createdAt: iso(start),
    });
  }

  const liveAmcs = ds.amcContracts.slice(0, N.amcLive);
  const amcByAsset = new Map<string, T.AMCContract>();
  liveAmcs.forEach((a) => a.assetIds.forEach((x) => amcByAsset.set(x, a)));

  /* ========================================================= scheduled visits */
  let svN = 0;
  for (const amc of liveAmcs) {
    const start = new Date(amc.startDate), end = new Date(amc.endDate);
    const span = end.getTime() - start.getTime();
    for (let v = 0; v < amc.visitsPerYear; v++) {
      const due = new Date(start.getTime() + (span * (v + 1)) / (amc.visitsPerYear + 1));
      for (const assetId of amc.assetIds) {
        svN++;
        ds.scheduledVisits.push({
          id: id("SVT", svN, 4), amcContractId: amc.id, assetId, dueDate: iso(due),
          sequence: v + 1, ticketId: null,
          completedAt: due < now && rng.bool(0.82) ? iso(shift(due, rng.int(0, 6))) : null,
        });
      }
    }
  }

  return finish(ds, rng, now, {
    machineItems, spareItems, serviceItems, custById, sitesByCustomer,
    institutionalIds, fieldEngineers, liveAmcs, amcByAsset, inWarranty,
    users: { uDB, uSM, uAC, uPM, uST, uSE, uHR, uBM, uSA }, cw,
    HISTORY_DAYS,
  });
}

export type { Dataset };
