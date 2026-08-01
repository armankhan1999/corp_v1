"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Clock, FileText, Inbox,
  MessageSquare, Target, TrendingUp,
} from "lucide-react";
import { VERTICAL_LABEL } from "@/lib/schemas/enums";
import {
  abbreviateINR, daysBetween, financialYear, formatCount, formatDate, formatINR, formatPercent,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import * as D from "@/lib/derive";
import { EmptyState, Overline, Panel, PanelHeader, Skeleton, StatusBadge } from "@/components/patterns/primitives";
import { QUOTATION_TONE, labelStatus, startOfDay, targetProgress } from "./calc";
import { deskEnquiries, deskFollowUps, deskQuotations, type DeskFollowUp, type DueState } from "./desk";
import { permissionsOf, useSalesSession, type SalesPermissions } from "./session";
import { retryLoad, useSalesStore, type SalesWorld } from "./store";
import { FollowUpDialog, type FollowUpSubject } from "./FollowUp";
import {
  Btn, ErrorPanel, LinkBtn, Meter, Modal, Notice, PageHeader, Stat, TableFrame, Td, Th, Tr,
} from "./ui";

/**
 * E3-S9 — the executive's working screen. Open enquiries, quotations awaiting
 * action, today's follow-ups and target against achieved, with the target's
 * source and period stated on screen rather than assumed.
 */

export function MyDeskPage() {
  const store = useSalesStore();
  const session = useSalesSession();

  if (store.status === "loading" || !session) return <DeskSkeleton />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  return <Desk w={store.world} perms={permissionsOf(session)} />;
}

function Desk({ w, perms }: { w: SalesWorld; perms: SalesPermissions }) {
  const [followUp, setFollowUp] = React.useState<FollowUpSubject | null>(null);
  const [ordersOpen, setOrdersOpen] = React.useState(false);

  const me = w.userById.get(perms.userId);
  const today = startOfDay(w.now);

  const followUps = React.useMemo(() => deskFollowUps(w, perms.userId), [w, perms.userId]);
  const enquiries = React.useMemo(() => deskEnquiries(w, perms.userId), [w, perms.userId]);
  const quotations = React.useMemo(() => deskQuotations(w, perms.userId), [w, perms.userId]);
  const progress = React.useMemo(
    () => targetProgress(w.ds, w.salesOrders, w.salesOrderLines, perms.userId, perms.branchId, w.now),
    [w, perms.userId, perms.branchId],
  );

  const overdue = followUps.filter((f) => f.state === "OVERDUE");
  const dueToday = followUps.filter((f) => f.state === "TODAY");
  const upcoming = followUps.filter((f) => f.state === "UPCOMING").slice(0, 8);

  const periodFrom = progress.target ? new Date(progress.target.periodStart) : D.fyToDate(w.now).from;
  const periodTo = progress.target ? new Date(progress.target.periodEnd) : D.fyToDate(w.now).to;
  const periodDays = Math.max(1, daysBetween(periodFrom, periodTo));
  const elapsedDays = Math.max(0, Math.min(periodDays, daysBetween(periodFrom, w.now)));
  const elapsedPct = Math.round((elapsedDays / periodDays) * 100);
  const onPace = progress.pct >= elapsedPct;

  const orderValue = (orderId: string) =>
    (w.orderLinesByOrder.get(orderId) ?? []).reduce((s, l) => s + l.qty * l.rate, 0);

  const nothingAtAll = enquiries.length === 0 && quotations.length === 0 && followUps.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My desk"
        lead={`Everything ${me?.name ?? "you"} owns and has to act on today — open enquiries, offers waiting on a decision, scheduled follow-ups and the target this period is measured against.`}
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{formatDate(w.now)}</StatusBadge>
            <StatusBadge tone="info">{me?.designation ?? perms.role.replace(/_/g, " ").toLowerCase()}</StatusBadge>
            {overdue.length > 0 ? <StatusBadge tone="danger">{overdue.length} overdue follow-ups</StatusBadge> : null}
          </>
        }
        right={
          <>
            <LinkBtn href="/sales/pipeline">Pipeline board</LinkBtn>
            <LinkBtn href="/sales/enquiries" variant="primary">Capture enquiry</LinkBtn>
          </>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Open enquiries" value={formatCount(enquiries.length)} sub={`${enquiries.filter((e) => !e.hasNextAction).length} with no next action scheduled`} href="/sales/pipeline" /></li>
        <li><Stat label="Quotations awaiting action" value={formatCount(quotations.length)} sub={`${quotations.filter((q) => q.status === "EXPIRED").length} lapsed past validity`} href="/sales/quotations" tone={quotations.some((q) => q.status === "EXPIRED") ? "warn" : undefined} /></li>
        <li><Stat label="Follow-ups due today" value={formatCount(dueToday.length)} sub={`${formatDate(today)}`} /></li>
        <li><Stat label="Overdue follow-ups" value={formatCount(overdue.length)} sub="Next-action date passed with no later activity" tone={overdue.length ? "danger" : "ok"} /></li>
      </ul>

      {/* --------------------------------------------- E3-S9 AC-5: target */}
      <div className="panel-hero p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Overline>Target versus achieved</Overline>
            <p className="t-body-sm mt-1 max-w-2xl text-text-mid">
              {progress.target
                ? `Source — ${progress.source}. Period — ${financialYear(periodFrom)}, ${progress.periodLabel}.`
                : `${progress.source}. Achievement is still counted against ${financialYear(periodFrom)} to date, ${progress.periodLabel}.`}
            </p>
          </div>
          <StatusBadge tone={onPace ? "ok" : "warn"}>
            {onPace ? "At or ahead of pace" : "Behind pace"} · period {elapsedPct}% elapsed
          </StatusBadge>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setOrdersOpen(true)}
              className="group flex w-full flex-col items-start rounded-md px-1 py-1 text-left transition-colors duration-150 hover:bg-surface-2/70"
              aria-label={`Achieved ${formatINR(progress.achieved)} of ${formatINR(progress.targetAmount)}. Open the ${progress.orders.length} contributing orders.`}
            >
              <span className="t-display-lg tabular-nums text-text-hi">{abbreviateINR(progress.achieved)}</span>
              <span className="t-body-sm flex items-center gap-1 text-text-mid">
                of {abbreviateINR(progress.targetAmount)} target
                <span className="inline-flex items-center gap-0.5 text-primary-400 underline decoration-line-strong underline-offset-2 group-hover:decoration-primary-500">
                  · {formatCount(progress.orders.length)} contributing orders
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </span>
              </span>
            </button>
            <div className="mt-3">
              <Meter pct={progress.pct} tone={progress.pct >= 100 ? "ok" : onPace ? "info" : "warn"} />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="t-body-sm text-text-lo">
                  {formatPercent(progress.pct, 0)} of target · {formatPercent(elapsedPct, 0)} of the period gone
                </span>
                <span className="t-body-sm tabular-nums text-text-lo">
                  {progress.targetAmount > progress.achieved
                    ? `${abbreviateINR(progress.targetAmount - progress.achieved)} to go`
                    : `${abbreviateINR(progress.achieved - progress.targetAmount)} over`}
                </span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-1">
            <div>
              <dt className="t-overline text-text-lo">Target held in</dt>
              <dd className="t-body-sm text-text-mid">
                {progress.target ? (
                  <Link href="/admin/masters" className="underline underline-offset-2">Admin › Masters › Sales targets</Link>
                ) : (
                  "No target row exists for this user or branch"
                )}
              </dd>
            </div>
            <div>
              <dt className="t-overline text-text-lo">Measured on</dt>
              <dd className="t-body-sm text-text-mid">Sales order value, order date inside the period</dd>
            </div>
          </dl>
        </div>
      </div>

      {nothingAtAll ? (
        <Panel>
          <EmptyState
            icon={Inbox}
            title="Your desk is clear"
            body="Nothing is assigned to you: no open enquiry, no offer awaiting a decision and no scheduled follow-up. Capture an enquiry and it appears here with its ageing clock running."
            action={<LinkBtn href="/sales/enquiries" variant="primary">Capture an enquiry</LinkBtn>}
          />
        </Panel>
      ) : null}

      {/* ------------------------------------------------------ follow-ups */}
      <Panel>
        <PanelHeader
          title="Scheduled follow-ups"
          sub="Driven by the next-action date on the last activity recorded against each enquiry, quotation or customer."
          right={<Overline>{formatCount(followUps.length)} scheduled</Overline>}
        />
        {followUps.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled"
            body="Record a follow-up on any enquiry or quotation and its next-action date lands here on the day it falls due."
            action={<LinkBtn href="/sales/pipeline" variant="primary">Open the pipeline board</LinkBtn>}
          />
        ) : (
          <div className="flex flex-col">
            <FollowUpGroup
              title="Overdue"
              caption="The next-action date has passed and no later activity was recorded against the subject."
              state="OVERDUE"
              rows={overdue}
              onLog={setFollowUp}
            />
            <FollowUpGroup
              title="Due today"
              caption={formatDate(today)}
              state="TODAY"
              rows={dueToday}
              onLog={setFollowUp}
            />
            <FollowUpGroup
              title="Coming up"
              caption="The next eight scheduled actions."
              state="UPCOMING"
              rows={upcoming}
              onLog={setFollowUp}
            />
          </div>
        )}
      </Panel>

      <div className="grid gap-3 xl:grid-cols-2">
        {/* -------------------------------------------- quotations awaiting */}
        <Panel>
          <PanelHeader
            title="Quotations awaiting action"
            sub="Newest version of each family only — a superseded version is read-only and would count the same opportunity twice."
            right={<Overline>{formatCount(quotations.length)} open</Overline>}
          />
          {quotations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No offer is waiting on you"
              body="Every quotation you own has been won, lost or is not yet raised. Build one from an enquiry and it appears here until it closes."
              action={<LinkBtn href="/sales/enquiries" variant="primary">Open enquiries</LinkBtn>}
            />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>Quotation</Th><Th>Customer</Th><Th right>Value</Th><Th>Valid until</Th>
                  <Th right>Age</Th><Th>State</Th><Th>What it needs</Th>
                </tr>
              </thead>
              <tbody>
                {quotations.slice(0, 25).map((r) => (
                  <Tr key={r.quotation.id} className={r.tone === "danger" ? "bg-danger-bg/30" : r.tone === "warn" ? "bg-warn-bg/25" : undefined}>
                    <Td mono>
                      <Link href={`/sales/quotations/${r.quotation.id}`} className="text-text-hi hover:underline">
                        {r.quotation.number} v{r.quotation.version}
                      </Link>
                    </Td>
                    <Td className="max-w-48 truncate text-text-hi">{r.customerName}</Td>
                    <Td right>{abbreviateINR(r.value)}</Td>
                    <Td className={r.status === "EXPIRED" ? "text-danger" : undefined}>{formatDate(r.validUntil)}</Td>
                    <Td right>{r.ageDays} d</Td>
                    <Td><StatusBadge tone={QUOTATION_TONE[r.status]}>{labelStatus(r.status)}</StatusBadge></Td>
                    <Td className="max-w-72">{r.action}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableFrame>
          )}
          {quotations.length > 25 ? (
            <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
              Showing the 25 most pressing of {formatCount(quotations.length)}.{" "}
              <Link href="/sales/quotations" className="underline underline-offset-2">Open the full register</Link>.
            </p>
          ) : null}
        </Panel>

        {/* -------------------------------------------------- open enquiries */}
        <Panel>
          <PanelHeader
            title="My open enquiries"
            sub="Everything you own that has not been won, lost or dropped, oldest first."
            right={<Overline>{formatCount(enquiries.length)} open</Overline>}
          />
          {enquiries.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No open enquiries"
              body="Nothing assigned to you is still in play. Capture an enquiry, or ask the branch manager to assign one from the unassigned queue."
              action={<LinkBtn href="/sales/enquiries" variant="primary">Capture an enquiry</LinkBtn>}
            />
          ) : (
            <TableFrame>
              <thead>
                <tr>
                  <Th>Enquiry</Th><Th>Customer</Th><Th>Vertical</Th><Th right>Expected</Th>
                  <Th right>Age</Th><Th>Status</Th><Th>Next action</Th>
                </tr>
              </thead>
              <tbody>
                {enquiries.slice(0, 25).map((r) => (
                  <Tr key={r.enquiry.id}>
                    <Td mono>{r.enquiry.number}</Td>
                    <Td className="max-w-48 truncate text-text-hi">
                      <Link href={`/sales/customers/${r.enquiry.customerId}`} className="hover:underline">{r.customerName}</Link>
                    </Td>
                    <Td>{VERTICAL_LABEL[r.enquiry.vertical]}</Td>
                    <Td right>{abbreviateINR(r.enquiry.expectedValue)}</Td>
                    <Td right>{r.ageDays} d</Td>
                    <Td>
                      <StatusBadge tone={r.enquiry.status === "NEW" ? "neutral" : "info"}>
                        {r.enquiry.status.charAt(0) + r.enquiry.status.slice(1).toLowerCase()}
                      </StatusBadge>
                    </Td>
                    <Td>
                      {r.hasNextAction ? (
                        <span className="t-body-sm text-text-mid">Scheduled</span>
                      ) : (
                        <StatusBadge tone="warn">None scheduled</StatusBadge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableFrame>
          )}
          {enquiries.length > 25 ? (
            <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
              Showing the 25 oldest of {formatCount(enquiries.length)}.{" "}
              <Link href="/sales/pipeline" className="underline underline-offset-2">See them all on the board</Link>.
            </p>
          ) : null}
        </Panel>
      </div>

      {/* -------------------------------------- contributing orders (AC-5) */}
      <Modal
        open={ordersOpen}
        onOpenChange={setOrdersOpen}
        wide
        title="Orders contributing to achievement"
        description={`${progress.source}. Period ${progress.periodLabel}. Achievement counts sales order value where the order date falls inside the period.`}
      >
        {progress.orders.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No orders in this period yet"
            body="Nothing has converted inside the target period, so achievement stands at zero. Winning a quotation raises an order and it appears here immediately."
            action={<LinkBtn href="/sales/pipeline" variant="primary">Open the pipeline board</LinkBtn>}
          />
        ) : (
          <>
            <TableFrame>
              <thead>
                <tr><Th>Order</Th><Th>Date</Th><Th>Customer</Th><Th>Vertical</Th><Th right>Value</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {progress.orders
                  .slice()
                  .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
                  .map((o) => (
                    <Tr key={o.id}>
                      <Td mono>
                        <Link href={`/sales/orders/${o.id}`} className="text-text-hi hover:underline">{o.number}</Link>
                      </Td>
                      <Td>{formatDate(o.orderDate)}</Td>
                      <Td className="max-w-56 truncate">{w.customerById.get(o.customerId)?.legalName ?? "—"}</Td>
                      <Td>{VERTICAL_LABEL[o.vertical]}</Td>
                      <Td right className="text-text-hi">{formatINR(orderValue(o.id))}</Td>
                      <Td><StatusBadge tone={o.status === "FULFILLED" ? "ok" : o.status === "CANCELLED" ? "danger" : "info"}>{o.status.charAt(0) + o.status.slice(1).toLowerCase()}</StatusBadge></Td>
                    </Tr>
                  ))}
              </tbody>
            </TableFrame>
            <Notice tone="info" icon={TrendingUp} title="How the figure is built" className="mt-3">
              {formatCount(progress.orders.length)} orders × line value (quantity × rate, before tax) ={" "}
              <span className="tabular-nums">{formatINR(progress.achieved)}</span>, against a target of{" "}
              <span className="tabular-nums">{formatINR(progress.targetAmount)}</span>. Tax is excluded — a target is a
              revenue commitment, not a collection of GST.
            </Notice>
          </>
        )}
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

/* ------------------------------------------------------------- follow-ups */

const DUE_ICON: Record<DueState, React.ComponentType<{ className?: string }>> = {
  OVERDUE: AlertTriangle,
  TODAY: Clock,
  UPCOMING: CalendarClock,
};

function FollowUpGroup({
  title, caption, state, rows, onLog,
}: {
  title: string;
  caption: string;
  state: DueState;
  rows: DeskFollowUp[];
  onLog: (s: FollowUpSubject) => void;
}) {
  const Icon = DUE_ICON[state];
  const tone = state === "OVERDUE" ? "danger" : state === "TODAY" ? "warn" : "neutral";

  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2 px-4 py-2">
        <span className="flex items-center gap-2">
          <Icon className={cn("size-3.5", state === "OVERDUE" ? "text-danger" : state === "TODAY" ? "text-warn" : "text-text-lo")} aria-hidden />
          <Overline>{title}</Overline>
          <span className="t-body-sm text-text-lo">{caption}</span>
        </span>
        <StatusBadge tone={tone}>{formatCount(rows.length)}</StatusBadge>
      </div>
      {rows.length === 0 ? (
        <p className="t-body-sm flex items-center gap-1.5 px-4 py-3 text-text-lo">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          {state === "OVERDUE"
            ? "Nothing has slipped — every scheduled action is still in date."
            : state === "TODAY"
              ? "Nothing falls due today."
              : "Nothing scheduled beyond today."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.activity.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="t-body flex flex-wrap items-center gap-1.5 text-text-hi">
                  <Link href={`/sales/customers/${r.customerId}`} className="hover:underline">{r.customerName}</Link>
                  <span className="t-body-sm text-text-lo" aria-hidden>·</span>
                  <Link href={r.subjectHref} className="t-body-sm text-text-mid underline underline-offset-2">
                    {r.subjectLabel}
                  </Link>
                </p>
                <p className="t-body-sm mt-0.5 text-text-mid">
                  {r.activity.outcome} — {r.activity.notes}
                </p>
                <p className="t-body-sm mt-0.5 flex flex-wrap items-center gap-1.5 text-text-lo">
                  <span>Last touched {formatDate(r.activity.at)} by {r.activity.mode.toLowerCase()}</span>
                  <span aria-hidden>·</span>
                  <span className={state === "OVERDUE" ? "text-danger" : undefined}>
                    next action {formatDate(r.due)}
                    {state === "OVERDUE" ? ` — ${r.daysLate} ${r.daysLate === 1 ? "day" : "days"} overdue` : ""}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {state === "OVERDUE" ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
                <Btn
                  size="sm"
                  onClick={() =>
                    onLog({
                      type: r.activity.subjectType,
                      id: r.activity.subjectId,
                      label: r.subjectLabel,
                      customerId: r.customerId,
                    })
                  }
                >
                  <MessageSquare className="size-3.5" aria-hidden /> Log follow-up
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- skeleton */

/** Matches the final geometry: stats, target hero, follow-up groups, two tables. */
function DeskSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">My desk</h1>
        <Skeleton className="mt-2 h-2.5 w-[28rem]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Panel key={i} className="p-3">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="mt-3 h-6 w-20" />
            <Skeleton className="mt-2 h-2 w-32" />
          </Panel>
        ))}
      </div>
      <div className="panel-hero p-5">
        <Skeleton className="h-2 w-40" />
        <Skeleton className="mt-2 h-2 w-[32rem] max-w-full" />
        <Skeleton className="mt-5 h-9 w-44" />
        <Skeleton className="mt-3 h-1.5 w-full" />
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="mt-2 h-2 w-96 max-w-full" />
        </div>
        {Array.from({ length: 3 }, (_, g) => (
          <div key={g} className="border-b border-line last:border-b-0">
            <div className="bg-surface-2 px-4 py-2"><Skeleton className="h-2 w-32" /></div>
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="px-4 py-2.5">
                <Skeleton className="h-2.5 w-56" />
                <Skeleton className="mt-2 h-2 w-80 max-w-full" />
              </div>
            ))}
          </div>
        ))}
      </Panel>
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, p) => (
          <Panel key={p}>
            <div className="border-b border-line px-4 py-3"><Skeleton className="h-3 w-48" /></div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4" style={{ height: "var(--row-h, 36px)" }}>
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-2.5 w-36" />
                <Skeleton className="ml-auto h-2.5 w-16" />
              </div>
            ))}
          </Panel>
        ))}
      </div>
    </div>
  );
}
