"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ArrowRight, ClipboardList, CircleCheck, Package, Search } from "lucide-react";
import type { CoverageType, JobOutcome } from "@/lib/schemas/enums";
import { formatCount, formatDate, formatDateTime } from "@/lib/format";
import { EmptyState, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { firstVisitResolved, mergeJobCard, useOverlay } from "./store";
import { FilteredEmpty, Select, Serial, TextInput } from "./ui";
import { COVERAGE_LABEL, COVERAGE_TONE, OUTCOME_LABEL, OUTCOME_TONE } from "./types";

/**
 * E4-S4 — the job-card register.
 *
 * One row per visit, because a ticket may carry several. The first-visit
 * resolution flag is derived here from outcome and visit sequence exactly as
 * the story defines it; there is no stored field to disagree with.
 */

export interface JobCardRow {
  id: string;
  number: string;
  ticketId: string;
  ticketNumber: string;
  customerName: string;
  siteName: string;
  siteDistrict: string;
  assetSerial: string;
  assetModel: string;
  engineerId: string;
  engineerName: string;
  visitSequence: number;
  visitType: string;
  outcome: JobOutcome | null;
  partsCount: number;
  coverage: CoverageType;
  scheduledDateMs: number;
  submittedAtMs: number | null;
}

export interface JobCardFilters {
  q: string;
  engineer: string;
  outcome: string;
  from: string;
  to: string;
}

export const VISIT_TYPE_LABEL: Record<string, string> = {
  BREAKDOWN: "Breakdown",
  PM: "Preventive",
  INSTALLATION: "Installation",
  INSPECTION: "Inspection",
  REVISIT: "Revisit",
};

const ROUTE = "/service/job-cards";

export function JobCardsTable({
  rows,
  filters,
  engineers,
  total,
  shown,
}: {
  rows: JobCardRow[];
  filters: JobCardFilters;
  engineers: { id: string; name: string }[];
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const overlay = useOverlay();

  /** Session captures merge over the seeded register so a just-closed visit shows. */
  const merged = useMemo(
    () =>
      rows.map((r) => {
        const patch = overlay.jobCards[r.id];
        if (!patch) return r;
        return {
          ...r,
          outcome: patch.outcome !== undefined ? patch.outcome : r.outcome,
          submittedAtMs: patch.submittedAtMs !== undefined ? patch.submittedAtMs : r.submittedAtMs,
          partsCount:
            r.partsCount + overlay.parts.filter((p) => p.jobCardId === r.id && p.sessionAdded).length,
        };
      }),
    [rows, overlay],
  );

  const sessionRows: JobCardRow[] = useMemo(
    () =>
      overlay.newJobCards.map((j) => {
        const card = mergeJobCard(j, overlay.jobCards[j.id]);
        return {
          id: card.id,
          number: card.number,
          ticketId: card.ticketId,
          ticketNumber: card.ticketNumber,
          customerName: card.customerName,
          siteName: card.siteName,
          siteDistrict: "",
          assetSerial: card.assetSerial,
          assetModel: card.assetModel,
          engineerId: card.engineerId,
          engineerName: card.engineerName,
          visitSequence: card.visitSequence,
          visitType: card.visitType,
          outcome: card.outcome,
          partsCount: overlay.parts.filter((p) => p.jobCardId === card.id).length,
          coverage: card.coverage,
          scheduledDateMs: card.scheduledDateMs,
          submittedAtMs: card.submittedAtMs,
        };
      }),
    [overlay],
  );

  const all = [...sessionRows, ...merged];

  function push(next: Partial<JobCardFilters>) {
    const params = new URLSearchParams();
    const combined = { ...filters, ...next };
    for (const [k, v] of Object.entries(combined)) if (v && v !== "ALL") params.set(k, v);
    router.push(`${ROUTE}${params.toString() ? `?${params}` : ""}`);
  }

  const activeFilters = [
    filters.q ? `search "${filters.q}"` : null,
    filters.engineer !== "ALL"
      ? `engineer ${engineers.find((e) => e.id === filters.engineer)?.name ?? filters.engineer}`
      : null,
    filters.outcome !== "ALL"
      ? `outcome ${OUTCOME_LABEL[filters.outcome as JobOutcome] ?? filters.outcome}`
      : null,
    filters.from ? `from ${filters.from}` : null,
    filters.to ? `to ${filters.to}` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end gap-2 border-b border-line px-3 py-2.5">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-lo"
            aria-hidden
          />
          <TextInput
            defaultValue={filters.q}
            aria-label="Search job cards by number, ticket, serial or customer"
            placeholder="Job card, ticket, serial, customer…"
            className="pl-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") push({ q: (e.target as HTMLInputElement).value });
            }}
            onBlur={(e) => {
              if (e.target.value !== filters.q) push({ q: e.target.value });
            }}
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="t-overline text-text-lo">Engineer</span>
          <Select
            value={filters.engineer}
            onChange={(e) => push({ engineer: e.target.value })}
            className="w-48"
          >
            <option value="ALL">All engineers</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="t-overline text-text-lo">Outcome</span>
          <Select
            value={filters.outcome}
            onChange={(e) => push({ outcome: e.target.value })}
            className="w-44"
          >
            <option value="ALL">All outcomes</option>
            {(Object.keys(OUTCOME_LABEL) as JobOutcome[]).map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABEL[o]}
              </option>
            ))}
            <option value="OPEN">Not yet submitted</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="t-overline text-text-lo">Visit from</span>
          <TextInput
            type="date"
            value={filters.from}
            className="w-40"
            onChange={(e) => push({ from: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="t-overline text-text-lo">Visit to</span>
          <TextInput
            type="date"
            value={filters.to}
            className="w-40"
            onChange={(e) => push({ to: e.target.value })}
          />
        </label>
      </div>

      <Explainer className="px-3 py-1.5 text-text-lo">
        {formatCount(all.length)} shown
        {shown < total ? ` of ${formatCount(total)} matching · most recent visit first` : ""}
        {sessionRows.length ? ` · ${sessionRows.length} written in this session` : ""}
      </Explainer>

      {all.length === 0 ? (
        activeFilters.length ? (
          <FilteredEmpty filters={activeFilters} onClear={() => router.push(ROUTE)} />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No job cards"
            body="A job card is one visit against one ticket. Nothing has been recorded yet — assign a ticket on the dispatch board and the visit lands here."
            action={
              <Link
                href="/service/dispatch"
                className="t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                Open the dispatch board
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                {[
                  "Job card",
                  "Ticket",
                  "Customer & machine",
                  "Engineer",
                  "Visit",
                  "Outcome",
                  "First-visit fix",
                  "Parts",
                  "Submitted",
                  "",
                ].map((h) => (
                  <th key={h} className="t-overline px-3 py-2 font-semibold text-text-lo">
                    {h || <span className="sr-only">Open</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map((r) => {
                const fvr = firstVisitResolved(r);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-line align-middle transition-colors duration-150 hover:bg-surface-2"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`${ROUTE}/${r.id}`}
                        className="t-mono inline-flex min-h-6 items-center text-text-hi hover:text-primary-400"
                      >
                        {r.number}
                      </Link>
                      <p className="t-body-sm text-text-lo">
                        {VISIT_TYPE_LABEL[r.visitType] ?? r.visitType} ·{" "}
                        {formatDate(r.scheduledDateMs)}
                      </p>
                    </td>
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/service/tickets/${r.ticketId}`}
                        className="t-mono inline-flex min-h-6 items-center text-text-mid hover:text-primary-400"
                      >
                        {r.ticketNumber}
                      </Link>
                      <p className="t-body-sm">
                        <StatusBadge tone={COVERAGE_TONE[r.coverage]}>
                          {COVERAGE_LABEL[r.coverage]}
                        </StatusBadge>
                      </p>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="t-body-sm text-text-hi">{r.customerName}</span>
                      <p className="t-body-sm text-text-lo">
                        {r.siteName}
                        {r.siteDistrict ? ` · ${r.siteDistrict}` : ""}
                      </p>
                      <p>
                        <Serial>{r.assetSerial}</Serial>{" "}
                        <span className="t-body-sm text-text-lo">{r.assetModel}</span>
                      </p>
                    </td>
                    <td className="px-3 py-1.5 t-body-sm text-text-mid">{r.engineerName}</td>
                    <td className="px-3 py-1.5">
                      <span className="t-mono tabular-nums text-text-hi">#{r.visitSequence}</span>
                      <p className="t-body-sm text-text-lo">
                        {VISIT_TYPE_LABEL[r.visitType] ?? r.visitType}
                      </p>
                    </td>
                    <td className="px-3 py-1.5">
                      {r.outcome ? (
                        <StatusBadge tone={OUTCOME_TONE[r.outcome]}>
                          {OUTCOME_LABEL[r.outcome]}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">In progress</StatusBadge>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {fvr ? (
                        <span className="t-body-sm inline-flex items-center gap-1 text-ok">
                          <CircleCheck className="size-3.5" aria-hidden />
                          Yes
                        </span>
                      ) : (
                        <span className="t-body-sm text-text-lo">No</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          "t-body-sm inline-flex items-center gap-1 tabular-nums",
                          r.partsCount ? "text-text-hi" : "text-text-lo",
                        )}
                      >
                        <Package className="size-3.5" aria-hidden />
                        {r.partsCount}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 t-body-sm text-text-mid">
                      {r.submittedAtMs ? (
                        <span className="t-mono">{formatDateTime(r.submittedAtMs)}</span>
                      ) : (
                        <span className="text-warn">Not submitted</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Link
                        href={`${ROUTE}/${r.id}`}
                        className="t-body-sm inline-flex min-h-6 items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
                      >
                        Open
                        <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
