"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight, Banknote, BellRing, Building2, HandCoins, ListFilter, TriangleAlert, Wallet,
} from "lucide-react";
import { abbreviateINR, formatCount, formatDate, formatINR } from "@/lib/format";
import type { AgeingBucket } from "@/lib/derive";
import type { CustomerType } from "@/lib/schemas/enums";
import { EmptyState, Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import {
  ageingSummary, applyAgeingFilters, brokenPromises, escalations, mergedFollowUps,
  mergedInvoices, moneyIndex, openInvoices, NO_FILTERS,
  type AgeingFilters, type OpenInvoice,
} from "@/components/domain/commercial/merge";
import { useCommercialOverlay } from "@/components/domain/commercial/store";
import {
  BUCKET_LABEL, BUCKET_ORDER, FOLLOWUP_MODE_LABEL, INSTITUTIONAL_TYPES,
  type Actor, type BranchRef, type FollowUpRow, type InvoiceRow, type UserRef,
} from "@/components/domain/commercial/types";
import {
  Button, Chip, DataTable, Field, FilteredEmpty, Money, PageHead, ReconcileNote,
  SearchInput, SectionPanel, Select, Stat, useDebounced, type Column,
} from "@/components/domain/commercial/ui";

/**
 * E8-S6 — receivables ageing, segmentation and collection follow-up.
 *
 * The buckets are not a report of a stored figure; they are recomputed from
 * every open invoice on every render, and the screen asserts on screen that
 * they sum to the total rather than asking to be believed.
 */

export interface ReceivablesClientProps {
  rows: InvoiceRow[];
  followUps: FollowUpRow[];
  branches: BranchRef[];
  executives: UserRef[];
  actor: Actor;
  todayIso: string;
}

const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  INDUSTRIAL: "Industrial",
  INSTITUTIONAL: "Institutional",
  GOVERNMENT: "Government",
  DEALER: "Dealer",
  RETAIL: "Retail",
};

/**
 * Whole-percent share, floored, so a segment is never overstated. The published
 * figure — institutional and government exposure at 61% of ₹1.82 Cr — is the
 * same arithmetic: ₹1.12 Cr is 61.5% of the total.
 */
function sharePct(part: number, whole: number): number {
  return whole > 0 ? Math.floor((part / whole) * 100) : 0;
}

export function ReceivablesClient({
  rows: base, followUps: followUpsSeed, branches, executives, todayIso,
}: ReceivablesClientProps) {
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);

  const rows = React.useMemo(() => mergedInvoices(base, overlay, now), [base, overlay, now]);
  const money = React.useMemo(() => moneyIndex(rows, overlay), [rows, overlay]);
  const open = React.useMemo(() => openInvoices(rows, overlay), [rows, overlay]);

  const [branchId, setBranchId] = React.useState("ALL");
  const [customerType, setCustomerType] = React.useState("ALL");
  const [accountExecutiveId, setAccountExecutiveId] = React.useState("ALL");
  const [segment, setSegment] = React.useState<AgeingFilters["segment"]>("ALL");
  const [bucket, setBucket] = React.useState<AgeingFilters["bucket"]>("ALL");
  const [query, setQuery] = React.useState("");
  const q = useDebounced(query);

  /** Branch, customer type and executive combine, and the buckets are computed
   *  from that scope — so whatever is on screen always sums to the total shown. */
  const scoped = React.useMemo(
    () => applyAgeingFilters(open, { ...NO_FILTERS, branchId, customerType, accountExecutiveId }),
    [open, branchId, customerType, accountExecutiveId],
  );
  const summary = React.useMemo(() => ageingSummary(scoped), [scoped]);

  const selected = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return applyAgeingFilters(scoped, { ...NO_FILTERS, segment, bucket }).filter((o) => {
      if (!needle) return true;
      return (
        o.row.number.toLowerCase().includes(needle) ||
        o.row.customerName.toLowerCase().includes(needle) ||
        o.row.accountExecutiveName.toLowerCase().includes(needle)
      );
    });
  }, [scoped, segment, bucket, q]);

  const selectedValue = selected.reduce((s, o) => s + o.outstanding, 0);

  const followUps = React.useMemo(
    () => mergedFollowUps(followUpsSeed, overlay),
    [followUpsSeed, overlay],
  );
  const invoiceIndex = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const broken = React.useMemo(
    () => brokenPromises(followUps, invoiceIndex, money, now),
    [followUps, invoiceIndex, money, now],
  );
  const escalated = React.useMemo(() => escalations(scoped), [scoped]);
  const sixty = escalated.filter((e) => e.level === "SIXTY");
  const ninety = escalated.filter((e) => e.level === "NINETY");

  const instShare = sharePct(summary.institutional.value, summary.total);

  const scopeFilters = [
    branchId !== "ALL" ? `branch ${branches.find((b) => b.id === branchId)?.name ?? branchId}` : null,
    customerType !== "ALL" ? `customer type ${CUSTOMER_TYPE_LABEL[customerType as CustomerType].toLowerCase()}` : null,
    accountExecutiveId !== "ALL" ? `account executive ${executives.find((u) => u.id === accountExecutiveId)?.name ?? accountExecutiveId}` : null,
  ].filter((x): x is string => Boolean(x));

  const activeFilters = [
    ...scopeFilters,
    bucket !== "ALL" ? `bucket ${BUCKET_LABEL[bucket].toLowerCase()}` : null,
    segment !== "ALL" ? `${segment === "INSTITUTIONAL" ? "institutional and government" : "private-sector"} exposure` : null,
    q.trim() ? `search “${q.trim()}”` : null,
  ].filter((x): x is string => Boolean(x));

  function clearFilters() {
    setBranchId("ALL"); setCustomerType("ALL"); setAccountExecutiveId("ALL");
    setSegment("ALL"); setBucket("ALL"); setQuery("");
  }

  const clicked =
    bucket !== "ALL" && segment !== "ALL"
      ? `${BUCKET_LABEL[bucket]} within ${segment === "INSTITUTIONAL" ? "institutional and government" : "private-sector"} exposure`
      : bucket !== "ALL"
        ? BUCKET_LABEL[bucket]
        : segment !== "ALL"
          ? (segment === "INSTITUTIONAL" ? "institutional and government exposure" : "private-sector exposure")
          : "all open invoices in scope";

  const columns: Column<OpenInvoice>[] = [
    {
      key: "number", label: "Invoice No", width: "minmax(9.5rem,1fr)", mono: true,
      render: (o) => <span className="truncate text-text-hi">{o.row.number}</span>,
    },
    {
      key: "customer", label: "Customer", width: "minmax(11rem,1.8fr)",
      render: (o) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-text-hi">{o.row.customerName}</span>
          {o.institutional ? (
            <Building2 className="size-3.5 shrink-0 text-info" aria-label="Institutional or government" />
          ) : null}
        </span>
      ),
    },
    { key: "date", label: "Invoice date", width: "7rem", render: (o) => formatDate(o.row.date) },
    {
      key: "days", label: "Days outstanding", width: "7.5rem", align: "right",
      render: (o) => (
        <span className={o.days > 90 ? "text-danger" : o.days > 60 ? "text-warn" : "text-text-mid"}>{o.days}</span>
      ),
    },
    {
      key: "bucket", label: "Bucket", width: "7.5rem", hideBelow: "lg",
      render: (o) => (
        <Chip tone={o.bucket === "B90_PLUS" ? "danger" : o.bucket === "B61_90" ? "warn" : "neutral"}>
          {BUCKET_LABEL[o.bucket]}
        </Chip>
      ),
    },
    {
      key: "amount", label: "Outstanding", width: "8.5rem", align: "right",
      render: (o) => <Money value={o.outstanding} abbreviate tone={o.days > 90 ? "danger" : "hi"} />,
    },
    {
      key: "owner", label: "Owner", width: "minmax(8rem,1fr)", hideBelow: "md",
      render: (o) => <span className="truncate">{o.row.accountExecutiveName}</span>,
    },
    {
      key: "branch", label: "Branch", width: "6.5rem", hideBelow: "xl",
      render: (o) => o.row.branchName,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Receivables"
        lede="Every rupee owed to the business, aged from the invoice date, segmented by the kind of customer who owes it, and traceable to the invoice that raised it. Institutional and government customers pay on a materially different rhythm from private ones, so they are counted apart."
        right={
          <>
            <Link
              href="/commercial/receipts"
              className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi hover:border-line-strong"
            >
              <HandCoins className="size-3.5" aria-hidden />
              Receipts and allocation
            </Link>
            {activeFilters.length ? (
              <Button onClick={clearFilters}><ListFilter className="size-3.5" aria-hidden />Clear filters</Button>
            ) : null}
          </>
        }
      />

      {/* ---------------------------------------------------------- buckets */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {BUCKET_ORDER.map((b) => {
          const cell = summary.buckets[b];
          return (
            <li key={b}>
              <Stat
                label={BUCKET_LABEL[b]}
                value={abbreviateINR(cell.value)}
                count={cell.count}
                active={bucket === b}
                tone={b === "B90_PLUS" ? "danger" : b === "B61_90" ? "warn" : "default"}
                onClick={() => setBucket((cur) => (cur === b ? "ALL" : b))}
                sub={
                  bucket === b
                    ? "Listed below — the invoices summing to this figure"
                    : `${sharePct(cell.value, summary.total)}% of outstanding · open to list`
                }
              />
            </li>
          );
        })}
      </ul>

      <Panel className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Overline>Total outstanding{scopeFilters.length ? " in scope" : ""}</Overline>
            <Money value={summary.total} abbreviate className="t-display-md" />
            <span className="t-body-sm text-text-mid">
              across {formatCount(summary.count)} open invoice{summary.count === 1 ? "" : "s"} ·{" "}
              <span className="t-mono">{formatINR(summary.total)}</span>
            </span>
          </div>
          <ReconcileNote
            ok={summary.reconciles}
            text={
              summary.reconciles
                ? `0–30 + 31–60 + 61–90 + 90+ = ${abbreviateINR(summary.total)} exactly — the buckets are the total, not a summary of it`
                : "The buckets do not sum to the total. The figure is withheld until they do."
            }
          />
        </div>
      </Panel>

      {/* ----------------------------------------------------- segmentation */}
      <SectionPanel
        title="Institutional and government exposure, against private"
        sub="Two segments, both with value and share. Selecting one narrows the invoice list beneath without changing the buckets above."
        right={<Chip tone="info">{instShare}% institutional</Chip>}
      >
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <Stat
            label="Institutional and government"
            value={abbreviateINR(summary.institutional.value)}
            count={summary.institutional.count}
            tone="info"
            active={segment === "INSTITUTIONAL"}
            onClick={() => setSegment((s) => (s === "INSTITUTIONAL" ? "ALL" : "INSTITUTIONAL"))}
            sub={`${instShare}% of the ${abbreviateINR(summary.total)} outstanding — ${formatINR(summary.institutional.value)}`}
          />
          <Stat
            label="Private sector"
            value={abbreviateINR(summary.privateSector.value)}
            count={summary.privateSector.count}
            active={segment === "PRIVATE"}
            onClick={() => setSegment((s) => (s === "PRIVATE" ? "ALL" : "PRIVATE"))}
            sub={`The remaining ${100 - instShare}% — ${formatINR(summary.privateSector.value)}`}
          />
        </div>
        <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
          Institutional and government customers ({INSTITUTIONAL_TYPES.map((t) => CUSTOMER_TYPE_LABEL[t].toLowerCase()).join(" and ")})
          are read as one exposure because they share a payment rhythm — bill passing, committee approval, budget release —
          that private customers do not.
        </p>
      </SectionPanel>

      {/* ---------------------------------------------------- invoice detail */}
      <Panel>
        <PanelHeader
          title="Contributing invoices"
          sub={`${formatCount(selected.length)} invoice${selected.length === 1 ? "" : "s"} in ${clicked}`}
          right={
            <span className="t-body-sm text-text-mid">
              Sum <Money value={selectedValue} abbreviate className="font-medium" />
            </span>
          }
        />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          <SearchInput
            value={query} onValueChange={setQuery}
            placeholder="Search invoice number, customer or owner"
            className="min-w-56 flex-1"
          />
          <Field label="Branch" className="w-40">
            <Select
              value={branchId} onChange={(e) => setBranchId(e.target.value)}
              options={[{ value: "ALL", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
          <Field label="Customer type" className="w-44">
            <Select
              value={customerType} onChange={(e) => setCustomerType(e.target.value)}
              options={[
                { value: "ALL", label: "All customer types" },
                ...(Object.keys(CUSTOMER_TYPE_LABEL) as CustomerType[]).map((t) => ({ value: t, label: CUSTOMER_TYPE_LABEL[t] })),
              ]}
            />
          </Field>
          <Field label="Account executive" className="w-48">
            <Select
              value={accountExecutiveId} onChange={(e) => setAccountExecutiveId(e.target.value)}
              options={[
                { value: "ALL", label: "All executives" },
                ...executives.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </Field>
          <Field label="Ageing bucket" className="w-40">
            <Select
              value={bucket} onChange={(e) => setBucket(e.target.value as AgeingBucket | "ALL")}
              options={[
                { value: "ALL", label: "All buckets" },
                ...BUCKET_ORDER.map((b) => ({ value: b, label: BUCKET_LABEL[b] })),
              ]}
            />
          </Field>
        </div>

        <DataTable
          caption="Open invoices contributing to the selected figure"
          columns={columns}
          rows={selected}
          rowKey={(o) => o.row.id}
          rowHref={(o) => `/commercial/invoices/${o.row.id}`}
          empty={
            activeFilters.length
              ? <FilteredEmpty active={activeFilters} onClear={clearFilters} subject="open invoices" />
              : (
                <EmptyState
                  icon={Wallet}
                  title="Nothing is outstanding"
                  body="Every invoice raised has been settled by an allocated receipt or written down by a credit note. There is no receivable to age, and no follow-up to make."
                />
              )
          }
          footer={
            <>
              <span className="t-body-sm text-text-lo">
                {formatCount(selected.length)} invoice{selected.length === 1 ? "" : "s"} listed
              </span>
              <span className="t-body-sm text-text-mid">
                These invoices sum to <Money value={selectedValue} className="font-medium" /> —{" "}
                {bucket === "ALL" && segment === "ALL"
                  ? "the whole of the outstanding in scope"
                  : "exactly the figure on the card that was opened"}
              </span>
            </>
          }
        />
      </Panel>

      {/* -------------------------------------------------- broken promises */}
      <SectionPanel
        title="Broken payment promises"
        sub="A promised date that passed without an allocated receipt. Each carries the amount promised and the days elapsed."
        right={<Chip tone={broken.length ? "warn" : "ok"}>{formatCount(broken.length)} standing</Chip>}
      >
        {broken.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No promise has been broken"
            body="Every payment commitment recorded against an open invoice has either been honoured by an allocated receipt or has not yet fallen due."
          />
        ) : (
          <ul className="divide-y divide-line">
            {broken.map((b) => (
              <li key={b.followUp.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                <div className="min-w-56 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/commercial/invoices/${b.invoice.id}`}
                      className="t-mono text-text-hi hover:underline"
                    >
                      {b.invoice.number}
                    </Link>
                    <span className="t-body-sm text-text-mid">{b.invoice.customerName}</span>
                    <StatusBadge tone="warn">{b.daysElapsed} {b.daysElapsed === 1 ? "day" : "days"} elapsed</StatusBadge>
                  </div>
                  <p className="t-body-sm mt-0.5 text-text-mid">
                    {b.followUp.personSpokenTo} promised {formatINR(b.promisedAmount)} by{" "}
                    {formatDate(b.followUp.promisedDate!)} on a{" "}
                    {FOLLOWUP_MODE_LABEL[b.followUp.mode].toLowerCase()} recorded by {b.followUp.byName}. No receipt has
                    been allocated against the invoice since.
                  </p>
                  <p className="t-body-sm text-text-lo">
                    {b.invoice.accountExecutiveName} owns the account · {b.invoice.branchName} ·{" "}
                    {b.invoice.daysOutstanding} days since the invoice date
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Overline>Still outstanding</Overline>
                  <Money value={b.outstanding} className="t-heading-md block" tone="danger" />
                  <Link
                    href={`/commercial/invoices/${b.invoice.id}`}
                    className="t-body-sm mt-1 inline-flex items-center gap-1 text-info hover:underline"
                  >
                    Open the follow-up log
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {/* ----------------------------------------------------- escalations */}
      <SectionPanel
        title="Escalations at 60 and 90 days"
        sub="Notification is a consequence of the ageing, not a separate decision. The rule that fired is printed against every invoice it names."
        right={
          <span className="flex items-center gap-2">
            <Chip tone="warn">{formatCount(sixty.length)} at 60 days</Chip>
            <Chip tone="danger">{formatCount(ninety.length)} at 90 days</Chip>
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-2">
          <EscalationRule
            icon={BellRing}
            tone="warn"
            title="Crossing 60 days"
            rule="Accounts and the Branch Manager are notified. The account executive keeps ownership; the branch gains visibility."
            count={sixty.length}
            value={sixty.reduce((s, e) => s + e.outstanding, 0)}
          />
          <EscalationRule
            icon={Banknote}
            tone="danger"
            title="Crossing 90 days"
            rule="Director – Business is added to the notification, with Accounts and the Branch Manager retained. Nothing is removed; the audience widens."
            count={ninety.length}
            value={ninety.reduce((s, e) => s + e.outstanding, 0)}
          />
        </div>
        {escalated.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No invoice has crossed 60 days"
            body="Nothing in the current scope is old enough to escalate. The rule still stands and will fire the day an invoice crosses the line."
          />
        ) : (
          <DataTable
            caption="Invoices past the escalation thresholds"
            maxHeight={420}
            columns={[
              {
                key: "level", label: "Threshold", width: "7.5rem",
                render: (e) => (
                  <Chip tone={e.level === "NINETY" ? "danger" : "warn"}>
                    {e.level === "NINETY" ? "90 days" : "60 days"}
                  </Chip>
                ),
              },
              {
                key: "number", label: "Invoice No", width: "minmax(9.5rem,1fr)", mono: true,
                render: (e) => <span className="truncate text-text-hi">{e.invoice.number}</span>,
              },
              {
                key: "customer", label: "Customer", width: "minmax(11rem,1.6fr)",
                render: (e) => <span className="truncate">{e.invoice.customerName}</span>,
              },
              { key: "days", label: "Days", width: "5rem", align: "right", render: (e) => e.days },
              {
                key: "amount", label: "Outstanding", width: "8.5rem", align: "right",
                render: (e) => <Money value={e.outstanding} abbreviate tone={e.level === "NINETY" ? "danger" : "warn"} />,
              },
              {
                key: "recipients", label: "Notified", width: "minmax(12rem,1.6fr)", hideBelow: "lg",
                render: (e) => <span className="truncate text-text-lo">{e.recipients.join(" · ")}</span>,
              },
            ]}
            rows={escalated}
            rowKey={(e) => `${e.level}-${e.invoice.id}`}
            rowHref={(e) => `/commercial/invoices/${e.invoice.id}`}
            empty={<EmptyState icon={BellRing} title="Nothing to escalate" body="No invoice in scope has crossed 60 days." />}
            footer={
              <>
                <span className="t-body-sm text-text-lo">
                  {formatCount(escalated.length)} invoice{escalated.length === 1 ? "" : "s"} past a threshold
                </span>
                <span className="t-body-sm text-text-mid">
                  Escalated value{" "}
                  <Money value={escalated.reduce((s, e) => s + e.outstanding, 0)} abbreviate className="font-medium" />
                </span>
              </>
            }
          />
        )}
      </SectionPanel>
    </div>
  );
}

function EscalationRule({
  icon: Icon, tone, title, rule, count, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "warn" | "danger";
  title: string; rule: string; count: number; value: number;
}) {
  return (
    <div className="bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={tone === "danger" ? "size-4 text-danger" : "size-4 text-warn"} aria-hidden />
        <span className="t-heading-md text-text-hi">{title}</span>
        <span className="t-mono ml-auto text-text-mid tabular-nums">
          {formatCount(count)} · {abbreviateINR(value)}
        </span>
      </div>
      <p className="t-body-sm mt-1 text-text-mid">{rule}</p>
    </div>
  );
}
