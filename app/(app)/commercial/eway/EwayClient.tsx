"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, FileStack, Route, ShieldAlert, Truck } from "lucide-react";
import { abbreviateINR, daysBetween, formatCount, formatDate, formatDateTime, formatINR } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, SimulatedBadge } from "@/components/patterns/primitives";
import { EwayPanel } from "@/components/domain/commercial/EwayPanel";
import {
  displayEbn, ewayEligibility, EWAY_DECISION_LABEL, EWAY_DECISION_TONE,
} from "@/components/domain/commercial/gst";
import { mergedEway } from "@/components/domain/commercial/merge";
import { actions, useCommercialOverlay } from "@/components/domain/commercial/store";
import {
  TRANSPORT_MODE_LABEL,
  type Actor, type EwayRow, type TransportMode,
} from "@/components/domain/commercial/types";
import {
  Chip, DataTable, Field, FilteredEmpty, Money, NumberInput, PageHead,
  SearchInput, Segmented, Select, SettingsBar, Stat, useDebounced, type Column,
} from "@/components/domain/commercial/ui";

/**
 * E8-S4 — e-way bills, and the rule that refuses to issue one.
 *
 * The refusal is the point of the screen. A base document older than the
 * configured maximum age cannot carry a bill, and the message says which
 * document, dated when, how old today, against what limit, and what would make
 * the movement lawful — so the rule is enforced by the platform rather than
 * remembered by whoever is on duty.
 */

export interface EwayBaseOption {
  id: string;
  number: string;
  date: string;
  customerName: string;
  consignmentValue: number;
  distanceKm: number;
  transporter: string;
  transporterGstin: string;
  vehicleNumber: string;
  transportMode: TransportMode;
  /** True when the seed already carries a bill against this document. */
  hasBill: boolean;
}

export interface EwayClientProps {
  rows: EwayRow[];
  bases: EwayBaseOption[];
  /** The base document the screen opens on — the newest one the age rule blocks. */
  defaultBaseId: string | null;
  seededCount: number;
  actor: Actor;
  todayIso: string;
}

type StatusFilter = "ALL" | "IN_FORCE" | "EXPIRED";
type BaseFilter = "BLOCKED" | "OPEN" | "ALL";

export function EwayClient({
  rows: base, bases, defaultBaseId, seededCount, actor, todayIso,
}: EwayClientProps) {
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const settings = overlay.settings;

  const rows = React.useMemo(() => mergedEway(base, overlay), [base, overlay]);
  const billByBase = React.useMemo(() => {
    const m = new Map<string, EwayRow>();
    for (const r of rows) m.set(r.baseDocId, r);
    return m;
  }, [rows]);

  /** Every base document, judged against the configured threshold and age limit. */
  const decisions = React.useMemo(() => {
    const m = new Map<string, ReturnType<typeof ewayEligibility>>();
    for (const b of bases) {
      const live = billByBase.get(b.id);
      m.set(b.id, ewayEligibility({
        consignmentValue: b.consignmentValue, baseDocDate: b.date, baseDocNumber: b.number,
        distanceKm: b.distanceKm, existing: live ? { validUntil: live.validUntil } : null,
        settings, now, sourceLabel: "Delivery challan",
      }));
    }
    return m;
  }, [bases, billByBase, settings, now]);

  const counts = React.useMemo(() => {
    let inForce = 0, expired = 0;
    for (const r of rows) {
      if (new Date(r.validUntil) >= now) inForce += 1; else expired += 1;
    }
    let blocked = 0, required = 0, notRequired = 0;
    for (const b of bases) {
      const d = decisions.get(b.id)?.decision;
      if (d === "BLOCKED_STALE_BASE") blocked += 1;
      else if (d === "REQUIRED" || d === "EXPIRED") required += 1;
      else if (d === "NOT_REQUIRED") notRequired += 1;
    }
    return { inForce, expired, blocked, required, notRequired, total: rows.length };
  }, [rows, bases, decisions, now]);

  /* ------------------------------------------------------------ generation */

  const [baseFilter, setBaseFilter] = React.useState<BaseFilter>("BLOCKED");
  const [baseId, setBaseId] = React.useState(defaultBaseId ?? bases[0]?.id ?? "");

  const baseOptions = React.useMemo(() => {
    const list = bases.filter((b) => {
      const d = decisions.get(b.id)?.decision;
      if (baseFilter === "BLOCKED") return d === "BLOCKED_STALE_BASE";
      if (baseFilter === "OPEN") return d === "REQUIRED" || d === "EXPIRED";
      return true;
    });
    return list.sort((a, b) => b.number.localeCompare(a.number)).slice(0, 250);
  }, [bases, decisions, baseFilter]);

  React.useEffect(() => {
    if (!baseOptions.some((b) => b.id === baseId)) {
      setBaseId(baseOptions.find((b) => b.id === defaultBaseId)?.id ?? baseOptions[0]?.id ?? "");
    }
  }, [baseOptions, baseId, defaultBaseId]);

  const selected = bases.find((b) => b.id === baseId) ?? null;
  const selectedDecision = selected ? decisions.get(selected.id) ?? null : null;

  /* ------------------------------------------------------------------ list */

  const [query, setQuery] = React.useState("");
  const q = useDebounced(query);
  const [status, setStatus] = React.useState<StatusFilter>("ALL");
  const [mode, setMode] = React.useState<"ALL" | TransportMode>("ALL");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        const inForce = new Date(r.validUntil) >= now;
        if (status === "IN_FORCE" && !inForce) return false;
        if (status === "EXPIRED" && inForce) return false;
        if (mode !== "ALL" && r.transportMode !== mode) return false;
        if (!needle) return true;
        return (
          displayEbn(r.ebn, r.baseDocNumber).includes(needle) ||
          r.baseDocNumber.toLowerCase().includes(needle) ||
          r.customerName.toLowerCase().includes(needle) ||
          r.transporter.toLowerCase().includes(needle) ||
          r.vehicleNumber.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [rows, q, status, mode, now]);

  const activeFilters = [
    status !== "ALL" ? `status ${status === "IN_FORCE" ? "in force" : "expired"}` : null,
    mode !== "ALL" ? `transport by ${TRANSPORT_MODE_LABEL[mode].toLowerCase()}` : null,
    q.trim() ? `search “${q.trim()}”` : null,
  ].filter((x): x is string => Boolean(x));

  function clearFilters() { setQuery(""); setStatus("ALL"); setMode("ALL"); }

  const columns: Column<EwayRow>[] = [
    {
      key: "ebn", label: "E-way bill No", width: "minmax(9rem,1fr)", mono: true,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate text-text-hi">{displayEbn(r.ebn, r.baseDocNumber)}</span>
          {r.simulated ? <SimulatedBadge what="e-way bill generated in this session" /> : null}
        </span>
      ),
    },
    {
      key: "base", label: "Base document", width: "minmax(9.5rem,1fr)", mono: true,
      render: (r) => <span className="truncate text-text-mid">{r.baseDocNumber}</span>,
    },
    { key: "baseDate", label: "Base dated", width: "6.5rem", render: (r) => formatDate(r.baseDocDate) },
    {
      key: "customer", label: "Consignee", width: "minmax(10rem,1.6fr)",
      render: (r) => <span className="truncate text-text-hi">{r.customerName}</span>,
    },
    {
      key: "route", label: "Distance", width: "6rem", align: "right", hideBelow: "lg",
      render: (r) => <span>{r.distanceKm} km</span>,
    },
    {
      key: "transporter", label: "Transporter", width: "minmax(8rem,1fr)", hideBelow: "xl",
      render: (r) => <span className="truncate">{r.transporter}</span>,
    },
    {
      key: "value", label: "Consignment", width: "8rem", align: "right",
      render: (r) => <Money value={r.consignmentValue} abbreviate />,
    },
    { key: "validUntil", label: "Valid until", width: "7rem", render: (r) => formatDate(r.validUntil) },
    {
      key: "status", label: "Status", width: "7rem",
      render: (r) => {
        const inForce = new Date(r.validUntil) >= now;
        return <Chip tone={inForce ? "ok" : "warn"}>{inForce ? "In force" : "Expired"}</Chip>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="E-way bills"
        lede="Movement documentation for consignments above the configured threshold. Generation is available where the statute allows it and refused where it does not — and a refusal states the rule, the figures behind it, and what would make the movement lawful."
        right={<SimulatedBadge what="E-way bill portal (INT-03)" />}
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li>
          <Stat
            label="Bills generated" value={formatCount(counts.total)}
            sub={`${abbreviateINR(rows.reduce((s, r) => s + r.consignmentValue, 0))} of goods moved under them`}
          />
        </li>
        <li>
          <Stat label="In force today" value={formatCount(counts.inForce)} tone="ok" sub="Validity has not lapsed" />
        </li>
        <li>
          <Stat
            label="Expired" value={formatCount(counts.expired)} tone="warn"
            sub="A fresh bill may be raised where the base document is still inside the age limit"
          />
        </li>
        <li>
          <Stat
            label="Base documents blocked" value={formatCount(counts.blocked)} tone="danger"
            sub={`Older than the configured ${settings.ewayMaxBaseAgeDays} days`}
          />
        </li>
      </ul>

      <SettingsBar note="Both figures belong in Masters. Changing one here re-judges every base document on this screen immediately — no bill is reissued and no decision is stored against an individual document.">
        <Field label="E-way bill threshold (₹)" className="w-44">
          <NumberInput
            value={settings.ewayThreshold}
            onChange={(e) => actions.updateSettings({ ewayThreshold: Math.max(0, Number(e.target.value) || 0) }, actor)}
            disabled={!actor.canWrite}
          />
        </Field>
        <Field label="Maximum base-document age (days)" className="w-56">
          <NumberInput
            value={settings.ewayMaxBaseAgeDays}
            onChange={(e) => actions.updateSettings({ ewayMaxBaseAgeDays: Math.max(1, Number(e.target.value) || 1) }, actor)}
            disabled={!actor.canWrite}
          />
        </Field>
        <Field label="Kilometres per day of Part-B validity" className="w-64">
          <NumberInput
            value={settings.ewayKmPerValidityDay}
            onChange={(e) => actions.updateSettings({ ewayKmPerValidityDay: Math.max(1, Number(e.target.value) || 1) }, actor)}
            disabled={!actor.canWrite}
          />
        </Field>
        <p className="t-body-sm max-w-md text-text-lo">
          {formatCount(counts.blocked)} of {formatCount(bases.length)} delivery challans currently exceed the age limit,
          {" "}{formatCount(counts.required)} are awaiting a bill and {formatCount(counts.notRequired)} sit at or below
          the {formatINR(settings.ewayThreshold)} threshold.
        </p>
      </SettingsBar>

      {/* --------------------------------------------------- generation form */}
      <Panel>
        <PanelHeader
          title="Generate an e-way bill"
          sub="Choose the base document the goods move under. The consignment value, the transport and the distance come from it; the platform decides whether a bill may be raised at all."
          right={
            <span className="t-body-sm text-text-lo">
              Goods moving under a tax invoice carry their own control{" "}
              <Link href="/commercial/invoices" className="text-info hover:underline">on the invoice</Link>
            </span>
          }
        />

        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <Segmented
            label="Base documents shown"
            value={baseFilter}
            onChange={setBaseFilter}
            options={[
              { value: "BLOCKED", label: "Blocked by age", count: counts.blocked },
              { value: "OPEN", label: "Awaiting a bill", count: counts.required },
              { value: "ALL", label: "All challans", count: bases.length },
            ]}
          />
          <Field
            label="Base document"
            className="min-w-72 flex-1"
            hint={
              selected
                ? `${selected.customerName} · dated ${formatDate(selected.date)} · ${daysBetween(new Date(selected.date), now)} days old · ${formatINR(selected.consignmentValue)}`
                : undefined
            }
          >
            <Select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              options={
                baseOptions.length
                  ? baseOptions.map((b) => ({
                    value: b.id,
                    label: `${b.number} — ${b.customerName} · ${formatINR(b.consignmentValue)} · ${daysBetween(new Date(b.date), now)} days old`,
                  }))
                  : [{ value: "", label: "No delivery challan matches this selection" }]
              }
            />
          </Field>
          {selectedDecision ? (
            <div className="flex flex-col gap-1">
              <Overline>Platform decision</Overline>
              <Chip tone={EWAY_DECISION_TONE[selectedDecision.decision]}>
                {EWAY_DECISION_LABEL[selectedDecision.decision]}
              </Chip>
            </div>
          ) : null}
        </div>

        <div className="p-4">
          {!selected ? (
            <EmptyState
              icon={FileStack}
              title="No base document selected"
              body="An e-way bill is always raised against a document that already exists — a delivery challan or a tax invoice. Widen the selection above, or raise a challan first."
              action={
                <Link
                  href="/commercial/challans"
                  className="t-body-sm inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 text-text-hi hover:border-line-strong"
                >
                  <Truck className="size-3.5" aria-hidden />
                  Go to delivery challans
                </Link>
              }
            />
          ) : (
            <EwayPanel
              base={{
                type: "CHALLAN",
                id: selected.id,
                number: selected.number,
                date: selected.date,
                customerName: selected.customerName,
                consignmentValue: selected.consignmentValue,
                distanceKm: selected.distanceKm,
                transporter: selected.transporter,
                transporterGstin: selected.transporterGstin,
                vehicleNumber: selected.vehicleNumber,
                transportMode: selected.transportMode,
                isExport: false,
                replacementHref: "/commercial/challans",
                replacementLabel: "Raise a fresh delivery challan",
              }}
              existing={billByBase.get(selected.id) ?? null}
              actor={actor}
              todayIso={todayIso}
              seededCount={seededCount}
            />
          )}
        </div>

        {counts.blocked > 0 ? (
          <div className="flex items-start gap-2 border-t border-line px-4 py-3">
            <Ban className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <p className="t-body-sm text-text-lo">
              {formatCount(counts.blocked)} delivery challans in the seeded history are past the{" "}
              {settings.ewayMaxBaseAgeDays}-day limit and cannot carry a bill. The list above opens on the most recently
              numbered of them, so the refusal can be read against a real document rather than a contrived one.
            </p>
          </div>
        ) : null}
      </Panel>

      {/* ------------------------------------------------------------- list */}
      <Panel>
        <PanelHeader
          title="Generated e-way bills"
          sub={`${formatCount(filtered.length)} of ${formatCount(rows.length)} shown · rows beyond the first hundred are virtualised`}
          right={
            <span className="t-body-sm text-text-lo">
              Validity is one day per {settings.ewayKmPerValidityDay} km, minimum one day
            </span>
          }
        />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          <SearchInput
            value={query} onValueChange={setQuery}
            placeholder="Search EBN, base document, consignee, transporter or vehicle"
            className="min-w-64 flex-1"
          />
          <Field label="Transport mode" className="w-40">
            <Select
              value={mode} onChange={(e) => setMode(e.target.value as TransportMode | "ALL")}
              options={[
                { value: "ALL", label: "Any mode" },
                ...(Object.keys(TRANSPORT_MODE_LABEL) as TransportMode[]).map((k) => ({ value: k, label: TRANSPORT_MODE_LABEL[k] })),
              ]}
            />
          </Field>
          <Segmented
            label="Validity"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All", count: rows.length },
              { value: "IN_FORCE", label: "In force", count: counts.inForce },
              { value: "EXPIRED", label: "Expired", count: counts.expired },
            ]}
          />
        </div>

        <DataTable
          caption="Generated e-way bills"
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          rowHref={(r) => (r.baseDocType === "CHALLAN" ? `/commercial/challans/${r.baseDocId}` : `/commercial/invoices/${r.baseDocId}`)}
          empty={
            activeFilters.length
              ? <FilteredEmpty active={activeFilters} onClear={clearFilters} subject="e-way bills" />
              : (
                <EmptyState
                  icon={Route}
                  title="No e-way bill has been generated"
                  body="A bill is raised against a delivery challan or a tax invoice once the consignment value passes the configured threshold. Choose a base document above to raise the first one."
                />
              )
          }
          footer={
            <>
              <span className="t-body-sm text-text-lo">
                {formatCount(filtered.length)} bill{filtered.length === 1 ? "" : "s"} listed
              </span>
              <span className="t-body-sm text-text-mid">
                Consignment value shown{" "}
                <Money value={filtered.reduce((s, r) => s + r.consignmentValue, 0)} abbreviate className="font-medium" />
              </span>
            </>
          }
        />
      </Panel>

      <div className="flex items-start gap-2 px-1">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-text-lo" aria-hidden />
        <p className="t-body-sm text-text-lo">
          Every number on this screen is simulated. The live e-way bill portal requires credentials with two-factor
          authentication, a transporter master and a distance source, and returns a bill whose validity the portal
          itself computes.{" "}
          <Link href="/admin/integrations" className="text-info hover:underline">Integration Readiness</Link> lists the
          Phase 2 prerequisites. The most recent generation in this session was{" "}
          {overlay.ewayBills.length
            ? <span className="t-mono">{formatDateTime(overlay.ewayBills[overlay.ewayBills.length - 1]!.generatedAt)}</span>
            : "none"}.
        </p>
      </div>
    </div>
  );
}
