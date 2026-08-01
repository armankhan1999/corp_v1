"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Plus, Search, Users } from "lucide-react";
import { abbreviateINR, formatCount, formatDate } from "@/lib/format";
import { Panel, PanelHeader, StatusBadge, EmptyState, Overline } from "@/components/patterns/primitives";
import type * as T from "@/lib/schemas/entities";
import { customerExposure } from "./calc";
import { inScope, permissionsOf, scopeNoteFor, useSalesSession } from "./session";
import { useSalesStore, retryLoad } from "./store";
import { CustomerFormModal } from "./CustomerForm";
import {
  Btn, ErrorPanel, FilterBar, FilteredEmpty, InlineLabel, PageHeader, PageSkeleton,
  Select, Stat, TableFrame, TextInput, Th, Td, Tr,
} from "./ui";

const TYPES: T.Customer["type"][] = ["INDUSTRIAL", "INSTITUTIONAL", "GOVERNMENT", "DEALER", "RETAIL"];

export function CustomersPage() {
  const store = useSalesStore();
  const session = useSalesSession();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T.Customer | undefined>(undefined);

  if (store.status === "loading" || !session) return <PageSkeleton title="Customers" cols={8} />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  const w = store.world;
  const perms = permissionsOf(session);
  const branchName = w.branchById.get(perms.branchId)?.name ?? "your branch";
  const scopeNote = scopeNoteFor(perms, "customers", branchName);
  const lockBranchId = perms.scope("customers") === "BRANCH" ? perms.branchId : null;

  // RBAC-2 — a branch manager's list returns only that branch. E3-S1 AC-6.
  const scoped = w.customers.filter((c) => inScope(perms, "customers", c));

  const filters: string[] = [];
  if (q) filters.push(`search "${q}"`);
  if (type) filters.push(`type ${type.toLowerCase()}`);
  if (branch) filters.push(`branch ${w.branchById.get(branch)?.name ?? branch}`);
  if (owner) filters.push(`executive ${w.userById.get(owner)?.name ?? owner}`);
  if (status) filters.push(`status ${status}`);

  const needle = q.trim().toLowerCase();
  const rows = scoped.filter((c) => {
    if (needle && ![c.legalName, c.tradeName, c.code, c.gstin ?? "", c.industry].some((v) => v.toLowerCase().includes(needle))) return false;
    if (type && c.type !== type) return false;
    if (branch && c.branchId !== branch) return false;
    if (owner && c.ownerUserId !== owner) return false;
    if (status === "active" && !c.active) return false;
    if (status === "inactive" && c.active) return false;
    return true;
  });

  const exposures = new Map(rows.map((c) => [c.id, customerExposure(w.ds, c.id, w.now, c.creditLimit)]));
  const totalOutstanding = [...exposures.values()].reduce((s, e) => s + e.outstanding, 0);
  const overLimit = rows.filter((c) => exposures.get(c.id)?.exceeded);
  const showMoney = perms.can("invoices") || perms.can("receivables");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        lead="Every customer, its premises and its people. Machines, tickets and invoices attach here — one record, not four spreadsheets."
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{formatCount(scoped.length)} in scope</StatusBadge>
            {scopeNote ? <StatusBadge tone="info">{scopeNote}</StatusBadge> : null}
          </>
        }
        right={
          perms.canCreate("customers") ? (
            <Btn variant="primary" onClick={() => { setEditing(undefined); setFormOpen(true); }}>
              <Plus className="size-3.5" aria-hidden /> New customer
            </Btn>
          ) : null
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Customers in scope" value={formatCount(scoped.length)} sub={`${scoped.filter((c) => c.active).length} active`} /></li>
        <li><Stat label="Institutional & government" value={formatCount(scoped.filter((c) => c.type === "INSTITUTIONAL" || c.type === "GOVERNMENT").length)} sub="Longest credit terms" /></li>
        {showMoney ? (
          <>
            <li>
              <Stat
                label="Outstanding on filtered set"
                value={abbreviateINR(totalOutstanding)}
                sub="Invoice totals less receipts less credit notes"
                href="/commercial/receivables"
                tone={totalOutstanding > 0 ? "warn" : undefined}
              />
            </li>
            <li>
              <Stat
                label="Over credit limit"
                value={formatCount(overLimit.length)}
                sub={overLimit.length ? "Exposure exceeds the sanctioned limit" : "All exposures within limit"}
                tone={overLimit.length ? "danger" : "ok"}
              />
            </li>
          </>
        ) : (
          <li className="lg:col-span-2">
            <Stat label="Commercial figures" value="Not visible" sub="Your role holds no invoice or receivables access, so exposure is omitted." />
          </li>
        )}
      </ul>

      <Panel>
        <PanelHeader
          title="Customer register"
          sub="Search matches legal name, trade name, code, GSTIN and industry."
          right={<Overline>{formatCount(rows.length)} shown</Overline>}
        />
        <FilterBar>
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <InlineLabel>Search</InlineLabel>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} className="pl-7" placeholder="Name, code or GSTIN" />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Type</InlineLabel>
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-40">
              <option value="">All types</option>
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </Select>
          </label>
          {!lockBranchId ? (
            <label className="flex flex-col gap-1">
              <InlineLabel>Branch</InlineLabel>
              <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-44">
                <option value="">All branches</option>
                {w.ds.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <InlineLabel>Executive</InlineLabel>
            <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-48">
              <option value="">All executives</option>
              {w.ds.users.filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Status</InlineLabel>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
          {filters.length > 0 ? (
            <Btn onClick={() => { setQ(""); setType(""); setBranch(""); setOwner(""); setStatus(""); }}>Clear filters</Btn>
          ) : null}
        </FilterBar>

        {scoped.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers in your scope yet"
            body={`This session returns ${scopeNote ? scopeNote.toLowerCase() : "all records"}. Create the first customer to start attaching sites, machines and invoices to it.`}
            action={perms.canCreate("customers") ? <Btn variant="primary" onClick={() => setFormOpen(true)}><Plus className="size-3.5" aria-hidden /> New customer</Btn> : undefined}
          />
        ) : rows.length === 0 ? (
          <FilteredEmpty
            noun="customers"
            activeFilters={filters}
            onClear={() => { setQ(""); setType(""); setBranch(""); setOwner(""); setStatus(""); }}
          />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Customer</Th>
                <Th>Type</Th>
                <Th>GSTIN</Th>
                <Th>Branch</Th>
                <Th>Executive</Th>
                <Th right>Credit terms</Th>
                <Th right>Credit limit</Th>
                {showMoney ? <Th right>Outstanding</Th> : null}
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((c) => {
                const e = exposures.get(c.id);
                return (
                  <Tr key={c.id}>
                    <Td mono>{c.code}</Td>
                    <Td className="text-text-hi">
                      <Link href={`/sales/customers/${c.id}`} className="hover:underline">{c.legalName}</Link>
                      {c.tradeName !== c.legalName ? <span className="block text-text-lo">{c.tradeName}</span> : null}
                    </Td>
                    <Td>{c.type.charAt(0) + c.type.slice(1).toLowerCase()}</Td>
                    <Td mono>{c.gstin ?? <span className="text-text-lo">Export — no GSTIN</span>}</Td>
                    <Td>{w.branchById.get(c.branchId)?.city ?? "—"}</Td>
                    <Td>{w.userById.get(c.ownerUserId)?.name ?? "—"}</Td>
                    <Td right>{c.creditTermDays} d</Td>
                    <Td right>{abbreviateINR(c.creditLimit)}</Td>
                    {showMoney ? (
                      <Td right>
                        {e && e.outstanding > 0 ? (
                          <Link href={`/sales/customers/${c.id}#invoices`} className={e.exceeded ? "text-danger underline underline-offset-2" : "underline decoration-line-strong underline-offset-2"}>
                            {abbreviateINR(e.outstanding)}
                          </Link>
                        ) : (
                          <span className="text-text-lo">—</span>
                        )}
                      </Td>
                    ) : null}
                    <Td>
                      {e?.exceeded ? (
                        <StatusBadge tone="danger">Over limit</StatusBadge>
                      ) : c.active ? (
                        <StatusBadge tone="ok">Active</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Inactive</StatusBadge>
                      )}
                    </Td>
                    <Td>
                      {perms.canWrite("customers") ? (
                        <Btn size="sm" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }}>Edit</Btn>
                      ) : null}
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
        <PanelHeader title="Recently added" sub="The newest records on the register, by creation date." />
        <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {[...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((c) => (
            <li key={c.id} className="bg-surface-1">
              <Link href={`/sales/customers/${c.id}`} className="flex items-start gap-2 p-3 hover:bg-surface-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-text-lo" aria-hidden />
                <span className="min-w-0">
                  <span className="t-body block truncate text-text-hi">{c.legalName}</span>
                  <span className="t-body-sm block text-text-lo">
                    {c.industry} · added {formatDate(c.createdAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <CustomerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        world={w}
        actor={perms.actor}
        customer={editing}
        lockBranchId={lockBranchId}
      />
    </div>
  );
}
