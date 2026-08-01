"use client";

/**
 * E7-S4 — purchase orders, goods receipts and the supplier master.
 *
 * The door is the control point. An order above the configured threshold cannot
 * be marked Sent until it has been approved, and a receipt is checked against
 * what was ordered before it is allowed to touch a balance: short supply leaves
 * the order Partially received with the balance visible, excess supply is
 * refused until somebody acknowledges an override in writing.
 *
 * Every receipt writes RECEIPT movements referencing the purchase order through
 * the same append-only `appendMovements` path the rest of E7 uses, so an
 * inbound quantity is as traceable as an outbound one, and every status change
 * is written to the audit trail with actor and timestamp.
 */

import * as React from "react";
import Link from "next/link";
import {
  Building2, CalendarClock, CheckCheck, ClipboardCheck, FileStack, Info, Lock, PackageCheck,
  PackagePlus, Plus, Send, ShieldCheck, Truck, TriangleAlert,
} from "lucide-react";
import {
  abbreviateINR, formatCount, formatDate, formatDateTime, formatINR, formatPhone, formatQty,
  isValidGSTIN, enumLabel,
} from "@/lib/format";
import { canApprove, canCreate, canWrite, isReadOnlyRole } from "@/lib/rbac/matrix";
import { ROLE_LABEL, type ItemCategory } from "@/lib/schemas/enums";
import type * as T from "@/lib/schemas/entities";
import { Panel, StatusBadge, Explainer } from "@/components/patterns/primitives";
import { CATEGORY_LABEL, poReceiptState, poValue, useInventory, type InvView } from "./model";
import {
  PO_APPROVAL_THRESHOLD, appendMovements, nextCounter, notify, pad, useMutate, writeAudit,
  type Actor, type MovementDraft, type Overlay,
} from "./store";
import { DataGrid, type GridColumn } from "./grid";
import {
  ActionResult, Blocked, Btn, CheckRow, Field, FilteredEmpty, LinkBtn, MetricStrip, Modal, Note,
  Num, NumInput, PageHeader, PageSkeleton, SearchField, Select, SelectField, Tabs, TextArea,
  TextInput, Toolbar,
} from "./ui";

type Tab = "orders" | "receipts" | "suppliers";

const STATUS_TONE: Record<T.PurchaseOrder["status"], "ok" | "warn" | "danger" | "info" | "neutral"> = {
  DRAFT: "neutral",
  APPROVED: "info",
  SENT: "info",
  PARTIALLY_RECEIVED: "warn",
  RECEIVED: "ok",
  CLOSED: "neutral",
};

interface PORow {
  po: T.PurchaseOrder;
  supplier: T.Supplier | null;
  lines: T.POLine[];
  value: number;
  ordered: number;
  received: number;
  pending: number;
  excess: boolean;
  overdue: boolean;
  needsApproval: boolean;
  approved: boolean;
}

function buildPORows(view: InvView): PORow[] {
  const today = view.today.getTime();
  return view.purchaseOrders
    .map((po) => {
      const lines = view.poLinesByPo.get(po.id) ?? [];
      const state = poReceiptState(view, po.id);
      const value = poValue(view, po.id);
      const open = po.status !== "RECEIVED" && po.status !== "CLOSED";
      return {
        po,
        supplier: view.supplierById.get(po.supplierId) ?? null,
        lines,
        value,
        ordered: state.ordered,
        received: state.received,
        pending: state.pending,
        excess: state.excess,
        overdue: open && new Date(po.expectedDelivery).getTime() < today,
        needsApproval: value > PO_APPROVAL_THRESHOLD,
        approved: po.status !== "DRAFT" || po.approvalRequestId !== null,
      };
    })
    .sort((a, b) => b.po.orderDate.localeCompare(a.po.orderDate));
}

export function PurchaseClient({
  initialTab,
  initialQuery,
  initialStatus,
  initialFocus,
}: {
  initialTab: Tab;
  initialQuery: string;
  initialStatus: string;
  initialFocus: string;
}) {
  const { view, ready, actor } = useInventory();
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [query, setQuery] = React.useState(initialQuery);
  const [status, setStatus] = React.useState(initialStatus);
  const [supplierFilter, setSupplierFilter] = React.useState("");
  const [openPo, setOpenPo] = React.useState<string | null>(null);
  const [receiptFor, setReceiptFor] = React.useState<string | null>(null);
  const [supplierForm, setSupplierForm] = React.useState<{ mode: "create" | "edit"; id: string | null } | null>(null);
  const [result, setResult] = React.useState<{ tone: "ok" | "warn" | "info" | "danger"; title: string; body: string } | null>(null);

  const rows = React.useMemo(() => (view ? buildPORows(view) : []), [view]);

  if (!ready || !view) return <PageSkeleton metrics={5} rows={14} columns={9} />;

  const mayWrite = canWrite(actor.role, "purchaseOrders") && !isReadOnlyRole(actor.role);
  const mayCreate = canCreate(actor.role, "purchaseOrders") && !isReadOnlyRole(actor.role);
  const mayApprove = canApprove(actor.role, "purchaseOrders") && !isReadOnlyRole(actor.role);

  const q = query.trim().toLowerCase();
  const filteredPOs = rows.filter((r) => {
    if (status && r.po.status !== status) return false;
    if (supplierFilter && r.po.supplierId !== supplierFilter) return false;
    if (!q) return true;
    return (
      r.po.number.toLowerCase().includes(q) ||
      (r.supplier?.name.toLowerCase().includes(q) ?? false) ||
      r.lines.some((l) => (view.itemById.get(l.itemId)?.code.toLowerCase().includes(q) ?? false))
    );
  });

  const open = rows.filter((r) => r.po.status !== "RECEIVED" && r.po.status !== "CLOSED");
  const awaitingApproval = rows.filter((r) => r.po.status === "DRAFT" && r.needsApproval);
  const overdue = rows.filter((r) => r.overdue);
  const shortReceipts = view.goodsReceipts.filter((g) => g.shortReceipt).length;
  const valueOnOrder = open.reduce((s, r) => s + r.value, 0);

  const activeFilters: string[] = [];
  if (q) activeFilters.push(`search "${query.trim()}"`);
  if (status) activeFilters.push(`status ${enumLabel(status)}`);
  if (supplierFilter) activeFilters.push(`supplier ${view.supplierById.get(supplierFilter)?.name ?? supplierFilter}`);

  function clearFilters() {
    setQuery("");
    setStatus("");
    setSupplierFilter("");
  }

  const poColumns: GridColumn<PORow>[] = [
    {
      key: "number",
      header: "PO number",
      width: "160px",
      cell: (r) => (
        <button
          type="button"
          onClick={() => setOpenPo(r.po.id)}
          className="t-mono block min-h-6 w-full truncate text-left text-text-hi hover:underline"
        >
          {r.po.number}
        </button>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      width: "minmax(180px,1fr)",
      cell: (r) => <span className="block truncate text-text-mid">{r.supplier?.name ?? r.po.supplierId}</span>,
    },
    {
      key: "ordered",
      header: "Order date",
      width: "108px",
      cell: (r) => <span className="t-body-sm text-text-mid">{formatDate(r.po.orderDate)}</span>,
    },
    {
      key: "expected",
      header: "Expected",
      width: "112px",
      cell: (r) => (
        <span className={`t-body-sm ${r.overdue ? "text-danger" : "text-text-mid"}`}>
          {formatDate(r.po.expectedDelivery)}
        </span>
      ),
    },
    {
      key: "lines",
      header: "Lines",
      width: "64px",
      align: "right",
      cell: (r) => <Num tone="lo">{formatCount(r.lines.length)}</Num>,
    },
    {
      key: "qty",
      header: "Received / ordered",
      width: "140px",
      align: "right",
      cell: (r) => (
        <Num tone={r.received >= r.ordered ? "ok" : r.received > 0 ? "warn" : "lo"}>
          {formatQty(r.received)} / {formatQty(r.ordered)}
        </Num>
      ),
    },
    {
      key: "value",
      header: "Value",
      width: "116px",
      align: "right",
      cell: (r) => <Num>{formatINR(r.value)}</Num>,
    },
    {
      key: "status",
      header: "Status",
      width: "180px",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <StatusBadge tone={STATUS_TONE[r.po.status]}>{enumLabel(r.po.status)}</StatusBadge>
          {r.po.status === "DRAFT" && r.needsApproval ? (
            <StatusBadge tone="warn">Approval required</StatusBadge>
          ) : null}
          {r.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      width: "150px",
      cell: (r) =>
        mayWrite && (r.po.status === "SENT" || r.po.status === "PARTIALLY_RECEIVED" || r.po.status === "APPROVED") ? (
          <Btn size="sm" icon={PackagePlus} onClick={() => setReceiptFor(r.po.id)}>
            Record receipt
          </Btn>
        ) : (
          <Btn size="sm" onClick={() => setOpenPo(r.po.id)}>
            Open
          </Btn>
        ),
    },
  ];

  const detail = openPo ? rows.find((r) => r.po.id === openPo) ?? null : null;
  const receiptRow = receiptFor ? rows.find((r) => r.po.id === receiptFor) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Purchase & goods receipt"
        lede="Orders raised against the supplier master, approved where the value demands it, and received line by line. A receipt is the only inbound path to a balance, and it always references the order it came from."
        right={
          <>
            <LinkBtn href="/inventory/reorder" icon={ClipboardCheck}>
              Reorder list
            </LinkBtn>
            <LinkBtn href="/inventory/stock" icon={FileStack}>
              Stock balances
            </LinkBtn>
            {mayCreate ? (
              <Btn variant="primary" icon={Plus} onClick={() => setSupplierForm({ mode: "create", id: null })}>
                Add supplier
              </Btn>
            ) : null}
          </>
        }
      />

      {result ? (
        <ActionResult tone={result.tone === "danger" ? "danger" : result.tone} title={result.title} onDismiss={() => setResult(null)}>
          {result.body}
        </ActionResult>
      ) : null}

      <MetricStrip
        columns={5}
        metrics={[
          { label: "Open orders", value: formatCount(open.length), icon: FileStack, sub: `${formatCount(view.purchaseOrders.length)} raised in total` },
          {
            label: "Awaiting approval",
            value: formatCount(awaitingApproval.length),
            tone: awaitingApproval.length ? "warn" : "ok",
            icon: ShieldCheck,
            sub: `Above the ${formatINR(PO_APPROVAL_THRESHOLD)} threshold`,
          },
          { label: "Value on order", value: abbreviateINR(valueOnOrder), icon: Truck, sub: "Ordered but not yet received" },
          {
            label: "Overdue deliveries",
            value: formatCount(overdue.length),
            tone: overdue.length ? "danger" : "ok",
            icon: CalendarClock,
            sub: `Expected before ${formatDate(view.today)}`,
          },
          {
            label: "Short receipts",
            value: formatCount(shortReceipts),
            tone: shortReceipts ? "warn" : "ok",
            icon: TriangleAlert,
            sub: "Balance still visible on the order",
          },
        ]}
      />

      <Note tone="neutral" title="How an order becomes stock" icon={Info}>
        Draft → (approval above {formatINR(PO_APPROVAL_THRESHOLD)}) → Sent → goods receipt → RECEIPT movements
        referencing the order → balances rise. Short supply leaves the order Partially received with the balance
        visible; excess supply is blocked until an override is acknowledged in writing. Every transition is written
        to the audit trail with actor and timestamp.
      </Note>

      <Panel>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "orders", label: "Purchase orders", count: view.purchaseOrders.length },
            { value: "receipts", label: "Goods receipts", count: view.goodsReceipts.length },
            { value: "suppliers", label: "Supplier master", count: view.suppliers.length },
          ]}
        />

        {tab === "orders" ? (
          <>
            <Toolbar>
              <SearchField
                value={query}
                onChange={setQuery}
                label="Search purchase orders"
                placeholder="PO number, supplier, item code…"
                width="w-80"
              />
              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "", label: "All statuses" },
                  ...(["DRAFT", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] as const).map((s) => ({
                    value: s as string,
                    label: enumLabel(s),
                  })),
                ]}
              />
              <SelectField
                label="Supplier"
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={[
                  { value: "", label: "All suppliers" },
                  ...view.suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <span className="t-body-sm ml-auto text-text-lo">
                {formatCount(filteredPOs.length)} of {formatCount(rows.length)} orders
              </span>
            </Toolbar>

            {filteredPOs.length === 0 ? (
              activeFilters.length ? (
                <FilteredEmpty filters={activeFilters} total={rows.length} onClear={clearFilters} />
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                  <FileStack className="size-8 text-text-lo" aria-hidden />
                  <div>
                    <p className="t-heading-md text-text-hi">No purchase order has been raised</p>
                    <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
                      Orders are usually raised from the reorder list, which groups the selected lines by preferred
                      supplier and pre-populates the suggested quantities.
                    </p>
                  </div>
                  <LinkBtn href="/inventory/reorder" icon={ClipboardCheck} variant="primary">
                    Open the reorder list
                  </LinkBtn>
                </div>
              )
            ) : (
              <DataGrid
                rows={filteredPOs}
                columns={poColumns}
                rowKey={(r) => r.po.id}
                ariaLabel="Purchase orders"
                height={520}
                rowTone={(r) => (r.overdue ? "danger" : r.po.status === "PARTIALLY_RECEIVED" ? "warn" : null)}
              />
            )}
          </>
        ) : null}

        {tab === "receipts" ? <ReceiptsTab view={view} /> : null}

        {tab === "suppliers" ? (
          <SuppliersTab
            view={view}
            focus={initialFocus}
            mayEdit={mayWrite}
            onEdit={(id) => setSupplierForm({ mode: "edit", id })}
          />
        ) : null}
      </Panel>

      {detail ? (
        <PODetailModal
          row={detail}
          view={view}
          actor={actor}
          mayWrite={mayWrite}
          mayApprove={mayApprove}
          onClose={() => setOpenPo(null)}
          onReceipt={() => {
            setReceiptFor(detail.po.id);
            setOpenPo(null);
          }}
          onResult={(tone, title, body) => setResult({ tone, title, body })}
        />
      ) : null}

      {receiptRow ? (
        <GoodsReceiptModal
          row={receiptRow}
          view={view}
          actor={actor}
          onClose={() => setReceiptFor(null)}
          onResult={(tone, title, body) => {
            setResult({ tone, title, body });
            setReceiptFor(null);
          }}
        />
      ) : null}

      {supplierForm ? (
        <SupplierModal
          supplierId={supplierForm.id}
          view={view}
          actor={actor}
          onClose={() => setSupplierForm(null)}
          onResult={(tone, title, body) => {
            setResult({ tone, title, body });
            setSupplierForm(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- PO detail */

function PODetailModal({
  row,
  view,
  actor,
  mayWrite,
  mayApprove,
  onClose,
  onReceipt,
  onResult,
}: {
  row: PORow;
  view: InvView;
  actor: Actor;
  mayWrite: boolean;
  mayApprove: boolean;
  onClose: () => void;
  onReceipt: () => void;
  onResult: (tone: "ok" | "warn" | "info", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const { po, supplier, lines } = row;
  const receipts = view.goodsReceipts.filter((g) => g.purchaseOrderId === po.id);
  const approvalPending = po.status === "DRAFT" && row.needsApproval && po.approvalRequestId !== null;
  const blockedFromSending = po.status === "DRAFT" && row.needsApproval && po.approvalRequestId === null;

  function transition(next: T.PurchaseOrder["status"], summary: string, extra?: Partial<T.PurchaseOrder>) {
    const at = new Date().toISOString();
    mutate((o: Overlay) => {
      o.poPatches[po.id] = { ...(o.poPatches[po.id] ?? {}), status: next, ...extra };
      writeAudit(o, actor, {
        at,
        action: "STATE_TRANSITION",
        entityType: "PurchaseOrder",
        entityId: po.id,
        entityLabel: po.number,
        summary,
        before: enumLabel(po.status),
        after: enumLabel(next),
      });
    });
    onResult("ok", `${po.number} — ${enumLabel(next)}`, summary);
  }

  function requestApproval() {
    const at = new Date().toISOString();
    mutate((o: Overlay) => {
      const n = nextCounter(o, "poApproval", 0);
      const ref = `BC/APR/2627/P${pad(n, 4)}`;
      o.poPatches[po.id] = { ...(o.poPatches[po.id] ?? {}), approvalRequestId: ref };
      writeAudit(o, actor, {
        at,
        action: "STATE_TRANSITION",
        entityType: "PurchaseOrder",
        entityId: po.id,
        entityLabel: po.number,
        summary: `Approval requested for ${po.number} at ${formatINR(row.value)} — above the ${formatINR(
          PO_APPROVAL_THRESHOLD,
        )} threshold`,
        before: "DRAFT · no approval raised",
        after: `DRAFT · approval ${ref} pending`,
      });
      const director = view.ds.users.find((u) => u.role === "DIRECTOR_BUSINESS");
      if (director) {
        notify(o, {
          at,
          toUserId: director.id,
          toLabel: director.name,
          channel: "IN_APP",
          digest: false,
          title: "Purchase order awaiting approval",
          body: `${po.number} to ${supplier?.name ?? "supplier"} for ${formatINR(row.value)} needs approval before it can be sent.`,
          href: "/workflow/approvals",
        });
      }
    });
    onResult(
      "info",
      "Approval requested",
      `${po.number} is held at Draft until it is approved. The Director – Business has been notified; the request is also visible on My Approvals.`,
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-4xl"
      title={po.number}
      sub={`${supplier?.name ?? po.supplierId} · ${enumLabel(po.status)} · ${formatINR(row.value)}`}
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          {mayWrite && po.status === "DRAFT" && row.needsApproval && !approvalPending ? (
            <Btn icon={ShieldCheck} onClick={requestApproval}>
              Request approval
            </Btn>
          ) : null}
          {mayApprove && approvalPending ? (
            <Btn
              icon={CheckCheck}
              onClick={() =>
                transition("APPROVED", `Approved for despatch to ${supplier?.name ?? "the supplier"} at ${formatINR(row.value)}`)
              }
            >
              Approve
            </Btn>
          ) : null}
          {mayWrite && (po.status === "APPROVED" || (po.status === "DRAFT" && !row.needsApproval)) ? (
            <Btn
              variant="primary"
              icon={Send}
              onClick={() => transition("SENT", `Order sent to ${supplier?.name ?? "the supplier"}`)}
            >
              Send to supplier
            </Btn>
          ) : null}
          {mayWrite && (po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") ? (
            <Btn variant="primary" icon={PackagePlus} onClick={onReceipt}>
              Record goods receipt
            </Btn>
          ) : null}
          {mayWrite && po.status === "RECEIVED" ? (
            <Btn icon={CheckCheck} onClick={() => transition("CLOSED", "Order closed after full receipt")}>
              Close the order
            </Btn>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Supplier</dt>
            <dd className="t-body-sm text-text-hi">
              {supplier?.name ?? po.supplierId}
              {supplier ? <span className="t-mono block text-text-lo">{supplier.gstin}</span> : null}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Terms</dt>
            <dd className="t-body-sm text-text-hi">{po.terms}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Expected delivery</dt>
            <dd className={`t-body-sm ${row.overdue ? "text-danger" : "text-text-hi"}`}>
              {formatDate(po.expectedDelivery)}
              {row.overdue ? " · overdue" : ""}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Deliver to</dt>
            <dd className="t-body-sm text-text-hi">{view.locationById.get(po.toLocationId)?.name ?? po.toLocationId}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Raised by</dt>
            <dd className="t-body-sm text-text-hi">{view.userById.get(po.raisedByUserId)?.name ?? po.raisedByUserId}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Order date</dt>
            <dd className="t-body-sm text-text-hi">{formatDate(po.orderDate)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Approval</dt>
            <dd className="t-body-sm text-text-hi">
              {row.needsApproval ? (po.approvalRequestId ? <span className="t-mono">{po.approvalRequestId}</span> : "Required, not yet raised") : "Not required"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Order value</dt>
            <dd className="t-body-sm text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatINR(row.value)}
            </dd>
          </div>
        </dl>

        {blockedFromSending ? (
          <Blocked
            title="This order cannot be sent yet"
            rule={`${formatINR(row.value)} is above the configured approval threshold of ${formatINR(
              PO_APPROVAL_THRESHOLD,
            )}, so the order stays at Draft until it is approved. The threshold is reference data, maintained in Masters.`}
            unblock={`Request approval here; ${ROLE_LABEL.DIRECTOR_BUSINESS} holds the authority to grant it. Once approved, Send becomes available.`}
            actions={
              <>
                <LinkBtn href="/admin/masters" icon={Lock}>
                  Approval thresholds
                </LinkBtn>
                <LinkBtn href="/workflow/approvals" icon={ShieldCheck}>
                  My approvals
                </LinkBtn>
              </>
            }
          />
        ) : null}

        {approvalPending && !mayApprove ? (
          <Note tone="warn" title="Waiting on approval">
            Approval <span className="t-mono">{po.approvalRequestId}</span> is pending. {ROLE_LABEL[actor.role]} may
            raise the request but cannot grant it, so no Approve control is rendered for this session.
          </Note>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
            <caption className="sr-only">Lines on {po.number}</caption>
            <thead>
              <tr>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">Item</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Ordered</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Received</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Balance</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Rate</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Value</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const item = view.itemById.get(l.itemId);
                const balance = l.qty - l.qtyReceived;
                return (
                  <tr key={l.id}>
                    <td className="border-b border-line/70 px-3 py-1.5">
                      <Link href={`/inventory/stock?q=${encodeURIComponent(item?.code ?? "")}`} className="t-mono inline-flex min-h-6 items-center text-text-hi hover:underline">
                        {item?.code ?? l.itemId}
                      </Link>
                      <span className="t-body-sm block truncate text-text-lo">{item?.description}</span>
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.qty, item?.uom)}
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.qtyReceived)}
                    </td>
                    <td
                      className={`t-body-sm border-b border-line/70 px-3 py-1.5 text-right ${
                        balance > 0 ? "text-warn" : balance < 0 ? "text-danger" : "text-ok"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {balance === 0 ? "Complete" : formatQty(balance)}
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatINR(l.rate)}
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatINR(l.qty * l.rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <span className="t-overline text-text-lo">Receipts against this order</span>
          {receipts.length === 0 ? (
            <p className="t-body-sm mt-1 text-text-lo">
              Nothing has been received yet. A receipt writes one RECEIPT movement per line, each referencing{" "}
              <span className="t-mono">{po.number}</span>.
            </p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {receipts.map((g) => (
                <li key={g.id} className="t-body-sm flex flex-wrap items-center gap-2 text-text-mid">
                  <span className="t-mono text-text-hi">{g.number}</span>
                  <span>{formatDateTime(g.receivedAt)}</span>
                  <span>
                    {formatQty(g.lines.reduce((s, l) => s + l.qtyReceived, 0))} received across{" "}
                    {formatCount(g.lines.length)} {g.lines.length === 1 ? "line" : "lines"}
                  </span>
                  {g.shortReceipt ? <StatusBadge tone="warn">Short</StatusBadge> : null}
                  {g.excessReceipt ? <StatusBadge tone="danger">Excess — overridden</StatusBadge> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ goods receipt */

function GoodsReceiptModal({
  row,
  view,
  actor,
  onClose,
  onResult,
}: {
  row: PORow;
  view: InvView;
  actor: Actor;
  onClose: () => void;
  onResult: (tone: "ok" | "warn", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const [qty, setQty] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(row.lines.map((l) => [l.id, Math.max(0, l.qty - l.qtyReceived)])),
  );
  const [override, setOverride] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const totals = row.lines.reduce(
    (acc, l) => {
      const received = qty[l.id] ?? 0;
      const cumulative = l.qtyReceived + received;
      acc.received += received;
      if (cumulative > l.qty) acc.excess += cumulative - l.qty;
      if (cumulative < l.qty) acc.short += l.qty - cumulative;
      return acc;
    },
    { received: 0, excess: 0, short: 0 },
  );

  const hasExcess = totals.excess > 0;
  const isShort = totals.short > 0;
  const blocked = totals.received <= 0 || (hasExcess && (!override || reason.trim().length < 8));

  function record() {
    if (blocked) return;
    const at = new Date().toISOString();
    const drafts: MovementDraft[] = [];
    for (const l of row.lines) {
      const received = qty[l.id] ?? 0;
      if (received <= 0) continue;
      drafts.push({
        itemId: l.itemId,
        type: "RECEIPT",
        qty: received,
        fromLocationId: null,
        toLocationId: row.po.toLocationId,
        sourceType: "PURCHASE_ORDER",
        sourceId: row.po.id,
        sourceLabel: row.po.number,
        rate: l.rate,
        reason: hasExcess ? `Excess receipt overridden — ${reason.trim()}` : null,
      });
    }

    const nextStatus: T.PurchaseOrder["status"] = isShort ? "PARTIALLY_RECEIVED" : "RECEIVED";

    mutate((o: Overlay) => {
      appendMovements(o, view.maxSeq, actor, drafts, at);

      for (const l of row.lines) {
        const received = qty[l.id] ?? 0;
        if (received <= 0) continue;
        o.poLinePatches[l.id] = { qtyReceived: l.qtyReceived + received };
      }

      const n = nextCounter(o, "grn", view.goodsReceipts.length);
      const number = `BC/GRN/2627/${pad(n, 4)}`;
      o.newGRNs.push({
        id: `GRN-L${pad(n, 4)}`,
        number,
        purchaseOrderId: row.po.id,
        receivedAt: at,
        byUserId: actor.userId,
        lines: row.lines
          .filter((l) => (qty[l.id] ?? 0) > 0)
          .map((l) => ({ poLineId: l.id, itemId: l.itemId, qtyReceived: qty[l.id] ?? 0 })),
        shortReceipt: isShort,
        excessReceipt: hasExcess,
        overrideReason: hasExcess ? reason.trim() : null,
      });

      o.poPatches[row.po.id] = { ...(o.poPatches[row.po.id] ?? {}), status: nextStatus };

      writeAudit(o, actor, {
        at,
        action: "STATE_TRANSITION",
        entityType: "PurchaseOrder",
        entityId: row.po.id,
        entityLabel: row.po.number,
        summary: `Goods receipt ${number} — ${formatQty(totals.received)} received${
          isShort ? `, ${formatQty(totals.short)} still outstanding` : ""
        }${hasExcess ? `, ${formatQty(totals.excess)} excess accepted under override` : ""}`,
        before: `${enumLabel(row.po.status)} · ${formatQty(row.received)} of ${formatQty(row.ordered)} received`,
        after: `${enumLabel(nextStatus)} · ${formatQty(row.received + totals.received)} of ${formatQty(row.ordered)} received`,
      });

      notify(o, {
        at,
        toUserId: row.po.raisedByUserId,
        toLabel: view.userById.get(row.po.raisedByUserId)?.name ?? "Buyer",
        channel: "IN_APP",
        digest: false,
        title: isShort ? "Short receipt recorded" : "Goods received in full",
        body: `${number} against ${row.po.number}: ${formatQty(totals.received)} received into ${
          view.locationById.get(row.po.toLocationId)?.name ?? "the store"
        }${isShort ? `. ${formatQty(totals.short)} remains outstanding on the order.` : "."}`,
        href: "/inventory/purchase",
      });
    });

    onResult(
      isShort || hasExcess ? "warn" : "ok",
      isShort ? "Short receipt recorded" : hasExcess ? "Excess receipt accepted under override" : "Goods received in full",
      `${formatQty(totals.received)} received against ${row.po.number} and written to the ledger as ${
        drafts.length
      } RECEIPT ${drafts.length === 1 ? "movement" : "movements"}. ${
        isShort
          ? `The order stays Partially received with ${formatQty(totals.short)} outstanding.`
          : "The order is now fully received."
      }`,
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title={`Goods receipt against ${row.po.number}`}
      sub={`${row.supplier?.name ?? row.po.supplierId} · expected ${formatDate(row.po.expectedDelivery)} · into ${
        view.locationById.get(row.po.toLocationId)?.name ?? row.po.toLocationId
      }`}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={PackageCheck} onClick={record} disabled={blocked}>
            Record receipt · {formatQty(totals.received)}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Note tone="neutral" title="What this writes" icon={Info}>
          One RECEIPT movement per received line from sequence{" "}
          <span className="t-mono text-text-hi">{view.maxSeq + 1}</span>, each referencing{" "}
          <span className="t-mono text-text-hi">{row.po.number}</span>, into{" "}
          <span className="text-text-hi">{view.locationById.get(row.po.toLocationId)?.name ?? "the store"}</span> at
          the ordered rate. Balances rise by exactly what is entered below.
        </Note>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse">
            <caption className="sr-only">Received quantities per line</caption>
            <thead>
              <tr>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">Item</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Ordered</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Already received</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Receiving now</th>
                <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">Position</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l) => {
                const item = view.itemById.get(l.itemId);
                const now = qty[l.id] ?? 0;
                const cumulative = l.qtyReceived + now;
                return (
                  <tr key={l.id}>
                    <td className="border-b border-line/70 px-3 py-1.5">
                      <span className="t-mono block text-text-hi">{item?.code ?? l.itemId}</span>
                      <span className="t-body-sm block truncate text-text-lo">{item?.description}</span>
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.qty, item?.uom)}
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.qtyReceived)}
                    </td>
                    <td className="border-b border-line/70 px-3 py-1.5 text-right">
                      <label className="inline-flex items-center">
                        <span className="sr-only">Quantity of {item?.code ?? l.itemId} received now</span>
                        <NumInput
                          className="w-24"
                          min={0}
                          value={now}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setQty((prev) => ({ ...prev, [l.id]: Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0 }));
                          }}
                        />
                      </label>
                    </td>
                    <td className="border-b border-line/70 px-3 py-1.5">
                      {cumulative > l.qty ? (
                        <StatusBadge tone="danger">Excess {formatQty(cumulative - l.qty)}</StatusBadge>
                      ) : cumulative < l.qty ? (
                        <StatusBadge tone="warn">Short {formatQty(l.qty - cumulative)}</StatusBadge>
                      ) : (
                        <StatusBadge tone="ok">Complete</StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isShort ? (
          <Note tone="warn" title="This will be recorded as a short receipt">
            {formatQty(totals.short)} stays outstanding. The order remains at Partially received with the balance
            visible on every line, so the supplier can be chased against a figure rather than a memory.
          </Note>
        ) : null}

        {hasExcess ? (
          <>
            <Blocked
              title={`Excess supply of ${formatQty(totals.excess)} — an override is required`}
              rule="More has arrived than was ordered. Accepting it silently would put stock on the shelf that no order authorised and no invoice will match, so the receipt is refused until somebody takes responsibility for it in writing."
              unblock="Acknowledge the override below and state why the excess is being accepted. The acknowledgement, the reason and the actor are written onto the receipt and into the audit trail."
            />
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] p-3">
              <CheckRow
                checked={override}
                onChange={setOverride}
                label={`I accept ${formatQty(totals.excess)} more than was ordered`}
                hint="Recorded against your name on the goods receipt."
              />
              <Field
                label="Reason for accepting the excess"
                required
                hint="Minimum eight characters. Written verbatim onto the receipt and the ledger rows."
                error={override && reason.trim().length > 0 && reason.trim().length < 8 ? "Too short to be a reason" : null}
              >
                <TextArea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Supplier shipped a full carton against a part quantity; agreed to retain and adjust the next order…"
                />
              </Field>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- receipts */

function ReceiptsTab({ view }: { view: InvView }) {
  const rows = React.useMemo(
    () => [...view.goodsReceipts].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [view.goodsReceipts],
  );

  const columns: GridColumn<T.GoodsReceipt>[] = [
    {
      key: "number",
      header: "GRN",
      width: "170px",
      cell: (g) => <span className="t-mono block truncate text-text-hi">{g.number}</span>,
    },
    {
      key: "po",
      header: "Against order",
      width: "170px",
      cell: (g) => {
        const po = view.purchaseOrders.find((p) => p.id === g.purchaseOrderId);
        return <span className="t-mono block truncate text-text-mid">{po?.number ?? g.purchaseOrderId}</span>;
      },
    },
    {
      key: "supplier",
      header: "Supplier",
      width: "minmax(160px,1fr)",
      cell: (g) => {
        const po = view.purchaseOrders.find((p) => p.id === g.purchaseOrderId);
        const s = po ? view.supplierById.get(po.supplierId) : null;
        return <span className="block truncate text-text-mid">{s?.name ?? "—"}</span>;
      },
    },
    {
      key: "at",
      header: "Received",
      width: "150px",
      cell: (g) => <span className="t-body-sm text-text-mid">{formatDate(g.receivedAt)}</span>,
    },
    {
      key: "lines",
      header: "Lines",
      width: "70px",
      align: "right",
      cell: (g) => <Num tone="lo">{formatCount(g.lines.length)}</Num>,
    },
    {
      key: "qty",
      header: "Quantity",
      width: "100px",
      align: "right",
      cell: (g) => <Num>{formatQty(g.lines.reduce((s, l) => s + l.qtyReceived, 0))}</Num>,
    },
    {
      key: "flags",
      header: "Exception",
      width: "220px",
      cell: (g) =>
        g.excessReceipt ? (
          <span className="flex items-center gap-1">
            <StatusBadge tone="danger">Excess — overridden</StatusBadge>
          </span>
        ) : g.shortReceipt ? (
          <StatusBadge tone="warn">Short receipt</StatusBadge>
        ) : (
          <StatusBadge tone="ok">Matched the order</StatusBadge>
        ),
    },
    {
      key: "by",
      header: "Received by",
      width: "150px",
      cell: (g) => <span className="block truncate text-text-mid">{view.userById.get(g.byUserId)?.name ?? g.byUserId}</span>,
    },
  ];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <PackagePlus className="size-8 text-text-lo" aria-hidden />
        <div>
          <p className="t-heading-md text-text-hi">No goods receipt has been recorded</p>
          <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
            A receipt is recorded against an open purchase order. Open an order at Sent or Partially received and
            record what actually arrived.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      rowKey={(g) => g.id}
      ariaLabel="Goods receipts"
      height={520}
      rowTone={(g) => (g.excessReceipt ? "danger" : g.shortReceipt ? "warn" : null)}
    />
  );
}

/* --------------------------------------------------------------- suppliers */

function SuppliersTab({
  view,
  focus,
  mayEdit,
  onEdit,
}: {
  view: InvView;
  focus: string;
  mayEdit: boolean;
  onEdit: (id: string) => void;
}) {
  const rows = React.useMemo(
    () => [...view.suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [view.suppliers],
  );

  const orderCount = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const po of view.purchaseOrders) m.set(po.supplierId, (m.get(po.supplierId) ?? 0) + 1);
    return m;
  }, [view.purchaseOrders]);

  const columns: GridColumn<T.Supplier>[] = [
    {
      key: "code",
      header: "Code",
      width: "90px",
      cell: (s) => <span className="t-mono block truncate text-text-hi">{s.code}</span>,
    },
    {
      key: "name",
      header: "Supplier",
      width: "minmax(180px,1fr)",
      cell: (s) => (
        <span className={`block truncate ${focus === s.id ? "text-text-hi" : "text-text-mid"}`}>{s.name}</span>
      ),
    },
    {
      key: "gstin",
      header: "GSTIN",
      width: "160px",
      cell: (s) => (
        <span className={`t-mono block truncate ${isValidGSTIN(s.gstin) ? "text-text-mid" : "text-warn"}`} title={isValidGSTIN(s.gstin) ? undefined : "Does not match the 15-character GSTIN pattern"}>
          {s.gstin}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      width: "minmax(150px,0.8fr)",
      cell: (s) => (
        <span className="block truncate text-text-mid">
          {s.contactPerson}
          <span className="t-mono block text-text-lo">{formatPhone(s.phone)}</span>
        </span>
      ),
    },
    {
      key: "terms",
      header: "Payment terms",
      width: "120px",
      cell: (s) => <span className="block truncate text-text-mid">{s.paymentTerms}</span>,
    },
    {
      key: "categories",
      header: "Supplies",
      width: "200px",
      cell: (s) => (
        <span className="block truncate text-text-mid">
          {s.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}
        </span>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      width: "80px",
      align: "right",
      cell: (s) => <Num tone="lo">{formatCount(orderCount.get(s.id) ?? 0)}</Num>,
    },
    {
      key: "action",
      header: "Action",
      width: "90px",
      cell: (s) =>
        mayEdit ? (
          <Btn size="sm" onClick={() => onEdit(s.id)}>
            Edit
          </Btn>
        ) : (
          <span className="t-body-sm text-text-lo">Read-only</span>
        ),
    },
  ];

  return (
    <>
      <div className="border-b border-line px-3 py-2">
        <Explainer className="text-text-mid">
          {formatCount(rows.length)} suppliers carry {formatCount(view.purchaseOrders.length)} orders. Name, GSTIN,
          contact, payment terms and the categories a supplier serves are all held here — the categories are what
          decide the preferred supplier on the reorder list where no purchase history exists yet.
        </Explainer>
      </div>
      <DataGrid
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        ariaLabel="Supplier master"
        height={480}
        rowTone={(s) => (isValidGSTIN(s.gstin) ? null : "warn")}
      />
    </>
  );
}

function SupplierModal({
  supplierId,
  view,
  actor,
  onClose,
  onResult,
}: {
  supplierId: string | null;
  view: InvView;
  actor: Actor;
  onClose: () => void;
  onResult: (tone: "ok" | "warn", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const existing = supplierId ? view.supplierById.get(supplierId) ?? null : null;
  const [name, setName] = React.useState(existing?.name ?? "");
  const [gstin, setGstin] = React.useState(existing?.gstin ?? "");
  const [contact, setContact] = React.useState(existing?.contactPerson ?? "");
  const [phone, setPhone] = React.useState(existing?.phone ?? "");
  const [email, setEmail] = React.useState(existing?.email ?? "");
  const [terms, setTerms] = React.useState(existing?.paymentTerms ?? "30 days");
  const [categories, setCategories] = React.useState<ItemCategory[]>(existing?.categories ?? ["SPARE"]);

  const gstinValid = gstin.trim().length === 0 || isValidGSTIN(gstin);
  const duplicate = view.suppliers.some(
    (s) => s.id !== existing?.id && s.gstin.toUpperCase() === gstin.trim().toUpperCase() && gstin.trim().length > 0,
  );
  const blocked = name.trim().length < 3 || !gstinValid || duplicate || categories.length === 0;

  function save() {
    if (blocked) return;
    const at = new Date().toISOString();
    mutate((o: Overlay) => {
      if (existing) {
        o.supplierPatches[existing.id] = {
          name: name.trim(),
          gstin: gstin.trim().toUpperCase(),
          contactPerson: contact.trim(),
          phone: phone.trim(),
          email: email.trim(),
          paymentTerms: terms,
          categories,
        };
        writeAudit(o, actor, {
          at,
          action: "UPDATE",
          entityType: "Supplier",
          entityId: existing.id,
          entityLabel: existing.name,
          summary: `Supplier record updated — ${name.trim()}`,
          before: `${existing.name} · ${existing.gstin} · ${existing.paymentTerms}`,
          after: `${name.trim()} · ${gstin.trim().toUpperCase()} · ${terms}`,
        });
      } else {
        const n = nextCounter(o, "supplier", view.suppliers.length);
        const supplier: T.Supplier = {
          id: `SUP-L${pad(n, 3)}`,
          code: `SUP${pad(n, 3)}`,
          name: name.trim(),
          gstin: gstin.trim().toUpperCase(),
          contactPerson: contact.trim(),
          phone: phone.trim(),
          email: email.trim(),
          paymentTerms: terms,
          categories,
          stateCode: gstin.trim().slice(0, 2) || "10",
        };
        o.newSuppliers.push(supplier);
        writeAudit(o, actor, {
          at,
          action: "CREATE",
          entityType: "Supplier",
          entityId: supplier.id,
          entityLabel: supplier.name,
          summary: `Supplier added to the master — ${supplier.name}, ${supplier.paymentTerms}`,
          before: null,
          after: `${supplier.code} · ${supplier.gstin} · supplies ${categories.map((c) => CATEGORY_LABEL[c]).join(", ")}`,
        });
      }
    });
    onResult(
      "ok",
      existing ? "Supplier updated" : "Supplier added to the master",
      `${name.trim()} is available to purchase orders and to the preferred-supplier rule on the reorder list.`,
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={existing ? `Edit ${existing.name}` : "Add a supplier"}
      sub="Name, GSTIN, contact, payment terms and the categories supplied. The categories decide which reorder lines default to this supplier."
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={Building2} onClick={save} disabled={blocked}>
            {existing ? "Save changes" : "Add supplier"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Supplier name" required error={name.trim().length > 0 && name.trim().length < 3 ? "Too short" : null}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ELGi Equipments — Eastern Depot" />
          </Field>
          <Field
            label="GSTIN"
            required
            hint="15 characters. The first two digits are the state code and decide the tax treatment on the invoice."
            error={!gstinValid ? "Not a valid 15-character GSTIN" : duplicate ? "Another supplier already holds this GSTIN" : null}
          >
            <TextInput mono value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="10AABCS1234K1Z5" />
          </Field>
          <Field label="Contact person" required>
            <TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Deepak Jha" />
          </Field>
          <Field label="Phone">
            <TextInput mono value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9955997458" />
          </Field>
          <Field label="Email">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@supplier.in" />
          </Field>
          <Field label="Payment terms" required>
            <Select value={terms} onChange={(e) => setTerms(e.target.value)}>
              {["Advance", "15 days", "30 days", "45 days", "60 days"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="t-overline text-text-lo">Categories supplied</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(CATEGORY_LABEL) as ItemCategory[])
              .filter((c) => c !== "SERVICE")
              .map((c) => (
                <label key={c} className="flex min-h-6 items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={categories.includes(c)}
                    onChange={(e) =>
                      setCategories((prev) => (e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)))
                    }
                    className="size-3.5 accent-[var(--primary-600)]"
                  />
                  <span className="t-body-sm text-text-mid">{CATEGORY_LABEL[c]}</span>
                </label>
              ))}
          </div>
          {categories.length === 0 ? (
            <p className="t-body-sm text-danger">A supplier must serve at least one category to be selectable.</p>
          ) : null}
        </fieldset>

        {duplicate ? (
          <Blocked
            title="A supplier with this GSTIN already exists"
            rule="A GSTIN identifies one registered taxpayer. Two supplier records against one GSTIN split the purchase history and break the preferred-supplier rule."
            unblock="Edit the existing record instead, or correct the GSTIN if this is a different registration."
          />
        ) : null}
      </div>
    </Modal>
  );
}
