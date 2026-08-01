"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight, CircleDot, ClipboardList, FileWarning, PackageCheck, PackageOpen,
  Search, Truck, Wallet,
} from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import type { Vertical } from "@/lib/schemas/enums";
import { VERTICAL_LABEL, VERTICAL_TOKEN } from "@/lib/schemas/enums";
import { abbreviateINR, formatCount, formatDate, formatINR, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, Overline, Panel, PanelHeader, Skeleton, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { VERTICALS } from "./calc";
import {
  FULFILMENT_LABEL, ORDER_STATUS_TONE, buildOrderViews, type Fulfilment, type OrderView,
} from "./orders";
import { inScope, permissionsOf, scopeNoteFor, useSalesSession, type SalesPermissions } from "./session";
import { retryLoad, useSalesStore, type SalesWorld } from "./store";
import {
  Btn, ErrorPanel, FilterBar, FilteredEmpty, InlineLabel, LinkBtn, Meter, PageHeader,
  Select, Stat, TableFrame, TextInput, Th, Td, Tr,
} from "./ui";

/**
 * E3-S7 — the sales order register.
 *
 * The open order book on this screen is the same arithmetic the seed
 * reconciliation validator asserts at ₹2.38 Cr across 71 orders: for every
 * order that is neither fulfilled nor cancelled, the sum over its lines of
 * (ordered quantity − invoiced quantity) × rate. The figure is computed here,
 * never typed in, and the reconciliation strip states the group total even when
 * a branch-scoped session narrows the list beneath it.
 */

const STATUSES: T.SalesOrder["status"][] = ["OPEN", "PARTIAL", "FULFILLED", "CANCELLED"];
const FULFILMENTS: Fulfilment[] = ["NOT_STARTED", "PARTIAL", "COMPLETE"];

const STATUS_LABEL: Record<T.SalesOrder["status"], string> = {
  OPEN: "Open",
  PARTIAL: "Part despatched",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

const FULFILMENT_ICON: Record<Fulfilment, React.ComponentType<{ className?: string }>> = {
  NOT_STARTED: CircleDot,
  PARTIAL: Truck,
  COMPLETE: PackageCheck,
};

interface Filters extends Record<string, string> {
  q: string;
  status: string;
  fulfilment: string;
  owner: string;
  branch: string;
  vertical: string;
  book: string;
}
const EMPTY: Filters = { q: "", status: "", fulfilment: "", owner: "", branch: "", vertical: "", book: "" };

export function OrdersPage() {
  const store = useSalesStore();
  const session = useSalesSession();

  if (store.status === "loading" || !session) return <OrdersSkeleton />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  return <Register w={store.world} perms={permissionsOf(session)} />;
}

function Register({ w, perms }: { w: SalesWorld; perms: SalesPermissions }) {
  const [f, setF] = React.useState<Filters>(EMPTY);

  const all = React.useMemo(() => buildOrderViews(w), [w]);

  // The group figure, before any scoping — this is what reconciles to the seed.
  const groupOpen = all.filter((v) => v.inOrderBook);
  const groupBook = groupOpen.reduce((s, v) => s + v.orderBookValue, 0);

  const scoped = React.useMemo(
    () =>
      all.filter((v) =>
        inScope(perms, "salesOrders", { branchId: v.order.branchId, ownerUserId: v.order.ownerUserId }),
      ),
    [all, perms],
  );

  const lockBranchId = perms.scope("salesOrders") === "BRANCH" ? perms.branchId : null;
  const branchName = w.branchById.get(perms.branchId)?.name ?? "your branch";
  const scopeNote = scopeNoteFor(perms, "salesOrders", branchName);
  const narrowed = scoped.length !== all.length;

  const needle = f.q.trim().toLowerCase();
  const rows = React.useMemo(
    () =>
      scoped.filter((v) => {
        if (needle) {
          const hay = `${v.order.number} ${v.order.customerPoRef} ${v.customer?.legalName ?? ""} ${v.customer?.code ?? ""} ${v.quotation?.number ?? ""}`;
          if (!hay.toLowerCase().includes(needle)) return false;
        }
        if (f.status && v.order.status !== f.status) return false;
        if (f.fulfilment && v.fulfilment !== f.fulfilment) return false;
        if (f.owner && v.order.ownerUserId !== f.owner) return false;
        if (f.branch && v.order.branchId !== f.branch) return false;
        if (f.vertical && v.order.vertical !== f.vertical) return false;
        if (f.book === "open" && !v.inOrderBook) return false;
        if (f.book === "nopo" && v.order.customerPoRef.trim()) return false;
        return true;
      }),
    [scoped, needle, f.status, f.fulfilment, f.owner, f.branch, f.vertical, f.book],
  );

  const active: string[] = [];
  if (f.q) active.push(`search "${f.q}"`);
  if (f.status) active.push(`status ${STATUS_LABEL[f.status as T.SalesOrder["status"]].toLowerCase()}`);
  if (f.fulfilment) active.push(`fulfilment ${FULFILMENT_LABEL[f.fulfilment as Fulfilment].toLowerCase()}`);
  if (f.owner) active.push(`executive ${w.userById.get(f.owner)?.name ?? f.owner}`);
  if (f.branch) active.push(`branch ${w.branchById.get(f.branch)?.name ?? f.branch}`);
  if (f.vertical) active.push(`vertical ${VERTICAL_LABEL[f.vertical as Vertical]}`);
  if (f.book === "open") active.push("open order book only");
  if (f.book === "nopo") active.push("no customer PO recorded");

  const scopedOpen = scoped.filter((v) => v.inOrderBook);
  const scopedBook = scopedOpen.reduce((s, v) => s + v.orderBookValue, 0);
  const shownBook = rows.filter((v) => v.inOrderBook).reduce((s, v) => s + v.orderBookValue, 0);
  const advance = scoped.reduce((s, v) => s + v.order.advanceReceived, 0);
  const undespatched = scoped.reduce((s, v) => s + v.unfulfilledValue, 0);
  const partial = scoped.filter((v) => v.fulfilment === "PARTIAL").length;
  const noPo = scoped.filter((v) => !v.order.customerPoRef.trim()).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sales orders"
        lead="Every won quotation becomes an order with its lines, terms and customer carried across. What remains uninvoiced on an order that is neither fulfilled nor cancelled is the order book."
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{formatCount(scoped.length)} orders in scope</StatusBadge>
            {scopeNote ? <StatusBadge tone="info">{scopeNote}</StatusBadge> : null}
            {noPo > 0 ? <StatusBadge tone="warn">{formatCount(noPo)} without a customer PO reference</StatusBadge> : null}
          </>
        }
        right={<LinkBtn href="/sales/pipeline" variant="primary">Pipeline board</LinkBtn>}
      />

      {/* ------------------------------------------ headline: the order book */}
      <div className="panel-hero p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Overline>Open order book{narrowed ? " — in your scope" : ""}</Overline>
            <p className="t-display-lg mt-1 tabular-nums text-text-hi" title={formatINR(scopedBook)}>
              {abbreviateINR(scopedBook)}
            </p>
            <Explainer className="mt-1 max-w-2xl text-text-mid">
              {formatCount(scopedOpen.length)} orders neither fulfilled nor cancelled, valued at ordered quantity less
              invoiced quantity times rate. Tax is excluded — an order book is work owed, not GST owed.
            </Explainer>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-1">
            <div>
              <dt className="t-overline text-text-lo">Group total</dt>
              <dd className="t-body-sm tabular-nums text-text-mid" title={formatINR(groupBook)}>
                {abbreviateINR(groupBook)} across {formatCount(groupOpen.length)} open of {formatCount(all.length)} orders
              </dd>
            </div>
            <div>
              <dt className="t-overline text-text-lo">Reconciles to</dt>
              <dd className="t-body-sm text-text-mid">
                <Link href="/analytics/sales" className="underline underline-offset-2">Order book (K-04)</Link>
                {" "}— identical arithmetic, asserted by the seed validator
              </dd>
            </div>
          </dl>
        </div>
        {active.length > 0 && shownBook !== scopedBook ? (
          <Explainer className="mt-3 flex items-start gap-1.5 border-t border-line pt-3 text-text-lo">
            <PackageOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              The filters below narrow the visible book to{" "}
              <span className="tabular-nums text-text-mid">{abbreviateINR(shownBook)}</span>. The headline figure stays
              on the whole scope so a filter can never make the number look better than it is.
            </span>
          </Explainer>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Orders in scope" value={formatCount(scoped.length)} sub={`${formatCount(scopedOpen.length)} still in the book`} /></li>
        <li><Stat label="Awaiting despatch" value={abbreviateINR(undespatched)} sub="Ordered quantity not yet despatched, at line rate" tone={undespatched > 0 ? "warn" : "ok"} /></li>
        <li><Stat label="Part despatched" value={formatCount(partial)} sub="Some lines gone, some still owed" tone={partial ? "info" : undefined} /></li>
        <li><Stat label="Advance received" value={abbreviateINR(advance)} sub="Recorded against orders in scope" href="/commercial/receivables" /></li>
      </ul>

      <Panel>
        <PanelHeader
          title="Order register"
          sub="Search matches order number, customer PO reference, customer name or code, and the source quotation."
          right={<Overline>{formatCount(rows.length)} shown</Overline>}
        />
        <FilterBar>
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <InlineLabel>Search</InlineLabel>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
              <TextInput
                value={f.q}
                onChange={(e) => setF({ ...f, q: e.target.value })}
                className="pl-7"
                placeholder="Order, PO reference or customer"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Status</InlineLabel>
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-40">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Fulfilment</InlineLabel>
            <Select value={f.fulfilment} onChange={(e) => setF({ ...f, fulfilment: e.target.value })} className="w-44">
              <option value="">Any fulfilment</option>
              {FULFILMENTS.map((s) => <option key={s} value={s}>{FULFILMENT_LABEL[s]}</option>)}
            </Select>
          </label>
          {!lockBranchId ? (
            <label className="flex flex-col gap-1">
              <InlineLabel>Branch</InlineLabel>
              <Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} className="w-44">
                <option value="">All branches</option>
                {w.ds.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </label>
          ) : null}
          {perms.ownOnly ? null : (
            <label className="flex flex-col gap-1">
              <InlineLabel>Executive</InlineLabel>
              <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} className="w-48">
                <option value="">All executives</option>
                {w.ds.users
                  .filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER")
                  .filter((u) => (lockBranchId ? u.branchId === lockBranchId : true))
                  .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <InlineLabel>Vertical</InlineLabel>
            <Select value={f.vertical} onChange={(e) => setF({ ...f, vertical: e.target.value })} className="w-44">
              <option value="">All verticals</option>
              {VERTICALS.map((v) => <option key={v} value={v}>{VERTICAL_LABEL[v]}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>View</InlineLabel>
            <Select value={f.book} onChange={(e) => setF({ ...f, book: e.target.value })} className="w-52">
              <option value="">Every order</option>
              <option value="open">Open order book only</option>
              <option value="nopo">No customer PO recorded</option>
            </Select>
          </label>
          {active.length > 0 ? <Btn onClick={() => setF(EMPTY)}>Clear filters</Btn> : null}
        </FilterBar>

        {scoped.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No sales orders in your scope"
            body={`An order exists only where a quotation was won. ${scopeNote ? scopeNote : "Nothing has converted yet."} Win an offer on the pipeline board and the order is raised with every line carried across.`}
            action={<LinkBtn href="/sales/pipeline" variant="primary">Open the pipeline board</LinkBtn>}
          />
        ) : rows.length === 0 ? (
          <FilteredEmpty noun="orders" activeFilters={active} onClear={() => setF(EMPTY)} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Order date</Th>
                <Th>Customer</Th>
                <Th>Customer PO</Th>
                <Th>Executive</Th>
                <Th right>Order value</Th>
                <Th>Despatched</Th>
                <Th right>Advance</Th>
                <Th right>In order book</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((v) => (
                <Tr key={v.order.id}>
                  <Td mono>
                    <Link href={`/sales/orders/${v.order.id}`} className="text-text-hi hover:underline">
                      {v.order.number}
                    </Link>
                  </Td>
                  <Td>{formatDate(v.order.orderDate)}</Td>
                  <Td className="max-w-56 truncate text-text-hi">
                    <Link href={`/sales/customers/${v.order.customerId}`} className="hover:underline">
                      {v.customer?.legalName ?? "Unknown customer"}
                    </Link>
                  </Td>
                  <Td>
                    {v.order.customerPoRef.trim() ? (
                      <span className="flex flex-col">
                        <span className="t-mono text-text-mid">{v.order.customerPoRef}</span>
                        <span className="text-text-lo">{formatDate(v.order.customerPoDate)}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-warn">
                        <FileWarning className="size-3.5 shrink-0" aria-hidden />
                        Not recorded
                      </span>
                    )}
                  </Td>
                  <Td className="max-w-40 truncate">{v.owner?.name ?? "—"}</Td>
                  <Td right className="text-text-hi" title={formatINR(v.value)}>{abbreviateINR(v.value)}</Td>
                  <Td>
                    <span className="flex w-36 flex-col gap-1">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        {React.createElement(FULFILMENT_ICON[v.fulfilment], {
                          className: cn(
                            "size-3.5 shrink-0",
                            v.fulfilment === "COMPLETE" ? "text-ok" : v.fulfilment === "PARTIAL" ? "text-warn" : "text-text-lo",
                          ),
                        })}
                        <span className="tabular-nums">{formatPercent(v.deliveredPct, 0)}</span>
                        <span className="text-text-lo">{FULFILMENT_LABEL[v.fulfilment].toLowerCase()}</span>
                      </span>
                      <Meter pct={v.deliveredPct} tone={v.fulfilment === "COMPLETE" ? "ok" : v.fulfilment === "PARTIAL" ? "warn" : "info"} />
                    </span>
                  </Td>
                  <Td right title={formatINR(v.order.advanceReceived)}>
                    {v.order.advanceReceived > 0 ? (
                      <span>
                        {abbreviateINR(v.order.advanceReceived)}
                        <span className="block text-text-lo">{formatPercent(v.advancePct, 0)}</span>
                      </span>
                    ) : (
                      <span className="text-text-lo">Nil</span>
                    )}
                  </Td>
                  <Td right title={formatINR(v.orderBookValue)}>
                    {v.inOrderBook ? (
                      <span className="text-text-hi">{abbreviateINR(v.orderBookValue)}</span>
                    ) : (
                      <span className="text-text-lo">Out of book</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge tone={ORDER_STATUS_TONE[v.order.status]}>{STATUS_LABEL[v.order.status]}</StatusBadge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        {rows.length > 200 ? (
          <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
            Showing the first 200 of {formatCount(rows.length)} by order date. Narrow the filters to reach the rest.
          </p>
        ) : null}
      </Panel>

      <RecentDespatches rows={scoped} />
    </div>
  );
}

/* ------------------------------------------------- part-despatched digest */

function RecentDespatches({ rows }: { rows: OrderView[] }) {
  const partial = rows
    .filter((v) => v.fulfilment === "PARTIAL")
    .sort((a, b) => b.unfulfilledValue - a.unfulfilledValue)
    .slice(0, 6);

  return (
    <Panel>
      <PanelHeader
        title="Orders part despatched"
        sub="Some lines have gone out and some are still owed — the balance sits in the order book until it is invoiced."
        right={<Overline>{formatCount(partial.length)} shown</Overline>}
      />
      {partial.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No order is sitting half despatched"
          body="Every order in scope is either untouched or gone out in full. Nothing is stuck mid-fulfilment."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {partial.map((v) => (
            <li key={v.order.id} className="bg-surface-1">
              <Link
                href={`/sales/orders/${v.order.id}`}
                style={{ ["--accent" as string]: VERTICAL_TOKEN[v.order.vertical] }}
                className="accent-rail lift flex h-full items-start gap-2 py-3 pl-4 pr-3 hover:bg-surface-2"
              >
                <Truck className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="t-body block truncate text-text-hi">{v.customer?.legalName ?? "Unknown customer"}</span>
                  <span className="t-mono block truncate text-[0.75rem] text-text-lo">{v.order.number}</span>
                  <span className="t-body-sm mt-1 block text-text-mid">
                    {formatPercent(v.deliveredPct, 0)} despatched ·{" "}
                    <span className="tabular-nums">{abbreviateINR(v.unfulfilledValue)}</span> still owed
                  </span>
                </span>
                <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------- skeleton */

/** Matches the final geometry: header, hero book, four stats, the register. */
function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">Sales orders</h1>
        <Skeleton className="mt-2 h-2.5 w-[30rem] max-w-full" />
      </div>
      <div className="panel-hero p-5">
        <Skeleton className="h-2 w-36" />
        <Skeleton className="mt-3 h-9 w-44" />
        <Skeleton className="mt-3 h-2 w-[28rem] max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Panel key={i} className="p-3">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="mt-3 h-6 w-24" />
            <Skeleton className="mt-2 h-2 w-32" />
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="mt-2 h-2 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2.5">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-40" />)}
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3" style={{ height: "var(--row-h, 36px)" }}>
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2.5 w-44" />
            <Skeleton className="ml-auto h-2.5 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </Panel>
      <span className="sr-only" role="status">
        <Wallet className="size-3" aria-hidden /> Loading the sales order register.
      </span>
    </div>
  );
}
