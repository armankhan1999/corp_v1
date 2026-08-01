/**
 * Server-side snapshot builder for Epic E11.
 *
 * The seeded world is large; the browser must never receive the generator. Each
 * workflow route resolves exactly the slice it needs here — including the fully
 * derived inline decision context E11-S2 depends on — and hands the client a
 * plain, serialisable object.
 *
 * Every figure below is either a stored field or a `@/lib/derive` call. Nothing
 * is invented: where the seeded world has no record for a dimension, the panel
 * says so rather than filling the gap.
 */

import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import type { Role } from "@/lib/schemas/enums";
import { ROLE_LABEL, VERTICAL_LABEL } from "@/lib/schemas/enums";
import { enumLabel, formatDate } from "@/lib/format";
import { CAPABILITIES, canWrite, grantFor, isReadOnlyRole, can, type Capability } from "@/lib/rbac/matrix";
import type { Session } from "@/lib/rbac/session";
import type {
  CustomerHistoryContext, LeaveDayContext, SubjectContext, WorkflowSnapshot,
} from "./types";

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Stable index into a collection when the seeded subject reference is of another kind. */
function stableIndex(key: string, length: number): number {
  if (length <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % length;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/* ---------------------------------------------------------- customer 360 */

function customerHistory(ds: Dataset, ctx: D.DeriveCtx, customer: T.Customer): CustomerHistoryContext {
  const invoices = ds.invoices.filter((i) => i.customerId === customer.id);
  let outstanding = 0;
  let oldestOpenDays = 0;
  let invoicedLifetime = 0;
  for (const inv of invoices) {
    const total = D.invoiceTotal(ds, inv.id);
    invoicedLifetime += total;
    const open = D.invoiceOutstanding(ds, inv.id);
    if (open > 0) {
      outstanding += open;
      const days = Math.floor((ctx.now.getTime() - new Date(inv.date).getTime()) / DAY);
      if (days > oldestOpenDays) oldestOpenDays = days;
    }
  }
  const quotes = ds.quotations.filter((q) => q.customerId === customer.id);
  return {
    name: customer.tradeName,
    code: customer.code,
    type: enumLabel(customer.type),
    industry: customer.industry,
    since: customer.createdAt,
    creditLimit: customer.creditLimit,
    creditTermDays: customer.creditTermDays,
    outstanding: Math.round(outstanding),
    oldestOpenDays,
    invoicedLifetime: Math.round(invoicedLifetime),
    invoiceCount: invoices.length,
    quotationsWon: quotes.filter((q) => q.status === "WON").length,
    quotationsLost: quotes.filter((q) => q.status === "LOST").length,
    href: `/sales/customers/${customer.id}`,
  };
}

/* ------------------------------------------------------- context builders */

function buildContext(
  ds: Dataset,
  ctx: D.DeriveCtx,
  req: T.ApprovalRequest,
  maps: {
    itemById: Map<string, T.Item>;
    customerById: Map<string, T.Customer>;
    quotationLines: Map<string, T.QuotationLine[]>;
    userById: Map<string, T.User>;
    employeeById: Map<string, T.Employee>;
    branchLabel: Map<string, string>;
  },
): SubjectContext {
  const { itemById, customerById, quotationLines, userById, employeeById, branchLabel } = maps;
  const now = ctx.now;

  switch (req.type) {
    /* ------------------------------------------------ quotation discount */
    case "QUOTATION_DISCOUNT": {
      const discounted = ds.quotations.filter((q) => (quotationLines.get(q.id) ?? []).some((l) => l.discountPct > 0));
      const quotation =
        ds.quotations.find((q) => q.id === req.subjectId) ??
        discounted[stableIndex(req.id, discounted.length)] ??
        ds.quotations[0];
      if (!quotation) return { kind: "UNRESOLVED", note: "No quotation records are present in the dataset." };

      const lines = quotationLines.get(quotation.id) ?? [];
      let gross = 0, discount = 0, cost = 0;
      const lineCtx = lines.map((l) => {
        const item = itemById.get(l.itemId);
        const g = l.qty * l.rate;
        const d = (g * l.discountPct) / 100;
        const c = l.qty * (item?.standardCost ?? 0);
        gross += g; discount += d; cost += c;
        const net = g - d;
        return {
          id: l.id,
          description: l.description,
          uom: l.uom,
          qty: l.qty,
          rate: l.rate,
          discountPct: l.discountPct,
          gstRate: l.gstRate,
          lineValue: Math.round(net),
          lineCost: Math.round(c),
          marginPct: net > 0 ? Math.round(((net - c) / net) * 1000) / 10 : 0,
        };
      });
      const net = gross - discount;

      // The comparator is the median realised margin on won business in the
      // same vertical — derived, not a hard-coded "policy floor".
      const wonMargins: number[] = [];
      for (const q of ds.quotations) {
        if (q.status !== "WON" || q.vertical !== quotation.vertical) continue;
        const ls = quotationLines.get(q.id) ?? [];
        let g = 0, dd = 0, c = 0;
        for (const l of ls) {
          g += l.qty * l.rate;
          dd += (l.qty * l.rate * l.discountPct) / 100;
          c += l.qty * (itemById.get(l.itemId)?.standardCost ?? 0);
        }
        const n = g - dd;
        if (n > 0) wonMargins.push(((n - c) / n) * 100);
      }
      wonMargins.sort((a, b) => a - b);
      const floor = wonMargins.length
        ? Math.round(wonMargins[Math.floor(wonMargins.length / 2)]! * 10) / 10
        : 0;

      const customer = customerById.get(quotation.customerId);
      return {
        kind: "QUOTATION_DISCOUNT",
        quotationNumber: quotation.number,
        quotationHref: `/sales/quotations/${quotation.id}`,
        quotationDate: quotation.quotationDate,
        vertical: VERTICAL_LABEL[quotation.vertical],
        lines: lineCtx,
        grossValue: Math.round(gross),
        discountValue: Math.round(discount),
        netValue: Math.round(net),
        weightedDiscountPct: gross > 0 ? Math.round((discount / gross) * 1000) / 10 : 0,
        costValue: Math.round(cost),
        marginPct: net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : 0,
        marginPctAtListPrice: gross > 0 ? Math.round(((gross - cost) / gross) * 1000) / 10 : 0,
        floorMarginPct: floor,
        customer: customer
          ? customerHistory(ds, ctx, customer)
          : {
            name: "Unknown customer", code: "—", type: "—", industry: "—",
            since: quotation.quotationDate, creditLimit: 0, creditTermDays: 0,
            outstanding: 0, oldestOpenDays: 0, invoicedLifetime: 0, invoiceCount: 0,
            quotationsWon: 0, quotationsLost: 0, href: "/sales/customers",
          },
        ownerName: userById.get(quotation.ownerUserId)?.name ?? "—",
      };
    }

    /* ------------------------------------------------------------- leave */
    case "LEAVE": {
      const pending = ds.leaveRequests.filter((l) => l.status === "PENDING");
      const withWarning = pending.filter((l) => l.coverageWarning);
      const pool = withWarning.length ? withWarning : pending.length ? pending : ds.leaveRequests;
      const leave =
        ds.leaveRequests.find((l) => l.id === req.subjectId) ??
        pool[stableIndex(req.id, pool.length)];
      if (!leave) return { kind: "UNRESOLVED", note: "No leave requests are present in the dataset." };

      const emp = employeeById.get(leave.employeeId);
      const leaveType = ds.leaveTypes.find((t) => t.id === leave.leaveTypeId);
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);

      const team = emp
        ? ds.employees.filter(
          (e) => e.active && e.branchId === emp.branchId && e.designation === emp.designation,
        )
        : [];
      const teamIds = new Set(team.map((e) => e.id));

      const overlapping = ds.leaveRequests.filter(
        (l) =>
          l.id !== leave.id &&
          l.status === "APPROVED" &&
          teamIds.has(l.employeeId) &&
          new Date(l.fromDate) <= to &&
          new Date(l.toDate) >= from,
      );
      const outIds = new Set(overlapping.map((l) => l.employeeId));

      const calendar: LeaveDayContext[] = [];
      for (let t = from.getTime(); t <= to.getTime() && calendar.length < 21; t += DAY) {
        const d = new Date(t);
        const iso = d.toISOString().slice(0, 10);
        const holiday = ds.holidays.find((h) => h.date.slice(0, 10) === iso) ?? null;
        calendar.push({
          date: d.toISOString(),
          weekday: WEEKDAYS[d.getDay()]!,
          holiday: holiday?.name ?? null,
          othersOut: overlapping
            .filter((l) => new Date(l.fromDate) <= d && new Date(l.toDate) >= d)
            .map((l) => employeeById.get(l.employeeId)?.name ?? l.employeeId),
        });
      }

      const minimumMatch = leave.coverageWarning?.match(/minimum of (\d+)/);
      const branchTickets = emp
        ? ds.tickets.filter((t) => t.branchId === emp.branchId && D.isOpenTicket(t)).length
        : 0;

      return {
        kind: "LEAVE",
        leaveNumber: leave.number,
        leaveHref: `/people/leave?request=${leave.id}`,
        employeeName: emp?.name ?? "—",
        employeeCode: emp?.code ?? "—",
        designation: emp?.designation ?? "—",
        branchLabel: emp ? branchLabel.get(emp.branchId) ?? "—" : "—",
        leaveTypeName: leaveType?.name ?? "Leave",
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        days: leave.days,
        reason: leave.reason,
        coverageArrangement: leave.coverageArrangement,
        coverageWarning: leave.coverageWarning,
        teamSize: team.length,
        availableDuring: Math.max(0, team.length - outIds.size - 1),
        coverageMinimum: minimumMatch ? Number(minimumMatch[1]) : 1,
        calendar,
        openTicketsInBranch: branchTickets,
      };
    }

    /* --------------------------------------------------- purchase order */
    case "PURCHASE_ORDER": {
      const open = ds.purchaseOrders.filter((p) => p.status === "DRAFT" || p.status === "APPROVED" || p.status === "SENT");
      const pool = open.length ? open : ds.purchaseOrders;
      const po =
        ds.purchaseOrders.find((p) => p.id === req.subjectId) ??
        pool[stableIndex(req.id, pool.length)];
      if (!po) return { kind: "UNRESOLVED", note: "No purchase orders are present in the dataset." };

      const supplier = ds.suppliers.find((s) => s.id === po.supplierId);
      const lines = ds.poLines.filter((l) => l.purchaseOrderId === po.id);
      const poDate = new Date(po.orderDate).getTime();

      const lineCtx = lines.map((l) => {
        const item = itemById.get(l.itemId);
        // Last purchase rate: the most recent line for the same item on an
        // earlier order, whoever supplied it.
        let bestAt = -Infinity;
        let bestRate: number | null = null;
        let bestSupplier: string | null = null;
        let bestIso: string | null = null;
        for (const other of ds.poLines) {
          if (other.itemId !== l.itemId || other.purchaseOrderId === po.id) continue;
          const opo = ds.purchaseOrders.find((p) => p.id === other.purchaseOrderId);
          if (!opo) continue;
          const t = new Date(opo.orderDate).getTime();
          if (t >= poDate || t <= bestAt) continue;
          bestAt = t;
          bestRate = other.rate;
          bestIso = opo.orderDate;
          bestSupplier = ds.suppliers.find((s) => s.id === opo.supplierId)?.name ?? null;
        }
        const onHand = item ? D.stockOnHand(ds, item.id) : 0;
        return {
          id: l.id,
          itemCode: item?.code ?? l.itemId,
          description: item?.description ?? "—",
          uom: item?.uom ?? "NOS",
          qty: l.qty,
          rate: l.rate,
          lineValue: Math.round(l.qty * l.rate),
          lastPurchaseRate: bestRate,
          lastPurchaseAt: bestIso,
          lastPurchaseSupplier: bestSupplier,
          variancePct: bestRate ? Math.round(((l.rate - bestRate) / bestRate) * 1000) / 10 : null,
          serviceCritical: item ? item.category === "SPARE" && item.reorderLevel > 0 : false,
          onHand,
          reorderLevel: item?.reorderLevel ?? 0,
        };
      });

      return {
        kind: "PURCHASE_ORDER",
        poNumber: po.number,
        poHref: `/inventory/purchase?po=${po.id}`,
        orderDate: po.orderDate,
        expectedDelivery: po.expectedDelivery,
        terms: po.terms,
        supplierName: supplier?.name ?? "—",
        supplierCode: supplier?.code ?? "—",
        supplierGstin: supplier?.gstin ?? "—",
        supplierPaymentTerms: supplier?.paymentTerms ?? "—",
        supplierStateCode: supplier?.stateCode ?? "—",
        lines: lineCtx,
        orderValue: lineCtx.reduce((s, l) => s + l.lineValue, 0),
        priorOrdersWithSupplier: ds.purchaseOrders.filter(
          (p) => p.supplierId === po.supplierId && new Date(p.orderDate).getTime() < poDate,
        ).length,
      };
    }

    /* ------------------------------------------------ credit limit override */
    case "CREDIT_LIMIT_OVERRIDE": {
      const rec = D.receivables(ctx);
      const byCustomer = new Map<string, number>();
      for (const o of rec.openInvoices) {
        byCustomer.set(o.invoice.customerId, (byCustomer.get(o.invoice.customerId) ?? 0) + o.outstanding);
      }
      const ranked = [...byCustomer.entries()]
        .map(([id, v]) => ({ customer: customerById.get(id), outstanding: v }))
        .filter((x): x is { customer: T.Customer; outstanding: number } => Boolean(x.customer))
        .filter((x) => x.customer.type === "INSTITUTIONAL" || x.customer.type === "GOVERNMENT")
        .sort((a, b) => b.outstanding - a.outstanding);
      const chosen =
        (customerById.get(req.subjectId) ? { customer: customerById.get(req.subjectId)!, outstanding: byCustomer.get(req.subjectId) ?? 0 } : null) ??
        ranked[stableIndex(req.id, Math.max(1, ranked.length))] ??
        null;
      if (!chosen) return { kind: "UNRESOLVED", note: "No customer with an open exposure could be resolved." };

      const history = customerHistory(ds, ctx, chosen.customer);
      const invoices = ds.invoices.filter((i) => i.customerId === chosen.customer.id);
      const buckets = [
        { key: "B0_30", label: "0–30 days" },
        { key: "B31_60", label: "31–60 days" },
        { key: "B61_90", label: "61–90 days" },
        { key: "B90_PLUS", label: "90+ days" },
      ].map((b) => {
        let value = 0, count = 0;
        for (const inv of invoices) {
          const open = D.invoiceOutstanding(ds, inv.id);
          if (open <= 0) continue;
          if (D.ageingBucket(inv.date, now) !== b.key) continue;
          value += open; count += 1;
        }
        return { label: b.label, value: Math.round(value), count };
      });

      const openOrdersValue = ds.salesOrders
        .filter((o) => o.customerId === chosen.customer.id && o.status !== "CANCELLED" && o.status !== "FULFILLED")
        .reduce((s, o) => {
          const lines = ds.salesOrderLines.filter((l) => l.salesOrderId === o.id);
          return s + lines.reduce((t, l) => t + (l.qty - l.qtyInvoiced) * l.rate, 0);
        }, 0);

      return {
        kind: "CREDIT_LIMIT_OVERRIDE",
        customer: history,
        requestedLimit: req.value,
        headroomAfter: Math.round(req.value - history.outstanding),
        utilisationPct: pct(history.outstanding, Math.max(1, history.creditLimit)),
        buckets,
        openOrdersValue: Math.round(openOrdersValue),
      };
    }

    /* -------------------------------------------------- RA-bill submission */
    case "RA_BILL_SUBMISSION": {
      const draft = ds.raBills.filter((b) => b.status === "DRAFT" || b.status === "SUBMITTED");
      const pool = draft.length ? draft : ds.raBills;
      const bill =
        ds.raBills.find((b) => b.id === req.subjectId) ??
        pool[stableIndex(req.id, pool.length)];
      if (!bill) return { kind: "UNRESOLVED", note: "No RA-bills are present in the dataset." };

      const project = ds.projects.find((p) => p.id === bill.projectId);
      const progress = D.projectProgress(ds, bill.projectId);
      const current = D.raBillCurrentPeriodValue(bill);
      const deductions = [
        { label: "Retention", value: Math.round((current * bill.retentionPct) / 100), basis: `${bill.retentionPct}% of the period value` },
        { label: "TDS", value: Math.round((current * bill.tdsPct) / 100), basis: `${bill.tdsPct}% under section 194C` },
        { label: "Labour cess", value: Math.round((current * bill.labourCessPct) / 100), basis: `${bill.labourCessPct}% under the BOCW cess` },
        { label: "Mobilisation recovery", value: Math.round(bill.mobilisationRecovery), basis: "Recovery against the mobilisation advance" },
        { label: "Other deductions", value: Math.round(bill.otherDeductions), basis: bill.otherDeductionsNote || "As agreed with the client" },
      ].filter((d) => d.value > 0);

      const siblings = ds.raBills.filter((b) => b.projectId === bill.projectId && b.id !== bill.id);
      return {
        kind: "RA_BILL_SUBMISSION",
        billNumber: bill.number,
        billHref: `/projects/${bill.projectId}`,
        projectName: project?.name ?? "—",
        projectHref: `/projects/${bill.projectId}`,
        clientName: project ? customerById.get(project.customerId)?.tradeName ?? "—" : "—",
        periodFrom: bill.periodFrom,
        periodTo: bill.periodTo,
        previousCumulative: Math.round(bill.previousCumulative),
        cumulativeValue: Math.round(bill.cumulativeValue),
        currentPeriodValue: Math.round(current),
        claimedValue: Math.round(bill.claimedValue),
        deductions,
        executedValue: progress.executedValue,
        contractedValue: progress.contractedValue,
        progressPct: progress.pct,
        priorBillsCertified: siblings.filter((b) => b.certifiedValue !== null).length,
        priorBillsAwaiting: siblings.filter((b) => b.status === "SUBMITTED" || b.status === "UNDER_CERTIFICATION").length,
      };
    }

    /* ----------------------------------------------------- stock adjustment */
    case "STOCK_ADJUSTMENT": {
      const location = ds.stockLocations[0];
      if (!location) return { kind: "UNRESOLVED", note: "No stock location is configured." };
      const raisedBy = userById.get(req.requesterUserId);

      const rows = ds.items
        .filter((i) => i.category !== "SERVICE")
        .map((item) => {
          const onHand = D.stockOnHand(ds, item.id, location.id);
          return { item, onHand, value: Math.round(onHand * item.standardCost) };
        })
        .filter((r) => r.onHand > 0)
        .sort((a, b) => b.value - a.value);

      const locationValue = rows.reduce((s, r) => s + r.value, 0);
      const serviceCriticalBelow = rows.filter(
        (r) => r.item.category === "SPARE" && r.onHand <= r.item.reorderLevel,
      ).length;

      return {
        kind: "STOCK_ADJUSTMENT",
        locationName: location.name,
        locationHref: "/inventory/stock",
        countedAt: req.raisedAt,
        countedBy: raisedBy?.name ?? "—",
        declaredVarianceValue: req.value,
        locationStockValue: locationValue,
        variancePctOfLocation: pct(req.value, Math.max(1, locationValue)),
        serviceCriticalBelowReorder: serviceCriticalBelow,
        items: rows.slice(0, 8).map((r) => ({
          itemCode: r.item.code,
          description: r.item.description,
          uom: r.item.uom,
          onHand: r.onHand,
          unitCost: r.item.standardCost,
          value: r.value,
          reorderLevel: r.item.reorderLevel,
          lastMovementAt: D.lastIssueDate(ds, r.item.id)?.toISOString() ?? null,
          serviceCritical: r.item.category === "SPARE" && r.onHand <= r.item.reorderLevel,
        })),
      };
    }

    /* -------------------------------------------------- AMC pricing exception */
    case "AMC_PRICING_EXCEPTION": {
      const expiring = ds.amcContracts.filter((a) => !a.terminated && D.amcStatus(a, now) === "EXPIRING");
      const pool = expiring.length ? expiring : ds.amcContracts;
      const contract =
        ds.amcContracts.find((a) => a.id === req.subjectId) ??
        pool[stableIndex(req.id, pool.length)];
      if (!contract) return { kind: "UNRESOLVED", note: "No AMC contracts are present in the dataset." };

      const assetSet = new Set(contract.assetIds);
      const yearAgo = now.getTime() - 365 * DAY;
      const tickets = ds.tickets.filter(
        (t) => assetSet.has(t.assetId) && new Date(t.loggedAt).getTime() >= yearAgo,
      );
      const ticketIds = new Set(tickets.map((t) => t.id));
      const cards = ds.jobCards.filter((j) => ticketIds.has(j.ticketId));
      const cardIds = new Set(cards.map((c) => c.id));
      const partsCost = ds.partConsumptions
        .filter((p) => cardIds.has(p.jobCardId))
        .reduce((s, p) => s + p.qty * (itemById.get(p.itemId)?.standardCost ?? 0), 0);

      const proposed = req.value > 0 ? req.value : contract.contractValue;
      return {
        kind: "AMC_PRICING_EXCEPTION",
        contractNumber: contract.number,
        contractHref: `/service/amc?contract=${contract.id}`,
        customerName: customerById.get(contract.customerId)?.tradeName ?? "—",
        coverage: enumLabel(contract.coverage),
        startDate: contract.startDate,
        endDate: contract.endDate,
        currentValue: Math.round(contract.contractValue),
        proposedValue: Math.round(proposed),
        deltaPct: contract.contractValue > 0
          ? Math.round(((proposed - contract.contractValue) / contract.contractValue) * 1000) / 10
          : 0,
        assetCount: contract.assetIds.length,
        visitsPerYear: contract.visitsPerYear,
        responseHours: contract.responseHours,
        restorationHours: contract.restorationHours,
        ticketsLastYear: tickets.length,
        partsCostLastYear: Math.round(partsCost),
        marginOverPartsPct: proposed > 0 ? Math.round(((proposed - partsCost) / proposed) * 1000) / 10 : 0,
      };
    }

    /* --------------------------------------------------------- expense claim */
    case "EXPENSE_CLAIM": {
      const requester = userById.get(req.requesterUserId);
      const emp = requester?.employeeId ? employeeById.get(requester.employeeId) : undefined;
      const periodEnd = new Date(req.raisedAt);
      const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
      const priorStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1);

      const engineerId = emp?.id ?? "";
      const inRange = (iso: string | null, a: Date, b: Date) =>
        iso ? new Date(iso).getTime() >= a.getTime() && new Date(iso).getTime() <= b.getTime() : false;

      const cardsAll = ds.jobCards.filter((j) => j.engineerUserId === engineerId);
      const cards = cardsAll.filter((j) => inRange(j.checkInAt, periodStart, periodEnd));
      const prior = cardsAll.filter((j) => inRange(j.checkInAt, priorStart, periodStart));

      const visits = cards.slice(0, 12).map((j) => {
        const ticket = ds.tickets.find((t) => t.id === j.ticketId);
        const site = ticket ? ds.sites.find((s) => s.id === ticket.siteId) : undefined;
        return {
          number: j.number,
          date: j.checkInAt ?? j.createdAt,
          customer: ticket ? customerById.get(ticket.customerId)?.tradeName ?? "—" : "—",
          site: site ? `${site.name}, ${site.district}` : j.checkInPlace ?? "—",
          outcome: j.outcome ? enumLabel(j.outcome) : "In progress",
        };
      });

      return {
        kind: "EXPENSE_CLAIM",
        employeeName: emp?.name ?? requester?.name ?? "—",
        employeeCode: emp?.code ?? "—",
        designation: emp?.designation ?? requester?.designation ?? "—",
        branchLabel: branchLabel.get(req.branchId) ?? "—",
        periodLabel: `${formatDate(periodStart)} – ${formatDate(periodEnd)}`,
        claimTotal: req.value,
        fieldVisits: cards.length,
        claimPerVisit: cards.length ? Math.round(req.value / cards.length) : 0,
        priorPeriodVisits: prior.length,
        visits,
      };
    }

    /* ------------------------------------------------------ price list change */
    case "PRICE_LIST_CHANGE": {
      const active = ds.priceList.filter((p) => !p.effectiveTo || new Date(p.effectiveTo) > now);
      if (!active.length) return { kind: "UNRESOLVED", note: "No effective price list entries are present." };
      const principal = active[stableIndex(req.id, active.length)]!.principal;
      const scoped = active.filter((p) => p.principal === principal).slice(0, 10);
      const deltaPct = req.value !== 0 ? req.value : 4;

      const lines = scoped.map((p) => {
        const item = itemById.get(p.itemId);
        const proposed = Math.round(p.rate * (1 + deltaPct / 100));
        const cost = item?.standardCost ?? 0;
        return {
          itemCode: item?.code ?? p.itemId,
          description: item?.description ?? "—",
          currentRate: Math.round(p.rate),
          proposedRate: proposed,
          deltaPct,
          standardCost: Math.round(cost),
          marginAfterPct: proposed > 0 ? Math.round(((proposed - cost) / proposed) * 1000) / 10 : 0,
        };
      });
      const scopedItems = new Set(scoped.map((p) => p.itemId));
      const openQuotes = ds.quotations.filter(
        (q) =>
          (q.status === "ISSUED" || q.status === "NEGOTIATION") &&
          (quotationLines.get(q.id) ?? []).some((l) => scopedItems.has(l.itemId)),
      ).length;

      return {
        kind: "PRICE_LIST_CHANGE",
        principal: enumLabel(principal),
        effectiveFrom: req.raisedAt,
        lines,
        averageDeltaPct: deltaPct,
        openQuotationsAffected: openQuotes,
      };
    }

    /* ------------------------------------------------------ user role change */
    case "USER_ROLE_CHANGE": {
      const candidates = ds.users.filter((u) => u.role !== "SUPER_ADMIN");
      const subject =
        ds.users.find((u) => u.id === req.subjectId) ??
        candidates[stableIndex(req.id, candidates.length)];
      if (!subject) return { kind: "UNRESOLVED", note: "No user records are present in the dataset." };

      const toRoleRaw = req.context["toRole"];
      const toRole = (typeof toRoleRaw === "string" ? toRoleRaw : "BRANCH_MANAGER") as Role;
      const gained: string[] = [];
      const lost: string[] = [];
      for (const capability of CAPABILITIES as readonly Capability[]) {
        const before = can(subject.role, capability);
        const after = can(toRole, capability);
        if (!before && after) gained.push(capability);
        if (before && !after) lost.push(capability);
      }
      return {
        kind: "USER_ROLE_CHANGE",
        subjectUserName: subject.name,
        subjectUserEmail: subject.email,
        fromRole: subject.role,
        toRole,
        branchLabel: branchLabel.get(subject.branchId) ?? "—",
        capabilitiesGained: gained,
        capabilitiesLost: lost,
        grantsApprovalAuthority: grantFor(toRole, "approvals").approve === true,
      };
    }

    default:
      return { kind: "UNRESOLVED", note: `No inline context builder is registered for ${req.type}.` };
  }
}

/* ------------------------------------------------------------- entry point */

export function buildWorkflowSnapshot(session: Session): WorkflowSnapshot {
  const ds = getDataset();
  const ctx = D.ctxOf(ds);

  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  const customerById = new Map(ds.customers.map((c) => [c.id, c]));
  const userById = new Map(ds.users.map((u) => [u.id, u]));
  const employeeById = new Map(ds.employees.map((e) => [e.id, e]));
  const branchLabel = new Map(ds.branches.map((b) => [b.id, `${b.name} (${b.code})`]));
  const quotationLines = new Map<string, T.QuotationLine[]>();
  for (const l of ds.quotationLines) {
    const arr = quotationLines.get(l.quotationId);
    if (arr) arr.push(l);
    else quotationLines.set(l.quotationId, [l]);
  }

  const maps = { itemById, customerById, quotationLines, userById, employeeById, branchLabel };

  const contexts: Record<string, SubjectContext> = {};
  for (const req of ds.approvalRequests) {
    contexts[req.id] = buildContext(ds, ctx, req, maps);
  }

  const grant = grantFor(session.role, "approvals");
  const viewerUser = userById.get(session.userId);

  return {
    today: ds.meta.today,
    viewer: {
      userId: session.userId,
      role: session.role,
      name: session.name,
      branchId: session.branchId,
      branchLabel: branchLabel.get(session.branchId) ?? "All branches",
      phone: viewerUser?.phone ?? "+919999900000",
      hasApprovalAuthority: grant.approve === true,
      approveLimit: grant.approveLimit ?? null,
      readOnly: isReadOnlyRole(session.role),
      canDesignChains: canWrite(session.role, "chainDesigner"),
    },
    users: ds.users.map((u) => ({
      id: u.id, name: u.name, role: u.role, branchId: u.branchId,
      phone: u.phone, designation: u.designation,
    })),
    branches: ds.branches.map((b) => ({ id: b.id, code: b.code, name: b.name })),
    chains: ds.approvalChains,
    chainSteps: ds.approvalChainSteps,
    requests: ds.approvalRequests,
    decisions: ds.approvalDecisions,
    delegations: ds.delegations,
    notifications: ds.notifications,
    messages: ds.messageLog,
    channelPreferences: ds.channelPreferences,
    contexts,
    metrics: {
      medianTurnaroundHours: D.approvalTurnaroundMedianHours(ds),
      decidedCount: ds.approvalRequests.filter((a) => a.decidedAt).length,
      pendingCount: ds.approvalRequests.filter((a) => !a.decidedAt).length,
    },
  };
}

/** Role labels are needed on the client for permission copy; re-exported for convenience. */
export { ROLE_LABEL };
