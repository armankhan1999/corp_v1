"use client";

import * as React from "react";
import Link from "next/link";
import { FileStack, Plus, ScrollText, Truck } from "lucide-react";
import { abbreviateINR, formatDate, formatCount, formatINR, formatQty } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, SimulatedBadge , Explainer } from "@/components/patterns/primitives";
import { ewayEligibility, EWAY_DECISION_LABEL, EWAY_DECISION_TONE } from "./gst";
import { mergedChallans } from "./merge";
import { actions, nextSeriesNumber, nextEntityId, useCommercialOverlay } from "./store";
import {
  CHALLAN_SOURCE_LABEL, TRANSPORT_MODE_LABEL,
  type Actor, type ChallanRow, type ChallanSourceType, type SeriesRow, type TransportMode,
} from "./types";
import {
  Button, Chip, DataTable, Field, FilteredEmpty, Modal, Money, NumberInput,
  PageHead, SearchInput, Segmented, Select, SettingsBar, Stat, TextInput,
  useDebounced, type Column,
} from "./ui";

export interface ChallanSourceOption {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  siteId: string;
  branchId: string;
  date: string;
  vertical: string;
  lines: { itemId: string; description: string; hsnSac: string; uom: string; qty: number; taxableValue: number; lineValue: number }[];
  value: number;
}

export interface ChallansClientProps {
  rows: ChallanRow[];
  ewayByChallan: Record<string, { id: string; ebn: string; validUntil: string }>;
  branches: { id: string; code: string; name: string }[];
  sources: ChallanSourceOption[];
  customerSites: Record<string, { siteId: string; siteName: string; siteAddress: string; stateCode: string; state: string; gstin: string | null }>;
  series: SeriesRow | null;
  actor: Actor;
  todayIso: string;
}

type StatusFilter = "ALL" | "NOT_REQUIRED" | "REQUIRED" | "GENERATED" | "EXPIRED" | "BLOCKED_STALE_BASE";

const TRANSPORTERS = ["Ganga Roadlines", "Magadh Carriers", "Bihar Transport Co", "Sone Logistics"];

export function ChallansClient(props: ChallansClientProps) {
  const { rows: base, ewayByChallan, branches, series, actor, todayIso } = props;
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const settings = overlay.settings;

  const rows = React.useMemo(() => mergedChallans(base, overlay, now), [base, overlay, now]);

  const eligibility = React.useMemo(() => {
    const byBase = new Map<string, { validUntil: string }>();
    for (const [k, v] of Object.entries(ewayByChallan)) byBase.set(k, { validUntil: v.validUntil });
    for (const e of overlay.ewayBills) byBase.set(e.baseDocId, { validUntil: e.validUntil });
    const map = new Map<string, ReturnType<typeof ewayEligibility>>();
    for (const c of rows) {
      map.set(c.id, ewayEligibility({
        consignmentValue: c.consignmentValue, baseDocDate: c.date, baseDocNumber: c.number,
        distanceKm: c.approxDistanceKm, existing: byBase.get(c.id) ?? null,
        settings, now, sourceLabel: "Delivery challan",
      }));
    }
    return map;
  }, [rows, ewayByChallan, overlay.ewayBills, settings, now]);

  const [query, setQuery] = React.useState("");
  const q = useDebounced(query);
  const [branchId, setBranchId] = React.useState("ALL");
  const [sourceType, setSourceType] = React.useState<"ALL" | ChallanSourceType>("ALL");
  const [status, setStatus] = React.useState<StatusFilter>("ALL");
  const [open, setOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (branchId !== "ALL" && c.branchId !== branchId) return false;
      if (sourceType !== "ALL" && c.sourceType !== sourceType) return false;
      if (status !== "ALL" && eligibility.get(c.id)?.decision !== status) return false;
      if (!needle) return true;
      return (
        c.number.toLowerCase().includes(needle) ||
        c.customerName.toLowerCase().includes(needle) ||
        c.sourceLabel.toLowerCase().includes(needle) ||
        c.vehicleNumber.toLowerCase().includes(needle) ||
        c.lrNumber.toLowerCase().includes(needle)
      );
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rows, q, branchId, sourceType, status, eligibility]);

  const counts = React.useMemo(() => {
    let required = 0, generated = 0, blocked = 0, notRequired = 0, value = 0;
    for (const c of rows) {
      value += c.consignmentValue;
      const d = eligibility.get(c.id)?.decision;
      if (d === "REQUIRED") required++;
      else if (d === "GENERATED") generated++;
      else if (d === "BLOCKED_STALE_BASE") blocked++;
      else if (d === "NOT_REQUIRED") notRequired++;
    }
    return { required, generated, blocked, notRequired, value };
  }, [rows, eligibility]);

  const activeFilters = [
    branchId !== "ALL" ? `branch ${branches.find((b) => b.id === branchId)?.name ?? branchId}` : null,
    sourceType !== "ALL" ? `source ${CHALLAN_SOURCE_LABEL[sourceType].toLowerCase()}` : null,
    status !== "ALL" ? `e-way status ${EWAY_DECISION_LABEL[status].toLowerCase()}` : null,
    q.trim() ? `search “${q.trim()}”` : null,
  ].filter((x): x is string => Boolean(x));

  function clearFilters() {
    setQuery(""); setBranchId("ALL"); setSourceType("ALL"); setStatus("ALL");
  }

  const columns: Column<ChallanRow>[] = [
    {
      key: "number", label: "Challan No", width: "minmax(9.5rem,1fr)", mono: true,
      render: (c) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate text-text-hi">{c.number}</span>
          {c.simulated ? <SimulatedBadge what="document created in this session" /> : null}
        </span>
      ),
    },
    { key: "date", label: "Date", width: "6.5rem", render: (c) => formatDate(c.date) },
    {
      key: "customer", label: "Consignee", width: "minmax(11rem,1.6fr)",
      render: (c) => <span className="truncate text-text-hi">{c.customerName}</span>,
    },
    {
      key: "source", label: "Source document", width: "minmax(9rem,1fr)", hideBelow: "lg",
      render: (c) => (
        <span className="truncate">
          <span className="t-mono text-text-mid">{c.sourceLabel}</span>
          <span className="ml-1.5 text-text-lo">{CHALLAN_SOURCE_LABEL[c.sourceType]}</span>
        </span>
      ),
    },
    {
      key: "vehicle", label: "Vehicle", width: "7rem", mono: true, hideBelow: "xl",
      render: (c) => c.vehicleNumber,
    },
    {
      key: "value", label: "Consignment value", width: "8.5rem", align: "right",
      render: (c) => <Money value={c.consignmentValue} abbreviate />,
    },
    {
      key: "eway", label: "E-way bill", width: "7.5rem",
      render: (c) => {
        const e = eligibility.get(c.id);
        if (!e) return null;
        return <Chip tone={EWAY_DECISION_TONE[e.decision]}>{EWAY_DECISION_LABEL[e.decision]}</Chip>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        title="Delivery challans"
        lede="A delivery challan is a statutory document in its own right, not a variant of the invoice. Each one names the consigner and consignee with their GSTINs, the transport, the goods and the reason they are moving, and prints in the triplicate Rule 55 requires."
        right={
          <>
            <Button onClick={() => setOpen(true)} tone="primary" disabled={!actor.canWrite}>
              <Plus className="size-3.5" aria-hidden />
              Raise challan
            </Button>
          </>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Challans on record" value={formatCount(rows.length)} sub={`${abbreviateINR(counts.value)} despatched in total`} /></li>
        <li><Stat label="E-way bill generated" value={formatCount(counts.generated)} tone="ok" sub="Movement authorised and in force" /></li>
        <li><Stat label="Awaiting an e-way bill" value={formatCount(counts.required)} tone="warn" sub={`Above the ${formatINR(settings.ewayThreshold)} threshold`} /></li>
        <li>
          <Stat
            label="Blocked — stale base document" value={formatCount(counts.blocked)} tone="danger"
            sub={`Older than the configured ${settings.ewayMaxBaseAgeDays} days`}
          />
        </li>
      </ul>

      <SettingsBar note="These values sit in Masters in production. Changing one here recomputes every challan on this screen immediately — no document is reissued and nothing is stored against the individual records.">
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
        <p className="t-body-sm max-w-md text-text-lo">
          {formatCount(counts.blocked)} of {formatCount(rows.length)} challans currently exceed the age limit and cannot
          carry a new e-way bill.
        </p>
      </SettingsBar>

      <Panel>
        <PanelHeader
          title="All challans"
          sub={`${formatCount(filtered.length)} of ${formatCount(rows.length)} shown`}
          right={
            series ? (
              <span className="t-body-sm text-text-lo">
                Next in series <span className="t-mono text-text-mid">{series.nextNumber}</span>
              </span>
            ) : null
          }
        />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          <SearchInput
            value={query} onValueChange={setQuery}
            placeholder="Search number, consignee, source, vehicle or LR"
            className="min-w-64 flex-1"
          />
          <Field label="Branch" className="w-40">
            <Select
              value={branchId} onChange={(e) => setBranchId(e.target.value)}
              options={[{ value: "ALL", label: "All branches" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </Field>
          <Field label="Source" className="w-40">
            <Select
              value={sourceType} onChange={(e) => setSourceType(e.target.value as ChallanSourceType | "ALL")}
              options={[
                { value: "ALL", label: "Any source" },
                ...(Object.keys(CHALLAN_SOURCE_LABEL) as ChallanSourceType[]).map((k) => ({ value: k, label: CHALLAN_SOURCE_LABEL[k] })),
              ]}
            />
          </Field>
          <Segmented
            label="E-way bill status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "All" },
              { value: "GENERATED", label: "Generated", count: counts.generated },
              { value: "REQUIRED", label: "Required", count: counts.required },
              { value: "BLOCKED_STALE_BASE", label: "Blocked", count: counts.blocked },
              { value: "NOT_REQUIRED", label: "Not required", count: counts.notRequired },
            ]}
          />
        </div>

        <DataTable
          caption="Delivery challans"
          columns={columns}
          rows={filtered}
          rowKey={(c) => c.id}
          rowHref={(c) => `/commercial/challans/${c.id}`}
          empty={
            activeFilters.length
              ? <FilteredEmpty active={activeFilters} onClear={clearFilters} subject="challans" />
              : (
                <EmptyState
                  icon={ScrollText}
                  title="No delivery challans yet"
                  body="A challan records goods leaving the premises against a sales order, a project supply, a rental despatch or a service part despatch. Raise the first one to begin."
                  action={<Button tone="primary" onClick={() => setOpen(true)} disabled={!actor.canWrite}><Plus className="size-3.5" aria-hidden />Raise challan</Button>}
                />
              )
          }
          footer={
            <>
              <span className="t-body-sm text-text-lo">
                {formatCount(filtered.length)} challan{filtered.length === 1 ? "" : "s"}
              </span>
              <span className="t-body-sm text-text-mid">
                Consignment value shown{" "}
                <Money value={filtered.reduce((s, c) => s + c.consignmentValue, 0)} abbreviate className="font-medium" />
              </span>
            </>
          }
        />
      </Panel>

      <NewChallanModal
        open={open} onClose={() => setOpen(false)} props={props}
        seededHighest={series?.highest ?? 0} seededCount={base.length}
      />
    </div>
  );
}

/* ------------------------------------------------------------ new challan */

function NewChallanModal({
  open, onClose, props, seededHighest, seededCount,
}: {
  open: boolean; onClose: () => void; props: ChallansClientProps;
  seededHighest: number; seededCount: number;
}) {
  const { sources, customerSites, branches, actor, todayIso, series } = props;
  const overlay = useCommercialOverlay();
  const [sourceType, setSourceType] = React.useState<ChallanSourceType>("SALES_ORDER");
  const [sourceId, setSourceId] = React.useState(sources[0]?.id ?? "");
  const [reason, setReason] = React.useState("Supply against order");
  const [transportMode, setTransportMode] = React.useState<TransportMode>("ROAD");
  const [vehicle, setVehicle] = React.useState("BR01AB1234");
  const [transporter, setTransporter] = React.useState(TRANSPORTERS[0]!);
  const [transporterGstin, setTransporterGstin] = React.useState("10AABCT4521K1Z9");
  const [lr, setLr] = React.useState("");
  const [distance, setDistance] = React.useState(120);
  const [error, setError] = React.useState<string | null>(null);

  const source = sources.find((s) => s.id === sourceId) ?? null;
  const next = series
    ? nextSeriesNumber(overlay, "CHALLAN", series.prefix, series.fySegment, series.width, seededHighest)
    : { seq: seededHighest + 1, number: `BC/DC/2627/${String(seededHighest + 1).padStart(4, "0")}` };

  const value = source?.value ?? 0;

  function submit() {
    if (!source) { setError("Select the source document the goods are moving against."); return; }
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(vehicle.replace(/\s|-/g, "").toUpperCase())) {
      setError("Enter the vehicle number in the registration format, for example BR01AB1234.");
      return;
    }
    const site = customerSites[source.customerId];
    const branch = branches.find((b) => b.id === source.branchId) ?? branches[0]!;
    const row: ChallanRow = {
      id: nextEntityId("DCH", overlay, "CHALLAN", seededCount),
      number: next.number,
      date: todayIso,
      customerId: source.customerId,
      customerName: source.customerName,
      customerGstin: site?.gstin ?? null,
      siteId: site?.siteId ?? source.siteId,
      siteName: site?.siteName ?? "Main Plant",
      siteAddress: site?.siteAddress ?? "—",
      siteStateCode: site?.stateCode ?? "10",
      siteState: site?.state ?? "Bihar",
      branchId: branch.id, branchCode: branch.code, branchName: branch.name,
      sourceType, sourceId: source.id, sourceLabel: source.number,
      reasonForTransportation: reason,
      transportMode,
      vehicleNumber: vehicle.replace(/\s|-/g, "").toUpperCase(),
      transporter, transporterGstin,
      lrNumber: lr.trim() || `LR${String(Date.now()).slice(-7)}`,
      approxDistanceKm: distance,
      lines: source.lines,
      consignmentValue: source.value,
      ageDays: 0,
      ewayBillId: null,
      simulated: true,
    };
    actions.addChallan(row, actor);
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose} wide
      title="Raise a delivery challan"
      sub="The goods, quantities and consignee come from the source document. Nothing already recorded there is asked for again."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" onClick={submit} disabled={!actor.canWrite}>
            Issue challan {next.number}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="t-body-sm rounded-md border border-danger/50 bg-danger-bg px-3 py-2 text-danger">{error}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Source type">
            <Select
              value={sourceType} onChange={(e) => setSourceType(e.target.value as ChallanSourceType)}
              options={(Object.keys(CHALLAN_SOURCE_LABEL) as ChallanSourceType[]).map((k) => ({ value: k, label: CHALLAN_SOURCE_LABEL[k] }))}
            />
          </Field>
          <Field label="Source document" hint={source ? `${source.customerName} · ${formatDate(source.date)}` : undefined}>
            <Select
              value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              options={sources.slice(0, 200).map((s) => ({ value: s.id, label: `${s.number} — ${s.customerName}` }))}
            />
          </Field>
          <Field label="Reason for transportation">
            <Select
              value={reason} onChange={(e) => setReason(e.target.value)}
              options={["Supply against order", "Project supply", "Rental despatch", "Service replacement", "Job work", "Line sales"].map((r) => ({ value: r, label: r }))}
            />
          </Field>
          <Field label="Transport mode">
            <Select
              value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode)}
              options={(Object.keys(TRANSPORT_MODE_LABEL) as TransportMode[]).map((k) => ({ value: k, label: TRANSPORT_MODE_LABEL[k] }))}
            />
          </Field>
          <Field label="Vehicle number" hint="Registration mark of the conveyance carrying the goods">
            <TextInput value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Transporter">
            <Select
              value={transporter} onChange={(e) => setTransporter(e.target.value)}
              options={TRANSPORTERS.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Transporter GSTIN">
            <TextInput value={transporterGstin} onChange={(e) => setTransporterGstin(e.target.value.toUpperCase())} />
          </Field>
          <Field label="LR / RR number" hint="Leave blank to take the transporter's own reference">
            <TextInput value={lr} onChange={(e) => setLr(e.target.value)} placeholder="LR2300539" />
          </Field>
          <Field label="Approximate distance (km)">
            <NumberInput value={distance} onChange={(e) => setDistance(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        </div>

        {source ? (
          <div className="rounded-lg border border-line">
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-2">
              <Overline>Particulars carried from {source.number}</Overline>
              <span className="t-body-sm text-text-mid">
                Consignment value <Money value={value} className="font-medium" />
              </span>
            </div>
            <ul className="divide-y divide-line">
              {source.lines.map((l, i) => (
                <li key={`${l.itemId}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="t-body-sm min-w-0 flex-1 truncate text-text-hi">{l.description}</span>
                  <span className="t-mono text-text-lo">{l.hsnSac}</span>
                  <span className="t-body-sm w-20 text-right text-text-mid tabular-nums">{formatQty(l.qty, l.uom)}</span>
                  <span className="t-body-sm w-28 text-right text-text-hi tabular-nums">{formatINR(l.lineValue)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 border-t border-line px-3 py-2">
              <Truck className="size-4 text-text-lo" aria-hidden />
              <span className="t-body-sm text-text-mid">
                {value > overlay.settings.ewayThreshold
                  ? `Above the ${formatINR(overlay.settings.ewayThreshold)} threshold — an e-way bill will be required and offered on the challan once saved.`
                  : `At or below the ${formatINR(overlay.settings.ewayThreshold)} threshold — no e-way bill is required for this consignment.`}
              </span>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={FileStack}
            title="No source document selected"
            body="A challan must move goods against something — a sales order, a project supply, a rental despatch or a service part despatch."
          />
        )}

        <Explainer className="text-text-lo">
          Issuing consumes the next number in the challan series, <span className="t-mono text-text-mid">{next.number}</span>,
          and writes an audit entry naming you as the actor.{" "}
          <Link href="/commercial/handoff" className="text-info hover:underline">Series state is visible to Accounts.</Link>
        </Explainer>
      </div>
    </Modal>
  );
}
