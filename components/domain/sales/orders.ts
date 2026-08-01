import type * as T from "@/lib/schemas/entities";
import { daysBetween } from "@/lib/format";
import { groupBy } from "./calc";
import type { SalesWorld } from "./store";

/**
 * E3-S7 — sales order derivations.
 *
 * The order-book figure here is deliberately the same arithmetic as
 * `lib/derive.orderBookValue`, which the seed reconciliation validator asserts
 * at ₹2.38 Cr: for every order that is neither fulfilled nor cancelled, the sum
 * over its lines of (ordered quantity − invoiced quantity) × rate. If this
 * screen ever disagreed with that validator, one of the two would be lying.
 */

export type LineState = "PENDING" | "PART_DESPATCHED" | "DESPATCHED" | "INVOICED";

export const LINE_STATE_LABEL: Record<LineState, string> = {
  PENDING: "Not despatched",
  PART_DESPATCHED: "Part despatched",
  DESPATCHED: "Despatched in full",
  INVOICED: "Invoiced",
};

export const LINE_STATE_TONE: Record<LineState, "neutral" | "warn" | "info" | "ok"> = {
  PENDING: "neutral",
  PART_DESPATCHED: "warn",
  DESPATCHED: "info",
  INVOICED: "ok",
};

export interface OrderLineView {
  line: T.SalesOrderLine;
  value: number;
  deliveredQty: number;
  invoicedQty: number;
  remainingQty: number;
  uninvoicedQty: number;
  deliveredPct: number;
  invoicedPct: number;
  unfulfilledValue: number;
  uninvoicedValue: number;
  state: LineState;
}

export type Fulfilment = "NOT_STARTED" | "PARTIAL" | "COMPLETE";

export const FULFILMENT_LABEL: Record<Fulfilment, string> = {
  NOT_STARTED: "Nothing despatched",
  PARTIAL: "Partly despatched",
  COMPLETE: "Despatched in full",
};

export interface OrderView {
  order: T.SalesOrder;
  lines: OrderLineView[];
  customer: T.Customer | undefined;
  site: T.Site | undefined;
  owner: T.User | undefined;
  branchName: string;
  quotation: T.Quotation | undefined;
  value: number;
  deliveredValue: number;
  invoicedValue: number;
  unfulfilledValue: number;
  uninvoicedValue: number;
  deliveredPct: number;
  invoicedPct: number;
  fulfilment: Fulfilment;
  /** Counted in the order book only while the order is neither fulfilled nor cancelled. */
  inOrderBook: boolean;
  orderBookValue: number;
  advancePct: number;
  ageDays: number;
  challanCount: number;
}

export function lineView(line: T.SalesOrderLine): OrderLineView {
  const value = line.qty * line.rate;
  const deliveredQty = line.qtyDelivered;
  const invoicedQty = line.qtyInvoiced;
  const remainingQty = Math.max(0, line.qty - deliveredQty);
  const uninvoicedQty = Math.max(0, line.qty - invoicedQty);
  const state: LineState =
    invoicedQty >= line.qty ? "INVOICED"
      : deliveredQty >= line.qty ? "DESPATCHED"
        : deliveredQty > 0 ? "PART_DESPATCHED"
          : "PENDING";
  return {
    line,
    value,
    deliveredQty,
    invoicedQty,
    remainingQty,
    uninvoicedQty,
    deliveredPct: line.qty > 0 ? Math.round((deliveredQty / line.qty) * 100) : 0,
    invoicedPct: line.qty > 0 ? Math.round((invoicedQty / line.qty) * 100) : 0,
    unfulfilledValue: remainingQty * line.rate,
    uninvoicedValue: uninvoicedQty * line.rate,
    state,
  };
}

export function challansByOrder(w: SalesWorld): Map<string, T.DeliveryChallan[]> {
  return groupBy(
    w.ds.challans.filter((c) => c.sourceType === "SALES_ORDER"),
    (c) => c.sourceId,
  );
}

export function buildOrderView(
  w: SalesWorld,
  order: T.SalesOrder,
  challans: readonly T.DeliveryChallan[],
): OrderView {
  const lines = (w.orderLinesByOrder.get(order.id) ?? []).map(lineView);
  const value = lines.reduce((s, l) => s + l.value, 0);
  const deliveredValue = lines.reduce((s, l) => s + l.deliveredQty * l.line.rate, 0);
  const invoicedValue = lines.reduce((s, l) => s + l.invoicedQty * l.line.rate, 0);
  const unfulfilledValue = lines.reduce((s, l) => s + l.unfulfilledValue, 0);
  const uninvoicedValue = lines.reduce((s, l) => s + l.uninvoicedValue, 0);
  const inOrderBook = order.status !== "FULFILLED" && order.status !== "CANCELLED";

  const anyDelivered = lines.some((l) => l.deliveredQty > 0);
  const allDelivered = lines.length > 0 && lines.every((l) => l.deliveredQty >= l.line.qty);
  const fulfilment: Fulfilment = allDelivered ? "COMPLETE" : anyDelivered ? "PARTIAL" : "NOT_STARTED";

  return {
    order,
    lines,
    customer: w.customerById.get(order.customerId),
    site: order.siteId ? w.siteById.get(order.siteId) : undefined,
    owner: w.userById.get(order.ownerUserId),
    branchName: w.branchById.get(order.branchId)?.name ?? order.branchId,
    quotation: w.quotationById.get(order.quotationId),
    value,
    deliveredValue,
    invoicedValue,
    unfulfilledValue,
    uninvoicedValue,
    deliveredPct: value > 0 ? Math.round((deliveredValue / value) * 100) : 0,
    invoicedPct: value > 0 ? Math.round((invoicedValue / value) * 100) : 0,
    fulfilment,
    inOrderBook,
    orderBookValue: inOrderBook ? uninvoicedValue : 0,
    advancePct: value > 0 ? Math.round((order.advanceReceived / value) * 100) : 0,
    ageDays: Math.max(0, daysBetween(order.orderDate, w.now)),
    challanCount: challans.length,
  };
}

export function buildOrderViews(w: SalesWorld): OrderView[] {
  const challans = challansByOrder(w);
  return w.salesOrders
    .map((o) => buildOrderView(w, o, challans.get(o.id) ?? []))
    .sort((a, b) => b.order.orderDate.localeCompare(a.order.orderDate));
}

export const ORDER_STATUS_TONE: Record<T.SalesOrder["status"], "ok" | "warn" | "danger" | "info" | "neutral"> = {
  OPEN: "info",
  PARTIAL: "warn",
  FULFILLED: "ok",
  CANCELLED: "danger",
};
