"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bookmark, BookmarkPlus, Check, Inbox, MessageSquare, Plus, Search, Trash2, UserPlus,
} from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import type { ProductLine, Vertical } from "@/lib/schemas/enums";
import { PRODUCT_LINE_LABEL, VERTICAL_LABEL } from "@/lib/schemas/enums";
import { abbreviateINR, daysBetween, enumLabel, formatCount, formatDate, isValidGSTIN } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { GSTIN_HINT, GSTIN_PATTERN, STATE_BY_CODE, VERTICALS, ageingOf } from "./calc";
import { inScope, permissionsOf, scopeNoteFor, useSalesSession } from "./session";
import {
  assignEnquiry, createCustomer, createEnquiry, createQuotationFromEnquiry, createSite,
  deleteSavedView, retryLoad, saveEnquiryView, useSalesStore, type SalesWorld, type Actor,
} from "./store";
import { FollowUpDialog, type FollowUpSubject } from "./FollowUp";
import {
  Btn, ErrorPanel, Field, FilterBar, FilteredEmpty, InlineLabel, Modal, Notice, NumberInput,
  PageHeader, PageSkeleton, Select, Stat, TableFrame, TextArea, TextInput, Th, Td, Tr,
} from "./ui";

const SOURCES: T.Enquiry["source"][] = ["PHONE", "WEBSITE", "WHATSAPP", "WALK_IN", "REFERRAL", "EXHIBITION", "OEM_LEAD"];
const STATUSES: T.Enquiry["status"][] = ["NEW", "QUALIFIED", "QUOTED", "NEGOTIATION", "WON", "LOST", "DROPPED"];
const COMPRESSOR_LINES: ProductLine[] = [
  "PISTON_COMPRESSOR", "SCREW_COMPRESSOR", "OIL_FREE_COMPRESSOR",
  "PORTABLE_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR",
];
const EQUIPMENT_LINES: ProductLine[] = [
  ...COMPRESSOR_LINES, "AIR_ACCESSORY", "PUMP", "BODY_SHOP_EQUIPMENT", "LUBE_EQUIPMENT",
  "WASHING_EQUIPMENT", "LIFTING_EQUIPMENT", "PNEUMATIC_TOOL", "TYRE_INFLATOR", "PPR_PIPING",
];

interface Filters extends Record<string, string> {
  q: string; branch: string; owner: string; source: string; vertical: string; status: string; age: string;
}
const EMPTY: Filters = { q: "", branch: "", owner: "", source: "", vertical: "", status: "", age: "" };

const AGE_BUCKETS: { value: string; label: string; test: (d: number) => boolean }[] = [
  { value: "0-7", label: "0–7 days", test: (d) => d <= 7 },
  { value: "8-30", label: "8–30 days", test: (d) => d > 7 && d <= 30 },
  { value: "31-90", label: "31–90 days", test: (d) => d > 30 && d <= 90 },
  { value: "90+", label: "Over 90 days", test: (d) => d > 90 },
];

export function EnquiriesPage() {
  const store = useSalesStore();
  const session = useSalesSession();
  const [f, setF] = React.useState<Filters>(EMPTY);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [viewName, setViewName] = React.useState("");
  const [followUp, setFollowUp] = React.useState<FollowUpSubject | null>(null);
  const [assigning, setAssigning] = React.useState<T.Enquiry | null>(null);

  if (store.status === "loading" || !session) return <PageSkeleton title="Enquiries" cols={9} />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  const w = store.world;
  const perms = permissionsOf(session);
  const branchName = w.branchById.get(perms.branchId)?.name ?? "your branch";
  const scopeNote = scopeNoteFor(perms, "enquiries", branchName);

  const scoped = w.enquiries.filter((e) => {
    // E3-S3 AC-3 — an unassigned enquiry is excluded from any executive's
    // personal pipeline but stays visible to the branch manager.
    if (!e.ownerUserId) return perms.scope("enquiries") !== "OWN" && (perms.visibleBranchIds === null || e.branchId === perms.branchId);
    return inScope(perms, "enquiries", e);
  });

  const unassigned = w.enquiries
    .filter((e) => !e.ownerUserId && (perms.visibleBranchIds === null || e.branchId === perms.branchId))
    .filter(() => perms.scope("enquiries") !== "OWN")
    .map((e) => ({ e, age: Math.max(0, daysBetween(e.createdAt, w.now)) }))
    .sort((a, b) => b.age - a.age);

  const needle = f.q.trim().toLowerCase();
  const rows = scoped.filter((e) => {
    const cust = w.customerById.get(e.customerId);
    if (needle && ![e.number, e.requirement, cust?.legalName ?? "", cust?.code ?? ""].some((v) => v.toLowerCase().includes(needle))) return false;
    if (f.branch && e.branchId !== f.branch) return false;
    if (f.owner && (f.owner === "__none" ? !!e.ownerUserId : e.ownerUserId !== f.owner)) return false;
    if (f.source && e.source !== f.source) return false;
    if (f.vertical && e.vertical !== f.vertical) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.age) {
      const bucket = AGE_BUCKETS.find((b) => b.value === f.age);
      if (bucket && !bucket.test(Math.max(0, daysBetween(e.createdAt, w.now)))) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const active: string[] = [];
  if (f.q) active.push(`search "${f.q}"`);
  if (f.branch) active.push(`branch ${w.branchById.get(f.branch)?.name ?? f.branch}`);
  if (f.owner) active.push(f.owner === "__none" ? "unassigned only" : `owner ${w.userById.get(f.owner)?.name ?? f.owner}`);
  if (f.source) active.push(`source ${enumLabel(f.source)}`);
  if (f.vertical) active.push(`vertical ${VERTICAL_LABEL[f.vertical as Vertical]}`);
  if (f.status) active.push(`status ${enumLabel(f.status)}`);
  if (f.age) active.push(`age ${AGE_BUCKETS.find((b) => b.value === f.age)?.label ?? f.age}`);

  const openValue = rows.filter((e) => !["WON", "LOST", "DROPPED"].includes(e.status)).reduce((s, e) => s + e.expectedValue, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Enquiries"
        lead="Every enquiry carries a source and an accountable owner, so demand cannot leak before it reaches a quotation."
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{formatCount(scoped.length)} in scope</StatusBadge>
            {scopeNote ? <StatusBadge tone="info">{scopeNote}</StatusBadge> : null}
            {unassigned.length > 0 ? <StatusBadge tone="warn">{unassigned.length} unassigned</StatusBadge> : null}
          </>
        }
        right={
          perms.canCreate("enquiries") ? (
            <Btn variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden /> Capture enquiry
            </Btn>
          ) : null
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Enquiries in scope" value={formatCount(scoped.length)} sub={`${scoped.filter((e) => e.status === "NEW").length} not yet worked`} /></li>
        <li><Stat label="Open expected value" value={abbreviateINR(openValue)} sub="Excludes won, lost and dropped" href="/sales/pipeline" /></li>
        <li>
          <Stat
            label="Unassigned queue"
            value={formatCount(unassigned.length)}
            sub={unassigned.length ? `Oldest ${unassigned[0]!.age} days` : "Everything has an owner"}
            tone={unassigned.some((u) => u.age > 3) ? "danger" : unassigned.length ? "warn" : "ok"}
          />
        </li>
        <li><Stat label="Converted" value={formatCount(scoped.filter((e) => e.status === "WON").length)} sub="Enquiries that became orders" /></li>
      </ul>

      {/* Unassigned queue — E3-S3 AC-3 */}
      {perms.scope("enquiries") !== "OWN" ? (
        <Panel>
          <PanelHeader
            title="Unassigned queue"
            sub="Visible to the branch manager, excluded from every executive's personal pipeline until an owner is set."
            right={<Overline>{formatCount(unassigned.length)} waiting</Overline>}
          />
          {unassigned.length === 0 ? (
            <EmptyState icon={Inbox} title="Queue is clear" body="Every enquiry in your scope carries an accountable owner. Nothing is waiting for allocation." />
          ) : (
            <TableFrame>
              <thead><tr><Th>Enquiry</Th><Th>Customer</Th><Th>Source</Th><Th>Vertical</Th><Th right>Expected value</Th><Th right>Age</Th><Th>Ageing</Th><Th /></tr></thead>
              <tbody>
                {unassigned.map(({ e, age }) => {
                  const state = ageingOf("ENQUIRY", age);
                  return (
                    <Tr key={e.id} className={state === "ESCALATE" ? "bg-danger-bg/40" : state === "WARN" ? "bg-warn-bg/40" : undefined}>
                      <Td mono>{e.number}</Td>
                      <Td className="text-text-hi">
                        <Link href={`/sales/customers/${e.customerId}`} className="hover:underline">
                          {w.customerById.get(e.customerId)?.legalName ?? "—"}
                        </Link>
                      </Td>
                      <Td>{enumLabel(e.source)}</Td>
                      <Td>{VERTICAL_LABEL[e.vertical]}</Td>
                      <Td right>{abbreviateINR(e.expectedValue)}</Td>
                      <Td right>{age} d</Td>
                      <Td>
                        <StatusBadge tone={state === "ESCALATE" ? "danger" : state === "WARN" ? "warn" : "ok"}>
                          {state === "ESCALATE" ? "Escalate" : state === "WARN" ? "Ageing" : "Fresh"}
                        </StatusBadge>
                      </Td>
                      <Td>
                        {perms.canWrite("enquiries") ? (
                          <Btn size="sm" onClick={() => setAssigning(e)}>
                            <UserPlus className="size-3.5" aria-hidden /> Assign
                          </Btn>
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableFrame>
          )}
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Enquiry register"
          sub="Filters combine. Save a combination as a named view and it stays in this browser."
          right={
            <div className="flex items-center gap-2">
              <Btn size="sm" onClick={() => { setViewName(""); setSaveOpen(true); }}>
                <BookmarkPlus className="size-3.5" aria-hidden /> Save this view
              </Btn>
              <Overline>{formatCount(rows.length)} shown</Overline>
            </div>
          }
        />

        {w.savedViews.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
            <Overline>Saved views</Overline>
            {w.savedViews.map((v) => (
              <span key={v.id} className="inline-flex items-center overflow-hidden rounded-md border border-line">
                <button
                  type="button"
                  onClick={() => setF({ ...EMPTY, ...v.filters } as Filters)}
                  className="flex items-center gap-1 px-2 py-1 text-[0.75rem] text-text-mid hover:bg-surface-3 hover:text-text-hi"
                >
                  <Bookmark className="size-3" aria-hidden /> {v.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete saved view ${v.name}`}
                  onClick={() => deleteSavedView(v.id)}
                  className="border-l border-line px-1.5 py-1 text-text-lo hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <FilterBar>
          <label className="flex min-w-52 flex-1 flex-col gap-1">
            <InlineLabel>Search</InlineLabel>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
              <TextInput value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="pl-7" placeholder="Number, customer or requirement" />
            </span>
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
            <InlineLabel>Owner</InlineLabel>
            <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} className="w-44">
              <option value="">All owners</option>
              <option value="__none">Unassigned</option>
              {w.ds.users.filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Source</InlineLabel>
            <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className="w-36">
              <option value="">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{enumLabel(s)}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Vertical</InlineLabel>
            <Select value={f.vertical} onChange={(e) => setF({ ...f, vertical: e.target.value })} className="w-40">
              <option value="">All verticals</option>
              {VERTICALS.map((v) => <option key={v} value={v}>{VERTICAL_LABEL[v]}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Status</InlineLabel>
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-36">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{enumLabel(s)}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Age</InlineLabel>
            <Select value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} className="w-36">
              <option value="">Any age</option>
              {AGE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </Select>
          </label>
          {active.length > 0 ? <Btn onClick={() => setF(EMPTY)}>Clear filters</Btn> : null}
        </FilterBar>

        {scoped.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No enquiries in your scope"
            body="Capture the first enquiry — source channel and owner are recorded on creation so nothing leaks anonymously."
            action={perms.canCreate("enquiries") ? <Btn variant="primary" onClick={() => setFormOpen(true)}><Plus className="size-3.5" aria-hidden /> Capture enquiry</Btn> : undefined}
          />
        ) : rows.length === 0 ? (
          <FilteredEmpty noun="enquiries" activeFilters={active} onClear={() => setF(EMPTY)} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Enquiry</Th><Th>Customer</Th><Th>Site</Th><Th>Source</Th><Th>Vertical</Th>
                <Th>Requirement</Th><Th right>Expected</Th><Th>Closure</Th><Th>Owner</Th>
                <Th right>Age</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((e) => {
                const age = Math.max(0, daysBetween(e.createdAt, w.now));
                const cust = w.customerById.get(e.customerId);
                const quotes = w.quotations.filter((q) => q.enquiryId === e.id);
                return (
                  <Tr key={e.id}>
                    <Td mono>{e.number}</Td>
                    <Td className="text-text-hi">
                      <Link href={`/sales/customers/${e.customerId}`} className="hover:underline">{cust?.legalName ?? "—"}</Link>
                    </Td>
                    <Td>{e.siteId ? w.siteById.get(e.siteId)?.name ?? "—" : "—"}</Td>
                    <Td>{enumLabel(e.source)}</Td>
                    <Td>{VERTICAL_LABEL[e.vertical]}</Td>
                    <Td className="max-w-72 truncate">{e.requirement}</Td>
                    <Td right>{abbreviateINR(e.expectedValue)}</Td>
                    <Td>{formatDate(e.expectedClosure)}</Td>
                    <Td>{e.ownerUserId ? w.userById.get(e.ownerUserId)?.name ?? "—" : <StatusBadge tone="warn">Unassigned</StatusBadge>}</Td>
                    <Td right>{age} d</Td>
                    <Td><StatusBadge tone={e.status === "WON" ? "ok" : e.status === "LOST" || e.status === "DROPPED" ? "danger" : e.status === "NEW" ? "neutral" : "info"}>{enumLabel(e.status)}</StatusBadge></Td>
                    <Td>
                      <span className="flex gap-1">
                        <Btn size="sm" variant="ghost" onClick={() => setFollowUp({ type: "ENQUIRY", id: e.id, label: e.number, customerId: e.customerId })}>
                          <MessageSquare className="size-3.5" aria-hidden />
                        </Btn>
                        {quotes.length > 0 ? (
                          <Link
                            href={`/sales/quotations/${quotes[quotes.length - 1]!.id}`}
                            className="inline-flex h-7 items-center rounded-md border border-line px-2 text-[0.75rem] text-text-mid hover:border-line-strong hover:text-text-hi"
                          >
                            {quotes.length} quote{quotes.length === 1 ? "" : "s"}
                          </Link>
                        ) : perms.canCreate("quotations") ? (
                          <Btn
                            size="sm"
                            onClick={() => {
                              const q = createQuotationFromEnquiry(e.id, perms.actor);
                              window.location.href = `/sales/quotations/${q.id}`;
                            }}
                          >
                            Quote
                          </Btn>
                        ) : null}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableFrame>
        )}
      </Panel>

      <EnquiryFormModal open={formOpen} onOpenChange={setFormOpen} world={w} actor={perms.actor} lockBranchId={perms.visibleBranchIds ? perms.branchId : null} />

      <Modal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save this filter set as a named view"
        description="Stored in this browser under pravaah.v1. It reappears on this screen for every session on this machine."
        footer={
          <>
            <Btn onClick={() => setSaveOpen(false)}>Cancel</Btn>
            <Btn
              variant="primary"
              onClick={() => {
                if (!viewName.trim()) return;
                saveEnquiryView(viewName.trim(), f);
                setSaveOpen(false);
              }}
            >
              <Check className="size-3.5" aria-hidden /> Save view
            </Btn>
          </>
        }
      >
        <Field label="View name" required hint={active.length ? `Captures: ${active.join(" · ")}` : "No filters are active — this view will show everything in scope."}>
          {(p) => <TextInput {...p} value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Ageing WhatsApp leads" />}
        </Field>
      </Modal>

      <Modal
        open={!!assigning}
        onOpenChange={(v) => { if (!v) setAssigning(null); }}
        title="Assign an owner"
        description={assigning ? `${assigning.number} — ${w.customerById.get(assigning.customerId)?.legalName ?? ""}` : undefined}
      >
        <p className="t-body-sm mb-3 text-text-mid">
          An enquiry with an owner leaves the unassigned queue and enters that executive&apos;s personal pipeline.
        </p>
        <div className="flex flex-col gap-2">
          {w.ds.users
            .filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER")
            .map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { if (assigning) assignEnquiry(assigning.id, u.id, perms.actor); setAssigning(null); }}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-left hover:border-line-strong hover:bg-surface-2"
              >
                <span>
                  <span className="t-body block text-text-hi">{u.name}</span>
                  <span className="t-body-sm block text-text-lo">{u.designation} · {w.branchById.get(u.branchId)?.city}</span>
                </span>
                <span className="t-body-sm text-text-lo">
                  {w.enquiries.filter((e) => e.ownerUserId === u.id && !["WON", "LOST", "DROPPED"].includes(e.status)).length} open
                </span>
              </button>
            ))}
        </div>
      </Modal>

      <FollowUpDialog
        open={!!followUp}
        onOpenChange={(v) => { if (!v) setFollowUp(null); }}
        subject={followUp}
        actor={perms.actor}
        todayIso={w.ds.meta.today}
      />
    </div>
  );
}

/* ------------------------------------------------------------ intake form */

function EnquiryFormModal({
  open, onOpenChange, world, actor, lockBranchId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; world: SalesWorld; actor: Actor; lockBranchId: string | null;
}) {
  const today = world.ds.meta.today.slice(0, 10);
  const [mode, setMode] = React.useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = React.useState("");
  const [customerQuery, setCustomerQuery] = React.useState("");
  const [siteId, setSiteId] = React.useState("");
  const [source, setSource] = React.useState<T.Enquiry["source"]>("PHONE");
  const [vertical, setVertical] = React.useState<Vertical>("EQUIPMENT_SALES");
  const [productLine, setProductLine] = React.useState<ProductLine | "">("SCREW_COMPRESSOR");
  const [requirement, setRequirement] = React.useState("");
  const [cfm, setCfm] = React.useState("");
  const [bar, setBar] = React.useState("");
  const [head, setHead] = React.useState("");
  const [flow, setFlow] = React.useState("");
  const [expectedValue, setExpectedValue] = React.useState("500000");
  const [closure, setClosure] = React.useState(today);
  const [owner, setOwner] = React.useState(actor.userId);
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});

  // Inline new customer
  const [nc, setNc] = React.useState({ legalName: "", gstin: "", type: "INDUSTRIAL" as T.Customer["type"], branchId: lockBranchId ?? world.ds.branches[0]!.id });
  const [ncSite, setNcSite] = React.useState({ name: "Main Plant", address: "", district: "", stateCode: "10" });

  React.useEffect(() => {
    if (!open) return;
    setMode("existing"); setCustomerId(""); setCustomerQuery(""); setSiteId("");
    setSource("PHONE"); setVertical("EQUIPMENT_SALES"); setProductLine("SCREW_COMPRESSOR");
    setRequirement(""); setCfm(""); setBar(""); setHead(""); setFlow("");
    setExpectedValue("500000"); setClosure(today); setOwner(actor.userId); setErrors({});
    setNc({ legalName: "", gstin: "", type: "INDUSTRIAL", branchId: lockBranchId ?? world.ds.branches[0]!.id });
    setNcSite({ name: "Main Plant", address: "", district: "", stateCode: "10" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const matches = React.useMemo(() => {
    const n = customerQuery.trim().toLowerCase();
    const pool = lockBranchId ? world.customers.filter((c) => c.branchId === lockBranchId) : world.customers;
    if (!n) return pool.slice(0, 8);
    return pool.filter((c) => `${c.legalName} ${c.code} ${c.gstin ?? ""}`.toLowerCase().includes(n)).slice(0, 8);
  }, [customerQuery, world.customers, lockBranchId]);

  const sites = customerId ? world.sitesByCustomer.get(customerId) ?? [] : [];
  const isPump = productLine === "PUMP";
  const isCompressor = COMPRESSOR_LINES.includes(productLine as ProductLine);

  function submit() {
    const next: Record<string, string | null> = {};
    let cid = customerId;

    if (mode === "new") {
      if (!nc.legalName.trim()) next.ncLegalName = "The new customer needs a legal name.";
      if (nc.gstin.trim() && !isValidGSTIN(nc.gstin)) next.ncGstin = `Expected ${GSTIN_PATTERN}. ${GSTIN_HINT}`;
      const dupe = nc.gstin.trim() ? world.customers.find((c) => c.gstin?.toUpperCase() === nc.gstin.trim().toUpperCase()) : undefined;
      if (dupe) next.ncGstin = `${dupe.legalName} (${dupe.code}) already holds this GSTIN. Pick the existing customer instead.`;
      if (!ncSite.address.trim()) next.ncAddress = "Give the site an address — assets attach to a site.";
      if (!ncSite.district.trim()) next.ncDistrict = "District is required.";
    } else if (!cid) {
      next.customer = "Pick the customer this enquiry came from, or switch to creating one inline.";
    }

    if (!requirement.trim()) next.requirement = "Describe what the customer asked for.";
    if (!Number.isFinite(Number(expectedValue)) || Number(expectedValue) <= 0) next.expectedValue = "Expected value must be above zero.";
    if (!closure) next.closure = "Give an expected closure date.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    if (mode === "new") {
      const created = createCustomer(
        {
          legalName: nc.legalName, tradeName: nc.legalName, type: nc.type,
          gstin: nc.gstin, pan: "", industry: "Engineering Workshop",
          creditTermDays: 30, creditLimit: 500000,
          branchId: nc.branchId, ownerUserId: owner || actor.userId,
          country: "IN", active: true,
        },
        actor,
      );
      cid = created.id;
      const site = createSiteInline(created.id);
      createEnquiryNow(cid, site);
      return;
    }
    createEnquiryNow(cid, siteId || null);
  }

  function createSiteInline(cid: string): string {
    const site = createSite(
      {
        customerId: cid, name: ncSite.name || "Main Plant", address: ncSite.address,
        district: ncSite.district, state: STATE_BY_CODE[ncSite.stateCode] ?? "Bihar",
        stateCode: ncSite.stateCode, pincode: "", contactPerson: "", contactPhone: "", notes: "",
      },
      actor,
    );
    return site.id;
  }

  function createEnquiryNow(cid: string, sid: string | null) {
    createEnquiry(
      {
        customerId: cid,
        siteId: sid,
        vertical,
        source,
        requirement: requirement.trim(),
        productLine: vertical === "EQUIPMENT_SALES" && productLine ? (productLine as ProductLine) : null,
        paramCfm: isCompressor && cfm ? Number(cfm) : null,
        paramBar: isCompressor && bar ? Number(bar) : null,
        paramHeadM: isPump && head ? Number(head) : null,
        paramFlowLpm: isPump && flow ? Number(flow) : null,
        expectedValue: Number(expectedValue),
        expectedClosure: new Date(`${closure}T10:00:00`).toISOString(),
        ownerUserId: owner === "__none" ? null : owner,
      },
      actor,
    );
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Capture an enquiry"
      description="Source channel, customer, site, vertical, requirement, technical parameters, expected value, closure date and owner."
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={submit}><Check className="size-3.5" aria-hidden /> Save enquiry</Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Source channel" required hint="Recorded on the audit entry so channel performance is measurable.">
          {(p) => (
            <Select {...p} value={source} onChange={(e) => setSource(e.target.value as T.Enquiry["source"])}>
              {SOURCES.map((s) => <option key={s} value={s}>{enumLabel(s)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Customer">
          {(p) => (
            <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as "existing" | "new")}>
              <option value="existing">Pick an existing customer</option>
              <option value="new">Create a new customer inline</option>
            </Select>
          )}
        </Field>

        {mode === "existing" ? (
          <>
            <Field label="Find the customer" required error={errors.customer} className="sm:col-span-2">
              {(p) => (
                <TextInput
                  {...p}
                  value={customerQuery}
                  onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId(""); }}
                  placeholder="Type a name, code or GSTIN"
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <div className="max-h-44 overflow-y-auto rounded-md border border-line">
                {matches.length === 0 ? (
                  <p className="t-body-sm px-3 py-3 text-text-lo">
                    No customer matches. Switch to creating one inline, or widen the search.
                  </p>
                ) : (
                  matches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerQuery(c.legalName); setSiteId(world.sitesByCustomer.get(c.id)?.[0]?.id ?? ""); }}
                      aria-pressed={customerId === c.id}
                      className={
                        customerId === c.id
                          ? "flex w-full items-center justify-between border-b border-line bg-primary-100 px-3 py-1.5 text-left text-text-hi last:border-b-0"
                          : "flex w-full items-center justify-between border-b border-line px-3 py-1.5 text-left text-text-mid last:border-b-0 hover:bg-surface-2 hover:text-text-hi"
                      }
                    >
                      <span className="t-body-sm truncate">{c.legalName}</span>
                      <span className="t-mono shrink-0 text-[0.75rem] text-text-lo">{c.code}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <Field label="Site" hint={customerId ? undefined : "Pick a customer first."}>
              {(p) => (
                <Select {...p} value={siteId} disabled={!customerId} onChange={(e) => setSiteId(e.target.value)}>
                  <option value="">No specific site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.district}</option>)}
                </Select>
              )}
            </Field>
          </>
        ) : (
          <>
            <Field label="New customer legal name" required error={errors.ncLegalName} className="sm:col-span-2">
              {(p) => <TextInput {...p} value={nc.legalName} onChange={(e) => setNc({ ...nc, legalName: e.target.value })} />}
            </Field>
            <Field label="GSTIN" error={errors.ncGstin} hint={`Expected ${GSTIN_PATTERN}.`}>
              {(p) => <TextInput {...p} value={nc.gstin} maxLength={15} className="t-mono uppercase" onChange={(e) => setNc({ ...nc, gstin: e.target.value.toUpperCase() })} />}
            </Field>
            <Field label="Customer type">
              {(p) => (
                <Select {...p} value={nc.type} onChange={(e) => setNc({ ...nc, type: e.target.value as T.Customer["type"] })}>
                  {(["INDUSTRIAL", "INSTITUTIONAL", "GOVERNMENT", "DEALER", "RETAIL"] as const).map((t) => (
                    <option key={t} value={t}>{enumLabel(t)}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Site address" required error={errors.ncAddress}>
              {(p) => <TextInput {...p} value={ncSite.address} onChange={(e) => setNcSite({ ...ncSite, address: e.target.value })} />}
            </Field>
            <Field label="District" required error={errors.ncDistrict}>
              {(p) => <TextInput {...p} value={ncSite.district} onChange={(e) => setNcSite({ ...ncSite, district: e.target.value })} />}
            </Field>
            <Field label="State">
              {(p) => (
                <Select {...p} value={ncSite.stateCode} onChange={(e) => setNcSite({ ...ncSite, stateCode: e.target.value })}>
                  {Object.entries(STATE_BY_CODE).map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Branch" hint={lockBranchId ? "Locked to your branch." : undefined}>
              {(p) => (
                <Select {...p} value={nc.branchId} disabled={!!lockBranchId} onChange={(e) => setNc({ ...nc, branchId: e.target.value })}>
                  {world.ds.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              )}
            </Field>
          </>
        )}

        <Field label="Vertical" required>
          {(p) => (
            <Select
              {...p}
              value={vertical}
              onChange={(e) => {
                const v = e.target.value as Vertical;
                setVertical(v);
                if (v !== "EQUIPMENT_SALES") setProductLine("");
                else if (!productLine) setProductLine("SCREW_COMPRESSOR");
              }}
            >
              {VERTICALS.map((v) => <option key={v} value={v}>{VERTICAL_LABEL[v]}</option>)}
            </Select>
          )}
        </Field>

        {vertical === "EQUIPMENT_SALES" ? (
          <Field label="Product line" hint="The technical parameters offered below change with this choice.">
            {(p) => (
              <Select {...p} value={productLine} onChange={(e) => setProductLine(e.target.value as ProductLine | "")}>
                <option value="">Not yet known</option>
                {EQUIPMENT_LINES.map((l) => <option key={l} value={l}>{PRODUCT_LINE_LABEL[l]}</option>)}
              </Select>
            )}
          </Field>
        ) : null}

        {isCompressor ? (
          <>
            <Field label="Required air delivery (CFM)" hint="Free air delivery the customer needs at the working pressure.">
              {(p) => <NumberInput {...p} value={cfm} min={0} onChange={(e) => setCfm(e.target.value)} placeholder="180" />}
            </Field>
            <Field label="Working pressure (bar)">
              {(p) => <NumberInput {...p} value={bar} min={0} step={0.1} onChange={(e) => setBar(e.target.value)} placeholder="7.5" />}
            </Field>
          </>
        ) : null}

        {isPump ? (
          <>
            <Field label="Head (m)" hint="Total dynamic head the pump must develop.">
              {(p) => <NumberInput {...p} value={head} min={0} onChange={(e) => setHead(e.target.value)} placeholder="42" />}
            </Field>
            <Field label="Flow (LPM)">
              {(p) => <NumberInput {...p} value={flow} min={0} onChange={(e) => setFlow(e.target.value)} placeholder="1200" />}
            </Field>
          </>
        ) : null}

        <Field label="Requirement" required error={errors.requirement} className="sm:col-span-2">
          {(p) => (
            <TextArea
              {...p}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="What the customer asked for, in their words."
            />
          )}
        </Field>

        <Field label="Expected value (₹)" required error={errors.expectedValue}>
          {(p) => <NumberInput {...p} value={expectedValue} min={0} step={10000} onChange={(e) => setExpectedValue(e.target.value)} />}
        </Field>
        <Field label="Expected closure" required error={errors.closure}>
          {(p) => <TextInput {...p} type="date" value={closure} onChange={(e) => setClosure(e.target.value)} />}
        </Field>
        <Field label="Owner" hint="Leave unassigned and it enters the branch manager's queue with an age indicator.">
          {(p) => (
            <Select {...p} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="__none">Leave unassigned</option>
              {world.ds.users.filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {owner === "__none" ? (
        <Notice tone="warn" title="This enquiry will be unassigned" className="mt-3">
          It will appear in the branch manager&apos;s unassigned queue with an age indicator and will be excluded from
          every executive&apos;s personal pipeline until an owner is set.
        </Notice>
      ) : null}
    </Modal>
  );
}
