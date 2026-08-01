"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CalendarClock,
  CircleCheck,
  ListChecks,
  Play,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { AMCStatus } from "@/lib/schemas/enums";
import { daysBetween, formatCount, formatDate, formatINR, formatPercent } from "@/lib/format";
import { Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge } from "@/components/patterns/primitives";
import { AmcStatusBadge } from "./badges";
import { CoverageBadge } from "./CoverageBadge";
import { fulfilmentOf } from "./metrics";
import {
  EMPTY_AMC,
  applyAmcOverlay,
  generateVisitSchedule,
  localNumber,
  useOverlay,
  type AmcOverlay,
} from "./store";
import {
  BlockedNote,
  Button,
  Field,
  FormulaDisclosure,
  Metric,
  Modal,
  Row,
  Section,
  Select,
  Serial,
  TableFrame,
  Td,
  TextArea,
  Th,
} from "./ui";
import type { AmcRow, AmcVisitRow, AssetRow } from "./types";

const TERMINATION_REASONS = [
  "Customer closed the plant permanently",
  "Machine sold on by the customer",
  "Contract superseded by a consolidated agreement",
  "Non-payment beyond the agreed credit period",
  "Service standards disputed and settled by mutual exit",
  "Duplicate contract raised in error",
];

function statusFromDates(row: AmcRow, now: Date): AMCStatus {
  if (row.terminated) return "TERMINATED";
  if (row.renewedIntoId) return "RENEWED";
  const start = new Date(row.startDate);
  const end = new Date(row.endDate);
  if (start > now) return "DRAFT";
  if (end < now) return "EXPIRED";
  return daysBetween(now, end) <= 60 ? "EXPIRING" : "ACTIVE";
}

export function AmcDetail({
  contract: seedContract,
  visits: seedVisits,
  assets,
  todayIso,
  canEdit,
}: {
  contract: AmcRow;
  visits: AmcVisitRow[];
  assets: AssetRow[];
  todayIso: string;
  canEdit: boolean;
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const { state: overlay, ready, update } = useOverlay<AmcOverlay>("pravaah.v1.amc", EMPTY_AMC);

  const contract =
    applyAmcOverlay([seedContract], overlay).find((c) => c.id === seedContract.id) ?? seedContract;
  const status = statusFromDates(contract, now);

  const visits = React.useMemo(() => {
    const generated = overlay.visits[contract.id];
    const base = generated && generated.length ? generated : seedVisits;
    return [...base].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [overlay.visits, contract.id, seedVisits]);

  const committed = visits.length;
  const completed = visits.filter((v) => v.completedAt).length;
  const dueToDate = visits.filter((v) => new Date(v.dueDate) <= now).length;
  const f = fulfilmentOf({ committed, completed, dueToDate });

  const dueSoon = visits.filter((v) => {
    if (v.completedAt) return false;
    const d = daysBetween(now, v.dueDate);
    return d >= 0 && d <= 7;
  });
  const overdueVisits = visits.filter((v) => !v.completedAt && new Date(v.dueDate) < now);

  const [terminateOpen, setTerminateOpen] = React.useState(false);
  const [reason, setReason] = React.useState(TERMINATION_REASONS[0]!);
  const [note, setNote] = React.useState("");

  function activate() {
    const generated = generateVisitSchedule(contract);
    update((prev) => ({ ...prev, visits: { ...prev.visits, [contract.id]: generated } }));
  }

  function terminate() {
    if (!reason.trim()) return;
    const full = note.trim() ? `${reason} — ${note.trim()}` : reason;
    update((prev) => ({
      ...prev,
      patches: {
        ...prev.patches,
        [contract.id]: {
          ...prev.patches[contract.id],
          terminated: true,
          terminationReason: full,
          status: "TERMINATED",
        },
      },
    }));
    setTerminateOpen(false);
  }

  function convertToTicket(visit: AmcVisitRow) {
    const ticketNumber = localNumber("BC/TKT/2627");
    update((prev) => ({
      ...prev,
      converted: {
        ...prev.converted,
        [visit.id]: { ticketNumber, at: now.toISOString() },
      },
    }));
  }

  const scheduleGenerated = committed > 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Overline>AMC contract</Overline>
              <AmcStatusBadge status={status} />
              {contract.local ? (
                <span className="t-overline rounded border border-line bg-surface-2 px-1 text-text-lo">
                  Created in this browser
                </span>
              ) : null}
            </div>
            <h1 className="t-display-md mt-1 text-text-hi">
              <span className="t-mono text-[1.5rem] leading-tight">{contract.number}</span>
            </h1>
            <p className="t-body mt-0.5 text-text-mid">{contract.customerName}</p>
            <p className="t-body-sm text-text-lo">
              {contract.branchCode} · owner {contract.ownerName} ·{" "}
              {contract.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status === "DRAFT" && !scheduleGenerated && canEdit ? (
              <Button tone="primary" onClick={activate}>
                <Play className="size-4" aria-hidden />
                Activate and generate visits
              </Button>
            ) : null}
            <Link
              href={`/service/renewals?contract=${contract.id}`}
              className="t-body-sm inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Renewal radar
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            {canEdit && !contract.terminated ? (
              <Button tone="danger" onClick={() => setTerminateOpen(true)}>
                <Ban className="size-4" aria-hidden />
                Terminate
              </Button>
            ) : null}
          </div>
        </div>

        {contract.terminated && contract.terminationReason ? (
          <p className="t-body-sm flex items-start gap-2 rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-warn">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Terminated — {contract.terminationReason}</span>
          </p>
        ) : null}
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li>
          <Metric label="Contract value" value={formatINR(contract.contractValue)} sub={contract.billingSchedule.replace(/_/g, " ").toLowerCase()} />
        </li>
        <li>
          <Metric
            label="Period"
            value={`${formatDate(contract.startDate)}`}
            sub={`to ${formatDate(contract.endDate)} · ${contract.daysRemaining >= 0 ? `${contract.daysRemaining} days left` : "ended"}`}
          />
        </li>
        <li>
          <Metric
            label="Visit fulfilment"
            value={`${completed} / ${committed}`}
            sub={`${formatPercent(f.pct)} of committed`}
            tone={f.behindSchedule ? "warn" : "ok"}
          />
        </li>
        <li>
          <Metric
            label="Covered machines"
            value={formatCount(contract.assetIds.length)}
            sub={`${contract.visitsPerYear} visits per machine per year`}
            tone="info"
          />
        </li>
      </ul>

      {f.behindSchedule ? (
        <Panel className="border-warn/40">
          <div className="flex flex-wrap items-start gap-3 p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="t-heading-md text-text-hi">Behind schedule by {f.behindBy} visits</p>
              <p className="t-body-sm mt-0.5 text-text-mid">
                {dueToDate} preventive visits have fallen due to date and {completed} are recorded
                complete. The gap is what the customer has been promised and not yet received.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      <FormulaDisclosure
        title="How fulfilment and the behind-schedule flag are calculated"
        formula={`Fulfilment ${formatPercent(f.pct)} = ${completed} completed ÷ ${committed} committed · behind by ${f.behindBy} = ${dueToDate} due to date − ${completed} completed`}
        note="Committed visits are generated on activation at even intervals across the contract period, one set per covered machine. A contract is flagged behind schedule whenever completions trail the visits already due."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            title="Preventive visit schedule"
            sub={`${committed} generated · ${completed} complete · ${overdueVisits.length} overdue`}
            right={
              dueSoon.length ? (
                <StatusBadge tone="warn">{dueSoon.length} due within 7 days</StatusBadge>
              ) : (
                <StatusBadge tone="ok">Nothing due this week</StatusBadge>
              )
            }
          >
            {!ready ? (
              <div className="flex flex-col gap-px bg-line p-px">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-9 bg-surface-1" />
                ))}
              </div>
            ) : committed === 0 ? (
              <div className="flex flex-col gap-3 px-4 py-6">
                <p className="t-body-sm text-text-mid">
                  No preventive visits have been generated. Activation spreads the committed visits
                  evenly across the contract period and gives each one a due date.
                </p>
                {canEdit ? (
                  <Button tone="primary" className="self-start" onClick={activate}>
                    <Play className="size-4" aria-hidden />
                    Activate and generate {contract.visitsPerYear * contract.assetIds.length} visits
                  </Button>
                ) : (
                  <BlockedNote
                    rule="Only a role with write access to AMC contracts can activate a contract."
                    unblock="asking the Service Manager to activate it."
                  />
                )}
              </div>
            ) : (
              <TableFrame>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Machine</Th>
                    <Th>Due date</Th>
                    <Th>State</Th>
                    <Th>Ticket</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => {
                    const converted = overlay.converted[v.id];
                    const days = daysBetween(now, v.dueDate);
                    const overdue = !v.completedAt && days < 0;
                    const soon = !v.completedAt && days >= 0 && days <= 7;
                    return (
                      <Row key={v.id} tone={overdue ? "danger" : soon ? "warn" : "none"}>
                        <Td nowrap>
                          <span className="t-mono text-text-mid">{v.sequence}</span>
                        </Td>
                        <Td nowrap>
                          <Link
                            href={`/service/assets/${encodeURIComponent(v.serial)}`}
                            className="hover:underline"
                          >
                            <Serial value={v.serial} />
                          </Link>
                        </Td>
                        <Td nowrap>
                          <span className="block text-text-mid">{formatDate(v.dueDate)}</span>
                          <span className="t-body-sm block text-text-lo">
                            {v.completedAt
                              ? `completed ${formatDate(v.completedAt)}`
                              : days >= 0
                                ? `in ${days} days`
                                : `${Math.abs(days)} days overdue`}
                          </span>
                        </Td>
                        <Td nowrap>
                          {v.completedAt ? (
                            <StatusBadge tone="ok">Completed</StatusBadge>
                          ) : overdue ? (
                            <StatusBadge tone="danger">Overdue</StatusBadge>
                          ) : soon ? (
                            <StatusBadge tone="warn">Due within 7 days</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Forward planned</StatusBadge>
                          )}
                        </Td>
                        <Td nowrap>
                          {converted ? (
                            <span className="flex flex-col gap-0.5">
                              <span className="t-mono text-text-hi">{converted.ticketNumber}</span>
                              <span className="t-body-sm text-text-lo">
                                raised {formatDate(converted.at)}
                              </span>
                            </span>
                          ) : v.ticketNumber ? (
                            <Link href="/service/tickets" className="t-mono text-text-mid hover:underline">
                              {v.ticketNumber}
                            </Link>
                          ) : (
                            <span className="text-text-lo">—</span>
                          )}
                        </Td>
                        <Td className="text-right" nowrap>
                          {v.completedAt || converted || v.ticketNumber ? (
                            <span className="t-body-sm text-text-lo">—</span>
                          ) : soon || overdue ? (
                            <Button disabled={!canEdit} onClick={() => convertToTicket(v)}>
                              <Wrench className="size-3.5" aria-hidden />
                              Convert to ticket
                            </Button>
                          ) : (
                            <span
                              className="t-body-sm text-text-lo"
                              title="A forward-planned visit becomes convertible once it falls due within seven days."
                            >
                              Not yet due
                            </span>
                          )}
                        </Td>
                      </Row>
                    );
                  })}
                </tbody>
              </TableFrame>
            )}
            {dueSoon.length ? (
              <p className="t-body-sm flex items-center gap-2 border-t border-line px-4 py-2 text-text-mid">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                {dueSoon.length} visit{dueSoon.length === 1 ? "" : "s"} appear on the dispatch board
                as forward-planned work and convert to a ticket in one action.
                <SimulatedBadge what="ticket creation from this screen (local to the browser)" />
              </p>
            ) : null}
          </Section>

          <Section
            title="Covered machines"
            sub="Each recomputes to Under AMC for the contract period."
            right={<ListChecks className="size-4 text-text-lo" aria-hidden />}
          >
            <TableFrame>
              <thead>
                <tr>
                  <Th>Serial</Th>
                  <Th>Machine</Th>
                  <Th>Site</Th>
                  <Th>Coverage now</Th>
                  <Th>Warranty end</Th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <Row key={a.id}>
                    <Td nowrap>
                      <Link href={`/service/assets/${encodeURIComponent(a.serial)}`} className="hover:underline">
                        <Serial value={a.serial} />
                      </Link>
                    </Td>
                    <Td>{a.model}</Td>
                    <Td>{a.siteName}</Td>
                    <Td nowrap>
                      <CoverageBadge state={a.coverage} />
                    </Td>
                    <Td nowrap>{a.warrantyEnd ? formatDate(a.warrantyEnd) : "—"}</Td>
                  </Row>
                ))}
              </tbody>
            </TableFrame>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader title="Contract terms" sub="As captured on the agreement." />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
              {(
                [
                  ["Contract number", contract.number],
                  ["Customer", contract.customerName],
                  [
                    "Coverage type",
                    contract.coverage === "COMPREHENSIVE" ? "Comprehensive" : "Non-comprehensive",
                  ],
                  ["Start date", formatDate(contract.startDate)],
                  ["End date", formatDate(contract.endDate)],
                  ["Contract value", formatINR(contract.contractValue)],
                  ["Billing schedule", contract.billingSchedule.replace(/_/g, " ").toLowerCase()],
                  ["Committed visits", `${contract.visitsPerYear} per machine per year`],
                  ["Response commitment", `${contract.responseHours} hours`],
                  ["Restoration commitment", `${contract.restorationHours} hours`],
                  ["Owner", contract.ownerName],
                  ["Branch", contract.branchCode],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <Overline>{k}</Overline>
                  <dd className="t-body-sm break-words text-text-hi">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Section title="Inclusions" defaultOpen>
            <p className="t-body-sm px-4 py-3 text-text-mid">{contract.inclusions}</p>
          </Section>

          <Section title="Exclusions" defaultOpen>
            <p className="t-body-sm px-4 py-3 text-text-mid">{contract.exclusions}</p>
          </Section>

          <Panel>
            <PanelHeader title="Status derivation" sub="Dates decide, not a dropdown." />
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <AmcStatusBadge status={status} />
                <span className="t-overline text-text-lo">Derived</span>
              </div>
              <p className="t-body-sm text-text-mid">
                Start {formatDate(contract.startDate)}, end {formatDate(contract.endDate)}, simulated
                date {formatDate(now)}.{" "}
                {status === "DRAFT"
                  ? "The start date is still ahead, so the contract reads Draft."
                  : status === "EXPIRED"
                    ? "The end date has passed, so the contract reads Expired."
                    : status === "EXPIRING"
                      ? `${contract.daysRemaining} days remain, inside the 60-day window, so the contract reads Expiring.`
                      : status === "TERMINATED"
                        ? "Terminated is the only state set by hand, and it required a reason."
                        : status === "RENEWED"
                          ? "A successor contract exists, so this one reads Renewed."
                          : `${contract.daysRemaining} days remain, beyond the 60-day window, so the contract reads Active.`}
              </p>
              <p className="t-body-sm text-text-lo">
                Advancing the simulated clock moves the status without anyone editing it.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Delivery position" />
            <ul className="flex flex-col gap-px bg-line">
              {(
                [
                  ["Committed visits", String(committed), null],
                  ["Due to date", String(dueToDate), null],
                  ["Completed", String(completed), completed >= dueToDate],
                  ["Outstanding against due", String(f.behindBy), f.behindBy === 0],
                  ["Overdue and unassigned", String(overdueVisits.length), overdueVisits.length === 0],
                ] as [string, string, boolean | null][]
              ).map(([k, v, ok]) => (
                <li key={k} className="flex items-center justify-between gap-2 bg-surface-1 px-4 py-2">
                  <span className="t-body-sm flex items-center gap-1.5 text-text-mid">
                    {ok === null ? null : ok ? (
                      <CircleCheck className="size-3.5 text-ok" aria-hidden />
                    ) : (
                      <TriangleAlert className="size-3.5 text-warn" aria-hidden />
                    )}
                    {k}
                  </span>
                  <span className="t-body tabular-nums text-text-hi">{v}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Modal
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        title="Terminate contract"
        description="Termination is the only contract status set by hand, and it requires a reason."
        footer={
          <>
            <Button onClick={() => setTerminateOpen(false)}>Cancel</Button>
            <Button tone="danger" onClick={terminate} disabled={!reason.trim()}>
              Terminate contract
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {TERMINATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" hint="Optional detail appended to the reason.">
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <p className="t-body-sm rounded-md border border-line bg-surface-0 px-2.5 py-2 text-text-mid">
            On termination the {contract.assetIds.length} covered machine
            {contract.assetIds.length === 1 ? "" : "s"} recompute their coverage — any that are not
            in warranty fall to Out of coverage and appear on the renewal radar.
          </p>
        </div>
      </Modal>
    </div>
  );
}
