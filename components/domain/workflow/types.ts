/**
 * Epic E11 — shared, JSON-serialisable contracts between the server snapshot
 * builder (`snapshot.ts`, which reads `@/lib/seed`) and the client surfaces
 * (which must never pull the seed generator into the browser bundle).
 *
 * Every field here survives the RSC boundary unchanged: ISO strings, numbers,
 * booleans, plain objects.
 */

import type * as T from "@/lib/schemas/entities";
import type { ApprovalRequestType, NotificationChannel, Role } from "@/lib/schemas/enums";

/* --------------------------------------------------------------- identity */

export interface ViewerInfo {
  userId: string;
  role: Role;
  name: string;
  branchId: string;
  branchLabel: string;
  phone: string;
  /** RBAC-4 — approval authority is granted separately from data access. */
  hasApprovalAuthority: boolean;
  /** Where the role is threshold-bound, the ceiling it may clear. */
  approveLimit: number | null;
  readOnly: boolean;
  canDesignChains: boolean;
}

export interface UserLite {
  id: string;
  name: string;
  role: Role;
  branchId: string;
  phone: string;
  designation: string;
}

export interface BranchLite {
  id: string;
  code: string;
  name: string;
}

/* ------------------------------------------------------- inline context */

export interface QuotationLineContext {
  id: string;
  description: string;
  uom: string;
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
  lineValue: number;
  lineCost: number;
  marginPct: number;
}

export interface CustomerHistoryContext {
  name: string;
  code: string;
  type: string;
  industry: string;
  since: string;
  creditLimit: number;
  creditTermDays: number;
  outstanding: number;
  oldestOpenDays: number;
  invoicedLifetime: number;
  invoiceCount: number;
  quotationsWon: number;
  quotationsLost: number;
  href: string;
}

export interface LeaveDayContext {
  date: string;
  weekday: string;
  holiday: string | null;
  othersOut: string[];
}

export type SubjectContext =
  | {
      kind: "QUOTATION_DISCOUNT";
      quotationNumber: string;
      quotationHref: string;
      quotationDate: string;
      vertical: string;
      lines: QuotationLineContext[];
      grossValue: number;
      discountValue: number;
      netValue: number;
      weightedDiscountPct: number;
      costValue: number;
      marginPct: number;
      marginPctAtListPrice: number;
      floorMarginPct: number;
      customer: CustomerHistoryContext;
      ownerName: string;
    }
  | {
      kind: "LEAVE";
      leaveNumber: string;
      leaveHref: string;
      employeeName: string;
      employeeCode: string;
      designation: string;
      branchLabel: string;
      leaveTypeName: string;
      fromDate: string;
      toDate: string;
      days: number;
      reason: string;
      coverageArrangement: string;
      coverageWarning: string | null;
      teamSize: number;
      availableDuring: number;
      coverageMinimum: number;
      calendar: LeaveDayContext[];
      openTicketsInBranch: number;
    }
  | {
      kind: "PURCHASE_ORDER";
      poNumber: string;
      poHref: string;
      orderDate: string;
      expectedDelivery: string;
      terms: string;
      supplierName: string;
      supplierCode: string;
      supplierGstin: string;
      supplierPaymentTerms: string;
      supplierStateCode: string;
      lines: {
        id: string;
        itemCode: string;
        description: string;
        uom: string;
        qty: number;
        rate: number;
        lineValue: number;
        lastPurchaseRate: number | null;
        lastPurchaseAt: string | null;
        lastPurchaseSupplier: string | null;
        variancePct: number | null;
        serviceCritical: boolean;
        onHand: number;
        reorderLevel: number;
      }[];
      orderValue: number;
      priorOrdersWithSupplier: number;
    }
  | {
      kind: "CREDIT_LIMIT_OVERRIDE";
      customer: CustomerHistoryContext;
      requestedLimit: number;
      headroomAfter: number;
      utilisationPct: number;
      buckets: { label: string; value: number; count: number }[];
      openOrdersValue: number;
    }
  | {
      kind: "RA_BILL_SUBMISSION";
      billNumber: string;
      billHref: string;
      projectName: string;
      projectHref: string;
      clientName: string;
      periodFrom: string;
      periodTo: string;
      previousCumulative: number;
      cumulativeValue: number;
      currentPeriodValue: number;
      claimedValue: number;
      deductions: { label: string; value: number; basis: string }[];
      executedValue: number;
      contractedValue: number;
      progressPct: number;
      priorBillsCertified: number;
      priorBillsAwaiting: number;
    }
  | {
      kind: "STOCK_ADJUSTMENT";
      locationName: string;
      locationHref: string;
      countedAt: string;
      countedBy: string;
      declaredVarianceValue: number;
      locationStockValue: number;
      variancePctOfLocation: number;
      serviceCriticalBelowReorder: number;
      items: {
        itemCode: string;
        description: string;
        uom: string;
        onHand: number;
        unitCost: number;
        value: number;
        reorderLevel: number;
        lastMovementAt: string | null;
        serviceCritical: boolean;
      }[];
    }
  | {
      kind: "AMC_PRICING_EXCEPTION";
      contractNumber: string;
      contractHref: string;
      customerName: string;
      coverage: string;
      startDate: string;
      endDate: string;
      currentValue: number;
      proposedValue: number;
      deltaPct: number;
      assetCount: number;
      visitsPerYear: number;
      responseHours: number;
      restorationHours: number;
      ticketsLastYear: number;
      partsCostLastYear: number;
      /** Parts only — labour is not costed in the prototype, and says so. */
      marginOverPartsPct: number;
    }
  | {
      kind: "EXPENSE_CLAIM";
      employeeName: string;
      employeeCode: string;
      designation: string;
      branchLabel: string;
      periodLabel: string;
      claimTotal: number;
      fieldVisits: number;
      claimPerVisit: number;
      priorPeriodVisits: number;
      visits: {
        number: string;
        date: string;
        customer: string;
        site: string;
        outcome: string;
      }[];
    }
  | {
      kind: "PRICE_LIST_CHANGE";
      principal: string;
      effectiveFrom: string;
      lines: {
        itemCode: string;
        description: string;
        currentRate: number;
        proposedRate: number;
        deltaPct: number;
        standardCost: number;
        marginAfterPct: number;
      }[];
      averageDeltaPct: number;
      openQuotationsAffected: number;
    }
  | {
      kind: "USER_ROLE_CHANGE";
      subjectUserName: string;
      subjectUserEmail: string;
      fromRole: Role;
      toRole: Role;
      branchLabel: string;
      capabilitiesGained: string[];
      capabilitiesLost: string[];
      grantsApprovalAuthority: boolean;
    }
  | { kind: "UNRESOLVED"; note: string };

/* ------------------------------------------------------------- snapshot */

export interface WorkflowSnapshot {
  /** Simulated clock. PRD SD-8 — everything derives from this, never Date.now(). */
  today: string;
  viewer: ViewerInfo;
  users: UserLite[];
  branches: BranchLite[];
  chains: T.ApprovalChain[];
  chainSteps: T.ApprovalChainStep[];
  requests: T.ApprovalRequest[];
  decisions: T.ApprovalDecision[];
  delegations: T.Delegation[];
  notifications: T.Notification[];
  messages: T.MessageLog[];
  channelPreferences: T.ChannelPreference[];
  /** Keyed by approval request id. */
  contexts: Record<string, SubjectContext>;
  metrics: {
    medianTurnaroundHours: number;
    decidedCount: number;
    pendingCount: number;
  };
}

/* ----------------------------------------------- WhatsApp composer input */

export interface TemplateVariableValue {
  key: string;
  label: string;
  value: string;
}

export interface OutboundDraft {
  templateId: string;
  channel: NotificationChannel;
  recipientUserId: string;
  approvalRequestId: string | null;
  variables: TemplateVariableValue[];
}

export type { ApprovalRequestType };
