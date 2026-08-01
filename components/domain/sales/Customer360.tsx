"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, Boxes, Calendar, FileText, Handshake, MessageSquare, Pencil,
  Receipt, ShieldCheck, TriangleAlert, Wrench,
} from "lucide-react";
import * as D from "@/lib/derive";
import {
  abbreviateINR, daysBetween, formatCount, formatDate, formatDateTime, formatINR,
  formatPhone, enumLabel,
} from "@/lib/format";
import { EmptyState, KeyValue, Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";

import {
  buildTimeline, customerExposure, effectiveStatus, quotationTotals, derivePlaceOfSupply,
  QUOTATION_TONE, labelStatus, type TimelineEvent,
} from "./calc";
import { permissionsOf, useSalesSession } from "./session";
import { retryLoad, useSalesStore } from "./store";
import { ContactsEditor, CustomerFormModal, SitesEditor } from "./CustomerForm";
import { FollowUpDialog, type FollowUpSubject } from "./FollowUp";
import {
  Btn, ErrorPanel, LinkBtn, Modal, Notice, PageHeader, PageSkeleton, Stat,
  TableFrame, Th, Td, Tr,
} from "./ui";

const KIND_ICON: Record<TimelineEvent["kind"], React.ComponentType<{ className?: string }>> = {
  ENQUIRY: MessageSquare, QUOTATION: FileText, ORDER: Handshake, TICKET: Wrench,
  VISIT: Wrench, INVOICE: Receipt, RECEIPT: Receipt, ACTIVITY: MessageSquare,
  AMC: ShieldCheck, DOCUMENT: FileText,
};

const COVERAGE_TONE = {
  IN_WARRANTY: "ok", UNDER_AMC: "info", OUT_OF_COVERAGE: "warn",
} as const;

export function Customer360({ customerId }: { customerId: string }) {
  const store = useSalesStore();
  const session = useSalesSession();
  const [editOpen, setEditOpen] = React.useState(false);
  const [contribOpen, setContribOpen] = React.useState(false);
  const [followUp, setFollowUp] = React.useState<FollowUpSubject | null>(null);
  const [timelineFilter, setTimelineFilter] = React.useState<"ALL" | TimelineEvent["kind"]>("ALL");

  if (store.status === "loading" || !session) return <PageSkeleton title="Customer 360" cols={6} />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  const w = store.world;
  const perms = permissionsOf(session);
  const customer = w.customerById.get(customerId);

  if (!customer) {
    return (
      <Panel className="p-2">
        <EmptyState
          icon={AlertTriangle}
          title="No such customer"
          body={`No customer with id ${customerId} exists in this dataset, or it sits outside your scope.`}
          action={<LinkBtn href="/sales/customers" variant="primary">Back to the register</LinkBtn>}
        />
      </Panel>
    );
  }

  // E3-S2 AC-6 — a section the role cannot see is omitted entirely.
  const show = {
    invoices: perms.can("invoices"),
    tickets: perms.can("tickets"),
    assets: perms.can("assets"),
    amc: perms.can("amc"),
    quotations: perms.can("quotations"),
    orders: perms.can("salesOrders"),
    documents: perms.can("vault"),
  };

  const exposure = customerExposure(w.ds, customer.id, w.now, customer.creditLimit);
  const sites = w.sitesByCustomer.get(customer.id) ?? [];
  const contacts = w.contactsByCustomer.get(customer.id) ?? [];
  const assets = w.ds.assets.filter((a) => a.customerId === customer.id);
  const openTickets = w.ds.tickets.filter((t) => t.customerId === customer.id && D.isOpenTicket(t));
  const amcs = w.ds.amcContracts.filter((a) => a.customerId === customer.id);
  const liveAmcs = amcs.filter((a) => D.amcStatus(a, w.now) === "ACTIVE" || D.amcStatus(a, w.now) === "EXPIRING");
  const quotations = w.quotations.filter((q) => q.customerId === customer.id);
  const orders = w.salesOrders.filter((o) => o.customerId === customer.id);
  const invoices = w.ds.invoices.filter((i) => i.customerId === customer.id);
  const documents = w.ds.documents.filter((d) => d.linkedType === "CUSTOMER" && d.linkedId === customer.id);
  const enquiries = w.enquiries.filter((e) => e.customerId === customer.id);

  const timeline = buildTimeline(
    w.ds, customer.id,
    { enquiries, quotations, salesOrders: orders, activities: w.activities },
    { invoices: show.invoices, tickets: show.tickets, documents: show.documents },
  );
  const timelineKinds = [...new Set(timeline.map((t) => t.kind))];
  const shownTimeline = timelineFilter === "ALL" ? timeline : timeline.filter((t) => t.kind === timelineFilter);

  const primary = contacts.find((c) => c.isPrimary);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={customer.legalName}
        lead={`${customer.industry} · ${customer.type.charAt(0)}${customer.type.slice(1).toLowerCase()} · customer since ${formatDate(customer.createdAt)}. Everything this business has ever bought, broken, owed and asked for, on one screen.`}
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{customer.code}</StatusBadge>
            {customer.gstin ? (
              <span className="t-mono text-text-mid">{customer.gstin}</span>
            ) : (
              <StatusBadge tone="sim">Export customer — no GSTIN</StatusBadge>
            )}
            {customer.active ? <StatusBadge tone="ok">Active</StatusBadge> : <StatusBadge tone="neutral">Inactive</StatusBadge>}
          </>
        }
        right={
          <>
            <Btn onClick={() => setFollowUp({ type: "CUSTOMER", id: customer.id, label: customer.legalName, customerId: customer.id })}>
              <MessageSquare className="size-3.5" aria-hidden /> Record follow-up
            </Btn>
            {perms.canWrite("customers") ? (
              <Btn variant="primary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" aria-hidden /> Edit customer
              </Btn>
            ) : null}
          </>
        }
      />

      {/* E3-S2 AC-5 — exposure against the sanctioned limit, named and quantified. */}
      {show.invoices && exposure.exceeded ? (
        <Notice tone="danger" icon={TriangleAlert} title="Credit limit exceeded">
          Exposure {formatINR(exposure.outstanding)} against a sanctioned limit of {formatINR(exposure.limit)} — over by{" "}
          <strong className="text-danger">{formatINR(exposure.overBy)}</strong>. Further despatch needs a credit-limit
          override approval.{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => setContribOpen(true)}>
            See the {exposure.contributing.length} invoices behind it
          </button>
          .
        </Notice>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <li><Stat label="Sites" value={formatCount(sites.length)} sub="Assets attach to a site" /></li>
        {show.assets ? <li><Stat label="Installed machines" value={formatCount(assets.length)} sub={`${assets.filter((a) => D.coverageState(w.ds, a, w.now) === "OUT_OF_COVERAGE").length} out of coverage`} /></li> : null}
        {show.tickets ? <li><Stat label="Open tickets" value={formatCount(openTickets.length)} sub="Live service commitments" href="/service/tickets" tone={openTickets.length ? "warn" : undefined} /></li> : null}
        {show.amc ? <li><Stat label="Live AMC contracts" value={formatCount(liveAmcs.length)} sub={abbreviateINR(liveAmcs.reduce((s, a) => s + a.contractValue, 0))} href="/service/amc" /></li> : null}
        {show.quotations ? <li><Stat label="Quotations" value={formatCount(quotations.length)} sub={`${quotations.filter((q) => effectiveStatus(q, w.now) === "WON").length} won`} /></li> : null}
        {show.invoices ? (
          <li>
            <button type="button" onClick={() => setContribOpen(true)} className="w-full text-left">
              <Stat
                label="Outstanding"
                value={abbreviateINR(exposure.outstanding)}
                sub="Click for the contributing invoices"
                tone={exposure.exceeded ? "danger" : exposure.outstanding > 0 ? "warn" : "ok"}
              />
            </button>
          </li>
        ) : null}
      </ul>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Profile */}
          <Panel>
            <PanelHeader title="Profile" sub="The master record every other module reads." />
            <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
              <KeyValue label="Legal name">{customer.legalName}</KeyValue>
              <KeyValue label="Trade name">{customer.tradeName}</KeyValue>
              <KeyValue label="Type">{customer.type.charAt(0) + customer.type.slice(1).toLowerCase()}</KeyValue>
              <KeyValue label="Industry">{customer.industry}</KeyValue>
              <KeyValue label="GSTIN"><span className="t-mono">{customer.gstin ?? "—"}</span></KeyValue>
              <KeyValue label="PAN"><span className="t-mono">{customer.pan ?? "—"}</span></KeyValue>
              <KeyValue label="Credit terms">{customer.creditTermDays} days</KeyValue>
              <KeyValue label="Credit limit"><span className="tabular-nums">{formatINR(customer.creditLimit)}</span></KeyValue>
              <KeyValue label="Assigned branch">{w.branchById.get(customer.branchId)?.name ?? "—"}</KeyValue>
              <KeyValue label="Assigned executive">{w.userById.get(customer.ownerUserId)?.name ?? "—"}</KeyValue>
              <KeyValue label="Country">{customer.country === "IN" ? "India" : customer.country}</KeyValue>
              <KeyValue label="Primary contact">
                {primary ? `${primary.name} · ${formatPhone(primary.mobile)}` : "Not recorded"}
              </KeyValue>
            </dl>
          </Panel>

          {/* Sites */}
          <Panel>
            <PanelHeader title="Sites" sub="Premises where this customer runs machines." />
            <div className="p-4">
              {perms.canWrite("customers") ? (
                <SitesEditor world={w} actor={perms.actor} customer={customer} />
              ) : sites.length === 0 ? (
                <EmptyState icon={Boxes} title="No premises recorded" body="No site has been recorded against this customer yet." />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Site</Th><Th>Address</Th><Th>District</Th><Th>State</Th><Th>Contact</Th><Th>Notes</Th></tr></thead>
                  <tbody>
                    {sites.map((s) => (
                      <Tr key={s.id}>
                        <Td className="text-text-hi">{s.name}</Td>
                        <Td>{s.address}</Td><Td>{s.district}</Td>
                        <Td>{s.state}</Td>
                        <Td>{s.contactPerson}</Td>
                        <Td>{s.notes || "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableFrame>
              )}
            </div>
          </Panel>

          {/* Contacts */}
          <Panel>
            <PanelHeader title="Contacts" sub="Who to call, and on which channel." />
            <div className="p-4">
              {perms.canWrite("customers") ? (
                <ContactsEditor world={w} actor={perms.actor} customer={customer} />
              ) : contacts.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No contacts recorded" body="No person has been recorded against this customer yet." />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Name</Th><Th>Designation</Th><Th>Mobile</Th><Th>Email</Th><Th>Channel</Th><Th>Primary</Th></tr></thead>
                  <tbody>
                    {contacts.map((c) => (
                      <Tr key={c.id}>
                        <Td className="text-text-hi">{c.name}</Td>
                        <Td>{c.designation}</Td>
                        <Td mono>{formatPhone(c.mobile)}</Td>
                        <Td>{c.email}</Td>
                        <Td>{enumLabel(c.preferredChannel)}</Td>
                        <Td>{c.isPrimary ? <StatusBadge tone="ok">Primary</StatusBadge> : "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableFrame>
              )}
            </div>
          </Panel>

          {/* Installed assets */}
          {show.assets ? (
            <Panel id="assets">
              <PanelHeader
                title="Installed assets"
                sub="Coverage is derived from warranty end and live AMC dates — never typed in."
                right={<Overline>{formatCount(assets.length)} machines</Overline>}
              />
              {assets.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No machines installed"
                  body="Nothing from Bhushan Corp is commissioned at this customer yet. Won equipment orders create assets on commissioning."
                />
              ) : (
                <TableFrame>
                  <thead>
                    <tr><Th>Serial</Th><Th>Model &amp; capacity</Th><Th>Site</Th><Th>Commissioned</Th><Th>Coverage</Th><Th right>Running hours</Th></tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => {
                      const cov = D.coverageState(w.ds, a, w.now);
                      const wEnd = D.warrantyEnd(a);
                      const amc = D.liveAmcFor(w.ds, a.id, w.now);
                      return (
                        <Tr key={a.id}>
                          <Td mono>
                            <Link href={`/service/assets/${a.serial}`} className="hover:underline">{a.serial}</Link>
                          </Td>
                          <Td className="text-text-hi">{a.model} · {a.capacityValue} {a.capacityUnit}</Td>
                          <Td>{w.siteById.get(a.siteId)?.name ?? "—"}</Td>
                          <Td>{a.commissioningDate ? formatDate(a.commissioningDate) : "Not commissioned"}</Td>
                          <Td>
                            <StatusBadge tone={COVERAGE_TONE[cov]}>{enumLabel(cov)}</StatusBadge>
                            <span className="t-body-sm ml-2 text-text-lo">
                              {cov === "IN_WARRANTY" && wEnd ? `to ${formatDate(wEnd)}`
                                : cov === "UNDER_AMC" && amc ? `${amc.number} to ${formatDate(amc.endDate)}`
                                  : wEnd ? `warranty ended ${formatDate(wEnd)}` : ""}
                            </span>
                          </Td>
                          <Td right>{formatCount(a.runningHours)} h</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}

          {/* Open tickets */}
          {show.tickets ? (
            <Panel>
              <PanelHeader title="Open service tickets" sub="Live commitments with a running SLA clock." />
              {openTickets.length === 0 ? (
                <EmptyState icon={Wrench} title="No open tickets" body="Every service commitment for this customer is closed. Breakdown history stays on the timeline below." />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Ticket</Th><Th>Severity</Th><Th>Problem</Th><Th>Status</Th><Th>Restoration due</Th><Th>SLA</Th></tr></thead>
                  <tbody>
                    {openTickets.map((t) => {
                      const clock = D.slaClock(t, w.now);
                      const tone = clock.state === "BREACHED" ? "danger" : clock.state === "IMMINENT" ? "warn" : clock.state === "APPROACHING" ? "warn" : "ok";
                      return (
                        <Tr key={t.id}>
                          <Td mono><Link href={`/service/tickets/${t.id}`} className="hover:underline">{t.number}</Link></Td>
                          <Td>{enumLabel(t.severity)}</Td>
                          <Td className="max-w-80 truncate text-text-hi">{t.problem}</Td>
                          <Td>{enumLabel(t.status)}</Td>
                          <Td>{formatDateTime(t.restorationDue)}</Td>
                          <Td><StatusBadge tone={tone}>{enumLabel(clock.state)}</StatusBadge></Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}

          {/* AMC */}
          {show.amc ? (
            <Panel>
              <PanelHeader title="AMC contracts" sub="Live cover and its history." />
              {amcs.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No maintenance cover"
                  body={`${assets.length} machine${assets.length === 1 ? "" : "s"} installed and no AMC on any of them — an uncovered base is the attach-rate opportunity.`}
                  action={<LinkBtn href="/service/renewals" variant="primary">Open the renewal radar</LinkBtn>}
                />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Contract</Th><Th>Coverage</Th><Th>Machines</Th><Th>Period</Th><Th right>Value</Th><Th>State</Th></tr></thead>
                  <tbody>
                    {amcs.map((a) => {
                      const st = D.amcStatus(a, w.now);
                      const tone = st === "ACTIVE" ? "ok" : st === "EXPIRING" ? "warn" : st === "EXPIRED" ? "danger" : "neutral";
                      return (
                        <Tr key={a.id}>
                          <Td mono><Link href={`/service/amc/${a.id}`} className="hover:underline">{a.number}</Link></Td>
                          <Td>{enumLabel(a.coverage)}</Td>
                          <Td right>{a.assetIds.length}</Td>
                          <Td>{formatDate(a.startDate)} – {formatDate(a.endDate)}</Td>
                          <Td right>{formatINR(a.contractValue)}</Td>
                          <Td><StatusBadge tone={tone}>{enumLabel(st)}</StatusBadge></Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}

          {/* Quotations & orders */}
          {show.quotations ? (
            <Panel>
              <PanelHeader title="Quotation history" sub="Every version ever offered to this customer." />
              {quotations.length === 0 ? (
                <EmptyState icon={FileText} title="Nothing offered yet" body="No quotation has been raised for this customer. Start from an enquiry." action={<LinkBtn href="/sales/enquiries" variant="primary">Open enquiries</LinkBtn>} />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Number</Th><Th>Date</Th><Th>Owner</Th><Th right>Value</Th><Th>State</Th><Th>Order</Th></tr></thead>
                  <tbody>
                    {[...quotations].sort((a, b) => b.quotationDate.localeCompare(a.quotationDate)).map((q) => {
                      const lines = w.linesByQuotation.get(q.id) ?? [];
                      const pos = derivePlaceOfSupply(customer, q.siteId ? w.siteById.get(q.siteId) : undefined);
                      const totals = quotationTotals(lines, pos.treatment);
                      const st = effectiveStatus(q, w.now);
                      const order = w.orderByQuotation.get(q.id);
                      return (
                        <Tr key={q.id}>
                          <Td mono>
                            <Link href={`/sales/quotations/${q.id}`} className="hover:underline">{q.number}</Link>
                            <span className="ml-1 text-text-lo">v{q.version}</span>
                          </Td>
                          <Td>{formatDate(q.quotationDate)}</Td>
                          <Td>{w.userById.get(q.ownerUserId)?.name ?? "—"}</Td>
                          <Td right>{formatINR(totals.grandTotal)}</Td>
                          <Td><StatusBadge tone={QUOTATION_TONE[st]}>{labelStatus(st)}</StatusBadge></Td>
                          <Td mono>{order ? <Link href={`/sales/orders/${order.id}`} className="hover:underline">{order.number}</Link> : "—"}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}

          {show.orders ? (
            <Panel>
              <PanelHeader title="Order history" sub="Confirmed orders and their fulfilment." />
              {orders.length === 0 ? (
                <EmptyState icon={Handshake} title="No orders yet" body="Nothing has converted for this customer. A quotation marked Won creates the order automatically." />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Order</Th><Th>Date</Th><Th>Customer PO</Th><Th right>Value</Th><Th right>Despatched</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {[...orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate)).map((o) => {
                      const lines = w.orderLinesByOrder.get(o.id) ?? [];
                      const value = lines.reduce((s, l) => s + l.qty * l.rate, 0);
                      const qty = lines.reduce((s, l) => s + l.qty, 0);
                      const del = lines.reduce((s, l) => s + l.qtyDelivered, 0);
                      return (
                        <Tr key={o.id}>
                          <Td mono><Link href={`/sales/orders/${o.id}`} className="hover:underline">{o.number}</Link></Td>
                          <Td>{formatDate(o.orderDate)}</Td>
                          <Td mono>{o.customerPoRef || "—"}</Td>
                          <Td right>{formatINR(Math.round(value))}</Td>
                          <Td right>{qty ? `${Math.round((del / qty) * 100)}%` : "—"}</Td>
                          <Td><StatusBadge tone={o.status === "FULFILLED" ? "ok" : o.status === "PARTIAL" ? "warn" : "info"}>{enumLabel(o.status)}</StatusBadge></Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}

          {/* Invoices */}
          {show.invoices ? (
            <Panel id="invoices">
              <PanelHeader
                title="Invoices and outstanding"
                sub="Outstanding = invoice total − allocated receipts − credit notes."
                right={
                  <Btn size="sm" onClick={() => setContribOpen(true)}>
                    Show the arithmetic
                  </Btn>
                }
              />
              {invoices.length === 0 ? (
                <EmptyState icon={Receipt} title="Nothing invoiced" body="No tax invoice has been raised against this customer." />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Invoice</Th><Th>Date</Th><Th>Type</Th><Th right>Total</Th><Th right>Outstanding</Th><Th right>Age</Th></tr></thead>
                  <tbody>
                    {[...invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40).map((i) => {
                      const total = D.invoiceTotal(w.ds, i.id);
                      const out = D.invoiceOutstanding(w.ds, i.id);
                      const days = daysBetween(i.date, w.now);
                      return (
                        <Tr key={i.id}>
                          <Td mono><Link href={`/commercial/invoices/${i.id}`} className="hover:underline">{i.number}</Link></Td>
                          <Td>{formatDate(i.date)}</Td>
                          <Td>{enumLabel(i.type)}</Td>
                          <Td right>{formatINR(total)}</Td>
                          <Td right className={out > 0 ? "text-warn" : "text-text-lo"}>{out > 0 ? formatINR(out) : "Settled"}</Td>
                          <Td right>{days} d</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}

          {/* Documents */}
          {show.documents ? (
            <Panel>
              <PanelHeader title="Documents" sub="Everything filed against this customer in the vault." />
              {documents.length === 0 ? (
                <EmptyState icon={FileText} title="No documents filed" body="Agreements, PO copies and correspondence filed against this customer will appear here." action={<LinkBtn href="/vault" variant="primary">Open the vault</LinkBtn>} />
              ) : (
                <TableFrame>
                  <thead><tr><Th>Title</Th><Th>Type</Th><Th>Version</Th><Th>Uploaded</Th><Th>Expires</Th></tr></thead>
                  <tbody>
                    {documents.slice(0, 25).map((d) => (
                      <Tr key={d.id}>
                        <Td className="text-text-hi"><Link href={`/vault?doc=${d.id}`} className="hover:underline">{d.title}</Link></Td>
                        <Td>{enumLabel(d.type)}</Td>
                        <Td mono>v{d.version}</Td>
                        <Td>{formatDate(d.uploadedAt)}</Td>
                        <Td>{d.expiresOn ? formatDate(d.expiresOn) : "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableFrame>
              )}
            </Panel>
          ) : null}
        </div>

        {/* Timeline */}
        <Panel className="self-start xl:sticky xl:top-20">
          <PanelHeader
            title="Activity timeline"
            sub="Enquiries, quotations, orders, tickets, visits, invoices, receipts and communications, newest first."
            right={<Overline>{formatCount(timeline.length)} events</Overline>}
          />
          <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
            <button
              type="button"
              onClick={() => setTimelineFilter("ALL")}
              aria-pressed={timelineFilter === "ALL"}
              className={timelineFilter === "ALL"
                ? "t-overline rounded-md border border-primary-600 bg-primary-100 px-2 py-0.5 text-text-hi"
                : "t-overline rounded-md border border-line px-2 py-0.5 text-text-mid hover:border-line-strong"}
            >
              All
            </button>
            {timelineKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTimelineFilter(k)}
                aria-pressed={timelineFilter === k}
                className={timelineFilter === k
                  ? "t-overline rounded-md border border-primary-600 bg-primary-100 px-2 py-0.5 text-text-hi"
                  : "t-overline rounded-md border border-line px-2 py-0.5 text-text-mid hover:border-line-strong"}
              >
                {enumLabel(k)}
              </button>
            ))}
          </div>
          {shownTimeline.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Nothing recorded yet"
              body="Enquiries, quotations, visits and payments all land here as they happen."
            />
          ) : (
            <ol className="max-h-[70vh] overflow-y-auto">
              {shownTimeline.slice(0, 120).map((ev) => {
                const Icon = KIND_ICON[ev.kind];
                return (
                  <li key={ev.id} className="flex gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
                      <Icon className="size-3.5 text-text-lo" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="t-body-sm font-medium text-text-hi">
                          {ev.href ? <Link href={ev.href} className="hover:underline">{ev.title}</Link> : ev.title}
                        </span>
                        <span className="t-body-sm shrink-0 tabular-nums text-text-lo">{formatDate(ev.at)}</span>
                      </span>
                      <span className="t-body-sm mt-0.5 block text-text-mid">{ev.detail}</span>
                      <span className="t-body-sm mt-0.5 flex flex-wrap items-center gap-2 text-text-lo">
                        <span>{ev.actor}</span>
                        {ev.amount !== null ? <span className="tabular-nums">{abbreviateINR(ev.amount)}</span> : null}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      {/* Contributing invoices — the outstanding figure opens its source. */}
      <Modal
        open={contribOpen}
        onOpenChange={setContribOpen}
        wide
        title="Outstanding — how it is computed"
        description={`${customer.legalName} · as at ${formatDate(w.now)}`}
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KeyValue label="Invoice totals"><span className="tabular-nums">{formatINR(exposure.invoiced)}</span></KeyValue>
          <KeyValue label="Less allocated receipts"><span className="tabular-nums text-ok">−{formatINR(exposure.receipts)}</span></KeyValue>
          <KeyValue label="Less credit notes"><span className="tabular-nums text-ok">−{formatINR(exposure.creditNotes)}</span></KeyValue>
          <KeyValue label="Plus debit notes"><span className="tabular-nums">+{formatINR(exposure.debitNotes)}</span></KeyValue>
        </dl>
        <p className="t-body mt-3 border-t border-line pt-3 text-text-hi">
          Outstanding <span className="t-mono">=</span>{" "}
          <span className="tabular-nums">{formatINR(exposure.outstanding)}</span>{" "}
          <span className="t-body-sm text-text-lo">
            against a sanctioned limit of {formatINR(exposure.limit)}
            {exposure.exceeded ? ` — over by ${formatINR(exposure.overBy)}` : " — within limit"}
          </span>
        </p>
        <div className="mt-4 rounded-md border border-line">
          <TableFrame>
            <thead><tr><Th>Invoice</Th><Th>Date</Th><Th right>Total</Th><Th right>Outstanding</Th><Th right>Age</Th><Th>Bucket</Th></tr></thead>
            <tbody>
              {exposure.contributing.map((r) => (
                <Tr key={r.invoice.id}>
                  <Td mono><Link href={`/commercial/invoices/${r.invoice.id}`} className="hover:underline">{r.invoice.number}</Link></Td>
                  <Td>{formatDate(r.invoice.date)}</Td>
                  <Td right>{formatINR(r.total)}</Td>
                  <Td right className="text-warn">{formatINR(r.outstanding)}</Td>
                  <Td right>{r.days} d</Td>
                  <Td>{enumLabel(D.ageingBucket(r.invoice.date, w.now).replace("B", "").replace("_", "–"))}</Td>
                </Tr>
              ))}
            </tbody>
          </TableFrame>
        </div>
      </Modal>

      <CustomerFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        world={w}
        actor={perms.actor}
        customer={customer}
        lockBranchId={perms.scope("customers") === "BRANCH" ? perms.branchId : null}
      />

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
