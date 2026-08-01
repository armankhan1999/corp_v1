"use client";

/**
 * E11-S2 AC — "the supporting context is presented inline … so that an approver
 * never has to navigate away to decide."
 *
 * Every panel below is built from records that already exist in the dataset.
 * Where the seeded world genuinely has no data for a dimension (labour cost on
 * a job card, for instance) the panel says so rather than filling the gap with
 * a plausible number.
 */

import Link from "next/link";
import {
  ArrowUpRight, CalendarDays, Package, TrendingDown, TrendingUp, TriangleAlert, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  abbreviateINR, formatCount, formatDate, formatINR, formatPercent, formatQty, daysBetween,
} from "@/lib/format";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { Overline, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { DataRow, Note, SectionTitle } from "./ui";
import type { CustomerHistoryContext, SubjectContext } from "./types";

/* ------------------------------------------------------------- fragments */

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-0 px-3 py-2",
        cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn("t-overline px-2 py-1.5 font-semibold text-text-lo", right ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

function Td({ children, right, mono, className }: { children: React.ReactNode; right?: boolean; mono?: boolean; className?: string }) {
  return (
    <td
      className={cn(
        "px-2 py-1.5 text-[0.8125rem] text-text-mid",
        right && "text-right tabular-nums",
        mono && "t-mono",
        className,
      )}
    >
      {children}
    </td>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse">{children}</table>
    </div>
  );
}

function OpenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="t-body-sm inline-flex items-center gap-1 text-info hover:underline"
    >
      {children}
      <ArrowUpRight className="size-3" aria-hidden />
    </Link>
  );
}

function CustomerCard({ c, now }: { c: CustomerHistoryContext; now: Date }) {
  const util = c.creditLimit > 0 ? (c.outstanding / c.creditLimit) * 100 : 0;
  return (
    <div className="rounded-md border border-line">
      <SectionTitle right={<OpenLink href={c.href}>Customer 360</OpenLink>}>
        Customer history — {c.name}
      </SectionTitle>
      <Grid cols={4}>
        <DataRow label="Type">{c.type} · {c.industry}</DataRow>
        <DataRow label="Relationship since">{formatDate(c.since)}</DataRow>
        <DataRow label="Lifetime invoiced">{abbreviateINR(c.invoicedLifetime)}</DataRow>
        <DataRow label="Invoices">{formatCount(c.invoiceCount)}</DataRow>
        <DataRow label="Credit limit">{abbreviateINR(c.creditLimit)}</DataRow>
        <DataRow label="Credit term">{c.creditTermDays} days</DataRow>
        <DataRow label="Outstanding">
          <span className={util > 90 ? "text-danger" : util > 70 ? "text-warn" : "text-text-hi"}>
            {abbreviateINR(c.outstanding)}
          </span>
        </DataRow>
        <DataRow label="Oldest open">
          {c.oldestOpenDays > 0 ? `${c.oldestOpenDays} days` : "Nothing open"}
        </DataRow>
        <DataRow label="Limit utilisation">{formatPercent(util)}</DataRow>
        <DataRow label="Quotations won / lost">{c.quotationsWon} / {c.quotationsLost}</DataRow>
        <DataRow label="Win rate">
          {c.quotationsWon + c.quotationsLost > 0
            ? formatPercent((c.quotationsWon / (c.quotationsWon + c.quotationsLost)) * 100)
            : "No decided quotations"}
        </DataRow>
        <DataRow label="As at">{formatDate(now)}</DataRow>
      </Grid>
    </div>
  );
}

/* ------------------------------------------------------------------ main */

export function InlineContext({ context, now }: { context: SubjectContext; now: Date }) {
  switch (context.kind) {
    /* --------------------------------------------- discount: lines, margin */
    case "QUOTATION_DISCOUNT": {
      const belowFloor = context.marginPct < context.floorMarginPct;
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<OpenLink href={context.quotationHref}>Open quotation</OpenLink>}>
              Quotation {context.quotationNumber} · {context.vertical} · {formatDate(context.quotationDate)}
            </SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th>Line</Th>
                  <Th right>Qty</Th>
                  <Th right>Rate</Th>
                  <Th right>Disc %</Th>
                  <Th right>Line value</Th>
                  <Th right>Cost</Th>
                  <Th right>Margin</Th>
                </tr>
              </thead>
              <tbody>
                {context.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <Td className="text-text-hi">{l.description}</Td>
                    <Td right>{formatQty(l.qty, l.uom)}</Td>
                    <Td right>{formatINR(l.rate)}</Td>
                    <Td right>
                      <span className={l.discountPct >= 10 ? "text-warn" : "text-text-mid"}>
                        {formatPercent(l.discountPct)}
                      </span>
                    </Td>
                    <Td right>{formatINR(l.lineValue)}</Td>
                    <Td right>{formatINR(l.lineCost)}</Td>
                    <Td right>
                      <span className={l.marginPct < context.floorMarginPct ? "text-danger" : "text-ok"}>
                        {formatPercent(l.marginPct)}
                      </span>
                    </Td>
                  </tr>
                ))}
                {context.lines.length === 0 ? (
                  <tr><Td>No priced lines are recorded on this quotation.</Td></tr>
                ) : null}
              </tbody>
            </TableShell>
            <Grid cols={4}>
              <DataRow label="Gross">{abbreviateINR(context.grossValue)}</DataRow>
              <DataRow label="Discount">−{abbreviateINR(context.discountValue)}</DataRow>
              <DataRow label="Net">{abbreviateINR(context.netValue)}</DataRow>
              <DataRow label="Weighted discount">{formatPercent(context.weightedDiscountPct)}</DataRow>
            </Grid>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-3 py-2",
              belowFloor ? "border-danger/40 bg-danger-bg" : "border-ok/40 bg-ok-bg",
            )}
          >
            {belowFloor
              ? <TrendingDown className="size-4 shrink-0 text-danger" aria-hidden />
              : <TrendingUp className="size-4 shrink-0 text-ok" aria-hidden />}
            <div>
              <Overline>Margin at this discount</Overline>
              <p className={cn("t-heading-lg tabular-nums", belowFloor ? "text-danger" : "text-ok")}>
                {formatPercent(context.marginPct)}
              </p>
            </div>
            <div>
              <Overline>At list price</Overline>
              <p className="t-heading-lg tabular-nums text-text-hi">{formatPercent(context.marginPctAtListPrice)}</p>
            </div>
            <div>
              <Overline>Median on won business</Overline>
              <p className="t-heading-lg tabular-nums text-text-mid">{formatPercent(context.floorMarginPct)}</p>
            </div>
            <Explainer className="min-w-48 flex-1 text-text-mid">
              {belowFloor
                ? `This discount lands ${formatPercent(context.floorMarginPct - context.marginPct)} below the median margin realised on won business in ${context.vertical}.`
                : `This discount still clears the median margin realised on won business in ${context.vertical}.`}
              {" "}Cost basis is the item master standard cost; owner is {context.ownerName}.
            </Explainer>
          </div>

          <CustomerCard c={context.customer} now={now} />
        </div>
      );
    }

    /* --------------------------------- leave: team calendar, coverage impact */
    case "LEAVE": {
      const breaches = context.availableDuring < context.coverageMinimum;
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<OpenLink href={context.leaveHref}>Open leave record</OpenLink>}>
              {context.leaveNumber} · {context.leaveTypeName}
            </SectionTitle>
            <Grid cols={4}>
              <DataRow label="Employee">{context.employeeName} <span className="t-mono text-text-lo">{context.employeeCode}</span></DataRow>
              <DataRow label="Designation">{context.designation}</DataRow>
              <DataRow label="Branch">{context.branchLabel}</DataRow>
              <DataRow label="Duration">
                {formatDate(context.fromDate)} – {formatDate(context.toDate)} · {context.days} day{context.days === 1 ? "" : "s"}
              </DataRow>
              <DataRow label="Reason">{context.reason}</DataRow>
              <DataRow label="Coverage arrangement">{context.coverageArrangement}</DataRow>
              <DataRow label="Open tickets in branch">{formatCount(context.openTicketsInBranch)}</DataRow>
              <DataRow label="Notice given">
                {Math.max(0, daysBetween(now, context.fromDate))} days
              </DataRow>
            </Grid>
          </div>

          <div
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-2",
              breaches ? "border-danger/40 bg-danger-bg" : "border-line bg-surface-2",
            )}
          >
            <Users className={cn("mt-0.5 size-4 shrink-0", breaches ? "text-danger" : "text-text-lo")} aria-hidden />
            <div className="min-w-0">
              <p className="t-body-sm text-text-hi">
                Coverage impact — {context.availableDuring} of {context.teamSize} {context.designation.toLowerCase()}
                {context.teamSize === 1 ? "" : "s"} available at {context.branchLabel} during this range, against a
                configured minimum of {context.coverageMinimum}.
              </p>
              {context.coverageWarning ? (
                <p className="t-body-sm mt-1 text-danger">{context.coverageWarning}</p>
              ) : (
                <p className="t-body-sm mt-1 text-text-mid">
                  Approving this request keeps the branch at or above its configured minimum.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle>Team calendar for the requested range</SectionTitle>
            <div className="flex flex-wrap gap-px bg-line p-px">
              {context.calendar.map((d) => (
                <div
                  key={d.date}
                  className={cn(
                    "min-w-24 flex-1 bg-surface-1 px-2 py-1.5",
                    d.holiday && "bg-surface-2",
                  )}
                >
                  <p className="t-overline text-text-lo">{d.weekday} {formatDate(d.date).slice(0, 6)}</p>
                  {d.holiday ? (
                    <p className="t-body-sm text-warn">{d.holiday}</p>
                  ) : d.othersOut.length ? (
                    <p className="t-body-sm text-danger">{d.othersOut.length} also out</p>
                  ) : (
                    <p className="t-body-sm text-text-lo">Team present</p>
                  )}
                  {d.othersOut.slice(0, 2).map((n) => (
                    <p key={n} className="t-body-sm truncate text-text-mid">{n}</p>
                  ))}
                </div>
              ))}
              {context.calendar.length === 0 ? (
                <p className="t-body-sm bg-surface-1 px-3 py-2 text-text-lo">No days resolved for this range.</p>
              ) : null}
            </div>
            <Explainer className="border-t border-line px-3 py-1.5 text-text-lo">
              <CalendarDays className="mr-1 inline size-3" aria-hidden />
              Overlaps are approved leave for staff of the same designation at the same branch. Holidays are the
              branch calendar.
            </Explainer>
          </div>
        </div>
      );
    }

    /* ------------------------- purchase order: items, supplier, last rate */
    case "PURCHASE_ORDER": {
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<OpenLink href={context.poHref}>Open purchase order</OpenLink>}>
              {context.poNumber} · ordered {formatDate(context.orderDate)}
            </SectionTitle>
            <Grid cols={4}>
              <DataRow label="Supplier">{context.supplierName} <span className="t-mono text-text-lo">{context.supplierCode}</span></DataRow>
              <DataRow label="GSTIN" mono>{context.supplierGstin}</DataRow>
              <DataRow label="Payment terms">{context.supplierPaymentTerms}</DataRow>
              <DataRow label="Expected delivery">{formatDate(context.expectedDelivery)}</DataRow>
              <DataRow label="Order value">{abbreviateINR(context.orderValue)}</DataRow>
              <DataRow label="Prior orders with supplier">{formatCount(context.priorOrdersWithSupplier)}</DataRow>
              <DataRow label="Place of supply">State code {context.supplierStateCode}</DataRow>
              <DataRow label="Terms">{context.terms}</DataRow>
            </Grid>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle>Items, with the last purchase rate for each</SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th>Item</Th>
                  <Th right>Qty</Th>
                  <Th right>Rate</Th>
                  <Th right>Last rate</Th>
                  <Th right>Change</Th>
                  <Th right>On hand</Th>
                  <Th right>Line value</Th>
                </tr>
              </thead>
              <tbody>
                {context.lines.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <Td className="text-text-hi">
                      <span className="t-mono text-text-lo">{l.itemCode}</span> {l.description}
                      {l.serviceCritical && l.onHand <= l.reorderLevel ? (
                        <StatusBadge tone="warn" className="ml-2">Below reorder</StatusBadge>
                      ) : null}
                    </Td>
                    <Td right>{formatQty(l.qty, l.uom)}</Td>
                    <Td right>{formatINR(l.rate)}</Td>
                    <Td right>
                      {l.lastPurchaseRate !== null
                        ? <>{formatINR(l.lastPurchaseRate)}<span className="block text-text-lo">{l.lastPurchaseAt ? formatDate(l.lastPurchaseAt) : ""}{l.lastPurchaseSupplier ? ` · ${l.lastPurchaseSupplier}` : ""}</span></>
                        : <span className="text-text-lo">First purchase</span>}
                    </Td>
                    <Td right>
                      {l.variancePct === null ? (
                        <span className="text-text-lo">—</span>
                      ) : (
                        <span className={l.variancePct > 5 ? "text-danger" : l.variancePct < 0 ? "text-ok" : "text-text-mid"}>
                          {l.variancePct > 0 ? "+" : ""}{formatPercent(l.variancePct)}
                        </span>
                      )}
                    </Td>
                    <Td right>{formatQty(l.onHand, l.uom)}</Td>
                    <Td right>{formatINR(l.lineValue)}</Td>
                  </tr>
                ))}
                {context.lines.length === 0 ? (
                  <tr><Td>No lines are recorded on this purchase order.</Td></tr>
                ) : null}
              </tbody>
            </TableShell>
          </div>
          <Note tone="neutral">
            <Package className="mr-1 inline size-3" aria-hidden />
            Last purchase rate is the most recent line for the same item on an earlier order, from any supplier.
            &ldquo;First purchase&rdquo; means the item master has no prior purchase history.
          </Note>
        </div>
      );
    }

    /* ------------------------------------------------ credit limit override */
    case "CREDIT_LIMIT_OVERRIDE": {
      const over = context.headroomAfter < 0;
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle>Requested exposure</SectionTitle>
            <Grid cols={4}>
              <DataRow label="Current limit">{abbreviateINR(context.customer.creditLimit)}</DataRow>
              <DataRow label="Requested limit">{abbreviateINR(context.requestedLimit)}</DataRow>
              <DataRow label="Outstanding today">{abbreviateINR(context.customer.outstanding)}</DataRow>
              <DataRow label="Headroom if approved">
                <span className={over ? "text-danger" : "text-ok"}>{abbreviateINR(context.headroomAfter)}</span>
              </DataRow>
              <DataRow label="Limit utilisation">{formatPercent(context.utilisationPct)}</DataRow>
              <DataRow label="Open order book">{abbreviateINR(context.openOrdersValue)}</DataRow>
              <DataRow label="Oldest open invoice">{context.customer.oldestOpenDays} days</DataRow>
              <DataRow label="Credit term">{context.customer.creditTermDays} days</DataRow>
            </Grid>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle>Ageing of this customer&rsquo;s outstanding</SectionTitle>
            <div className="flex flex-col gap-px bg-line">
              {context.buckets.map((b) => (
                <div key={b.label} className="flex items-center justify-between bg-surface-1 px-3 py-1.5">
                  <span className="t-body-sm text-text-mid">{b.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="t-body-sm text-text-lo">{b.count} inv</span>
                    <span className="t-body tabular-nums text-text-hi">{abbreviateINR(b.value)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <CustomerCard c={context.customer} now={now} />
        </div>
      );
    }

    /* --------------------------------------------------- RA-bill submission */
    case "RA_BILL_SUBMISSION": {
      const totalDeductions = context.deductions.reduce((s, d) => s + d.value, 0);
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<OpenLink href={context.projectHref}>Open project</OpenLink>}>
              {context.billNumber} · {context.projectName}
            </SectionTitle>
            <Grid cols={4}>
              <DataRow label="Client">{context.clientName}</DataRow>
              <DataRow label="Period">{formatDate(context.periodFrom)} – {formatDate(context.periodTo)}</DataRow>
              <DataRow label="Previous cumulative">{abbreviateINR(context.previousCumulative)}</DataRow>
              <DataRow label="This cumulative">{abbreviateINR(context.cumulativeValue)}</DataRow>
              <DataRow label="Current period value">{abbreviateINR(context.currentPeriodValue)}</DataRow>
              <DataRow label="Claimed after deductions">{abbreviateINR(context.claimedValue)}</DataRow>
              <DataRow label="Executed to date">{abbreviateINR(context.executedValue)}</DataRow>
              <DataRow label="Physical progress">{formatPercent(context.progressPct)}</DataRow>
            </Grid>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle right={<span className="t-body-sm text-text-lo">Total {abbreviateINR(totalDeductions)}</span>}>
              Deductions applied
            </SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th>Deduction</Th>
                  <Th>Basis</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {context.deductions.map((d) => (
                  <tr key={d.label} className="border-b border-line last:border-0">
                    <Td className="text-text-hi">{d.label}</Td>
                    <Td>{d.basis}</Td>
                    <Td right>−{formatINR(d.value)}</Td>
                  </tr>
                ))}
                {context.deductions.length === 0 ? (
                  <tr><Td>No deductions apply to this bill.</Td></tr>
                ) : null}
              </tbody>
            </TableShell>
          </div>

          <Note tone={context.priorBillsAwaiting > 0 ? "warn" : "neutral"}>
            {context.priorBillsCertified} prior bill{context.priorBillsCertified === 1 ? "" : "s"} certified on this
            project; {context.priorBillsAwaiting} still awaiting certification. Contracted value{" "}
            {abbreviateINR(context.contractedValue)}.
          </Note>
        </div>
      );
    }

    /* ----------------------------------------------------- stock adjustment */
    case "STOCK_ADJUSTMENT":
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<OpenLink href={context.locationHref}>Open stock ledger</OpenLink>}>
              {context.locationName}
            </SectionTitle>
            <Grid cols={4}>
              <DataRow label="Counted">{formatDate(context.countedAt)}</DataRow>
              <DataRow label="Counted by">{context.countedBy}</DataRow>
              <DataRow label="Declared variance">{abbreviateINR(context.declaredVarianceValue)}</DataRow>
              <DataRow label="Location stock value">{abbreviateINR(context.locationStockValue)}</DataRow>
              <DataRow label="Variance as % of location">{formatPercent(context.variancePctOfLocation, 2)}</DataRow>
              <DataRow label="Service-critical below reorder">{formatCount(context.serviceCriticalBelowReorder)}</DataRow>
            </Grid>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle>Largest balances at this location</SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th>Item</Th>
                  <Th right>On hand</Th>
                  <Th right>Unit cost</Th>
                  <Th right>Value</Th>
                  <Th right>Reorder</Th>
                  <Th right>Last issue</Th>
                </tr>
              </thead>
              <tbody>
                {context.items.map((i) => (
                  <tr key={i.itemCode} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <Td className="text-text-hi">
                      <span className="t-mono text-text-lo">{i.itemCode}</span> {i.description}
                      {i.serviceCritical ? <StatusBadge tone="warn" className="ml-2">Service critical</StatusBadge> : null}
                    </Td>
                    <Td right>{formatQty(i.onHand, i.uom)}</Td>
                    <Td right>{formatINR(i.unitCost)}</Td>
                    <Td right>{formatINR(i.value)}</Td>
                    <Td right>{formatQty(i.reorderLevel)}</Td>
                    <Td right>{i.lastMovementAt ? formatDate(i.lastMovementAt) : "Never issued"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </div>

          <Note tone="warn">
            <TriangleAlert className="mr-1 inline size-3" aria-hidden />
            The prototype seeds no per-line physical count sheet, so the line-level variance split is not shown.
            The declared variance value on the request and the location&rsquo;s live balances are both real.
          </Note>
        </div>
      );

    /* ------------------------------------------------ AMC pricing exception */
    case "AMC_PRICING_EXCEPTION": {
      const down = context.deltaPct < 0;
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<OpenLink href={context.contractHref}>Open AMC contract</OpenLink>}>
              {context.contractNumber} · {context.customerName}
            </SectionTitle>
            <Grid cols={4}>
              <DataRow label="Coverage">{context.coverage}</DataRow>
              <DataRow label="Term">{formatDate(context.startDate)} – {formatDate(context.endDate)}</DataRow>
              <DataRow label="Machines covered">{formatCount(context.assetCount)}</DataRow>
              <DataRow label="Visits per year">{formatCount(context.visitsPerYear)}</DataRow>
              <DataRow label="Current contract value">{abbreviateINR(context.currentValue)}</DataRow>
              <DataRow label="Proposed value">{abbreviateINR(context.proposedValue)}</DataRow>
              <DataRow label="Change">
                <span className={down ? "text-danger" : "text-ok"}>
                  {context.deltaPct > 0 ? "+" : ""}{formatPercent(context.deltaPct)}
                </span>
              </DataRow>
              <DataRow label="Response / restoration">{context.responseHours} h / {context.restorationHours} h</DataRow>
            </Grid>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle>Twelve-month service record on the covered machines</SectionTitle>
            <Grid cols={3}>
              <DataRow label="Tickets logged">{formatCount(context.ticketsLastYear)}</DataRow>
              <DataRow label="Parts consumed at cost">{abbreviateINR(context.partsCostLastYear)}</DataRow>
              <DataRow label="Margin over parts">{formatPercent(context.marginOverPartsPct)}</DataRow>
            </Grid>
            <Explainer className="border-t border-line px-3 py-1.5 text-text-lo">
              Margin is over recorded parts cost only. Labour and travel are not costed on job cards in this
              prototype, so the true cost to serve is higher than shown.
            </Explainer>
          </div>
        </div>
      );
    }

    /* ----------------------------------------------------------- expense */
    case "EXPENSE_CLAIM":
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle>Claim summary — {context.periodLabel}</SectionTitle>
            <Grid cols={4}>
              <DataRow label="Employee">{context.employeeName} <span className="t-mono text-text-lo">{context.employeeCode}</span></DataRow>
              <DataRow label="Designation">{context.designation}</DataRow>
              <DataRow label="Branch">{context.branchLabel}</DataRow>
              <DataRow label="Claim total">{formatINR(context.claimTotal)}</DataRow>
              <DataRow label="Field visits in period">{formatCount(context.fieldVisits)}</DataRow>
              <DataRow label="Claim per visit">{context.fieldVisits ? formatINR(context.claimPerVisit) : "No visits recorded"}</DataRow>
              <DataRow label="Prior period visits">{formatCount(context.priorPeriodVisits)}</DataRow>
            </Grid>
          </div>

          <div className="rounded-md border border-line">
            <SectionTitle>Field visits supporting the claim</SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th>Job card</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Site</Th>
                  <Th>Outcome</Th>
                </tr>
              </thead>
              <tbody>
                {context.visits.map((v) => (
                  <tr key={v.number} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <Td mono className="text-text-hi">{v.number}</Td>
                    <Td>{formatDate(v.date)}</Td>
                    <Td>{v.customer}</Td>
                    <Td>{v.site}</Td>
                    <Td>{v.outcome}</Td>
                  </tr>
                ))}
                {context.visits.length === 0 ? (
                  <tr><Td>No field visits are recorded for this employee in the claim period.</Td></tr>
                ) : null}
              </tbody>
            </TableShell>
          </div>
          <Note tone="neutral">
            Job cards carry no travel or labour amount in the seeded world, so the claim is shown against visit
            count rather than a reconstructed line-item bill.
          </Note>
        </div>
      );

    /* -------------------------------------------------------- price list */
    case "PRICE_LIST_CHANGE":
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle right={<span className="t-body-sm text-text-lo">Effective {formatDate(context.effectiveFrom)}</span>}>
              {context.principal} price list · {context.averageDeltaPct > 0 ? "+" : ""}{formatPercent(context.averageDeltaPct)} across {context.lines.length} lines
            </SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th>Item</Th>
                  <Th right>Current</Th>
                  <Th right>Proposed</Th>
                  <Th right>Change</Th>
                  <Th right>Std cost</Th>
                  <Th right>Margin after</Th>
                </tr>
              </thead>
              <tbody>
                {context.lines.map((l) => (
                  <tr key={l.itemCode} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <Td className="text-text-hi"><span className="t-mono text-text-lo">{l.itemCode}</span> {l.description}</Td>
                    <Td right>{formatINR(l.currentRate)}</Td>
                    <Td right>{formatINR(l.proposedRate)}</Td>
                    <Td right>{l.deltaPct > 0 ? "+" : ""}{formatPercent(l.deltaPct)}</Td>
                    <Td right>{formatINR(l.standardCost)}</Td>
                    <Td right>{formatPercent(l.marginAfterPct)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </div>
          <Note tone={context.openQuotationsAffected > 0 ? "warn" : "neutral"}>
            {context.openQuotationsAffected} open quotation{context.openQuotationsAffected === 1 ? "" : "s"} quote
            these items and would price differently on revision.
          </Note>
        </div>
      );

    /* ------------------------------------------------------ user role change */
    case "USER_ROLE_CHANGE":
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line">
            <SectionTitle>Role change requested</SectionTitle>
            <Grid cols={4}>
              <DataRow label="User">{context.subjectUserName}</DataRow>
              <DataRow label="Email" mono>{context.subjectUserEmail}</DataRow>
              <DataRow label="Branch">{context.branchLabel}</DataRow>
              <DataRow label="Change">{ROLE_LABEL[context.fromRole]} → {ROLE_LABEL[context.toRole]}</DataRow>
            </Grid>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-ok/40">
              <SectionTitle>Capabilities gained ({context.capabilitiesGained.length})</SectionTitle>
              <p className="t-mono px-3 py-2 text-[0.75rem] text-ok">
                {context.capabilitiesGained.join(" · ") || "None"}
              </p>
            </div>
            <div className="rounded-md border border-danger/40">
              <SectionTitle>Capabilities lost ({context.capabilitiesLost.length})</SectionTitle>
              <p className="t-mono px-3 py-2 text-[0.75rem] text-danger">
                {context.capabilitiesLost.join(" · ") || "None"}
              </p>
            </div>
          </div>
          {context.grantsApprovalAuthority ? (
            <Note tone="warn">
              The target role carries approval authority. Approving this request changes who may sign off business
              decisions, not only who may read them.
            </Note>
          ) : null}
        </div>
      );

    default:
      return (
        <Note tone="warn">
          Supporting context could not be assembled: {context.note} The decision controls remain available, but the
          approver should open the subject record before acting.
        </Note>
      );
  }
}
