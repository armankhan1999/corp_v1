import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Calendar,
  ClipboardCheck,
  FileText,
  Gauge,
  History,
  Layers,
  ListChecks,
  MapPin,
  Package,
  Receipt,
  RotateCcw,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import {
  OEM_LABEL,
  PRODUCT_LINE_LABEL,
  type CoverageState,
  type RootCause,
} from "@/lib/schemas/enums";
import {
  abbreviateINR,
  enumLabel,
  formatCount,
  formatDate,
  formatDateTime,
  formatINR,
  formatQty,
} from "@/lib/format";
import { Overline, Panel, SimulatedBadge, StatusBadge } from "@/components/patterns/primitives";
import { AssetStatusBadge, CountdownPanel, PrincipalTag, SubmissionBadge, countdownOf } from "./badges";
import { AmcAlsoInForce, CoverageBadge, CoverageDerivation } from "./CoverageBadge";
import { CoverageTimeline } from "./CoverageTimeline";
import { RunningHoursChart, type HoursPoint } from "./RunningHoursChart";
import { Metric, Section, Serial, TableFrame, Td, Th } from "./ui";
import type {
  AssetRow,
  CoverageBand,
  CommissioningRow,
  DocumentRow,
  PartRow,
  TicketRow,
  VisitRow,
} from "./types";

export interface PassportProps {
  asset: AssetRow;
  bands: CoverageBand[];
  tickets: TicketRow[];
  visits: VisitRow[];
  parts: PartRow[];
  documents: DocumentRow[];
  hours: HoursPoint[];
  commissioning: CommissioningRow | null;
  amcHistory: {
    id: string;
    number: string;
    coverage: string;
    startDate: string;
    endDate: string;
    contractValue: number;
    status: string;
  }[];
  todayIso: string;
  showCommercial: boolean;
  canEdit: boolean;
}

const SEVERITY_TONE: Record<string, "danger" | "warn" | "info" | "neutral"> = {
  CRITICAL: "danger",
  HIGH: "warn",
  NORMAL: "info",
  LOW: "neutral",
};

function repeatFailures(visits: VisitRow[], tickets: TicketRow[]) {
  const counts = new Map<RootCause, { count: number; last: string; tickets: Set<string> }>();
  for (const v of visits) {
    if (!v.rootCause) continue;
    const cur = counts.get(v.rootCause) ?? { count: 0, last: v.scheduledDate, tickets: new Set<string>() };
    cur.count += 1;
    cur.tickets.add(v.ticketNumber);
    if (v.scheduledDate > cur.last) cur.last = v.scheduledDate;
    counts.set(v.rootCause, cur);
  }
  for (const t of tickets) {
    for (const rc of t.rootCauses) {
      const cur = counts.get(rc);
      if (cur) cur.tickets.add(t.number);
    }
  }
  return [...counts.entries()]
    .map(([cause, v]) => ({ cause, count: v.count, last: v.last, tickets: [...v.tickets] }))
    .sort((a, b) => b.count - a.count);
}

export function AssetPassport(props: PassportProps) {
  const {
    asset,
    bands,
    tickets,
    visits,
    parts,
    documents,
    hours,
    commissioning,
    amcHistory,
    todayIso,
    showCommercial,
    canEdit,
  } = props;
  const now = new Date(todayIso);

  const openTickets = tickets.filter(
    (t) => !["CLOSED", "CANCELLED", "RESOLVED"].includes(t.status),
  );
  const totalSpend = parts.reduce((s, p) => s + p.amount, 0);
  const billableSpend = parts.filter((p) => p.billable).reduce((s, p) => s + p.amount, 0);
  const repeats = repeatFailures(visits, tickets);
  const recurring = repeats.filter((r) => r.count >= 2);
  const amcAlsoLive =
    asset.coverage === "IN_WARRANTY" &&
    asset.amcNumber !== null &&
    asset.amcStart !== null &&
    asset.amcEnd !== null &&
    new Date(asset.amcStart) <= now &&
    new Date(asset.amcEnd) >= now;

  const countdown = commissioning
    ? countdownOf({
        deadline: commissioning.deadline,
        submittedAt: commissioning.submittedAt,
        windowDays: commissioning.windowDays,
        now,
      })
    : null;

  const coverageLabel: Record<CoverageState, string> = {
    IN_WARRANTY: "In warranty",
    UNDER_AMC: "Under AMC",
    OUT_OF_COVERAGE: "Out of coverage",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Identity header ------------------------------------------------- */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Overline>Asset passport</Overline>
              <PrincipalTag principal={asset.principal} />
              <AssetStatusBadge status={asset.status} />
            </div>
            <h1 className="t-display-md mt-1 break-words text-text-hi">
              <span className="t-mono text-[1.5rem] leading-tight">{asset.serial}</span>
            </h1>
            <p className="t-body mt-0.5 text-text-mid">{asset.model}</p>
            <p className="t-body-sm mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-text-lo">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {asset.customerName} · {asset.siteName}
                {asset.locationInSite ? ` · ${asset.locationInSite}` : ""}
              </span>
              <span>{asset.branchName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/field/commissioning/${asset.id}`}
              className="t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <ClipboardCheck className="size-4" aria-hidden />
              {commissioning ? "Open commissioning report" : "Record commissioning"}
            </Link>
            {canEdit ? (
              <Link
                href="/service/assets"
                className="t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <Layers className="size-4" aria-hidden />
                Back to register
              </Link>
            ) : null}
          </div>
        </div>

        {asset.status === "DECOMMISSIONED" && asset.decommissionReason ? (
          <p className="t-body-sm flex items-start gap-2 rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-warn">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Decommissioned — {asset.decommissionReason}. Excluded from coverage and renewal
              calculations; the full history below is retained.
            </span>
          </p>
        ) : null}
      </header>

      {/* Metric strip ---------------------------------------------------- */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        <li className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
          <Overline>Coverage — derived</Overline>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <CoverageBadge state={asset.coverage} />
            {amcAlsoLive && asset.amcNumber ? (
              <AmcAlsoInForce amcNumber={asset.amcNumber} amcEnd={asset.amcEnd} />
            ) : null}
          </div>
          <p className="t-body-sm mt-1 text-text-lo">{coverageLabel[asset.coverage]}</p>
        </li>
        <li>
          <Metric
            label="Warranty end"
            value={asset.warrantyEnd ? formatDate(asset.warrantyEnd) : "—"}
            sub={`${asset.warrantyMonths} months from commissioning`}
          />
        </li>
        <li>
          <Metric
            label="Running hours"
            value={formatCount(asset.runningHours)}
            sub={`read ${formatDate(asset.runningHoursAt)}`}
          />
        </li>
        <li>
          <Metric
            label="Service tickets"
            value={formatCount(tickets.length)}
            sub={`${openTickets.length} open · ${visits.length} visits`}
            tone={openTickets.length ? "warn" : "default"}
          />
        </li>
        {showCommercial ? (
          <li>
            <Metric
              label="Parts spend to date"
              value={abbreviateINR(totalSpend)}
              sub={`${abbreviateINR(billableSpend)} billable · ${parts.length} lines`}
            />
          </li>
        ) : (
          <li>
            <Metric label="Parts consumed" value={formatCount(parts.length)} sub="lines on record" />
          </li>
        )}
      </ul>

      {countdown && commissioning ? (
        <CountdownPanel
          state={countdown}
          deadline={commissioning.deadline}
          windowDays={commissioning.windowDays}
          principal={asset.principal}
        />
      ) : null}

      {recurring.length ? (
        <Panel className="border-warn/40">
          <div className="flex flex-wrap items-start gap-3 p-3">
            <RotateCcw className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="t-heading-md text-text-hi">Recurring fault detected</p>
              <p className="t-body-sm mt-0.5 text-text-mid">
                The same root cause has been diagnosed more than once on this machine. Read the
                grouped history before starting work.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {recurring.map((r) => (
                  <li
                    key={r.cause}
                    className="t-body-sm rounded-md border border-warn/40 bg-warn-bg px-2 py-1 text-warn"
                  >
                    {enumLabel(r.cause)} ×{r.count}
                    <span className="ml-1 text-text-mid">last {formatDate(r.last)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Single column on a phone; collapsible everywhere. --------------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            title="Coverage timeline"
            sub="Warranty and AMC periods against one date axis. Uncovered intervals are marked."
          >
            <CoverageTimeline
              bands={bands}
              now={now}
              emptyNote="No warranty or AMC period has ever been recorded against this machine, so there is nothing to plot. It has been out of coverage since installation."
            />
          </Section>

          <Section
            title="Ticket history"
            sub={`${tickets.length} tickets · repeat failures grouped by root cause`}
            right={
              openTickets.length ? (
                <StatusBadge tone="warn">{openTickets.length} open</StatusBadge>
              ) : (
                <StatusBadge tone="ok">All closed</StatusBadge>
              )
            }
          >
            {repeats.length ? (
              <div className="border-b border-line px-4 py-3">
                <Overline>Root-cause groups</Overline>
                <ul className="mt-1.5 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
                  {repeats.map((r) => (
                    <li
                      key={r.cause}
                      className="flex flex-wrap items-center justify-between gap-2 bg-surface-1 px-3 py-1.5"
                    >
                      <span className="t-body-sm flex items-center gap-2 text-text-hi">
                        {r.count >= 2 ? (
                          <RotateCcw className="size-3.5 shrink-0 text-warn" aria-hidden />
                        ) : (
                          <Wrench className="size-3.5 shrink-0 text-text-lo" aria-hidden />
                        )}
                        {enumLabel(r.cause)}
                        {r.count >= 2 ? (
                          <span className="t-overline rounded-md border border-warn/40 bg-warn-bg px-1 text-warn">
                            Recurring
                          </span>
                        ) : null}
                      </span>
                      <span className="t-body-sm tabular-nums text-text-mid">
                        {r.count} visit{r.count === 1 ? "" : "s"} ·{" "}
                        <span className="text-text-lo">{r.tickets.join(", ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tickets.length ? (
              <TableFrame>
                <thead>
                  <tr>
                    <Th>Ticket</Th>
                    <Th>Problem</Th>
                    <Th>Severity</Th>
                    <Th>Coverage</Th>
                    <Th>Logged</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="h-[var(--row-h,36px)] hover:bg-surface-2">
                      <Td nowrap>
                        <Link href={`/service/tickets/${t.id}`} className="t-mono text-text-hi hover:underline">
                          {t.number}
                        </Link>
                      </Td>
                      <Td className="max-w-[22rem]">
                        <span className="block text-text-hi">{t.problem}</span>
                        <span className="t-body-sm block text-text-lo">
                          {enumLabel(t.category)}
                          {t.rootCauses.length
                            ? ` · ${t.rootCauses.map(enumLabel).join(", ")}`
                            : ""}
                        </span>
                      </Td>
                      <Td nowrap>
                        <StatusBadge tone={SEVERITY_TONE[t.severity] ?? "neutral"}>
                          {enumLabel(t.severity)}
                        </StatusBadge>
                      </Td>
                      <Td nowrap>
                        <span className="t-body-sm text-text-mid">{enumLabel(t.coverage)}</span>
                      </Td>
                      <Td nowrap>{formatDate(t.loggedAt)}</Td>
                      <Td nowrap>
                        <StatusBadge
                          tone={
                            t.breached
                              ? "danger"
                              : t.status === "CLOSED" || t.status === "RESOLVED"
                                ? "ok"
                                : "warn"
                          }
                        >
                          {enumLabel(t.status)}
                        </StatusBadge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            ) : (
              <p className="t-body-sm px-4 py-6 text-text-mid">
                No service ticket has ever been raised against this machine.
              </p>
            )}
          </Section>

          <Section
            title="Visits and outcomes"
            sub={`${visits.length} job cards, newest first`}
            defaultOpen={false}
          >
            {visits.length ? (
              <TableFrame>
                <thead>
                  <tr>
                    <Th>Job card</Th>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Engineer</Th>
                    <Th>Root cause</Th>
                    <Th>Work performed</Th>
                    <Th>Outcome</Th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="h-[var(--row-h,36px)] hover:bg-surface-2">
                      <Td nowrap>
                        <Link href={`/service/job-cards/${v.id}`} className="t-mono text-text-hi hover:underline">
                          {v.number}
                        </Link>
                      </Td>
                      <Td nowrap>{formatDate(v.scheduledDate)}</Td>
                      <Td nowrap>{enumLabel(v.visitType)}</Td>
                      <Td nowrap>{v.engineerName}</Td>
                      <Td nowrap>{v.rootCause ? enumLabel(v.rootCause) : "—"}</Td>
                      <Td className="max-w-[20rem]">{v.workPerformed || v.observations || "—"}</Td>
                      <Td nowrap>
                        {v.outcome ? (
                          <StatusBadge
                            tone={
                              v.outcome === "RESOLVED"
                                ? "ok"
                                : v.outcome === "NOT_ATTENDED"
                                  ? "danger"
                                  : "warn"
                            }
                          >
                            {enumLabel(v.outcome)}
                          </StatusBadge>
                        ) : (
                          <span className="text-text-lo">In progress</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableFrame>
            ) : (
              <p className="t-body-sm px-4 py-6 text-text-mid">
                No engineer has visited this machine yet.
              </p>
            )}
          </Section>

          <Section
            title="Parts consumed"
            sub={
              showCommercial
                ? `${parts.length} lines · ${formatINR(totalSpend)} spent on this machine to date`
                : `${parts.length} lines · values withheld — your role holds no commercial permission`
            }
            defaultOpen={false}
            right={<Package className="size-4 text-text-lo" aria-hidden />}
          >
            {parts.length ? (
              <>
                <TableFrame>
                  <thead>
                    <tr>
                      <Th>Part</Th>
                      <Th numeric>Qty</Th>
                      <Th>Date</Th>
                      <Th>Job card</Th>
                      <Th>Basis</Th>
                      {showCommercial ? <Th numeric>Rate</Th> : null}
                      {showCommercial ? <Th numeric>Amount</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((p) => (
                      <tr key={p.id} className="h-[var(--row-h,36px)] hover:bg-surface-2">
                        <Td>
                          <span className="t-mono block text-text-hi">{p.itemCode}</span>
                          <span className="t-body-sm block text-text-lo">{p.description}</span>
                        </Td>
                        <Td numeric nowrap>
                          {formatQty(p.qty, p.uom)}
                        </Td>
                        <Td nowrap>{formatDate(p.at)}</Td>
                        <Td nowrap>
                          <Link
                            href={`/service/job-cards/${p.jobCardId}`}
                            className="t-mono text-text-mid hover:underline"
                          >
                            {p.jobCardNumber}
                          </Link>
                        </Td>
                        <Td nowrap>{p.billable ? "Chargeable" : "Under coverage"}</Td>
                        {showCommercial ? <Td numeric>{formatINR(p.rate)}</Td> : null}
                        {showCommercial ? <Td numeric>{formatINR(p.amount)}</Td> : null}
                      </tr>
                    ))}
                  </tbody>
                </TableFrame>
                {showCommercial ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
                    <span className="t-body-sm text-text-mid">Total spend on this machine to date</span>
                    <span className="t-heading-md tabular-nums text-text-hi">
                      {formatINR(totalSpend)}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="t-body-sm px-4 py-6 text-text-mid">
                No part has been consumed on this machine.
              </p>
            )}
          </Section>

          <Section
            title="Running-hours history"
            sub="Readings captured on each job card, plus the current meter."
            defaultOpen={false}
            right={<Gauge className="size-4 text-text-lo" aria-hidden />}
          >
            <RunningHoursChart points={hours} />
          </Section>
        </div>

        {/* Right column ------------------------------------------------- */}
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Identity and specification" sub="As registered.">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4">
              {(
                [
                  ["Serial number", <Serial key="s" value={asset.serial} />],
                  ["OEM principal", OEM_LABEL[asset.principal]],
                  ["Product line", PRODUCT_LINE_LABEL[asset.productLine]],
                  ["Model / series", asset.model],
                  ["Capacity", formatQty(asset.capacityValue, asset.capacityUnit)],
                  ["Rated power", asset.ratedKw === null ? "—" : `${asset.ratedKw} kW`],
                  ["Catalogue item", asset.itemCode || "Not linked"],
                  ["Customer", asset.customerName],
                  ["Site", `${asset.siteName}${asset.siteDistrict ? `, ${asset.siteDistrict}` : ""}`],
                  ["Location within site", asset.locationInSite || "—"],
                  ["Sale invoice", asset.saleInvoiceNumber ?? "Not linked"],
                  ["Installation date", asset.installationDate ? formatDate(asset.installationDate) : "—"],
                  ["Commissioning date", asset.commissioningDate ? formatDate(asset.commissioningDate) : "Not commissioned"],
                  ["Warranty duration", `${asset.warrantyMonths} months`],
                  ["Branch", asset.branchName],
                ] as [string, React.ReactNode][]
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <Overline>{k}</Overline>
                  <dd className="t-body-sm break-words text-text-hi">{v}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Coverage derivation" sub="Why this machine reads as it does.">
            <div className="px-4 py-4">
              <CoverageDerivation
                state={asset.coverage}
                warrantyEnd={asset.warrantyEnd}
                amcNumber={asset.amcNumber}
                amcEnd={asset.amcEnd}
                decommissioned={asset.status === "DECOMMISSIONED"}
                now={now}
              />
            </div>
          </Section>

          <Section
            title="Commissioning report"
            sub={commissioning ? commissioning.number : "Not recorded"}
            right={<ClipboardCheck className="size-4 text-text-lo" aria-hidden />}
          >
            {commissioning ? (
              <div className="flex flex-col gap-3 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SubmissionBadge state={commissioning.submission} />
                  {commissioning.cleanReport ? (
                    <StatusBadge tone="ok">Clean</StatusBadge>
                  ) : (
                    <StatusBadge tone="warn">
                      Commissioned with observations ({commissioning.failedItems})
                    </StatusBadge>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["Commissioned", formatDate(commissioning.commissioningDate)],
                      ["OEM deadline", formatDate(commissioning.deadline)],
                      ["Submitted", commissioning.submittedAt ? formatDate(commissioning.submittedAt) : "Not submitted"],
                      ["Acknowledgement", commissioning.acknowledgementRef ?? "—"],
                      ["Engineer", commissioning.engineerName],
                      ["Warranty to", commissioning.warrantyEnd ? formatDate(commissioning.warrantyEnd) : "—"],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <Overline>{k}</Overline>
                      <dd className="t-body-sm break-words text-text-hi">{v}</dd>
                    </div>
                  ))}
                </dl>
                {commissioning.acknowledgementRef ? (
                  <SimulatedBadge what="OEM channel portal (INT-11)" />
                ) : null}
                <Link
                  href={`/field/commissioning/${asset.id}`}
                  className="t-body-sm inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
                >
                  Open the full report
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-4 py-4">
                <p className="t-body-sm text-text-mid">
                  No commissioning report exists for this machine, so no OEM submission clock is
                  running and warranty start has not been fixed from a commissioning date.
                </p>
                <Link
                  href={`/field/commissioning/${asset.id}`}
                  className="t-body-sm inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-primary-600 bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-500"
                >
                  Record the commissioning report
                </Link>
              </div>
            )}
          </Section>

          <Section
            title="AMC history"
            sub={`${amcHistory.length} contract${amcHistory.length === 1 ? "" : "s"} have covered this machine`}
            defaultOpen={false}
            right={<Receipt className="size-4 text-text-lo" aria-hidden />}
          >
            {amcHistory.length ? (
              <ul className="flex flex-col gap-px bg-line">
                {amcHistory.map((c) => (
                  <li key={c.id} className="bg-surface-1 px-4 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/service/amc/${c.id}`} className="t-mono text-text-hi hover:underline">
                        {c.number}
                      </Link>
                      <StatusBadge tone={c.status === "ACTIVE" ? "ok" : c.status === "EXPIRING" ? "warn" : "neutral"}>
                        {enumLabel(c.status)}
                      </StatusBadge>
                    </div>
                    <p className="t-body-sm mt-0.5 text-text-mid">
                      {enumLabel(c.coverage)} · {formatDate(c.startDate)} → {formatDate(c.endDate)}
                    </p>
                    {showCommercial ? (
                      <p className="t-body-sm tabular-nums text-text-lo">
                        {formatINR(c.contractValue)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body-sm px-4 py-6 text-text-mid">
                This machine has never been under an AMC contract.
              </p>
            )}
          </Section>

          <Section
            title="Service reports"
            sub="Generated from each completed job card."
            defaultOpen={false}
            right={<ListChecks className="size-4 text-text-lo" aria-hidden />}
          >
            {visits.filter((v) => v.submittedAt).length ? (
              <ul className="flex flex-col gap-px bg-line">
                {visits
                  .filter((v) => v.submittedAt)
                  .map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 bg-surface-1 px-4 py-2">
                      <span className="min-w-0">
                        <Link
                          href={`/service/job-cards/${v.id}`}
                          className="t-mono inline-flex min-h-6 items-center text-text-hi hover:underline"
                        >
                          {v.number}
                        </Link>
                        <span className="t-body-sm block text-text-lo">
                          {enumLabel(v.visitType)} · {v.engineerName}
                        </span>
                      </span>
                      <span className="t-body-sm shrink-0 text-text-mid">
                        {formatDateTime(v.submittedAt as string)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="t-body-sm px-4 py-6 text-text-mid">
                No service report has been submitted for this machine yet.
              </p>
            )}
          </Section>

          <Section
            title="Related documents"
            sub={`${documents.length} in the vault`}
            defaultOpen={false}
            right={<FileText className="size-4 text-text-lo" aria-hidden />}
          >
            {documents.length ? (
              <ul className="flex flex-col gap-px bg-line">
                {documents.map((d) => (
                  <li key={d.id} className="bg-surface-1 px-4 py-2">
                    <Link href={`/vault?doc=${d.id}`} className="t-body-sm block text-text-hi hover:underline">
                      {d.title}
                    </Link>
                    <span className="t-body-sm block text-text-lo">
                      {enumLabel(d.type)} · v{d.version} · {formatDate(d.uploadedAt)} · {d.pageCount}{" "}
                      pages · {formatCount(d.sizeKb)} KB
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-body-sm px-4 py-6 text-text-mid">
                No document in the vault is linked to this machine.
              </p>
            )}
          </Section>

          <Section title="Activity summary" defaultOpen={false} right={<Activity className="size-4 text-text-lo" aria-hidden />}>
            <dl className="grid grid-cols-2 gap-3 px-4 py-4">
              {(
                [
                  ["First recorded event", asset.commissioningDate ? formatDate(asset.commissioningDate) : "—"],
                  ["Last service", asset.lastServiceAt ? formatDate(asset.lastServiceAt) : "Never"],
                  ["Tickets raised", formatCount(tickets.length)],
                  ["Visits made", formatCount(visits.length)],
                  ["Parts lines", formatCount(parts.length)],
                  ["Documents", formatCount(documents.length)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k}>
                  <Overline>{k}</Overline>
                  <dd className="t-body-sm tabular-nums text-text-hi">{v}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>

      <p className="t-body-sm flex items-center gap-2 text-text-lo">
        <History className="size-3.5" aria-hidden />
        Every figure on this passport is read from the record behind it. Coverage recomputes on each
        read against the simulated clock at {formatDateTime(now)}.
        <Calendar className="size-3.5" aria-hidden />
      </p>
    </div>
  );
}
