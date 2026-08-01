export * from "./enums";
export * from "./entities";

import type * as T from "./entities";

/**
 * The whole seeded world. Mock route handlers slice this; nothing else
 * holds authoritative state. PRD §6.1.
 */
export interface Dataset {
  meta: {
    seed: number;
    /** Simulated "today" — PRD SD-8. Advanceable from Demo Controls. */
    today: string;
    generatedAt: string;
    historyMonths: number;
  };
  branches: T.Branch[];
  users: T.User[];
  holidays: T.Holiday[];
  customers: T.Customer[];
  sites: T.Site[];
  contacts: T.Contact[];
  items: T.Item[];
  priceList: T.PriceListEntry[];
  enquiries: T.Enquiry[];
  quotations: T.Quotation[];
  quotationLines: T.QuotationLine[];
  salesOrders: T.SalesOrder[];
  salesOrderLines: T.SalesOrderLine[];
  targets: T.Target[];
  activities: T.Activity[];
  assets: T.InstalledAsset[];
  commissioningReports: T.CommissioningReport[];
  amcContracts: T.AMCContract[];
  scheduledVisits: T.ScheduledVisit[];
  rentalAssets: T.RentalAsset[];
  rentalAgreements: T.RentalAgreement[];
  tickets: T.ServiceTicket[];
  jobCards: T.JobCard[];
  partConsumptions: T.PartConsumption[];
  partsRequests: T.PartsRequest[];
  projects: T.Project[];
  boqLines: T.BOQLine[];
  dprs: T.DPR[];
  milestones: T.Milestone[];
  raBills: T.RABill[];
  retentionEntries: T.RetentionEntry[];
  projectCosts: T.ProjectCost[];
  stockLocations: T.StockLocation[];
  stockMovements: T.StockMovement[];
  stockReservations: T.StockReservation[];
  suppliers: T.Supplier[];
  purchaseOrders: T.PurchaseOrder[];
  poLines: T.POLine[];
  goodsReceipts: T.GoodsReceipt[];
  stockCounts: T.StockCount[];
  challans: T.DeliveryChallan[];
  invoices: T.Invoice[];
  invoiceLines: T.InvoiceLine[];
  creditNotes: T.CreditNote[];
  ewayBills: T.EWayBill[];
  receipts: T.Receipt[];
  receiptAllocations: T.ReceiptAllocation[];
  collectionFollowUps: T.CollectionFollowUp[];
  numberingSeries: T.NumberingSeries[];
  employees: T.Employee[];
  employeeDocuments: T.EmployeeDocument[];
  attendance: T.AttendanceRecord[];
  leaveTypes: T.LeaveType[];
  leaveRequests: T.LeaveRequest[];
  documents: T.PravaahDocument[];
  approvalChains: T.ApprovalChain[];
  approvalChainSteps: T.ApprovalChainStep[];
  approvalRequests: T.ApprovalRequest[];
  approvalDecisions: T.ApprovalDecision[];
  delegations: T.Delegation[];
  notifications: T.Notification[];
  messageLog: T.MessageLog[];
  channelPreferences: T.ChannelPreference[];
  auditLog: T.AuditLog[];
  slaDefinitions: T.SLADefinition[];
  dsrRequests: T.DSRRequest[];
  retentionPolicies: T.RetentionPolicy[];
  aiFeedback: T.AIFeedback[];
}
