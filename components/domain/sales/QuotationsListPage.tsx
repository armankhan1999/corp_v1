"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Search, TriangleAlert } from "lucide-react";
import type { QuotationStatus, Vertical } from "@/lib/schemas/enums";
import { VERTICAL_LABEL } from "@/lib/schemas/enums";
import { abbreviateINR, daysBetween, enumLabel, formatCount, formatDate, formatINR, formatPercent } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import * as D from "@/lib/derive";
import {
  QUOTATION_STATUS_ORDER, QUOTATION_TONE, VERTICALS, autoExpired, derivePlaceOfSupply,
  effectiveStatus, isOpenQuotation, labelStatus, quotationTotals, validityEnd,
} from "./calc";
import { inScope, permissionsOf, scopeNoteFor, useSalesSession } from "./session";
import { linesOf, retryLoad, useSalesStore } from "./store";
import {
  Btn, ErrorPanel, FilterBar, FilteredEmpty, InlineLabel, LinkBtn, Notice, PageHeader,
  PageSkeleton, Select, Stat, TableFrame, TextInput, Th, Td, Tr,
} from "./ui";

interface Filters extends Record<string, string> {
  q: string; status: string; owner: string; branch: string; vertical: string; validity: string;
}
const EMPTY: Filters = { q: "", status: "", owner: "", branch: "", vertical: "", validity: "" };

export function QuotationsListPage() {
  const store = useSalesStore();
  const session = useSalesSession();
  const [f, setF] = React.useState<Filters>(EMPTY);

  if (store.status === "loading" || !session) return <PageSkeleton title="Quotations" cols={9} />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  const w = store.world;
  const perms = permissionsOf(session);
  const scopeNote = scopeNoteFor(perms, "quotations", w.branchById.get(perms.branchId)?.name ?? "your branch");

  const scoped = w.quotations.filter((q) => inScope(perms, "quotations", q));

  const rows = scoped
    .map((q) => {
      const lines = linesOf(w, q.id);
      const pos = derivePlaceOfSupply(w.customerById.get(q.customerId), q.siteId ? w.siteById.get(q.siteId) : undefined);
      const totals = quotationTotals(lines, pos.treatment);
      return {
        q, totals,
        status: effectiveStatus(q, w.now),
        lapsed: autoExpired(q, w.now),
        ageDays: Math.max(0, daysBetween(q.quotationDate, w.now)),
      };
    })
    .filter((r) => {
      const n = f.q.trim().toLowerCase();
      const cust = w.customerById.get(r.q.customerId);
      if (n && ![r.q.number, cust?.legalName ?? "", cust?.code ?? ""].some((v) => v.toLowerCase().includes(n))) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.owner && r.q.ownerUserId !== f.owner) return false;
      if (f.branch && r.q.branchId !== f.branch) return false;
      if (f.vertical && r.q.vertical !== f.vertical) return false;
      if (f.validity === "live" && !isOpenQuotation(r.q, w.now)) return false;
      if (f.validity === "lapsed" && !r.lapsed) return false;
      return true;
    })
    .sort((a, b) => b.q.quotationDate.localeCompare(a.q.quotationDate));

  const active: string[] = [];
  if (f.q) active.push(`search "${f.q}"`);
  if (f.status) active.push(`state ${labelStatus(f.status as QuotationStatus)}`);
  if (f.owner) active.push(`owner ${w.userById.get(f.owner)?.name ?? f.owner}`);
  if (f.branch) active.push(`branch ${w.branchById.get(f.branch)?.name ?? f.branch}`);
  if (f.vertical) active.push(`vertical ${VERTICAL_LABEL[f.vertical as Vertical]}`);
  if (f.validity) active.push(f.validity === "live" ? "live offers only" : "lapsed offers only");

  const allRows = scoped.map((q) => ({ q, status: effectiveStatus(q, w.now), lapsed: autoExpired(q, w.now) }));
  const lapsedCount = allRows.filter((r) => r.lapsed).length;
  const openRows = rows.filter((r) => isOpenQuotation(r.q, w.now));
  const openValue = openRows.reduce((s, r) => s + r.totals.grandTotal, 0);
  const lapsedValue = rows.filter((r) => r.lapsed).reduce((s, r) => s + r.totals.grandTotal, 0);
  const fy = D.fyToDate(w.now);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quotations"
        lead="Every offer this business has made, with the version that was actually sent and the state it is in today."
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{formatCount(scoped.length)} in scope</StatusBadge>
            {scopeNote ? <StatusBadge tone="info">{scopeNote}</StatusBadge> : null}
          </>
        }
        right={<LinkBtn href="/sales/enquiries" variant="primary">Start from an enquiry</LinkBtn>}
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Open offers" value={formatCount(openRows.length)} sub="Draft, pending, issued or in negotiation" /></li>
        <li><Stat label="Open pipeline value" value={abbreviateINR(openValue)} sub="Lapsed offers excluded by rule" /></li>
        <li>
          <Stat
            label="Win rate — FY to date"
            value={formatPercent(D.quotationWinRate(w.ds, fy))}
            sub="Won ÷ (won + lost) on quotation date"
            href="/analytics/sales"
          />
        </li>
        <li>
          <Stat
            label="Lapsed past validity"
            value={formatCount(lapsedCount)}
            sub={`${abbreviateINR(lapsedValue)} dropped out of open value`}
            tone={lapsedCount > 0 ? "warn" : "ok"}
          />
        </li>
      </ul>

      {lapsedCount > 0 ? (
        <Notice tone="warn" icon={TriangleAlert} title={`${lapsedCount} issued offers have passed their validity date`}>
          The platform evaluates validity rather than storing a status, so each of these reads Expired, is excluded
          from open pipeline value and cannot be marked Won. Revising one to a new version with fresh validity is the
          only way forward — that gap is the leakage this epic exists to expose.{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => setF({ ...EMPTY, validity: "lapsed" })}>
            Show them
          </button>
        </Notice>
      ) : null}

      <Panel>
        <PanelHeader
          title="Quotation register"
          sub="State is derived on read — an offer past its validity date reports Expired regardless of what was stored."
          right={<Overline>{formatCount(rows.length)} shown</Overline>}
        />
        <FilterBar>
          <label className="flex min-w-52 flex-1 flex-col gap-1">
            <InlineLabel>Search</InlineLabel>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
              <TextInput value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="pl-7" placeholder="Quotation number or customer" />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>State</InlineLabel>
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-44">
              <option value="">All states</option>
              {QUOTATION_STATUS_ORDER.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Validity</InlineLabel>
            <Select value={f.validity} onChange={(e) => setF({ ...f, validity: e.target.value })} className="w-40">
              <option value="">Any</option>
              <option value="live">Live offers only</option>
              <option value="lapsed">Lapsed on validity</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Owner</InlineLabel>
            <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} className="w-44">
              <option value="">All owners</option>
              {w.ds.users.filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </label>
          {perms.visibleBranchIds === null ? (
            <label className="flex flex-col gap-1">
              <InlineLabel>Branch</InlineLabel>
              <Select value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} className="w-40">
                <option value="">All branches</option>
                {w.ds.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <InlineLabel>Vertical</InlineLabel>
            <Select value={f.vertical} onChange={(e) => setF({ ...f, vertical: e.target.value })} className="w-40">
              <option value="">All verticals</option>
              {VERTICALS.map((v) => <option key={v} value={v}>{VERTICAL_LABEL[v]}</option>)}
            </Select>
          </label>
          {active.length > 0 ? <Btn onClick={() => setF(EMPTY)}>Clear filters</Btn> : null}
        </FilterBar>

        {scoped.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotations in your scope"
            body="Quotations are raised from an enquiry, so the pipeline always knows where an offer came from."
            action={<LinkBtn href="/sales/enquiries" variant="primary">Open enquiries</LinkBtn>}
          />
        ) : rows.length === 0 ? (
          <FilteredEmpty noun="quotations" activeFilters={active} onClear={() => setF(EMPTY)} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Quotation</Th><Th>Ver</Th><Th>Customer</Th><Th>Vertical</Th><Th>Date</Th>
                <Th>Valid until</Th><Th right>Discount</Th><Th right>Value</Th><Th right>Age</Th>
                <Th>State</Th><Th>Order</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map(({ q, totals, status, lapsed, ageDays }) => {
                const order = w.orderByQuotation.get(q.id);
                return (
                  <Tr key={q.id} className={lapsed ? "bg-warn-bg/30" : undefined}>
                    <Td mono>
                      <Link href={`/sales/quotations/${q.id}`} className="text-text-hi hover:underline">{q.number}</Link>
                    </Td>
                    <Td mono>v{q.version}</Td>
                    <Td className="max-w-64 truncate text-text-hi">
                      <Link href={`/sales/customers/${q.customerId}`} className="hover:underline">
                        {w.customerById.get(q.customerId)?.legalName ?? "—"}
                      </Link>
                    </Td>
                    <Td>{VERTICAL_LABEL[q.vertical]}</Td>
                    <Td>{formatDate(q.quotationDate)}</Td>
                    <Td className={lapsed ? "text-warn" : undefined}>{formatDate(validityEnd(q))}</Td>
                    <Td right className={totals.effectiveDiscountPct > 10 ? "text-danger" : totals.effectiveDiscountPct > 5 ? "text-warn" : undefined}>
                      {formatPercent(totals.effectiveDiscountPct, 2)}
                    </Td>
                    <Td right className="text-text-hi">{formatINR(totals.grandTotal)}</Td>
                    <Td right>{ageDays} d</Td>
                    <Td>
                      <StatusBadge tone={QUOTATION_TONE[status]}>{labelStatus(status)}</StatusBadge>
                      {lapsed ? <span className="t-body-sm ml-1 text-text-lo">auto</span> : null}
                    </Td>
                    <Td mono>
                      {order ? <Link href={`/sales/orders/${order.id}`} className="hover:underline">{order.number}</Link> : <span className="text-text-lo">—</span>}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableFrame>
        )}
        {rows.length > 200 ? (
          <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
            Showing the first 200 of {formatCount(rows.length)}. Narrow the filters to reach the rest.
          </p>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader title="State distribution" sub="Derived state, not stored state." />
        <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-7">
          {QUOTATION_STATUS_ORDER.map((s) => {
            const list = allRows.filter((r) => r.status === s);
            return (
              <li key={s} className="bg-surface-1">
                <button
                  type="button"
                  onClick={() => setF({ ...EMPTY, status: s })}
                  className="flex w-full flex-col gap-1 p-3 text-left hover:bg-surface-2"
                >
                  <Overline>{labelStatus(s)}</Overline>
                  <span className="t-display-md tabular-nums text-text-hi">{formatCount(list.length)}</span>
                  <span className="t-body-sm text-text-lo">{enumLabel(s)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
