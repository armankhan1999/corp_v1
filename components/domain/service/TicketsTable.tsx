"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Inbox, Plus, Search } from "lucide-react";
import { formatCount, formatDateTime } from "@/lib/format";
import type { CoverageType, SLAState, TicketSeverity, TicketStatus } from "@/lib/schemas/enums";
import { EmptyState, StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { SlaClock, useSimNow } from "./SlaClock";
import { useOverlay, mergeTicket } from "./store";
import { btnClass, FilteredEmpty, Select, Serial, TextInput } from "./ui";
import {
  COVERAGE_LABEL, COVERAGE_TONE, SEVERITY_SHORT, SEVERITY_TONE,
  SLA_STATE_LABEL, TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL,
} from "./types";

export interface TicketRow {
  id: string;
  number: string;
  customerName: string;
  siteName: string;
  siteDistrict: string;
  assetSerial: string;
  assetModel: string;
  severity: TicketSeverity;
  coverage: CoverageType;
  status: TicketStatus;
  category: keyof typeof TICKET_CATEGORY_LABEL;
  engineerName: string | null;
  loggedAtMs: number;
  restorationDueMs: number;
  restoredAtMs: number | null;
  pausedMs: number;
  pauseStartedAtMs: number | null;
  businessHours: boolean;
  breachedAtMs: number | null;
  breachReasonCode: string | null;
  slaRuleApplied: string;
}

export interface TicketFilters {
  q: string;
  status: string;
  severity: string;
  coverage: string;
  sla: string;
  scope: string;
}

const STATUS_TONE: Record<TicketStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  LOGGED: "neutral",
  ASSIGNED: "info",
  EN_ROUTE: "info",
  ON_SITE: "info",
  AWAITING_PARTS: "warn",
  AWAITING_CUSTOMER: "warn",
  RESOLVED: "ok",
  CLOSED: "neutral",
  CANCELLED: "neutral",
};

export function TicketsTable({
  rows, filters, nowMs, holidays, total, shown, canCreate,
}: {
  rows: TicketRow[];
  filters: TicketFilters;
  nowMs: number;
  holidays: string[];
  total: number;
  shown: number;
  canCreate: boolean;
}) {
  const router = useRouter();
  const now = useSimNow(nowMs);
  const overlay = useOverlay();

  const sessionRows: TicketRow[] = useMemo(
    () =>
      overlay.newTickets.map((t) => {
        const merged = mergeTicket(t, overlay.tickets[t.id]);
        return {
          id: merged.id,
          number: merged.number,
          customerName: merged.customerName,
          siteName: merged.site.name,
          siteDistrict: merged.site.district,
          assetSerial: merged.asset.serial,
          assetModel: merged.asset.model,
          severity: merged.severity,
          coverage: merged.coverage,
          status: merged.status,
          category: merged.category,
          engineerName: merged.engineerName,
          loggedAtMs: merged.loggedAtMs,
          restorationDueMs: merged.restorationDueMs,
          restoredAtMs: merged.restoredAtMs,
          pausedMs: merged.pausedMs,
          pauseStartedAtMs: merged.pauseStartedAtMs,
          businessHours: merged.slaBusinessHours,
          breachedAtMs: merged.breachedAtMs,
          breachReasonCode: merged.breachReasonCode,
          slaRuleApplied: merged.slaRuleApplied,
        };
      }),
    [overlay],
  );

  const merged = useMemo(
    () =>
      rows.map((r) => {
        const p = overlay.tickets[r.id];
        if (!p) return r;
        return {
          ...r,
          status: p.status ?? r.status,
          engineerName: p.engineerName !== undefined ? p.engineerName : r.engineerName,
          pausedMs: p.pausedMs ?? r.pausedMs,
          pauseStartedAtMs: p.pauseStartedAtMs !== undefined ? p.pauseStartedAtMs : r.pauseStartedAtMs,
          breachedAtMs: p.breachedAtMs !== undefined ? p.breachedAtMs : r.breachedAtMs,
          breachReasonCode:
            p.breachReasonCode !== undefined ? p.breachReasonCode : r.breachReasonCode,
          restoredAtMs: p.restoredAtMs !== undefined ? p.restoredAtMs : r.restoredAtMs,
        };
      }),
    [rows, overlay],
  );

  const all = [...sessionRows, ...merged];

  function push(next: Partial<TicketFilters>) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "ALL") params.set(k, v);
    router.push(`/service/tickets${params.toString() ? `?${params}` : ""}`);
  }

  const activeFilters = [
    filters.q ? `search "${filters.q}"` : null,
    filters.status !== "ALL" ? `status ${TICKET_STATUS_LABEL[filters.status as TicketStatus] ?? filters.status}` : null,
    filters.severity !== "ALL" ? `severity ${filters.severity}` : null,
    filters.coverage !== "ALL" ? `coverage ${filters.coverage}` : null,
    filters.sla !== "ALL" ? `SLA ${SLA_STATE_LABEL[filters.sla as SLAState] ?? filters.sla}` : null,
    filters.scope !== "OPEN" ? `scope ${filters.scope.toLowerCase()}` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2 border-b border-line px-3 py-2.5">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-lo" aria-hidden />
          <TextInput
            defaultValue={filters.q}
            aria-label="Search tickets by number, serial, customer or problem"
            placeholder="Ticket number, serial, customer, problem…"
            className="pl-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") push({ q: (e.target as HTMLInputElement).value });
            }}
            onBlur={(e) => {
              if (e.target.value !== filters.q) push({ q: e.target.value });
            }}
          />
        </div>
        <Select
          aria-label="Scope"
          value={filters.scope}
          onChange={(e) => push({ scope: e.target.value })}
          className="w-36"
        >
          <option value="OPEN">Open only</option>
          <option value="ALL">All tickets</option>
          <option value="BREACHED">Breached</option>
        </Select>
        <Select
          aria-label="Status"
          value={filters.status}
          onChange={(e) => push({ status: e.target.value })}
          className="w-40"
        >
          <option value="ALL">All statuses</option>
          {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>
          ))}
        </Select>
        <Select
          aria-label="Severity"
          value={filters.severity}
          onChange={(e) => push({ severity: e.target.value })}
          className="w-32"
        >
          <option value="ALL">All severity</option>
          {(["CRITICAL", "HIGH", "NORMAL", "LOW"] as TicketSeverity[]).map((s) => (
            <option key={s} value={s}>{SEVERITY_SHORT[s]}</option>
          ))}
        </Select>
        <Select
          aria-label="Coverage"
          value={filters.coverage}
          onChange={(e) => push({ coverage: e.target.value })}
          className="w-36"
        >
          <option value="ALL">All coverage</option>
          {(["IN_WARRANTY", "UNDER_AMC", "CHARGEABLE"] as CoverageType[]).map((c) => (
            <option key={c} value={c}>{COVERAGE_LABEL[c]}</option>
          ))}
        </Select>
        <Select
          aria-label="SLA state"
          value={filters.sla}
          onChange={(e) => push({ sla: e.target.value })}
          className="w-36"
        >
          <option value="ALL">All SLA states</option>
          {(["COMFORTABLE", "APPROACHING", "IMMINENT", "BREACHED"] as SLAState[]).map((s) => (
            <option key={s} value={s}>{SLA_STATE_LABEL[s]}</option>
          ))}
        </Select>
        {canCreate ? (
          <Link href="/service/tickets/new" className={btnClass("primary")}>
            <Plus className="size-4" aria-hidden />
            Log ticket
          </Link>
        ) : null}
      </div>

      <p className="t-body-sm px-3 py-1.5 text-text-lo">
        {formatCount(all.length)} shown
        {shown < total ? ` of ${formatCount(total)} matching · newest first` : ""}
        {sessionRows.length ? ` · ${sessionRows.length} raised in this session` : ""}
      </p>

      {all.length === 0 ? (
        activeFilters.length ? (
          <FilteredEmpty filters={activeFilters} onClear={() => router.push("/service/tickets")} />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No service tickets"
            body="Nothing has been logged against this scope. A ticket carries the machine, the coverage basis and the clock, so log one rather than working from a phone note."
            action={
              canCreate ? (
                <Link href="/service/tickets/new" className={btnClass("primary")}>
                  <Plus className="size-4" aria-hidden />
                  Log the first ticket
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                {["Ticket", "Customer & site", "Machine", "Severity", "Coverage", "Restoration clock", "Status", "Engineer"].map((h) => (
                  <th key={h} className="t-overline px-3 py-2 font-semibold text-text-lo">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-line align-middle transition-colors duration-150 hover:bg-surface-2"
                  style={{ height: "var(--row-h, 36px)" }}
                >
                  <td className="px-3 py-1.5">
                    <Link href={`/service/tickets/${r.id}`} className="t-mono text-text-hi hover:text-primary-400">
                      {r.number}
                    </Link>
                    <p className="t-body-sm text-text-lo">
                      {TICKET_CATEGORY_LABEL[r.category]} · {formatDateTime(r.loggedAtMs)}
                    </p>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="t-body-sm text-text-hi">{r.customerName}</span>
                    <p className="t-body-sm text-text-lo">
                      {r.siteName} · {r.siteDistrict}
                    </p>
                  </td>
                  <td className="px-3 py-1.5">
                    <Serial>{r.assetSerial}</Serial>
                    <p className="t-body-sm text-text-lo">{r.assetModel}</p>
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge tone={SEVERITY_TONE[r.severity]}>{SEVERITY_SHORT[r.severity]}</StatusBadge>
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge tone={COVERAGE_TONE[r.coverage]}>{COVERAGE_LABEL[r.coverage]}</StatusBadge>
                  </td>
                  <td className="px-3 py-1.5">
                    <SlaClock
                      input={{
                        loggedAtMs: r.loggedAtMs,
                        dueAtMs: r.restorationDueMs,
                        stoppedAtMs: r.restoredAtMs,
                        pausedMs: r.pausedMs,
                        pauseStartedAtMs: r.pauseStartedAtMs,
                        businessHours: r.businessHours,
                      }}
                      nowMs={now}
                      holidays={holidays}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge tone={STATUS_TONE[r.status]}>{TICKET_STATUS_LABEL[r.status]}</StatusBadge>
                  </td>
                  <td className={cn("px-3 py-1.5 t-body-sm", r.engineerName ? "text-text-hi" : "text-text-lo")}>
                    {r.engineerName ?? "Unassigned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
