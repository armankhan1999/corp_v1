"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, Ban, Building2, CalendarDays, Check, CircleDot, ClipboardList, FileText,
  FileWarning, Handshake, PackageCheck, Pencil, Receipt, Ship, Truck, Wallet, X,
} from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import { VERTICAL_LABEL, VERTICAL_TOKEN } from "@/lib/schemas/enums";
import {
  abbreviateINR, formatCount, formatDate, formatINR, formatPercent, formatQty,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import * as D from "@/lib/derive";
import { EmptyState, Overline, Panel, PanelHeader, Skeleton, StatusBadge } from "@/components/patterns/primitives";
import { effectiveStatus, labelStatus, QUOTATION_TONE } from "./calc";
import {
  FULFILMENT_LABEL, LINE_STATE_LABEL, LINE_STATE_TONE, ORDER_STATUS_TONE, buildOrderView,
  type OrderLineView, type OrderView,
} from "./orders";
import { inScope, permissionsOf, useSalesSession, type SalesPermissions } from "./session";
import { recordDespatch, retryLoad, updateSalesOrder, useSalesStore, type SalesWorld } from "./store";
import {
  BlockedNotice, Btn, ErrorPanel, Field, LinkBtn, Meter, Modal, Notice, NumberInput, PageHeader,
  Select, TableFrame, Td, TextArea, TextInput, Th, Tr,
} from "./ui";

/**
 * E3-S7 — sales order detail.
 *
 * Everything the story asks the order to hold is captured here: the customer's
 * own PO reference and its date, the delivery schedule, the advance received,
 * and fulfilment at the line rather than at the order, so a despatch of part of
 * a line is an ordinary event rather than an exception. The source quotation is
 * linked both ways — the quotation shows the order number, the order shows the
 * quotation — so nothing was re-entered and the trail runs in both directions.
 */

const STATUS_LABEL: Record<T.SalesOrder["status"], string> = {
  OPEN: "Open",
  PARTIAL: "Part despatched",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export function OrderDetail({ orderId }: { orderId: string }) {
  const store = useSalesStore();
  const session = useSalesSession();

  if (store.status === "loading" || !session) return <OrderSkeleton />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  const w = store.world;
  const perms = permissionsOf(session);
  const order = w.salesOrders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <Panel className="p-2">
        <EmptyState
          icon={AlertTriangle}
          title="No such sales order"
          body={`Nothing in this dataset carries the id ${orderId}. An order exists only where a quotation was won.`}
          action={<LinkBtn href="/sales/orders" variant="primary">Back to the order register</LinkBtn>}
        />
      </Panel>
    );
  }

  if (!inScope(perms, "salesOrders", { branchId: order.branchId, ownerUserId: order.ownerUserId })) {
    return (
      <Panel className="p-2">
        <EmptyState
          icon={Ban}
          title="This order sits outside your scope"
          body={`${order.number} belongs to ${w.branchById.get(order.branchId)?.name ?? "another branch"} and is owned by ${w.userById.get(order.ownerUserId)?.name ?? "another executive"}. Your session returns only what you are accountable for.`}
          action={<LinkBtn href="/sales/orders" variant="primary">Back to the order register</LinkBtn>}
        />
      </Panel>
    );
  }

  const challans = w.ds.challans.filter((c) => c.sourceType === "SALES_ORDER" && c.sourceId === order.id);
  const view = buildOrderView(w, order, challans);
  return <Detail w={w} perms={perms} view={view} challans={challans} />;
}

/* ------------------------------------------------------------------ body */

function Detail({
  w, perms, view, challans,
}: {
  w: SalesWorld;
  perms: SalesPermissions;
  view: OrderView;
  challans: T.DeliveryChallan[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [despatchFor, setDespatchFor] = React.useState<OrderLineView | null>(null);
  const [blocked, setBlocked] = React.useState<{ reason: string; remedy?: string } | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const o = view.order;
  const canWrite = perms.canWrite("salesOrders");
  const quotation = view.quotation;
  const enquiry = quotation?.enquiryId ? w.enquiryById.get(quotation.enquiryId) : undefined;
  const invoices = perms.can("invoices") ? w.ds.invoices.filter((i) => i.salesOrderId === o.id) : [];
  const invoicedTotal = invoices.reduce((s, i) => s + D.invoiceTotal(w.ds, i.id), 0);
  const poMissing = !o.customerPoRef.trim();
  const cancelled = o.status === "CANCELLED";

  function despatch(line: OrderLineView, qty: number) {
    const res = recordDespatch(o.id, line.line.id, qty, perms.actor);
    if (!res.ok) {
      setFlash(null);
      setBlocked({ reason: res.reason ?? "The despatch was refused.", remedy: res.remedy });
      return false;
    }
    setBlocked(null);
    setFlash(
      `Despatched ${formatQty(qty, line.line.uom)} of ${line.line.description}. The line and the order status follow the quantity, not the other way round.`,
    );
    return true;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={o.number}
        lead={`${view.customer?.legalName ?? "Unknown customer"}${view.site ? ` — ${view.site.name}, ${view.site.district}` : ""}. Ordered ${formatDate(o.orderDate)}, ${view.ageDays} days ago, on ${view.branchName}'s book.`}
        meta={
          <>
            <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</StatusBadge>
            <StatusBadge tone={view.fulfilment === "COMPLETE" ? "ok" : view.fulfilment === "PARTIAL" ? "warn" : "neutral"}>
              {FULFILMENT_LABEL[view.fulfilment]}
            </StatusBadge>
            <StatusBadge tone="neutral" icon={false}>{VERTICAL_LABEL[o.vertical]}</StatusBadge>
            {quotation ? (
              <Link href={`/sales/quotations/${quotation.id}`} className="t-body-sm text-text-mid underline underline-offset-2">
                from quotation {quotation.number} v{quotation.version}
              </Link>
            ) : null}
            {poMissing ? <StatusBadge tone="warn">Customer PO not recorded</StatusBadge> : null}
          </>
        }
        right={
          <>
            <LinkBtn href="/sales/orders">All orders</LinkBtn>
            {quotation ? (
              <LinkBtn href={`/sales/quotations/${quotation.id}`}>
                <FileText className="size-3.5" aria-hidden /> Source quotation
              </LinkBtn>
            ) : null}
            {canWrite ? (
              <Btn variant="primary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" aria-hidden /> Capture order particulars
              </Btn>
            ) : null}
          </>
        }
      />

      {flash ? (
        <Notice tone="ok" icon={Check} title={flash}>
          <button type="button" className="underline underline-offset-2" onClick={() => setFlash(null)}>Dismiss</button>
        </Notice>
      ) : null}

      {blocked ? (
        <BlockedNotice
          reason={blocked.reason}
          remedy={blocked.remedy}
          action={<Btn size="sm" onClick={() => setBlocked(null)}><X className="size-3.5" aria-hidden /> Dismiss</Btn>}
        />
      ) : null}

      {cancelled ? (
        <BlockedNotice
          reason="This order is cancelled — no further despatch can be recorded against it"
          remedy="A cancelled order carries no order-book value. Raise a fresh order from a live quotation if the customer returns."
        />
      ) : null}

      {poMissing && !cancelled ? (
        <Notice tone="warn" icon={FileWarning} title="No customer purchase-order reference is recorded against this order">
          The customer&rsquo;s own PO number and its date are what an invoice is matched against at their end. Capture them
          before the first invoice leaves, or the payment will sit unallocated in their ledger.
        </Notice>
      ) : null}

      {/* -------------------------------------------- headline: order value */}
      <div className="panel-hero p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0">
            <Overline>Order value, before tax</Overline>
            <p className="t-display-lg mt-1 tabular-nums text-text-hi" title={formatINR(view.value)}>
              {abbreviateINR(view.value)}
            </p>
            <p className="t-body-sm mt-1 max-w-2xl text-text-mid">
              {formatCount(view.lines.length)} lines carried across from{" "}
              {quotation ? `${quotation.number} v${quotation.version}` : "the winning quotation"} with nothing re-entered.{" "}
              {view.inOrderBook
                ? `${abbreviateINR(view.orderBookValue)} of it remains uninvoiced and stands in the order book.`
                : "The order has left the order book — it is fulfilled or cancelled."}
            </p>
            <div className="mt-3">
              <Meter
                pct={view.deliveredPct}
                tone={view.fulfilment === "COMPLETE" ? "ok" : view.fulfilment === "PARTIAL" ? "warn" : "info"}
              />
              <p className="t-body-sm mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-text-lo">
                <span className="flex items-center gap-1">
                  <Truck className="size-3.5 shrink-0" aria-hidden />
                  {formatPercent(view.deliveredPct, 0)} despatched
                </span>
                <span className="flex items-center gap-1">
                  <Receipt className="size-3.5 shrink-0" aria-hidden />
                  {formatPercent(view.invoicedPct, 0)} invoiced
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="size-3.5 shrink-0" aria-hidden />
                  {formatPercent(view.advancePct, 0)} taken as advance
                </span>
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <Figure label="In order book" value={view.inOrderBook ? abbreviateINR(view.orderBookValue) : "Nil"} note={view.inOrderBook ? "Ordered less invoiced, at line rate" : "Out of the book"} />
            <Figure label="Still to despatch" value={abbreviateINR(view.unfulfilledValue)} note="Ordered quantity not yet gone out" tone={view.unfulfilledValue > 0 ? "warn" : "ok"} />
            <Figure label="Advance received" value={view.order.advanceReceived > 0 ? abbreviateINR(view.order.advanceReceived) : "Nil"} note={view.order.advanceReceived > 0 ? `${formatPercent(view.advancePct, 0)} of order value` : "Nothing taken up front"} />
            <Figure label="Invoiced to date" value={abbreviateINR(view.invoicedValue)} note={`${formatCount(invoices.length)} tax invoices raised`} />
          </dl>
        </div>
      </div>

      {/* ------------------------------------------ commercial particulars */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Order particulars"
            sub="The customer's own reference, the schedule they were promised and the money taken up front."
            right={canWrite ? <Btn size="sm" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" aria-hidden /> Edit</Btn> : <Overline>Read-only session</Overline>}
          />
          <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
            <Cell label="Customer PO reference" icon={ClipboardList}>
              {o.customerPoRef.trim() ? (
                <span className="t-mono text-text-hi">{o.customerPoRef}</span>
              ) : (
                <span className="flex items-center gap-1 text-warn">
                  <FileWarning className="size-3.5 shrink-0" aria-hidden /> Not recorded
                </span>
              )}
            </Cell>
            <Cell label="Customer PO date" icon={CalendarDays}>
              {o.customerPoRef.trim() ? formatDate(o.customerPoDate) : <span className="text-text-lo">Awaiting the PO</span>}
            </Cell>
            <Cell label="Delivery schedule" icon={Ship} wide>
              {o.deliverySchedule || <span className="text-text-lo">No schedule recorded</span>}
            </Cell>
            <Cell label="Advance received" icon={Wallet}>
              <span className="tabular-nums text-text-hi">{formatINR(o.advanceReceived)}</span>
              {o.advanceReceived > 0 ? (
                <span className="t-body-sm block text-text-lo">{formatPercent(view.advancePct, 0)} of order value</span>
              ) : null}
            </Cell>
            <Cell label="Order date" icon={CalendarDays}>{formatDate(o.orderDate)}</Cell>
            <Cell label="Accountable executive" icon={Handshake}>{view.owner?.name ?? "—"}</Cell>
            <Cell label="Branch" icon={Building2}>{view.branchName}</Cell>
            <Cell label="Delivery site" icon={Ship}>
              {view.site ? `${view.site.name}, ${view.site.district}` : <span className="text-text-lo">Billed to the customer address</span>}
            </Cell>
          </dl>
        </Panel>

        {/* --------------------------------------------- source quotation */}
        <Panel
          style={{ ["--accent" as string]: VERTICAL_TOKEN[o.vertical] }}
          className="accent-rail"
        >
          <PanelHeader title="Where this order came from" sub="Linked both ways — the quotation carries this order number as a working link." />
          {quotation ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/sales/quotations/${quotation.id}`} className="t-mono t-body text-text-hi underline underline-offset-2">
                  {quotation.number} v{quotation.version}
                </Link>
                <StatusBadge tone={QUOTATION_TONE[effectiveStatus(quotation, w.now)]}>
                  {labelStatus(effectiveStatus(quotation, w.now))}
                </StatusBadge>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="t-overline text-text-lo">Quoted on</dt>
                  <dd className="t-body-sm text-text-mid">{formatDate(quotation.quotationDate)}</dd>
                </div>
                <div>
                  <dt className="t-overline text-text-lo">Version history</dt>
                  <dd className="t-body-sm text-text-mid">
                    {formatCount((w.quotationsByRoot.get(quotation.rootId) ?? []).length)} versions on the file
                  </dd>
                </div>
                <div>
                  <dt className="t-overline text-text-lo">Payment terms</dt>
                  <dd className="t-body-sm text-text-mid">{quotation.paymentTerms}</dd>
                </div>
                <div>
                  <dt className="t-overline text-text-lo">Warranty</dt>
                  <dd className="t-body-sm text-text-mid">{quotation.warrantyTerms}</dd>
                </div>
              </dl>
              {enquiry ? (
                <p className="t-body-sm text-text-lo">
                  Traced back to enquiry <span className="t-mono">{enquiry.number}</span>, captured{" "}
                  {formatDate(enquiry.createdAt)} from {enquiry.source.replace(/_/g, " ").toLowerCase()}.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <LinkBtn href={`/sales/quotations/${quotation.id}`} size="sm">Open the quotation</LinkBtn>
                <LinkBtn href={`/sales/customers/${o.customerId}`} size="sm">Customer 360</LinkBtn>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="The source quotation is not in this dataset"
              body="Every order in Pravaah is raised from a won quotation. This one carries a quotation id that no longer resolves, which is itself worth investigating."
            />
          )}
        </Panel>
      </div>

      {/* -------------------------------------------- line-level fulfilment */}
      <Panel>
        <PanelHeader
          title="Line-level fulfilment"
          sub="Fulfilment is tracked per line, so part of a line can go out today and the balance next month without either being fiction."
          right={<Overline>{formatCount(view.lines.length)} lines</Overline>}
        />
        {view.lines.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="This order carries no lines"
            body="An order created from a quotation copies every line across. An order with none means the quotation itself was empty when it was won."
          />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Description</Th>
                <Th>HSN/SAC</Th>
                <Th right>Ordered</Th>
                <Th right>Rate</Th>
                <Th right>Line value</Th>
                <Th>Despatched</Th>
                <Th right>Invoiced</Th>
                <Th right>Still owed</Th>
                <Th>Line state</Th>
                {canWrite ? <Th>Despatch</Th> : null}
              </tr>
            </thead>
            <tbody>
              {view.lines.map((l, i) => (
                <Tr key={l.line.id}>
                  <Td right className="text-text-lo">{i + 1}</Td>
                  <Td className="max-w-72 text-text-hi">
                    <span className="block truncate" title={l.line.description}>{l.line.description}</span>
                    <span className="t-mono block text-[0.75rem] text-text-lo">{l.line.itemId}</span>
                  </Td>
                  <Td mono>{l.line.hsnSac}</Td>
                  <Td right>{formatQty(l.line.qty, l.line.uom)}</Td>
                  <Td right title={formatINR(l.line.rate)}>{formatINR(l.line.rate)}</Td>
                  <Td right className="text-text-hi" title={formatINR(l.value)}>{abbreviateINR(l.value)}</Td>
                  <Td>
                    <span className="flex w-36 flex-col gap-1">
                      <span className="tabular-nums whitespace-nowrap">
                        {formatQty(l.deliveredQty)} / {formatQty(l.line.qty, l.line.uom)}
                      </span>
                      <Meter pct={l.deliveredPct} tone={l.deliveredPct >= 100 ? "ok" : l.deliveredPct > 0 ? "warn" : "info"} />
                    </span>
                  </Td>
                  <Td right>{formatQty(l.invoicedQty)}</Td>
                  <Td right className={l.remainingQty > 0 ? "text-warn" : "text-text-lo"} title={formatINR(l.unfulfilledValue)}>
                    {l.remainingQty > 0 ? formatQty(l.remainingQty, l.line.uom) : "Nil"}
                  </Td>
                  <Td>
                    <StatusBadge tone={LINE_STATE_TONE[l.state]}>{LINE_STATE_LABEL[l.state]}</StatusBadge>
                  </Td>
                  {canWrite ? (
                    <Td>
                      {cancelled ? (
                        <span className="t-body-sm flex items-center gap-1 text-text-lo">
                          <Ban className="size-3.5 shrink-0" aria-hidden /> Order cancelled
                        </span>
                      ) : l.remainingQty <= 0 ? (
                        <span className="t-body-sm flex items-center gap-1 text-ok">
                          <PackageCheck className="size-3.5 shrink-0" aria-hidden /> Complete
                        </span>
                      ) : (
                        <Btn
                          size="sm"
                          onClick={() => { setBlocked(null); setDespatchFor(l); }}
                          aria-label={`Record a despatch against line ${i + 1}, ${l.line.description}`}
                        >
                          <Truck className="size-3.5" aria-hidden /> Despatch
                        </Btn>
                      )}
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <Td colSpan={5} className="text-text-mid">Order total, before tax</Td>
                <Td right className="text-text-hi">{formatINR(view.value)}</Td>
                <Td>{formatPercent(view.deliveredPct, 0)} despatched</Td>
                <Td right>{formatPercent(view.invoicedPct, 0)}</Td>
                <Td right className="text-warn" title={formatINR(view.unfulfilledValue)}>{abbreviateINR(view.unfulfilledValue)}</Td>
                <Td colSpan={canWrite ? 2 : 1} className="text-text-lo">
                  {view.inOrderBook ? `${abbreviateINR(view.orderBookValue)} in the order book` : "Out of the order book"}
                </Td>
              </tr>
            </tfoot>
          </TableFrame>
        )}
      </Panel>

      {/* --------------------------------------------- despatch + invoices */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Despatches against this order"
            sub="Delivery challans raised for this order, each carrying its own e-way particulars."
            right={<Overline>{formatCount(challans.length)} challans</Overline>}
          />
          {challans.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Nothing has been despatched yet"
              body="No delivery challan has been raised against this order. Record a despatch on a line above and the movement becomes visible here and in the commercial module."
              action={<LinkBtn href="/commercial/challans" variant="primary">Open the challan register</LinkBtn>}
            />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>Challan</Th><Th>Date</Th><Th>Reason</Th><Th right>Lines</Th><Th right>Quantity</Th><Th>Vehicle</Th>
                </tr>
              </thead>
              <tbody>
                {challans
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 12)
                  .map((c) => (
                    <Tr key={c.id}>
                      <Td mono>
                        <Link href={`/commercial/challans/${c.id}`} className="text-text-hi hover:underline">{c.number}</Link>
                      </Td>
                      <Td>{formatDate(c.date)}</Td>
                      <Td className="max-w-48 truncate">{c.reasonForTransportation}</Td>
                      <Td right>{formatCount(c.lines.length)}</Td>
                      <Td right>{formatQty(c.lines.reduce((s, l) => s + l.qty, 0))}</Td>
                      <Td mono>{c.vehicleNumber}</Td>
                    </Tr>
                  ))}
              </tbody>
            </TableFrame>
          )}
          {challans.length > 12 ? (
            <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
              Showing the 12 most recent of {formatCount(challans.length)}.{" "}
              <Link href="/commercial/challans" className="underline underline-offset-2">Open the full challan register</Link>.
            </p>
          ) : null}
        </Panel>

        <Panel>
          <PanelHeader
            title="Invoices raised against this order"
            sub="What has been billed reduces the order book; what has been despatched does not."
            right={<Overline>{perms.can("invoices") ? `${formatCount(invoices.length)} invoices` : "Not visible to your role"}</Overline>}
          />
          {!perms.can("invoices") ? (
            <EmptyState
              icon={Receipt}
              title="Invoices are omitted for your role"
              body="Your session holds no invoice permission, so the billing section is left out entirely rather than shown as an empty panel you cannot fill."
            />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nothing has been invoiced yet"
              body="The whole order value still stands in the order book. Billing happens in the commercial module once goods have moved."
              action={<LinkBtn href="/commercial/invoices" variant="primary">Open the invoice register</LinkBtn>}
            />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>Invoice</Th><Th>Date</Th><Th right>Total</Th><Th right>Outstanding</Th><Th>e-Invoice</Th>
                </tr>
              </thead>
              <tbody>
                {invoices
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((inv) => {
                    const out = D.invoiceOutstanding(w.ds, inv.id);
                    return (
                      <Tr key={inv.id}>
                        <Td mono>
                          <Link href={`/commercial/invoices/${inv.id}`} className="text-text-hi hover:underline">{inv.number}</Link>
                        </Td>
                        <Td>{formatDate(inv.date)}</Td>
                        <Td right className="text-text-hi">{formatINR(D.invoiceTotal(w.ds, inv.id))}</Td>
                        <Td right className={out > 0 ? "text-warn" : "text-ok"}>{out > 0 ? formatINR(out) : "Settled"}</Td>
                        <Td>
                          {inv.irn ? (
                            <StatusBadge tone="ok">IRN registered</StatusBadge>
                          ) : inv.eInvoiceApplicable ? (
                            <StatusBadge tone="warn">Awaiting IRN</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Not applicable</StatusBadge>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr>
                  <Td colSpan={2} className="text-text-mid">Billed against this order</Td>
                  <Td right className="text-text-hi">{formatINR(invoicedTotal)}</Td>
                  <Td colSpan={2} className="text-text-lo">
                    {view.inOrderBook ? `${abbreviateINR(view.orderBookValue)} still in the order book` : "Order fully out of the book"}
                  </Td>
                </tr>
              </tfoot>
            </TableFrame>
          )}
        </Panel>
      </div>

      <ParticularsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        view={view}
        onSave={(delta) => {
          updateSalesOrder(o.id, delta, perms.actor);
          setEditOpen(false);
          setBlocked(null);
          setFlash("Order particulars recorded. The customer PO reference, its date, the schedule and the advance are now on the order.");
        }}
      />

      <DespatchDialog
        line={despatchFor}
        onOpenChange={(v) => { if (!v) setDespatchFor(null); }}
        onConfirm={(line, qty) => {
          if (despatch(line, qty)) setDespatchFor(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- bits */

function Figure({
  label, value, note, tone,
}: { label: string; value: string; note: string; tone?: "ok" | "warn" | "danger" }) {
  const toneClass = tone ? { ok: "text-ok", warn: "text-warn", danger: "text-danger" }[tone] : "text-text-hi";
  return (
    <div className="rounded-md border border-line bg-surface-1/70 p-3">
      <dt className="t-overline text-text-lo">{label}</dt>
      <dd>
        <span className={cn("t-heading-md block tabular-nums", toneClass)}>{value}</span>
        <span className="t-body-sm block text-text-lo">{note}</span>
      </dd>
    </div>
  );
}

function Cell({
  label, icon: Icon, children, wide,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("bg-surface-1 px-4 py-3", wide && "sm:col-span-2")}>
      <dt className="t-overline flex items-center gap-1.5 text-text-lo">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="t-body mt-1 text-text-mid">{children}</dd>
    </div>
  );
}

/* -------------------------------------------------- capture particulars */

function ParticularsDialog({
  open, onOpenChange, view, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  view: OrderView;
  onSave: (delta: Partial<T.SalesOrder>) => void;
}) {
  const o = view.order;
  const [poRef, setPoRef] = React.useState(o.customerPoRef);
  const [poDate, setPoDate] = React.useState(o.customerPoDate.slice(0, 10));
  const [schedule, setSchedule] = React.useState(o.deliverySchedule);
  const [advance, setAdvance] = React.useState(String(o.advanceReceived));
  const [status, setStatus] = React.useState<T.SalesOrder["status"]>(o.status);
  const [err, setErr] = React.useState<Record<string, string | null>>({});
  const [refusal, setRefusal] = React.useState<{ reason: string; remedy: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPoRef(o.customerPoRef);
    setPoDate(o.customerPoDate.slice(0, 10));
    setSchedule(o.deliverySchedule);
    setAdvance(String(o.advanceReceived));
    setStatus(o.status);
    setErr({});
    setRefusal(null);
  }, [open, o]);

  const orderDay = o.orderDate.slice(0, 10);

  function save() {
    const next: Record<string, string | null> = {};
    const amount = Number(advance);

    if (!poRef.trim()) next.poRef = "The customer's own PO number is what their accounts team matches an invoice against. Enter it, or leave the order as awaiting the PO.";
    if (!poDate) next.poDate = "A PO reference without a date cannot be matched to a period.";
    else if (poDate > orderDay) next.poDate = `A purchase order cannot be dated after the order it produced — this order was raised ${formatDate(o.orderDate)}.`;
    if (!schedule.trim()) next.schedule = "State what the customer was promised. A blank schedule is a dispute waiting to happen.";
    if (!Number.isFinite(amount) || amount < 0) next.advance = "An advance is zero or a positive amount.";

    setErr(next);
    if (Object.values(next).some(Boolean)) return;

    // E14-S2 — a blocked action states the rule and what would unblock it.
    if (amount > view.value) {
      setRefusal({
        reason: `An advance of ${formatINR(amount)} exceeds the order value of ${formatINR(view.value)}.`,
        remedy: "Record the excess as an on-account receipt in the commercial module instead, or raise a variation that increases the order value first.",
      });
      return;
    }

    setRefusal(null);
    onSave({
      customerPoRef: poRef.trim(),
      customerPoDate: new Date(`${poDate}T10:00:00`).toISOString(),
      deliverySchedule: schedule.trim(),
      advanceReceived: Math.round(amount),
      status,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Capture order particulars"
      description={`${o.number} — ${view.customer?.legalName ?? "Unknown customer"}. Order value ${formatINR(view.value)}.`}
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save}><Check className="size-3.5" aria-hidden /> Save particulars</Btn>
        </>
      }
    >
      {refusal ? <BlockedNotice className="mb-3" reason={refusal.reason} remedy={refusal.remedy} /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Customer PO reference" required error={err.poRef} hint="Exactly as the customer wrote it — this is the string their ledger keys on.">
          {(p) => <TextInput {...p} value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="PO/2026/00184" />}
        </Field>
        <Field label="Customer PO date" required error={err.poDate} hint={`On or before ${formatDate(o.orderDate)}.`}>
          {(p) => <TextInput {...p} type="date" max={orderDay} value={poDate} onChange={(e) => setPoDate(e.target.value)} />}
        </Field>
        <Field label="Delivery schedule" required error={err.schedule} className="sm:col-span-2" hint="What was promised, in the customer's terms — dates, phases, site readiness conditions.">
          {(p) => (
            <TextArea
              {...p}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Phase 1 — two units within 4 weeks of PO; balance on site readiness confirmation."
            />
          )}
        </Field>
        <Field label="Advance received" required error={err.advance} hint={`Rupees, before tax. Order value is ${formatINR(view.value)}.`}>
          {(p) => <NumberInput {...p} min={0} step={1000} value={advance} onChange={(e) => setAdvance(e.target.value)} />}
        </Field>
        <Field label="Order status" hint="Despatch drives this automatically; set it by hand only to cancel or to reopen.">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as T.SalesOrder["status"])}>
              <option value="OPEN">Open</option>
              <option value="PARTIAL">Part despatched</option>
              <option value="FULFILLED">Fulfilled</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          )}
        </Field>
      </div>
      <p className="t-body-sm mt-3 flex items-start gap-1.5 text-text-lo">
        <CircleDot className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        A fulfilled or cancelled order leaves the order book immediately, so the figure on the register moves the moment
        this is saved. Every change is written to the audit trail with your name against it.
      </p>
    </Modal>
  );
}

/* -------------------------------------------------------- record despatch */

function DespatchDialog({
  line, onOpenChange, onConfirm,
}: {
  line: OrderLineView | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (line: OrderLineView, qty: number) => void;
}) {
  const [qty, setQty] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!line) return;
    setQty(String(line.remainingQty));
    setErr(null);
  }, [line]);

  const remaining = line?.remainingQty ?? 0;

  return (
    <Modal
      open={!!line}
      onOpenChange={onOpenChange}
      title="Record a despatch"
      description={line ? `${line.line.description} — ${formatQty(line.line.qty, line.line.uom)} ordered, ${formatQty(line.deliveredQty)} already gone.` : undefined}
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (!line) return;
              const n = Number(qty);
              if (!Number.isFinite(n) || n <= 0) {
                setErr("A despatch is for a positive quantity — a zero despatch is not an event.");
                return;
              }
              if (n > remaining) {
                setErr(`Only ${formatQty(remaining, line.line.uom)} remain undespatched on this line. Despatch that or less, or raise a variation on the order.`);
                return;
              }
              onConfirm(line, n);
            }}
          >
            <Truck className="size-3.5" aria-hidden /> Record despatch
          </Btn>
        </>
      }
    >
      {line ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`Quantity despatched (${line.line.uom})`} required error={err} hint={`Up to ${formatQty(remaining, line.line.uom)} remain on this line.`}>
              {(p) => (
                <NumberInput
                  {...p}
                  min={0}
                  max={remaining}
                  step="any"
                  value={qty}
                  onChange={(e) => { setQty(e.target.value); if (err) setErr(null); }}
                />
              )}
            </Field>
            <div className="flex flex-col justify-end gap-1">
              <Overline>Partial despatch is normal</Overline>
              <p className="t-body-sm text-text-mid">
                Send what is ready. The line keeps the balance, the order moves to part despatched, and the remainder
                stays in the order book until it is invoiced.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
            <div className="bg-surface-1 px-3 py-2">
              <dt className="t-overline text-text-lo">Ordered</dt>
              <dd className="t-body tabular-nums text-text-hi">{formatQty(line.line.qty, line.line.uom)}</dd>
            </div>
            <div className="bg-surface-1 px-3 py-2">
              <dt className="t-overline text-text-lo">Already despatched</dt>
              <dd className="t-body tabular-nums text-text-hi">{formatQty(line.deliveredQty)}</dd>
            </div>
            <div className="bg-surface-1 px-3 py-2">
              <dt className="t-overline text-text-lo">Invoiced</dt>
              <dd className="t-body tabular-nums text-text-hi">{formatQty(line.invoicedQty)}</dd>
            </div>
            <div className="bg-surface-1 px-3 py-2">
              <dt className="t-overline text-text-lo">Value still owed</dt>
              <dd className="t-body tabular-nums text-text-hi">{abbreviateINR(line.unfulfilledValue)}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </Modal>
  );
}

/* --------------------------------------------------------------- skeleton */

/** Matches the final geometry: header, hero figure, particulars, line table. */
function OrderSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-2.5 w-[30rem] max-w-full" />
      </div>
      <div className="panel-hero p-5">
        <Skeleton className="h-2 w-40" />
        <Skeleton className="mt-3 h-9 w-44" />
        <Skeleton className="mt-3 h-2 w-[26rem] max-w-full" />
        <Skeleton className="mt-4 h-1.5 w-full" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <div className="border-b border-line px-4 py-3"><Skeleton className="h-3 w-40" /></div>
          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="bg-surface-1 px-4 py-3">
                <Skeleton className="h-2 w-28" />
                <Skeleton className="mt-2 h-2.5 w-36" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="border-b border-line px-4 py-3"><Skeleton className="h-3 w-44" /></div>
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2 w-56" />
            <Skeleton className="h-2 w-48" />
            <Skeleton className="h-8 w-40" />
          </div>
        </Panel>
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="mt-2 h-2 w-96 max-w-full" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3" style={{ height: "var(--row-h, 36px)" }}>
            <Skeleton className="h-2.5 w-6" />
            <Skeleton className="h-2.5 w-52" />
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="ml-auto h-2.5 w-16" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
      </Panel>
    </div>
  );
}
