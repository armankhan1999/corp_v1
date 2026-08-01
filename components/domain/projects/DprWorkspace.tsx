"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BellRing, CloudRain, FileText, Link2, Lock, Plus, Search, TriangleAlert, Users,
} from "lucide-react";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState, KeyValue , Explainer } from "@/components/patterns/primitives";
import { formatCount, formatDate, formatDateTime, formatQty, daysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HINDRANCE_CAUSE_LABEL } from "./labels";
import {
  DPR_GAP_ESCALATE_DAYS, DPR_GAP_NOTIFY_DAYS, dprGap, type BoqLineSeed,
} from "./compute";
import { DprForm } from "./DprForm";
import { useProjectsOverlay } from "./store";
import { Btn, FilteredEmpty, Select, TextInput, WarnNotice } from "./ui";

export interface DprRow {
  id: string;
  number: string;
  date: string;
  weather: string;
  manpower: { trade: string; count: number }[];
  plant: { name: string; count: number }[];
  execution: { boqLineId: string; qty: number }[];
  materialsReceived: string;
  siteInstructions: string;
  hindrance: string | null;
  hindranceCause: string | null;
  safetyObservations: string;
  photos: { caption: string; tone: string }[];
  byUserName: string;
  submittedAt: string;
  supersedesId: string | null;
  supersedesNumber: string | null;
  supersedeReason: string | null;
  source: "SEED" | "OVERLAY";
}

const ROW_H = 36;

/**
 * E6-S3 — the DPR log. Newest first, with manpower totals and hindrance flags
 * legible without opening a single record. Beyond a hundred entries the list is
 * virtualised so a project with a year of daily reports stays instant.
 */
export function DprWorkspace({
  projectId, projectCode, projectLive, managerName, lines, seedDprs, holidays, today, actor, canWrite,
}: {
  projectId: string;
  projectCode: string;
  projectLive: boolean;
  managerName: string;
  lines: BoqLineSeed[];
  seedDprs: DprRow[];
  holidays: string[];
  today: string;
  actor: { id: string; name: string };
  canWrite: boolean;
}) {
  const overlay = useProjectsOverlay();
  const [q, setQ] = useState("");
  const [hindranceOnly, setHindranceOnly] = useState(false);
  const [cause, setCause] = useState<"ALL" | string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [supersedeTarget, setSupersedeTarget] = useState<DprRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const all: DprRow[] = useMemo(() => {
    const fromOverlay: DprRow[] = overlay.dprs
      .filter((d) => d.projectId === projectId)
      .map((d) => ({
        id: d.id, number: d.number, date: d.date, weather: d.weather,
        manpower: d.manpower, plant: d.plant, execution: d.execution,
        materialsReceived: d.materialsReceived, siteInstructions: d.siteInstructions,
        hindrance: d.hindrance, hindranceCause: d.hindranceCause,
        safetyObservations: d.safetyObservations, photos: d.photos,
        byUserName: d.byUserName, submittedAt: d.submittedAt,
        supersedesId: d.supersedesId, supersedesNumber: d.supersedesNumber,
        supersedeReason: d.supersedeReason, source: "OVERLAY",
      }));
    return [...seedDprs, ...fromOverlay].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [seedDprs, overlay.dprs, projectId]);

  /** id → the entry that supersedes it, so both sides of a correction are linked. */
  const supersededBy = useMemo(() => {
    const map = new Map<string, DprRow>();
    for (const d of all) if (d.supersedesId) map.set(d.supersedesId, d);
    return map;
  }, [all]);

  const filters: string[] = [];
  if (q.trim()) filters.push(`search “${q.trim()}”`);
  if (hindranceOnly) filters.push("hindrances only");
  if (cause !== "ALL") filters.push(`cause ${HINDRANCE_CAUSE_LABEL[cause] ?? cause}`);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((d) => {
      if (hindranceOnly && !d.hindrance) return false;
      if (cause !== "ALL" && d.hindranceCause !== cause) return false;
      if (!needle) return true;
      return (
        d.number.toLowerCase().includes(needle) ||
        d.weather.toLowerCase().includes(needle) ||
        (d.hindrance ?? "").toLowerCase().includes(needle) ||
        d.materialsReceived.toLowerCase().includes(needle) ||
        d.siteInstructions.toLowerCase().includes(needle)
      );
    });
  }, [all, q, hindranceOnly, cause]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const lastDate = all.length ? all.map((d) => d.date).sort()[all.length - 1]! : null;
  const gap = dprGap(lastDate, new Date(today), holidays);
  const selected = rows.find((d) => d.id === selectedId) ?? rows[0] ?? null;

  function clearFilters() { setQ(""); setHindranceOnly(false); setCause("ALL"); }

  return (
    <div className="flex flex-col gap-4">
      {/* E6-S3 — the cadence notification, with its escalation stated plainly. */}
      {projectLive && gap.notify ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
            gap.escalate ? "border-danger/40 bg-danger-bg" : "border-warn/40 bg-warn-bg",
          )}
        >
          <BellRing className={cn("mt-0.5 size-4 shrink-0", gap.escalate ? "text-danger" : "text-warn")} aria-hidden />
          <div>
            <p className={cn("t-body-sm font-medium", gap.escalate ? "text-danger" : "text-warn")}>
              No progress entry for {gap.missedWorkingDays} consecutive working days
            </p>
            <Explainer className="mt-0.5 text-text-mid">
              Last entry {gap.lastDprDate ? formatDate(gap.lastDprDate) : "—"}. {managerName} has been notified.
              {gap.escalate
                ? ` Beyond ${DPR_GAP_ESCALATE_DAYS} working days this escalates to Director – Business, and it has.`
                : ` It escalates to Director – Business at ${DPR_GAP_ESCALATE_DAYS} working days.`}
              {" "}Sundays and the branch holiday calendar are excluded from the count.
            </Explainer>
          </div>
        </div>
      ) : projectLive && all.length ? (
        <Explainer className="text-text-lo">
          Cadence healthy — last entry {formatDate(lastDate!)}, {gap.missedWorkingDays} working{" "}
          {gap.missedWorkingDays === 1 ? "day" : "days"} since. The project manager is notified at{" "}
          {DPR_GAP_NOTIFY_DAYS} and Director – Business at {DPR_GAP_ESCALATE_DAYS}.
        </Explainer>
      ) : null}

      {composing || supersedeTarget ? (
        <Panel>
          <PanelHeader
            title={supersedeTarget ? `Supersede ${supersedeTarget.number}` : "File a daily progress report"}
            sub="Quantities entered here increment the cumulative executed quantity on the BOQ lines named."
          />
          <DprForm
            projectId={projectId}
            projectCode={projectCode}
            lines={lines}
            today={today}
            actor={actor}
            dprCount={all.length}
            supersedes={
              supersedeTarget
                ? {
                  id: supersedeTarget.id,
                  number: supersedeTarget.number,
                  fromSeed: supersedeTarget.source === "SEED",
                  execution: supersedeTarget.execution,
                  date: supersedeTarget.date,
                }
                : null
            }
            onDone={() => { setComposing(false); setSupersedeTarget(null); }}
          />
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
        <Panel>
          <PanelHeader
            title="Progress entry log"
            sub={`${formatCount(all.length)} entries, newest first. Every entry is immutable once submitted.`}
            right={
              canWrite && !composing ? (
                <Btn variant="primary" onClick={() => { setComposing(true); setSupersedeTarget(null); }}>
                  <Plus className="size-3.5" aria-hidden /> File entry
                </Btn>
              ) : null
            }
          />

          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <label className="relative">
              <span className="sr-only">Search progress entries</span>
              <Search className="pointer-events-none absolute left-2 top-2 size-4 text-text-lo" aria-hidden />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number, weather, hindrance" className="w-56 pl-7" />
            </label>
            <label>
              <span className="sr-only">Filter by hindrance cause</span>
              <Select value={cause} onChange={(e) => setCause(e.target.value)} className="w-44">
                <option value="ALL">Any cause</option>
                {Object.entries(HINDRANCE_CAUSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </label>
            <Btn
              onClick={() => setHindranceOnly((v) => !v)}
              aria-pressed={hindranceOnly}
              className={cn(hindranceOnly && "border-warn/50 bg-warn-bg text-warn")}
            >
              <TriangleAlert className="size-3.5" aria-hidden /> Hindrances only
            </Btn>
            {filters.length ? <Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn> : null}
            <span className="t-body-sm ml-auto text-text-lo">{formatCount(rows.length)} shown</span>
          </div>

          {all.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No progress has been reported on this project"
              body="A daily progress report is the only way executed quantity reaches the BOQ. Until the first one is filed, nothing on this project is billable."
              action={canWrite ? <Btn variant="primary" onClick={() => setComposing(true)}><Plus className="size-3.5" aria-hidden /> File the first entry</Btn> : null}
            />
          ) : rows.length === 0 ? (
            <FilteredEmpty filters={filters} onClear={clearFilters} />
          ) : (
            <>
              <div className="grid grid-cols-[7.5rem_6.5rem_1fr_4.5rem_5rem_6rem] gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
                {["Date", "Number", "Weather / hindrance", "Manpower", "BOQ lines", "Filed by"].map((h, i) => (
                  <span key={h} className={cn("t-overline text-text-lo", (i === 3 || i === 4) && "text-right")}>{h}</span>
                ))}
              </div>
              <div ref={scrollRef} className="max-h-[32rem] overflow-y-auto">
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {virtualizer.getVirtualItems().map((v) => {
                    const d = rows[v.index]!;
                    const total = d.manpower.reduce((s, m) => s + m.count, 0);
                    const replaced = supersededBy.get(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedId(d.id)}
                        aria-current={selected?.id === d.id ? "true" : undefined}
                        className={cn(
                          "absolute left-0 grid w-full grid-cols-[7.5rem_6.5rem_1fr_4.5rem_5rem_6rem] items-center gap-2 border-b border-line px-3 text-left",
                          selected?.id === d.id ? "bg-surface-3" : "hover:bg-surface-2",
                          replaced && "opacity-60",
                        )}
                        style={{ height: ROW_H, transform: `translateY(${v.start}px)` }}
                      >
                        <span className="t-body-sm tabular-nums text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(d.date)}
                        </span>
                        <span className="t-mono truncate text-text-mid">{d.number.split("/").pop()}</span>
                        <span className="flex min-w-0 items-center gap-1.5">
                          {d.hindrance ? (
                            <StatusBadge tone="warn" icon={false}>
                              {HINDRANCE_CAUSE_LABEL[d.hindranceCause ?? "OTHER"]}
                            </StatusBadge>
                          ) : null}
                          {replaced ? <StatusBadge tone="danger" icon={false}>Superseded</StatusBadge> : null}
                          {d.supersedesId ? <StatusBadge tone="info" icon={false}>Correction</StatusBadge> : null}
                          <span className="t-body-sm truncate text-text-mid">
                            {d.hindrance ?? d.weather}
                          </span>
                        </span>
                        <span className="t-body-sm flex items-center justify-end gap-1 tabular-nums text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                          <Users className="size-3 text-text-lo" aria-hidden />
                          {total}
                        </span>
                        <span className="t-body-sm text-right tabular-nums text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {d.execution.length}
                        </span>
                        <span className="t-body-sm truncate text-text-lo">{d.byUserName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="t-body-sm border-t border-line px-3 py-1.5 text-text-lo">
                Manpower totals and hindrance flags read straight from the list — no entry needs to be opened to
                spot a lost day.
              </p>
            </>
          )}
        </Panel>

        {/* ------------------------------------------------- selected entry */}
        {selected ? (
          <Panel className="self-start">
            <PanelHeader
              title={selected.number}
              sub={`${formatDate(selected.date)} · submitted ${formatDateTime(selected.submittedAt)}`}
              right={<StatusBadge tone="neutral"><Lock className="size-3" aria-hidden /> Immutable</StatusBadge>}
            />
            <div className="flex flex-col gap-3 p-4">
              {supersededBy.get(selected.id) ? (
                <WarnNotice
                  title={`Superseded by ${supersededBy.get(selected.id)!.number}`}
                  body={
                    <>
                      {supersededBy.get(selected.id)!.supersedeReason}
                      <button
                        type="button"
                        onClick={() => setSelectedId(supersededBy.get(selected.id)!.id)}
                        className="ml-1 inline-flex items-center gap-1 underline decoration-line underline-offset-2 hover:text-text-hi"
                      >
                        <Link2 className="size-3" aria-hidden /> Open the correction
                      </button>
                    </>
                  }
                />
              ) : null}
              {selected.supersedesId ? (
                <div className="rounded-md border border-info/40 bg-info-bg px-3 py-2">
                  <p className="t-body-sm text-info">
                    This entry supersedes {selected.supersedesNumber ?? selected.supersedesId}
                  </p>
                  <p className="t-body-sm text-text-mid">{selected.supersedeReason}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(selected.supersedesId!)}
                    className="t-body-sm mt-1 inline-flex items-center gap-1 text-text-mid underline decoration-line underline-offset-2 hover:text-text-hi"
                  >
                    <Link2 className="size-3" aria-hidden /> Open the original
                  </button>
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-3">
                <KeyValue label="Weather">
                  <span className="flex items-center gap-1.5">
                    <CloudRain className="size-3.5 text-text-lo" aria-hidden /> {selected.weather}
                  </span>
                </KeyValue>
                <KeyValue label="Manpower on site">
                  {selected.manpower.reduce((s, m) => s + m.count, 0)}
                </KeyValue>
              </dl>

              <div>
                <Overline>Manpower by trade</Overline>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {selected.manpower.map((m) => (
                    <li key={m.trade} className="t-body-sm rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
                      {m.trade} <span className="tabular-nums text-text-hi">{m.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Overline>Plant and machinery</Overline>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {selected.plant.length ? selected.plant.map((p) => (
                    <li key={p.name} className="t-body-sm rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
                      {p.name} <span className="tabular-nums text-text-hi">{p.count}</span>
                    </li>
                  )) : <li className="t-body-sm text-text-lo">None deployed</li>}
                </ul>
              </div>

              <div>
                <Overline>Work executed against BOQ</Overline>
                <ul className="mt-1 flex flex-col gap-1">
                  {selected.execution.map((e, i) => {
                    const line = lineById.get(e.boqLineId);
                    return (
                      <li key={`${e.boqLineId}-${i}`} className="flex items-baseline justify-between gap-2">
                        <span className="t-body-sm min-w-0 truncate text-text-mid">
                          <span className="t-mono text-text-hi">{line?.code ?? e.boqLineId}</span>{" "}
                          {line?.description ?? ""}
                        </span>
                        <span className="t-body-sm shrink-0 tabular-nums text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatQty(e.qty, line?.uom)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <KeyValue label="Materials received"><span className="t-body-sm text-text-mid">{selected.materialsReceived}</span></KeyValue>
              <KeyValue label="Site instructions"><span className="t-body-sm text-text-mid">{selected.siteInstructions}</span></KeyValue>
              {selected.hindrance ? (
                <KeyValue label={`Hindrance — ${HINDRANCE_CAUSE_LABEL[selected.hindranceCause ?? "OTHER"]}`}>
                  <span className="t-body-sm text-warn">{selected.hindrance}</span>
                </KeyValue>
              ) : null}
              <KeyValue label="Safety observations"><span className="t-body-sm text-text-mid">{selected.safetyObservations}</span></KeyValue>
              <KeyValue label="Photographs">
                {selected.photos.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {selected.photos.map((p, i) => (
                      <li key={i} className="t-body-sm rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
                        {p.caption}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="t-body-sm text-text-lo">None attached</span>
                )}
              </KeyValue>
              <KeyValue label="Filed by">
                {selected.byUserName} · {daysBetween(selected.submittedAt, new Date(today))} days ago
              </KeyValue>

              <div className="border-t border-line pt-3">
                <Explainer className="text-text-lo">
                  Submitted reports cannot be edited. A correction is filed as a superseding entry with a stated
                  reason; both records are retained and linked.
                </Explainer>
                {canWrite && !supersededBy.get(selected.id) ? (
                  <Btn
                    className="mt-2"
                    onClick={() => { setSupersedeTarget(selected); setComposing(false); }}
                  >
                    Supersede this entry
                  </Btn>
                ) : null}
              </div>
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
