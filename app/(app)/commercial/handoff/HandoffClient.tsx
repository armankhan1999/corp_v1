"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookLock, CircleCheck, Download, FileSpreadsheet, Hash, RefreshCw, TriangleAlert, XCircle,
} from "lucide-react";
import { abbreviateINR, formatCount, formatDate, formatDateTime, formatINR } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge } from "@/components/patterns/primitives";
import { inPeriod, periodOptions, type PeriodSpec } from "@/components/domain/commercial/merge";
import { actions, useCommercialOverlay, type HandoffExport } from "@/components/domain/commercial/store";
import type { Actor, SeriesRow } from "@/components/domain/commercial/types";
import {
  Button, Chip, DataTable, Field, InfoNotice, Money, PageHead, SectionPanel, Select, Stat,
  type Column,
} from "@/components/domain/commercial/ui";

/**
 * E8-S7 — the period hand-off to the accounting package.
 *
 * The screen exists to draw a boundary, not to blur one. Tally remains the
 * statutory book of record; this is a structured hand-off of what the platform
 * captured, with a simulated sync that reports every voucher the package would
 * refuse and why, so the reconciliation is done here rather than discovered
 * later in the ledger.
 */

export type HandoffKind = "INVOICE" | "RECEIPT" | "CHALLAN" | "NOTE";

export interface HandoffDoc {
  kind: HandoffKind;
  id: string;
  number: string;
  date: string;
  value: number;
  party: string;
  /** Recipient GSTIN where the document type carries one. */
  gstin: string | null;
  simulated: boolean;
}

export interface HandoffClientProps {
  docs: HandoffDoc[];
  series: SeriesRow[];
  actor: Actor;
  todayIso: string;
}

const KIND_LABEL: Record<HandoffKind, string> = {
  INVOICE: "Tax invoice",
  RECEIPT: "Receipt",
  CHALLAN: "Delivery challan",
  NOTE: "Credit / debit note",
};

const KIND_PLURAL: Record<HandoffKind, string> = {
  INVOICE: "Tax invoices",
  RECEIPT: "Receipts",
  CHALLAN: "Delivery challans",
  NOTE: "Credit and debit notes",
};

const KIND_ORDER: HandoffKind[] = ["INVOICE", "RECEIPT", "CHALLAN", "NOTE"];

/**
 * Why the accounting package would refuse a voucher. Both rules are real
 * import constraints rather than decoration, so the failure count moves with
 * the data rather than with a random number.
 */
function rejectionOf(doc: HandoffDoc): string | null {
  if (doc.kind === "INVOICE" && !doc.gstin) {
    return "Recipient GSTIN absent — the package will not post a B2B sales voucher without one. Post it as an export voucher against the LUT ledger instead.";
  }
  if (doc.kind === "NOTE" && doc.value <= 0) {
    return "The note carries no taxable value, and a nil voucher is refused on import. Pass the note with its value, or withdraw it.";
  }
  return null;
}

const STAGES = [
  "Opening the company and the financial year",
  "Validating vouchers against the masters",
  "Posting sales, receipt and note vouchers",
  "Reconciling counts and values",
] as const;

export function HandoffClient({ docs: allDocs, series, actor, todayIso }: HandoffClientProps) {
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const periods = React.useMemo(() => periodOptions(now), [now]);

  const defaultKey = periods.find((p) => p.key.startsWith("FY-"))?.key ?? periods[0]?.key ?? "";
  const [periodKey, setPeriodKey] = React.useState(defaultKey);
  const period: PeriodSpec | null = periods.find((p) => p.key === periodKey) ?? null;

  /** Documents raised in this browser join the period on the same terms. */
  const docs = React.useMemo(() => {
    const extras: HandoffDoc[] = [
      ...overlay.invoices.map((e) => ({
        kind: "INVOICE" as const, id: e.row.id, number: e.row.number, date: e.row.date,
        value: e.row.total + e.row.roundOff, party: e.row.customerName, gstin: e.row.customerGstin, simulated: true,
      })),
      ...overlay.receipts.map((r) => ({
        kind: "RECEIPT" as const, id: r.id, number: r.number, date: r.date,
        value: r.amount, party: r.customerName, gstin: null, simulated: true,
      })),
      ...overlay.challans.map((c) => ({
        kind: "CHALLAN" as const, id: c.id, number: c.number, date: c.date,
        value: c.consignmentValue, party: c.customerName, gstin: c.customerGstin, simulated: true,
      })),
      ...overlay.notes.map((n) => ({
        kind: "NOTE" as const, id: n.id, number: n.number, date: n.date,
        value: n.amount + n.gstAmount, party: n.customerName, gstin: null, simulated: true,
      })),
    ];
    const pool = [...allDocs, ...extras];
    const scoped = period ? pool.filter((d) => inPeriod(d.date, period)) : pool;
    return scoped.sort((a, b) => {
      const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      return k !== 0 ? k : a.number.localeCompare(b.number);
    });
  }, [allDocs, overlay, period]);

  const groups = React.useMemo(() => {
    const m = new Map<HandoffKind, { count: number; value: number; rejected: number }>();
    for (const k of KIND_ORDER) m.set(k, { count: 0, value: 0, rejected: 0 });
    for (const d of docs) {
      const g = m.get(d.kind)!;
      g.count += 1;
      g.value += d.value;
      if (rejectionOf(d)) g.rejected += 1;
    }
    return m;
  }, [docs]);

  const offered = docs.length;
  const rejected = docs.filter((d) => rejectionOf(d)).length;
  const accepted = offered - rejected;
  const valueOffered = docs.reduce((s, d) => s + d.value, 0);
  const valueRejected = docs.filter((d) => rejectionOf(d)).reduce((s, d) => s + d.value, 0);

  /* ------------------------------------------------------- sync simulation */

  const [phase, setPhase] = React.useState<"IDLE" | "RUNNING" | "DONE">("IDLE");
  const [processed, setProcessed] = React.useState(0);

  React.useEffect(() => { setPhase("IDLE"); setProcessed(0); }, [periodKey]);

  React.useEffect(() => {
    if (phase !== "RUNNING") return;
    if (processed >= offered) {
      setPhase("DONE");
      if (!period) return;
      const entry: HandoffExport = {
        id: `EXP-${String(overlay.exports.length + 1).padStart(3, "0")}`,
        periodLabel: period.label, from: period.from, to: period.to,
        counts: {
          invoices: groups.get("INVOICE")!.count,
          receipts: groups.get("RECEIPT")!.count,
          challans: groups.get("CHALLAN")!.count,
          notes: groups.get("NOTE")!.count,
        },
        values: {
          invoices: groups.get("INVOICE")!.value,
          receipts: groups.get("RECEIPT")!.value,
          challans: groups.get("CHALLAN")!.value,
          notes: groups.get("NOTE")!.value,
        },
        succeeded: accepted,
        failed: rejected,
        failures: docs
          .filter((d) => rejectionOf(d))
          .slice(0, 25)
          .map((d) => ({ number: d.number, reason: rejectionOf(d)! })),
        actorName: actor.name, actorRole: actor.role,
        at: new Date().toISOString(),
      };
      actions.recordExport(entry, actor);
      return;
    }
    const step = Math.max(1, Math.ceil(offered / 24));
    const timer = setTimeout(() => setProcessed((p) => Math.min(offered, p + step)), 90);
    return () => clearTimeout(timer);
    // `groups`, `docs` and the counts are all derived from the same period.
  }, [phase, processed, offered, accepted, rejected, docs, groups, period, actor, overlay.exports.length]);

  const done = phase === "DONE";
  const running = phase === "RUNNING";
  const visible = running || done ? docs.slice(0, processed) : [];
  const visibleRejected = visible.filter((d) => rejectionOf(d)).length;
  const stage = offered === 0 ? 3 : Math.min(STAGES.length - 1, Math.floor((processed / offered) * STAGES.length));

  const columns: Column<HandoffDoc>[] = [
    {
      key: "kind", label: "Voucher", width: "9.5rem",
      render: (d) => <span className="truncate text-text-mid">{KIND_LABEL[d.kind]}</span>,
    },
    {
      key: "number", label: "Document No", width: "minmax(9.5rem,1fr)", mono: true,
      render: (d) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate text-text-hi">{d.number}</span>
          {d.simulated ? <SimulatedBadge what="document created in this session" /> : null}
        </span>
      ),
    },
    { key: "date", label: "Date", width: "6.5rem", render: (d) => formatDate(d.date) },
    {
      key: "party", label: "Party", width: "minmax(10rem,1.6fr)",
      render: (d) => <span className="truncate">{d.party}</span>,
    },
    { key: "value", label: "Value", width: "8rem", align: "right", render: (d) => <Money value={d.value} abbreviate /> },
    {
      key: "outcome", label: "Sync result", width: "minmax(9rem,1.4fr)",
      render: (d) => {
        const reason = rejectionOf(d);
        return reason ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Chip tone="danger">Rejected</Chip>
            <span className="truncate text-text-lo" title={reason}>{reason}</span>
          </span>
        ) : (
          <Chip tone="ok">Accepted</Chip>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Ledger hand-off"
        lede="A structured export of what the platform captured in a period, handed to the accounting package. Counts and values are stated before the export runs, so the reconciliation is agreed in advance rather than argued about afterwards."
        right={<SimulatedBadge what="Accounting package sync (INT-05)" />}
      />

      {/* --------------------------------------------------- the boundary */}
      <InfoNotice
        icon={BookLock}
        headline="The accounting package remains the statutory book of record"
        detail="Pravaah captures commercial documents as they are raised and hands them over in a structured export. It does not keep the ledger, post journals, compute tax liability or prepare returns, and it never becomes the statutory record. If the two ever disagree, the accounting package is right and this export is what needs correcting. This is a hand-off, not a replacement."
        facts={[
          { label: "Book of record", value: "Accounting package" },
          { label: "This screen", value: "Period hand-off export" },
          { label: "Out of scope", value: "Journals, returns, bank reconciliation" },
          { label: "Direction", value: "Platform → package, one way" },
        ]}
      />

      {/* ------------------------------------------------------- the period */}
      <Panel>
        <PanelHeader
          title="Period to hand over"
          sub="Every invoice, receipt, delivery challan and credit or debit note dated inside the period, whether seeded or raised in this session."
          right={
            <span className="t-body-sm text-text-lo">
              {period ? `${formatDate(period.from)} to ${formatDate(period.to)}` : "No period selected"}
            </span>
          }
        />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <Field label="Period" className="w-56">
            <Select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              options={periods.map((p) => ({ value: p.key, label: p.label }))}
            />
          </Field>
          <Button
            tone="primary"
            onClick={() => { setProcessed(0); setPhase("RUNNING"); }}
            disabled={!actor.canWrite || running || offered === 0}
          >
            {done ? <RefreshCw className="size-3.5" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
            {done ? "Run the export again" : running ? "Exporting…" : "Generate export"}
          </Button>
          {!actor.canWrite ? (
            <p className="t-body-sm text-text-lo">
              Your role may read the hand-off but not generate one. Accounts and Super Admin hold that right.
            </p>
          ) : null}
        </div>

        <ul className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
          {KIND_ORDER.map((k) => {
            const g = groups.get(k)!;
            return (
              <li key={k}>
                <Stat
                  label={KIND_PLURAL[k]}
                  value={formatCount(g.count)}
                  sub={
                    <>
                      {abbreviateINR(g.value)} in the period
                      {g.rejected ? ` · ${g.rejected} would be refused` : ""}
                    </>
                  }
                  tone={g.rejected ? "warn" : "default"}
                />
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-4 py-3">
          <span className="t-body-sm text-text-mid">
            {formatCount(offered)} document{offered === 1 ? "" : "s"} in {period?.label ?? "the period"} ·{" "}
            <span className="t-mono">{formatINR(valueOffered)}</span> of documented value
          </span>
          <span className="t-body-sm text-text-lo">
            Delivery challans move goods rather than money, so their value is stated for completeness and is not added
            to the sales figure the package posts.
          </span>
        </div>
      </Panel>

      {/* --------------------------------------------------- sync progress */}
      <SectionPanel
        title="Simulated sync"
        sub="Each voucher is offered to the package one at a time, and the result is reported document by document."
        right={<SimulatedBadge what="Accounting package sync (INT-05)" />}
      >
        {phase === "IDLE" ? (
          offered === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No document falls inside this period"
              body="Nothing was invoiced, received, despatched or adjusted between these dates, so there is nothing to hand over. Choose another period."
            />
          ) : (
            <EmptyState
              icon={FileSpreadsheet}
              title="The export has not been run for this period"
              body={`${formatCount(offered)} documents worth ${formatINR(valueOffered)} are ready to hand over. Generating the export walks the package through them one at a time and reports what it accepts and what it refuses.`}
              action={
                <Button tone="primary" onClick={() => { setProcessed(0); setPhase("RUNNING"); }} disabled={!actor.canWrite}>
                  <Download className="size-3.5" aria-hidden />
                  Generate export
                </Button>
              }
            />
          )
        ) : (
          <>
            <div className="border-b border-line px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="t-body font-medium text-text-hi">
                  {done ? "Sync complete" : STAGES[stage]}
                </span>
                <span className="t-mono text-text-mid tabular-nums">
                  {formatCount(processed)} / {formatCount(offered)}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-md bg-surface-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={offered}
                aria-valuenow={processed}
                aria-label="Documents offered to the accounting package"
              >
                <div
                  className={done ? "h-full bg-ok" : "h-full bg-sim"}
                  style={{ width: `${offered ? (processed / offered) * 100 : 100}%` }}
                />
              </div>
              <ol className="mt-2 flex flex-wrap items-center gap-1">
                {STAGES.map((s, i) => (
                  <li key={s} className="flex items-center gap-1">
                    {i > 0 ? <span className="text-text-lo" aria-hidden>›</span> : null}
                    <span
                      className={
                        done || i <= stage
                          ? "t-overline rounded-md border border-sim/50 bg-sim-bg px-1.5 py-0.5 text-sim"
                          : "t-overline rounded-md border border-line px-1.5 py-0.5 text-text-lo"
                      }
                    >
                      {s}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
              <Outcome
                icon={CircleCheck} tone="ok" label="Accepted"
                value={formatCount(visible.length - visibleRejected)}
                sub="Posted into the package"
              />
              <Outcome
                icon={XCircle} tone="danger" label="Rejected"
                value={formatCount(visibleRejected)}
                sub="Refused with a reason, listed below"
              />
              <Outcome
                icon={Hash} tone="neutral" label="Offered"
                value={formatCount(visible.length)}
                sub={`of ${formatCount(offered)} in the period`}
              />
              <Outcome
                icon={TriangleAlert} tone={done && rejected ? "warn" : "neutral"} label="Value not posted"
                value={abbreviateINR(done ? valueRejected : visible.filter((d) => rejectionOf(d)).reduce((s, d) => s + d.value, 0))}
                sub="Held back with the refused vouchers"
              />
            </ul>

            {done ? (
              <div className="border-b border-line bg-surface-2 px-4 py-3">
                <Overline>Reconciliation</Overline>
                <p className="t-body mt-1 text-text-hi">
                  {formatCount(offered)} documents offered · {formatCount(accepted)} accepted ·{" "}
                  {formatCount(rejected)} refused. {formatINR(valueOffered)} offered,{" "}
                  {formatINR(valueOffered - valueRejected)} posted, {formatINR(valueRejected)} held back — the
                  difference is exactly the {formatCount(rejected)} refused voucher{rejected === 1 ? "" : "s"} listed
                  below, and nothing else.
                </p>
                <p className="t-body-sm mt-1 text-text-lo">
                  The export has been audit-logged against {actor.name} with the period, the document counts and the
                  outcome. The live connector needs the package&apos;s company and financial-year mapping, a ledger and
                  voucher-type map and an ODBC or XML endpoint —{" "}
                  <Link href="/admin/integrations" className="text-info hover:underline">Integration Readiness</Link>{" "}
                  lists the Phase 2 prerequisites.
                </p>
              </div>
            ) : null}

            <DataTable
              caption="Per-document sync result"
              maxHeight={460}
              columns={columns}
              rows={visible}
              rowKey={(d) => `${d.kind}-${d.id}`}
              empty={
                <EmptyState
                  icon={FileSpreadsheet}
                  title="Nothing offered yet"
                  body="The first voucher is on its way to the package."
                />
              }
              footer={
                <>
                  <span className="t-body-sm text-text-lo">
                    {formatCount(visible.length)} of {formatCount(offered)} documents reported
                  </span>
                  <span className="t-body-sm text-text-mid">
                    Accepted value{" "}
                    <Money
                      value={visible.filter((d) => !rejectionOf(d)).reduce((s, d) => s + d.value, 0)}
                      abbreviate className="font-medium"
                    />
                  </span>
                </>
              }
            />
          </>
        )}
      </SectionPanel>

      {/* -------------------------------------------------- numbering series */}
      <SectionPanel
        title="Numbering series"
        sub="One sequence per document type and financial year. The state is measured from the documents that exist rather than from a counter kept beside them, so “no gaps, no duplicates” is re-proved on every load."
        right={<Chip tone={series.every((s) => !s.gaps.length && !s.duplicates.length) ? "ok" : "danger"}>
          {series.every((s) => !s.gaps.length && !s.duplicates.length) ? "No gaps · no duplicates" : "Sequence broken"}
        </Chip>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse">
            <caption className="sr-only">Document numbering series and their current state</caption>
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                <th scope="col" className="t-overline px-4 py-2 text-left text-text-lo">Document type</th>
                <th scope="col" className="t-overline px-4 py-2 text-left text-text-lo">Series</th>
                <th scope="col" className="t-overline px-4 py-2 text-right text-text-lo">Issued</th>
                <th scope="col" className="t-overline px-4 py-2 text-right text-text-lo">Highest</th>
                <th scope="col" className="t-overline px-4 py-2 text-right text-text-lo">This session</th>
                <th scope="col" className="t-overline px-4 py-2 text-left text-text-lo">Next number</th>
                <th scope="col" className="t-overline px-4 py-2 text-left text-text-lo">Integrity</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const consumed = overlay.consumed[s.docType] ?? 0;
                const clean = !s.gaps.length && !s.duplicates.length;
                return (
                  <tr key={s.id} className="border-b border-line">
                    <td className="t-body-sm px-4 py-2 text-text-hi">{s.label}</td>
                    <td className="t-mono px-4 py-2 text-text-mid">{s.prefix}/{s.fySegment}</td>
                    <td className="t-body-sm px-4 py-2 text-right text-text-mid tabular-nums">{formatCount(s.issued)}</td>
                    <td className="t-body-sm px-4 py-2 text-right text-text-mid tabular-nums">{formatCount(s.highest)}</td>
                    <td className="t-body-sm px-4 py-2 text-right text-text-mid tabular-nums">{formatCount(consumed)}</td>
                    <td className="t-mono px-4 py-2 text-text-hi">
                      {`${s.prefix}/${s.fySegment}/${String(s.highest + consumed + 1).padStart(s.width, "0")}`}
                    </td>
                    <td className="px-4 py-2">
                      {clean ? (
                        <StatusBadge tone="ok">Sequential</StatusBadge>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone="danger">
                            {s.gaps.length ? `${s.gaps.length} gap${s.gaps.length === 1 ? "" : "s"}` : "Duplicates"}
                          </StatusBadge>
                          <span className="t-body-sm text-text-lo">
                            {s.gaps.length ? `missing ${s.gaps.slice(0, 6).join(", ")}` : s.duplicates.slice(0, 4).join(", ")}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
          A number is consumed the moment a document is issued and is never reused, so a hand-off can be checked against
          the series without reference to this platform: the count of documents in a financial year must equal the
          highest sequence issued in it.
        </p>
      </SectionPanel>

      {/* ------------------------------------------------------ export log */}
      <SectionPanel
        title="Exports generated in this session"
        sub="Every hand-off is audit-logged with the period, the document counts and the actor who ran it."
        right={<Chip tone="neutral">{formatCount(overlay.exports.length)} recorded</Chip>}
      >
        {overlay.exports.length === 0 ? (
          <EmptyState
            icon={Download}
            title="No export has been generated yet"
            body="Choosing a period and generating the export records the hand-off against your name, with the counts and values it carried."
          />
        ) : (
          <ul className="divide-y divide-line">
            {[...overlay.exports].reverse().map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-56 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="t-body font-medium text-text-hi">{e.periodLabel}</span>
                    <span className="t-body-sm text-text-lo">{formatDateTime(e.at)}</span>
                    <SimulatedBadge what="Accounting package sync (INT-05)" />
                  </div>
                  <p className="t-body-sm mt-0.5 text-text-mid">
                    {formatCount(e.counts.invoices)} invoices · {formatCount(e.counts.receipts)} receipts ·{" "}
                    {formatCount(e.counts.challans)} challans · {formatCount(e.counts.notes)} notes. Run by{" "}
                    {e.actorName}.
                  </p>
                  {e.failures.length ? (
                    <p className="t-body-sm text-text-lo">
                      Refused: {e.failures.slice(0, 3).map((f) => f.number).join(", ")}
                      {e.failures.length > 3 ? ` and ${e.failures.length - 3} more` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <span className="flex items-center gap-2">
                    <StatusBadge tone="ok">{formatCount(e.succeeded)} accepted</StatusBadge>
                    <StatusBadge tone={e.failed ? "danger" : "neutral"}>{formatCount(e.failed)} refused</StatusBadge>
                  </span>
                  <Money
                    value={e.values.invoices + e.values.receipts + e.values.notes}
                    abbreviate className="t-body mt-1 block"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </div>
  );
}

function Outcome({
  icon: Icon, tone, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "ok" | "danger" | "warn" | "neutral";
  label: string; value: string; sub: string;
}) {
  const fg =
    tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-text-lo";
  return (
    <li className="bg-surface-1 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`size-3.5 ${fg}`} aria-hidden />
        <Overline>{label}</Overline>
      </div>
      <p className="t-display-md mt-0.5 text-text-hi tabular-nums">{value}</p>
      <p className="t-body-sm text-text-lo">{sub}</p>
    </li>
  );
}
