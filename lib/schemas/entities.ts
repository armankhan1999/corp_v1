import { z } from "zod";
import * as E from "./enums";

/**
 * Entity schemas — PRD §6.1. Zod is the single source of truth; every exported
 * type is inferred (NFR-16). Dates are ISO strings so records survive the
 * JSON boundary of the mock route handlers unchanged.
 */

const zISO = z.string().min(10);
const zId = z.string().min(1);
const zMoney = z.number();

/* ------------------------------------------------------- org & identity */

export const zBranch = z.object({
  id: zId,
  code: z.string(),
  name: z.string(),
  city: z.string(),
  district: z.string(),
  state: z.string(),
  stateCode: z.string(),
  isHeadOffice: z.boolean(),
  hasCentralWarehouse: z.boolean(),
  gstin: z.string(),
  address: z.string(),
  phone: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type Branch = z.infer<typeof zBranch>;

export const zUser = z.object({
  id: zId,
  name: z.string(),
  role: E.zRole,
  branchId: zId,
  employeeId: zId.nullable(),
  email: z.string(),
  phone: z.string(),
  designation: z.string(),
  active: z.boolean(),
  /** stock locations this user may act on — STORE_INCHARGE scoping, RBAC-3 */
  stockLocationIds: z.array(zId),
});
export type User = z.infer<typeof zUser>;

export const zHoliday = z.object({
  id: zId,
  branchId: zId.nullable(),
  date: zISO,
  name: z.string(),
});
export type Holiday = z.infer<typeof zHoliday>;

/* ------------------------------------------------------------- customers */

export const zCustomer = z.object({
  id: zId,
  code: z.string(),
  legalName: z.string(),
  tradeName: z.string(),
  type: E.zCustomerType,
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  industry: z.string(),
  creditTermDays: z.number().int(),
  creditLimit: zMoney,
  branchId: zId,
  ownerUserId: zId,
  active: z.boolean(),
  country: z.string(),
  createdAt: zISO,
});
export type Customer = z.infer<typeof zCustomer>;

export const zSite = z.object({
  id: zId,
  customerId: zId,
  name: z.string(),
  address: z.string(),
  district: z.string(),
  state: z.string(),
  stateCode: z.string(),
  pincode: z.string(),
  contactPerson: z.string(),
  contactPhone: z.string(),
  notes: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type Site = z.infer<typeof zSite>;

export const zContact = z.object({
  id: zId,
  customerId: zId,
  name: z.string(),
  designation: z.string(),
  mobile: z.string(),
  email: z.string(),
  preferredChannel: E.zNotificationChannel,
  isPrimary: z.boolean(),
});
export type Contact = z.infer<typeof zContact>;

/* ---------------------------------------------------------------- items */

export const zItem = z.object({
  id: zId,
  code: z.string(),
  description: z.string(),
  category: E.zItemCategory,
  principal: E.zOEMPrincipal,
  productLine: E.zProductLine.nullable(),
  oemPartNumber: z.string(),
  uom: z.string(),
  hsnSac: z.string(),
  gstRate: z.number(),
  standardCost: zMoney,
  standardPrice: zMoney,
  reorderLevel: z.number(),
  reorderQty: z.number(),
  leadTimeDays: z.number().int(),
  storageLocation: z.string(),
  active: z.boolean(),
});
export type Item = z.infer<typeof zItem>;

export const zPriceListEntry = z.object({
  id: zId,
  itemId: zId,
  principal: E.zOEMPrincipal,
  rate: zMoney,
  effectiveFrom: zISO,
  effectiveTo: zISO.nullable(),
});
export type PriceListEntry = z.infer<typeof zPriceListEntry>;

/* ----------------------------------------------------------------- sales */

export const zEnquiry = z.object({
  id: zId,
  number: z.string(),
  customerId: zId,
  siteId: zId.nullable(),
  branchId: zId,
  vertical: E.zVertical,
  source: E.zEnquirySource,
  requirement: z.string(),
  productLine: E.zProductLine.nullable(),
  paramCfm: z.number().nullable(),
  paramBar: z.number().nullable(),
  paramHeadM: z.number().nullable(),
  paramFlowLpm: z.number().nullable(),
  expectedValue: zMoney,
  expectedClosure: zISO,
  ownerUserId: zId.nullable(),
  status: E.zEnquiryStatus,
  stageEnteredAt: zISO,
  createdAt: zISO,
});
export type Enquiry = z.infer<typeof zEnquiry>;

export const zQuotationLine = z.object({
  id: zId,
  quotationId: zId,
  itemId: zId,
  description: z.string(),
  hsnSac: z.string(),
  uom: z.string(),
  qty: z.number(),
  rate: zMoney,
  discountPct: z.number(),
  gstRate: z.number(),
});
export type QuotationLine = z.infer<typeof zQuotationLine>;

export const zQuotation = z.object({
  id: zId,
  number: z.string(),
  version: z.number().int(),
  rootId: zId,
  supersedesId: zId.nullable(),
  changeSummary: z.string().nullable(),
  enquiryId: zId.nullable(),
  customerId: zId,
  siteId: zId.nullable(),
  branchId: zId,
  ownerUserId: zId,
  vertical: E.zVertical,
  status: E.zQuotationStatus,
  quotationDate: zISO,
  validityDays: z.number().int(),
  paymentTerms: z.string(),
  deliveryTerms: z.string(),
  warrantyTerms: z.string(),
  inclusions: z.string(),
  exclusions: z.string(),
  technicalNotes: z.string(),
  lossReason: E.zLossReason.nullable(),
  competitor: z.string().nullable(),
  approvalRequestId: zId.nullable(),
  approvedByUserId: zId.nullable(),
  approvedAt: zISO.nullable(),
  sourceAmcContractId: zId.nullable(),
  stageEnteredAt: zISO,
  createdAt: zISO,
});
export type Quotation = z.infer<typeof zQuotation>;

export const zSalesOrderLine = z.object({
  id: zId,
  salesOrderId: zId,
  itemId: zId,
  description: z.string(),
  hsnSac: z.string(),
  uom: z.string(),
  qty: z.number(),
  rate: zMoney,
  discountPct: z.number(),
  gstRate: z.number(),
  qtyDelivered: z.number(),
  qtyInvoiced: z.number(),
});
export type SalesOrderLine = z.infer<typeof zSalesOrderLine>;

export const zSalesOrder = z.object({
  id: zId,
  number: z.string(),
  quotationId: zId,
  customerId: zId,
  siteId: zId.nullable(),
  branchId: zId,
  ownerUserId: zId,
  vertical: E.zVertical,
  orderDate: zISO,
  customerPoRef: z.string(),
  customerPoDate: zISO,
  deliverySchedule: z.string(),
  advanceReceived: zMoney,
  status: z.enum(["OPEN", "PARTIAL", "FULFILLED", "CANCELLED"]),
  createdAt: zISO,
});
export type SalesOrder = z.infer<typeof zSalesOrder>;

export const zTarget = z.object({
  id: zId,
  branchId: zId.nullable(),
  userId: zId.nullable(),
  periodStart: zISO,
  periodEnd: zISO,
  amount: zMoney,
  label: z.string(),
});
export type Target = z.infer<typeof zTarget>;

export const zActivity = z.object({
  id: zId,
  subjectType: z.enum(["ENQUIRY", "QUOTATION", "CUSTOMER", "INVOICE", "TICKET"]),
  subjectId: zId,
  customerId: zId,
  mode: z.enum(["CALL", "VISIT", "EMAIL", "WHATSAPP"]),
  outcome: z.string(),
  notes: z.string(),
  nextActionDate: zISO.nullable(),
  byUserId: zId,
  at: zISO,
});
export type Activity = z.infer<typeof zActivity>;

/* --------------------------------------------------------------- assets */

export const zInstalledAsset = z.object({
  id: zId,
  serial: z.string(),
  principal: E.zOEMPrincipal,
  productLine: E.zProductLine,
  model: z.string(),
  capacityValue: z.number(),
  capacityUnit: z.string(),
  ratedKw: z.number().nullable(),
  customerId: zId,
  siteId: zId,
  locationInSite: z.string(),
  itemId: zId,
  saleInvoiceId: zId.nullable(),
  installationDate: zISO.nullable(),
  commissioningDate: zISO.nullable(),
  warrantyMonths: z.number().int(),
  runningHours: z.number(),
  runningHoursAt: zISO,
  status: E.zAssetStatus,
  branchId: zId,
  decommissionReason: z.string().nullable(),
  createdAt: zISO,
});
export type InstalledAsset = z.infer<typeof zInstalledAsset>;

export const zCommissioningReport = z.object({
  id: zId,
  number: z.string(),
  assetId: zId,
  commissioningDate: zISO,
  engineerUserId: zId,
  siteConditions: z.string(),
  supplyVoltage: z.string(),
  supplyPhase: z.string(),
  earthingOhms: z.number(),
  accessoriesFitted: z.string(),
  checklist: z.array(z.object({ item: z.string(), pass: z.boolean(), remark: z.string() })),
  initialPressureBar: z.number().nullable(),
  initialFadCfm: z.number().nullable(),
  loadCurrentAmp: z.number().nullable(),
  trainingAcknowledged: z.boolean(),
  customerSignatory: z.string(),
  customerDesignation: z.string(),
  dealerAuthorisedBy: z.string(),
  submittedAt: zISO.nullable(),
  acknowledgementRef: z.string().nullable(),
  createdAt: zISO,
});
export type CommissioningReport = z.infer<typeof zCommissioningReport>;

export const zAMCContract = z.object({
  id: zId,
  number: z.string(),
  customerId: zId,
  branchId: zId,
  assetIds: z.array(zId),
  coverage: E.zAMCCoverage,
  startDate: zISO,
  endDate: zISO,
  contractValue: zMoney,
  billingSchedule: z.enum(["ONE_TIME", "QUARTERLY", "HALF_YEARLY"]),
  visitsPerYear: z.number().int(),
  responseHours: z.number(),
  restorationHours: z.number(),
  inclusions: z.string(),
  exclusions: z.string(),
  ownerUserId: zId,
  terminated: z.boolean(),
  terminationReason: z.string().nullable(),
  renewedIntoId: zId.nullable(),
  renewalQuotationId: zId.nullable(),
  createdAt: zISO,
});
export type AMCContract = z.infer<typeof zAMCContract>;

export const zScheduledVisit = z.object({
  id: zId,
  amcContractId: zId,
  assetId: zId,
  dueDate: zISO,
  sequence: z.number().int(),
  ticketId: zId.nullable(),
  completedAt: zISO.nullable(),
});
export type ScheduledVisit = z.infer<typeof zScheduledVisit>;

export const zRentalAsset = z.object({
  id: zId,
  serial: z.string(),
  itemId: zId,
  model: z.string(),
  capacityValue: z.number(),
  capacityUnit: z.string(),
  condition: z.string(),
  branchId: zId,
  availableFrom: zISO,
});
export type RentalAsset = z.infer<typeof zRentalAsset>;

export const zRentalAgreement = z.object({
  id: zId,
  number: z.string(),
  rentalAssetId: zId,
  customerId: zId,
  siteId: zId,
  startDate: zISO,
  expectedReturn: zISO,
  actualReturn: zISO.nullable(),
  rateBasis: z.enum(["PER_DAY", "PER_MONTH"]),
  rate: zMoney,
  deposit: zMoney,
  returnCondition: z.string().nullable(),
  damageNote: z.string().nullable(),
});
export type RentalAgreement = z.infer<typeof zRentalAgreement>;

/* -------------------------------------------------------------- service */

export const zServiceTicket = z.object({
  id: zId,
  number: z.string(),
  customerId: zId,
  siteId: zId,
  assetId: zId,
  branchId: zId,
  category: E.zTicketCategory,
  severity: E.zTicketSeverity,
  problem: z.string(),
  reportedByContactId: zId.nullable(),
  channel: E.zEnquirySource,
  coverage: E.zCoverageType,
  coverageBasis: z.string(),
  amcContractId: zId.nullable(),
  scheduledVisitId: zId.nullable(),
  status: E.zTicketStatus,
  assignedEngineerId: zId.nullable(),
  assignmentOverrideReason: z.string().nullable(),
  loggedAt: zISO,
  responseDue: zISO,
  restorationDue: zISO,
  slaRuleApplied: z.string(),
  slaBusinessHours: z.boolean(),
  firstResponseAt: zISO.nullable(),
  restoredAt: zISO.nullable(),
  closedAt: zISO.nullable(),
  breachedAt: zISO.nullable(),
  breachReasonCode: z.string().nullable(),
  pausedMs: z.number(),
  pauseStartedAt: zISO.nullable(),
});
export type ServiceTicket = z.infer<typeof zServiceTicket>;

export const zPartConsumption = z.object({
  id: zId,
  jobCardId: zId,
  itemId: zId,
  qty: z.number(),
  rate: zMoney,
  gstRate: z.number(),
  billable: z.boolean(),
  stockMovementId: zId.nullable(),
});
export type PartConsumption = z.infer<typeof zPartConsumption>;

export const zJobCard = z.object({
  id: zId,
  number: z.string(),
  ticketId: zId,
  assetId: zId,
  engineerUserId: zId,
  visitSequence: z.number().int(),
  visitType: z.enum(["BREAKDOWN", "PM", "INSTALLATION", "INSPECTION", "REVISIT"]),
  scheduledDate: zISO,
  checkInAt: zISO.nullable(),
  checkOutAt: zISO.nullable(),
  checkInLat: z.number().nullable(),
  checkInLng: z.number().nullable(),
  checkInPlace: z.string().nullable(),
  observations: z.string(),
  rootCause: E.zRootCause.nullable(),
  workPerformed: z.string(),
  runningHoursReading: z.number().nullable(),
  nextVisitRecommendation: z.string(),
  outcome: E.zJobOutcome.nullable(),
  resolvedOnThisVisit: z.boolean(),
  customerAckName: z.string().nullable(),
  customerAckDesignation: z.string().nullable(),
  customerSignature: z.string().nullable(),
  photos: z.array(z.object({ caption: z.string(), tone: z.string() })),
  labourAmount: zMoney,
  travelAmount: zMoney,
  submittedAt: zISO.nullable(),
  tapCount: z.number().int().nullable(),
  createdAt: zISO,
});
export type JobCard = z.infer<typeof zJobCard>;

export const zPartsRequest = z.object({
  id: zId,
  number: z.string(),
  jobCardId: zId.nullable(),
  projectId: zId.nullable(),
  boqLineId: zId.nullable(),
  requestedByUserId: zId,
  stockLocationId: zId,
  lines: z.array(z.object({ itemId: zId, qtyRequested: z.number(), qtyIssued: z.number() })),
  serviceCritical: z.boolean(),
  status: z.enum(["PENDING", "PARTIAL", "ISSUED", "CANCELLED"]),
  raisedAt: zISO,
  issuedAt: zISO.nullable(),
});
export type PartsRequest = z.infer<typeof zPartsRequest>;

/* -------------------------------------------------------------- projects */

export const zProject = z.object({
  id: zId,
  code: z.string(),
  name: z.string(),
  customerId: zId,
  clientType: E.zCustomerType,
  siteLocation: z.string(),
  district: z.string(),
  scopeSummary: z.string(),
  contractType: z.string(),
  workOrderRef: z.string(),
  workOrderDate: zISO,
  contractValue: zMoney,
  startDate: zISO,
  contractualCompletion: zISO,
  revisedCompletion: zISO.nullable(),
  actualCompletion: zISO.nullable(),
  defectLiabilityMonths: z.number().int(),
  retentionPct: z.number(),
  mobilisationAdvance: zMoney,
  priceVariationClause: z.boolean(),
  liquidatedDamagesTerms: z.string(),
  managerUserId: zId,
  branchId: zId,
  status: E.zProjectStatus,
  varianceTolerancePct: z.number(),
  createdAt: zISO,
});
export type Project = z.infer<typeof zProject>;

export const zBOQLine = z.object({
  id: zId,
  projectId: zId,
  section: z.string(),
  sortOrder: z.number().int(),
  code: z.string(),
  description: z.string(),
  uom: z.string(),
  contractedQty: z.number(),
  rate: zMoney,
  variationQty: z.number(),
  variationRef: z.string().nullable(),
  itemId: zId.nullable(),
});
export type BOQLine = z.infer<typeof zBOQLine>;

export const zDPR = z.object({
  id: zId,
  number: z.string(),
  projectId: zId,
  date: zISO,
  weather: z.string(),
  manpower: z.array(z.object({ trade: z.string(), count: z.number().int() })),
  plant: z.array(z.object({ name: z.string(), count: z.number().int() })),
  execution: z.array(z.object({ boqLineId: zId, qty: z.number() })),
  materialsReceived: z.string(),
  siteInstructions: z.string(),
  hindrance: z.string().nullable(),
  hindranceCause: z
    .enum(["WEATHER", "MATERIAL", "CLIENT_APPROVAL", "LABOUR", "DRAWING", "ACCESS", "OTHER"])
    .nullable(),
  safetyObservations: z.string(),
  photos: z.array(z.object({ caption: z.string(), tone: z.string() })),
  byUserId: zId,
  supersedesId: zId.nullable(),
  supersedeReason: z.string().nullable(),
  submittedAt: zISO,
});
export type DPR = z.infer<typeof zDPR>;

export const zMilestone = z.object({
  id: zId,
  projectId: zId,
  name: z.string(),
  plannedDate: zISO,
  actualDate: zISO.nullable(),
  weightage: z.number(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETE", "SLIPPED"]),
});
export type Milestone = z.infer<typeof zMilestone>;

export const zRABill = z.object({
  id: zId,
  number: z.string(),
  projectId: zId,
  sequence: z.number().int(),
  periodFrom: zISO,
  periodTo: zISO,
  cumulativeValue: zMoney,
  previousCumulative: zMoney,
  frozenExecution: z.array(z.object({ boqLineId: zId, cumulativeQty: z.number() })),
  mobilisationRecovery: zMoney,
  retentionPct: z.number(),
  tdsPct: z.number(),
  labourCessPct: z.number(),
  otherDeductions: zMoney,
  otherDeductionsNote: z.string(),
  claimedValue: zMoney,
  certifiedValue: zMoney.nullable(),
  status: E.zRABillStatus,
  submittedAt: zISO.nullable(),
  certifiedAt: zISO.nullable(),
  paidAt: zISO.nullable(),
  invoiceId: zId.nullable(),
  createdAt: zISO,
});
export type RABill = z.infer<typeof zRABill>;

export const zRetentionEntry = z.object({
  id: zId,
  projectId: zId,
  raBillId: zId,
  amount: zMoney,
  withheldOn: zISO,
  eligibleFrom: zISO,
  claimRaisedAt: zISO.nullable(),
  releasedAt: zISO.nullable(),
  releasedAmount: zMoney.nullable(),
  releaseRef: z.string().nullable(),
});
export type RetentionEntry = z.infer<typeof zRetentionEntry>;

export const zProjectCost = z.object({
  id: zId,
  projectId: zId,
  category: z.enum(["MATERIAL", "SUBCONTRACT", "LABOUR", "PLANT", "OVERHEAD"]),
  committed: zMoney,
  incurred: zMoney,
  asOf: zISO,
  note: z.string(),
});
export type ProjectCost = z.infer<typeof zProjectCost>;

/* ------------------------------------------------------------- inventory */

export const zStockLocation = z.object({
  id: zId,
  code: z.string(),
  name: z.string(),
  kind: z.enum(["CENTRAL_WAREHOUSE", "BRANCH", "ENGINEER_BOOT", "PROJECT_SITE"]),
  branchId: zId.nullable(),
  ownerUserId: zId.nullable(),
  projectId: zId.nullable(),
});
export type StockLocation = z.infer<typeof zStockLocation>;

export const zStockMovement = z.object({
  id: zId,
  seq: z.number().int(),
  itemId: zId,
  type: E.zMovementType,
  qty: z.number(),
  fromLocationId: zId.nullable(),
  toLocationId: zId.nullable(),
  sourceType: z.enum([
    "JOB_CARD", "PROJECT", "PURCHASE_ORDER", "OPENING", "TRANSFER",
    "ADJUSTMENT", "SCRAP", "RETURN", "SALES_ORDER",
  ]),
  sourceId: zId.nullable(),
  sourceLabel: z.string(),
  rate: zMoney,
  byUserId: zId,
  at: zISO,
  reason: z.string().nullable(),
});
export type StockMovement = z.infer<typeof zStockMovement>;

export const zStockReservation = z.object({
  id: zId,
  itemId: zId,
  locationId: zId,
  qty: z.number(),
  partsRequestId: zId,
});
export type StockReservation = z.infer<typeof zStockReservation>;

export const zSupplier = z.object({
  id: zId,
  code: z.string(),
  name: z.string(),
  gstin: z.string(),
  contactPerson: z.string(),
  phone: z.string(),
  email: z.string(),
  paymentTerms: z.string(),
  categories: z.array(E.zItemCategory),
  stateCode: z.string(),
});
export type Supplier = z.infer<typeof zSupplier>;

export const zPOLine = z.object({
  id: zId,
  purchaseOrderId: zId,
  itemId: zId,
  qty: z.number(),
  rate: zMoney,
  qtyReceived: z.number(),
});
export type POLine = z.infer<typeof zPOLine>;

export const zPurchaseOrder = z.object({
  id: zId,
  number: z.string(),
  supplierId: zId,
  toLocationId: zId,
  orderDate: zISO,
  expectedDelivery: zISO,
  terms: z.string(),
  status: E.zPOStatus,
  approvalRequestId: zId.nullable(),
  raisedByUserId: zId,
});
export type PurchaseOrder = z.infer<typeof zPurchaseOrder>;

export const zGoodsReceipt = z.object({
  id: zId,
  number: z.string(),
  purchaseOrderId: zId,
  receivedAt: zISO,
  byUserId: zId,
  lines: z.array(z.object({ poLineId: zId, itemId: zId, qtyReceived: z.number() })),
  shortReceipt: z.boolean(),
  excessReceipt: z.boolean(),
  overrideReason: z.string().nullable(),
});
export type GoodsReceipt = z.infer<typeof zGoodsReceipt>;

export const zStockCount = z.object({
  id: zId,
  number: z.string(),
  locationId: zId,
  countedAt: zISO,
  byUserId: zId,
  lines: z.array(z.object({ itemId: zId, systemQty: z.number(), physicalQty: z.number() })),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "POSTED"]),
  approvalRequestId: zId.nullable(),
});
export type StockCount = z.infer<typeof zStockCount>;

/* ------------------------------------------------------------ commercial */

export const zDeliveryChallan = z.object({
  id: zId,
  number: z.string(),
  date: zISO,
  customerId: zId,
  siteId: zId,
  branchId: zId,
  sourceType: z.enum(["SALES_ORDER", "PROJECT", "RENTAL", "SERVICE_PART"]),
  sourceId: zId,
  sourceLabel: z.string(),
  reasonForTransportation: z.string(),
  transportMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]),
  vehicleNumber: z.string(),
  transporter: z.string(),
  transporterGstin: z.string(),
  lrNumber: z.string(),
  approxDistanceKm: z.number(),
  lines: z.array(
    z.object({ itemId: zId, description: z.string(), hsnSac: z.string(), uom: z.string(), qty: z.number(), taxableValue: zMoney }),
  ),
});
export type DeliveryChallan = z.infer<typeof zDeliveryChallan>;

export const zInvoiceLine = z.object({
  id: zId,
  invoiceId: zId,
  itemId: zId.nullable(),
  description: z.string(),
  hsnSac: z.string(),
  uom: z.string(),
  qty: z.number(),
  rate: zMoney,
  discountPct: z.number(),
  gstRate: z.number(),
});
export type InvoiceLine = z.infer<typeof zInvoiceLine>;

export const zInvoice = z.object({
  id: zId,
  number: z.string(),
  type: E.zInvoiceType,
  date: zISO,
  dueDate: zISO,
  customerId: zId,
  siteId: zId.nullable(),
  branchId: zId,
  placeOfSupplyStateCode: z.string(),
  placeOfSupplyName: z.string(),
  taxTreatment: E.zTaxTreatment,
  salesOrderId: zId.nullable(),
  jobCardId: zId.nullable(),
  amcContractId: zId.nullable(),
  raBillId: zId.nullable(),
  rentalAgreementId: zId.nullable(),
  challanId: zId.nullable(),
  roundOff: zMoney,
  irn: z.string().nullable(),
  ackNumber: z.string().nullable(),
  ackDate: zISO.nullable(),
  irpReportedAt: zISO.nullable(),
  eInvoiceApplicable: z.boolean(),
  eInvoiceExemptReason: z.string().nullable(),
  ownerUserId: zId,
  createdAt: zISO,
});
export type Invoice = z.infer<typeof zInvoice>;

export const zCreditNote = z.object({
  id: zId,
  number: z.string(),
  kind: z.enum(["CREDIT", "DEBIT"]),
  invoiceId: zId,
  date: zISO,
  reason: z.string(),
  amount: zMoney,
  gstAmount: zMoney,
  byUserId: zId,
});
export type CreditNote = z.infer<typeof zCreditNote>;

export const zEWayBill = z.object({
  id: zId,
  ebn: z.string(),
  baseDocType: z.enum(["INVOICE", "CHALLAN"]),
  baseDocId: zId,
  baseDocDate: zISO,
  supplyType: z.enum(["OUTWARD", "INWARD"]),
  subType: z.string(),
  transportMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]),
  distanceKm: z.number(),
  transporter: z.string(),
  vehicleNumber: z.string(),
  generatedAt: zISO,
  validUntil: zISO,
});
export type EWayBill = z.infer<typeof zEWayBill>;

export const zReceiptAllocation = z.object({
  id: zId,
  receiptId: zId,
  invoiceId: zId,
  amount: zMoney,
});
export type ReceiptAllocation = z.infer<typeof zReceiptAllocation>;

export const zReceipt = z.object({
  id: zId,
  number: z.string(),
  customerId: zId,
  branchId: zId,
  date: zISO,
  amount: zMoney,
  mode: E.zPaymentMode,
  reference: z.string(),
  simulatedUpi: z.boolean(),
  byUserId: zId,
});
export type Receipt = z.infer<typeof zReceipt>;

export const zCollectionFollowUp = z.object({
  id: zId,
  invoiceId: zId,
  date: zISO,
  mode: z.enum(["CALL", "VISIT", "EMAIL", "WHATSAPP"]),
  personSpokenTo: z.string(),
  outcome: z.string(),
  promisedDate: zISO.nullable(),
  promisedAmount: zMoney.nullable(),
  fulfilled: z.boolean(),
  byUserId: zId,
});
export type CollectionFollowUp = z.infer<typeof zCollectionFollowUp>;

export const zNumberingSeries = z.object({
  id: zId,
  docType: z.string(),
  prefix: z.string(),
  fySegment: z.string(),
  width: z.number().int(),
  current: z.number().int(),
});
export type NumberingSeries = z.infer<typeof zNumberingSeries>;

/* ----------------------------------------------------------------- people */

export const zEmployee = z.object({
  id: zId,
  code: z.string(),
  name: z.string(),
  designation: z.string(),
  department: z.string(),
  branchId: zId,
  reportingManagerId: zId.nullable(),
  dateOfJoining: zISO,
  employmentType: E.zEmploymentType,
  workLocationType: E.zWorkLocationType,
  phone: z.string(),
  email: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
  pfNumberMasked: z.string(),
  esicNumberMasked: z.string(),
  uanMasked: z.string(),
  oemCertifications: z.array(E.zOEMPrincipal),
  dailyCapacity: z.number().int(),
  active: z.boolean(),
});
export type Employee = z.infer<typeof zEmployee>;

export const zEmployeeDocument = z.object({
  id: zId,
  employeeId: zId,
  type: E.zDocumentType,
  title: z.string(),
  issuedOn: zISO,
  expiresOn: zISO.nullable(),
  documentId: zId.nullable(),
});
export type EmployeeDocument = z.infer<typeof zEmployeeDocument>;

export const zAttendanceRecord = z.object({
  id: zId,
  employeeId: zId,
  date: zISO,
  state: E.zAttendanceState,
  checkInAt: zISO.nullable(),
  checkOutAt: zISO.nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  placeLabel: z.string().nullable(),
  jobCardId: zId.nullable(),
  source: z.enum(["APP", "DEVICE", "MANUAL"]),
  selfieCaptured: z.boolean(),
  geofenceBreachKm: z.number().nullable(),
  lateMark: z.boolean(),
  missingCheckOut: z.boolean(),
  regularisedByUserId: zId.nullable(),
  regularisationReason: z.string().nullable(),
  originalState: E.zAttendanceState.nullable(),
});
export type AttendanceRecord = z.infer<typeof zAttendanceRecord>;

export const zLeaveType = z.object({
  id: zId,
  code: z.string(),
  name: z.string(),
  annualEntitlement: z.number(),
  accrualPerMonth: z.number(),
});
export type LeaveType = z.infer<typeof zLeaveType>;

export const zLeaveRequest = z.object({
  id: zId,
  number: z.string(),
  employeeId: zId,
  leaveTypeId: zId,
  fromDate: zISO,
  toDate: zISO,
  days: z.number(),
  reason: z.string(),
  coverageArrangement: z.string(),
  status: E.zLeaveStatus,
  approvalRequestId: zId.nullable(),
  coverageWarning: z.string().nullable(),
  raisedAt: zISO,
  decidedAt: zISO.nullable(),
});
export type LeaveRequest = z.infer<typeof zLeaveRequest>;

/* -------------------------------------------------------------- documents */

export const zDocument = z.object({
  id: zId,
  title: z.string(),
  type: E.zDocumentType,
  category: E.zDocumentCategory,
  linkedType: z
    .enum(["CUSTOMER", "ASSET", "PROJECT", "EMPLOYEE", "INVOICE", "AMC", "COMPANY", "SUPPLIER"])
    .nullable(),
  linkedId: zId.nullable(),
  ownerUserId: zId,
  uploadedAt: zISO,
  version: z.number().int(),
  supersedesId: zId.nullable(),
  effectiveFrom: zISO.nullable(),
  expiresOn: zISO.nullable(),
  tags: z.array(z.string()),
  accessLevel: z.enum(["GENERAL", "COMMERCIAL", "HR", "RESTRICTED"]),
  mime: z.string(),
  sizeKb: z.number().int(),
  pageCount: z.number().int(),
  revision: z.string().nullable(),
  approvalState: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "SUPERSEDED"]).nullable(),
  /** Passages the vault retrieval simulation cites against. */
  passages: z.array(z.object({ id: zId, heading: z.string(), text: z.string() })),
  deletedAt: zISO.nullable(),
  deletedReason: z.string().nullable(),
});
export type PravaahDocument = z.infer<typeof zDocument>;

/* --------------------------------------------------------------- workflow */

export const zApprovalChainStep = z.object({
  id: zId,
  chainId: zId,
  order: z.number().int(),
  approverRole: E.zRole,
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
  escalationHours: z.number(),
  parallel: z.boolean(),
});
export type ApprovalChainStep = z.infer<typeof zApprovalChainStep>;

export const zApprovalChain = z.object({
  id: zId,
  requestType: E.zApprovalRequestType,
  name: z.string(),
  minValue: z.number(),
  maxValue: z.number().nullable(),
});
export type ApprovalChain = z.infer<typeof zApprovalChain>;

export const zApprovalDecision = z.object({
  id: zId,
  requestId: zId,
  stepOrder: z.number().int(),
  approverUserId: zId,
  onBehalfOfUserId: zId.nullable(),
  decision: z.enum(["APPROVED", "REJECTED", "RETURNED"]),
  comment: z.string(),
  channel: E.zNotificationChannel,
  at: zISO,
});
export type ApprovalDecision = z.infer<typeof zApprovalDecision>;

export const zApprovalRequest = z.object({
  id: zId,
  number: z.string(),
  type: E.zApprovalRequestType,
  subjectType: z.string(),
  subjectId: zId,
  subjectLabel: z.string(),
  value: zMoney,
  requesterUserId: zId,
  branchId: zId,
  resolvedChainId: zId,
  resolvedSteps: z.array(
    z.object({ order: z.number().int(), approverRole: E.zRole, escalationHours: z.number() }),
  ),
  currentStep: z.number().int(),
  status: E.zApprovalStatus,
  raisedAt: zISO,
  decidedAt: zISO.nullable(),
  escalatedAt: zISO.nullable(),
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type ApprovalRequest = z.infer<typeof zApprovalRequest>;

export const zDelegation = z.object({
  id: zId,
  approverUserId: zId,
  delegateUserId: zId,
  fromDate: zISO,
  toDate: zISO,
});
export type Delegation = z.infer<typeof zDelegation>;

export const zNotification = z.object({
  id: zId,
  userId: zId,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  entityType: z.string().nullable(),
  entityId: zId.nullable(),
  href: z.string().nullable(),
  read: z.boolean(),
  at: zISO,
  digest: z.boolean(),
});
export type Notification = z.infer<typeof zNotification>;

export const zMessageLog = z.object({
  id: zId,
  channel: E.zNotificationChannel,
  recipientUserId: zId.nullable(),
  recipientContactId: zId.nullable(),
  recipientLabel: z.string(),
  recipientPhone: z.string(),
  template: z.string(),
  content: z.string(),
  approvalRequestId: zId.nullable(),
  entityType: z.string().nullable(),
  entityId: zId.nullable(),
  state: E.zMessageState,
  at: zISO,
  simulated: z.literal(true),
});
export type MessageLog = z.infer<typeof zMessageLog>;

export const zChannelPreference = z.object({
  id: zId,
  notificationType: z.string(),
  role: E.zRole,
  channels: z.array(E.zNotificationChannel),
});
export type ChannelPreference = z.infer<typeof zChannelPreference>;

/* ------------------------------------------------------ audit, AI, admin */

export const zAuditLog = z.object({
  id: zId,
  seq: z.number().int(),
  actorUserId: zId,
  actorName: z.string(),
  actorRole: E.zRole,
  impersonatedBy: zId.nullable(),
  action: E.zAuditAction,
  entityType: z.string(),
  entityId: z.string(),
  entityLabel: z.string(),
  summary: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  at: zISO,
  ip: z.string(),
});
export type AuditLog = z.infer<typeof zAuditLog>;

export const zAICitation = z.object({
  id: zId,
  marker: z.number().int(),
  documentId: zId.nullable(),
  passageId: zId.nullable(),
  recordSetKey: z.string().nullable(),
  label: z.string(),
  href: z.string(),
});
export type AICitation = z.infer<typeof zAICitation>;

export const zAIAnswer = z.object({
  id: zId,
  question: z.string(),
  surface: z.enum(["VAULT", "ASSISTANT", "BRIEFING"]),
  answer: z.string(),
  confidence: E.zConfidenceState,
  confidenceBasis: z.string(),
  citations: z.array(zAICitation),
  searchedCount: z.number().int(),
  readCount: z.number().int(),
  formula: z.string().nullable(),
  recordSetHref: z.string().nullable(),
  refusal: z.boolean(),
  nearestMatches: z.array(z.object({ documentId: zId, title: z.string() })),
});
export type AIAnswer = z.infer<typeof zAIAnswer>;

export const zAIFeedback = z.object({
  id: zId,
  answerId: zId,
  question: z.string(),
  confidence: E.zConfidenceState,
  helpful: z.boolean(),
  comment: z.string(),
  byUserId: zId,
  at: zISO,
});
export type AIFeedback = z.infer<typeof zAIFeedback>;

export const zSLADefinition = z.object({
  id: zId,
  productLine: E.zProductLine.nullable(),
  severity: E.zTicketSeverity,
  coverage: E.zCoverageType.nullable(),
  responseHours: z.number(),
  restorationHours: z.number(),
  businessHoursOnly: z.boolean(),
  pauseOnAwaitingParts: z.boolean(),
  pauseOnAwaitingCustomer: z.boolean(),
  label: z.string(),
});
export type SLADefinition = z.infer<typeof zSLADefinition>;

export const zDSRRequest = z.object({
  id: zId,
  number: z.string(),
  requestType: z.enum(["ACCESS", "CORRECTION", "ERASURE", "WITHDRAW_CONSENT", "GRIEVANCE"]),
  requester: z.string(),
  receivedOn: zISO,
  status: z.enum(["RECEIVED", "IN_PROGRESS", "CLOSED"]),
  closedOn: zISO.nullable(),
  note: z.string(),
});
export type DSRRequest = z.infer<typeof zDSRRequest>;

export const zRetentionPolicy = z.object({
  id: zId,
  entityClass: z.string(),
  retentionMonths: z.number().int(),
  basis: z.string(),
});
export type RetentionPolicy = z.infer<typeof zRetentionPolicy>;
