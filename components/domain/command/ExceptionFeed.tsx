import Link from "next/link";
import {
  AlertOctagon, Check, Circle, Clock, Info, Inbox, ListFilter, RotateCcw, TriangleAlert, UserPlus, X,
} from "lucide-react";
import { EmptyState, Overline, StatusBadge } from "@/components/patterns/primitives";
import { abbreviateINR, formatDateTime, formatCount, enumLabel } from "@/lib/format";
import { EXCEPTION_LABEL, ROLE_LABEL, type ExceptionSeverity, type ExceptionType } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import { acknowledgeException, assignException, reopenException, snoozeException } from "./exception-actions";
import { LIFECYCLE_LABEL, SNOOZE_OPTIONS, type ExceptionLifecycle, type ExceptionStateEntry } from "./exception-state";
import { formatAge, SEVERITY_ORDER, TYPE_ORDER, type ExceptionRow } from "./exceptions";

export interface FeedItem {
  row: ExceptionRow;
  lifecycle: ExceptionLifecycle;
  entry: ExceptionStateEntry | undefined;
}

export interface FeedFilters {
  severity: ExceptionSeverity | null;
  type: ExceptionType | null;
  state: "OUTSTANDING" | "ALL" | ExceptionLifecycle;
}

const SEVERITY_META: Record<
  ExceptionSeverity,
  { icon: React.ComponentType<{ className?: string }>; text: string; bg: string; border: string }
> = {
  CRITICAL: { icon: AlertOctagon, text: "text-danger", bg: "bg-danger-bg", border: "border-danger/40" },
  HIGH: { icon: TriangleAlert, text: "text-warn", bg: "bg-warn-bg", border: "border-warn/40" },
  MEDIUM: { icon: Info, text: "text-info", bg: "bg-info-bg", border: "border-info/40" },
  LOW: { icon: Circle, text: "text-text-mid", bg: "bg-surface-2", border: "border-line" },
};

const LIFECYCLE_TONE: Record<ExceptionLifecycle, "neutral" | "ok" | "info" | "warn"> = {
  OPEN: "neutral",
  ACKNOWLEDGED: "ok",
  ASSIGNED: "info",
  SNOOZED: "warn",
};

function chipClass(active: boolean): string {
  return cn(
    "t-overline inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors duration-150",
    active
      ? "border-primary-500 bg-primary-100 text-text-hi"
      : "border-line bg-surface-1 text-text-mid hover:border-line-strong hover:text-text-hi",
  );
}

export function SeverityChip({ severity }: { severity: ExceptionSeverity }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        meta.bg, meta.text, meta.border,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {enumLabel(severity)}
    </span>
  );
}

export function ExceptionFilters({
  filters, counts, severityCounts, total, basePath,
}: {
  filters: FeedFilters;
  counts: Record<ExceptionType, number>;
  severityCounts: Record<ExceptionSeverity, number>;
  total: number;
  basePath: string;
}) {
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    if (filters.severity) q.set("severity", filters.severity);
    if (filters.type) q.set("type", filters.type);
    if (filters.state !== "OUTSTANDING") q.set("state", filters.state);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const anyFilter = filters.severity !== null || filters.type !== null || filters.state !== "OUTSTANDING";

  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Overline className="mr-1">Severity</Overline>
        <Link href={href({ severity: null })} className={chipClass(filters.severity === null)}>
          All {formatCount(total)}
        </Link>
        {SEVERITY_ORDER.map((s) => (
          <Link
            key={s}
            href={href({ severity: filters.severity === s ? null : s })}
            className={chipClass(filters.severity === s)}
          >
            {enumLabel(s)} {formatCount(severityCounts[s])}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Overline className="mr-1">State</Overline>
        {([
          ["OUTSTANDING", "Needs attention"],
          ["ACKNOWLEDGED", "Acknowledged"],
          ["SNOOZED", "Snoozed"],
          ["ALL", "All states"],
        ] as const).map(([value, label]) => (
          <Link
            key={value}
            href={href({ state: value === "OUTSTANDING" ? null : value })}
            className={chipClass(filters.state === value)}
          >
            {label}
          </Link>
        ))}
      </div>

      <details className="group">
        <summary className="t-overline inline-flex cursor-pointer list-none items-center gap-1.5 text-text-mid hover:text-text-hi">
          <ListFilter className="size-3.5" aria-hidden />
          Filter by type — all 16 rules evaluated
        </summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {TYPE_ORDER.map((t) => (
            <Link
              key={t}
              href={href({ type: filters.type === t ? null : t })}
              className={cn(chipClass(filters.type === t), counts[t] === 0 && "opacity-55")}
              title={counts[t] === 0 ? "Rule evaluated; nothing matched in this scope" : undefined}
            >
              {EXCEPTION_LABEL[t]} {formatCount(counts[t])}
            </Link>
          ))}
        </div>
      </details>

      {anyFilter ? (
        <div>
          <Link
            href={basePath}
            className="t-overline inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-text-hi hover:bg-surface-2"
          >
            <X className="size-3" aria-hidden />
            Clear filters
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ActionCell({ item, users }: { item: FeedItem; users: { id: string; name: string; role: string }[] }) {
  const { row, lifecycle } = item;
  const hidden = (
    <>
      <input type="hidden" name="exceptionId" value={row.id} />
      <input type="hidden" name="label" value={`${EXCEPTION_LABEL[row.type]} — ${row.subject}`} />
    </>
  );
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        {lifecycle === "ACKNOWLEDGED" || lifecycle === "SNOOZED" ? (
          <form action={reopenException}>
            {hidden}
            <button
              type="submit"
              className="t-overline inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <RotateCcw className="size-3" aria-hidden />
              Reopen
            </button>
          </form>
        ) : (
          <form action={acknowledgeException}>
            {hidden}
            <button
              type="submit"
              className="t-overline inline-flex items-center gap-1 rounded-md border border-ok/40 bg-ok-bg px-2 py-1 text-ok hover:border-ok"
            >
              <Check className="size-3" aria-hidden />
              Acknowledge
            </button>
          </form>
        )}
        <details className="relative">
          <summary className="t-overline inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi">
            Manage
          </summary>
          <div className="mt-1.5 flex w-56 flex-col gap-2 rounded-md border border-line-strong bg-surface-2 p-2">
            <form action={assignException} className="flex flex-col gap-1">
              {hidden}
              <label className="t-overline text-text-lo" htmlFor={`assign-${row.id}`}>
                Assign to
              </label>
              <select
                id={`assign-${row.id}`}
                name="assignTo"
                defaultValue={row.ownerId}
                className="t-body-sm rounded-md border border-line bg-surface-1 px-2 py-1 text-text-hi"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="t-overline inline-flex items-center justify-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <UserPlus className="size-3" aria-hidden />
                Assign
              </button>
            </form>
            <form action={snoozeException} className="flex flex-col gap-1 border-t border-line pt-2">
              {hidden}
              <label className="t-overline text-text-lo" htmlFor={`snooze-${row.id}`}>
                Snooze, then return
              </label>
              <select
                id={`snooze-${row.id}`}
                name="interval"
                defaultValue="1d"
                className="t-body-sm rounded-md border border-line bg-surface-1 px-2 py-1 text-text-hi"
              >
                {SNOOZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="t-overline inline-flex items-center justify-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                <Clock className="size-3" aria-hidden />
                Snooze
              </button>
            </form>
          </div>
        </details>
      </div>
      {item.entry && lifecycle !== "OPEN" ? (
        <span className="t-body-sm text-right text-text-lo">
          {lifecycle === "SNOOZED" && item.entry.snoozeUntilIso
            ? `Returns ${formatDateTime(item.entry.snoozeUntilIso)}`
            : lifecycle === "ASSIGNED"
              ? `Assigned to ${item.entry.assignedToName}`
              : `By ${item.entry.byName}`}
        </span>
      ) : null}
    </div>
  );
}

export function ExceptionTable({
  items, users, now,
}: {
  items: FeedItem[];
  users: { id: string; name: string; role: string }[];
  now: Date;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[62rem] border-collapse">
        <caption className="sr-only">
          Exceptions ordered by severity, then by age within each severity band.
        </caption>
        <thead>
          <tr className="border-b border-line-strong text-left">
            <th scope="col" className="t-overline px-3 py-2 font-semibold text-text-lo">Severity</th>
            <th scope="col" className="t-overline px-3 py-2 font-semibold text-text-lo">Type</th>
            <th scope="col" className="t-overline px-3 py-2 font-semibold text-text-lo">Subject</th>
            <th scope="col" className="t-overline px-3 py-2 font-semibold text-text-lo">What is wrong</th>
            <th scope="col" className="t-overline px-3 py-2 text-right font-semibold text-text-lo">Age</th>
            <th scope="col" className="t-overline px-3 py-2 text-right font-semibold text-text-lo">At stake</th>
            <th scope="col" className="t-overline px-3 py-2 font-semibold text-text-lo">Accountable</th>
            <th scope="col" className="t-overline px-3 py-2 text-right font-semibold text-text-lo">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ row, lifecycle, entry }) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-line align-top hover:bg-surface-2",
                lifecycle !== "OPEN" && "opacity-75",
              )}
            >
              <td className="px-3 py-2"><SeverityChip severity={row.severity} /></td>
              <td className="t-body-sm px-3 py-2 text-text-mid">{EXCEPTION_LABEL[row.type]}</td>
              <td className="px-3 py-2">
                <Link href={row.subjectHref} className="t-mono text-text-hi underline decoration-line underline-offset-2 hover:decoration-text-hi">
                  {row.subject}
                </Link>
                <span className="t-body-sm block max-w-64 truncate text-text-lo">{row.headline}</span>
              </td>
              <td className="t-body-sm max-w-96 px-3 py-2 text-text-mid">{row.detail}</td>
              <td className="t-body-sm whitespace-nowrap px-3 py-2 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatAge(row.ageMs, now, row.sinceIso)}
              </td>
              <td className="t-body-sm whitespace-nowrap px-3 py-2 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                {row.value === null ? <span className="text-text-lo">—</span> : abbreviateINR(row.value)}
              </td>
              <td className="px-3 py-2">
                <span className="t-body-sm block whitespace-nowrap text-text-hi">{row.ownerName}</span>
                <span className="t-body-sm block whitespace-nowrap text-text-lo">
                  {ROLE_LABEL[row.ownerRole]}
                </span>
                <StatusBadge tone={LIFECYCLE_TONE[lifecycle]} className="mt-1">
                  {LIFECYCLE_LABEL[lifecycle]}
                </StatusBadge>
              </td>
              <td className="px-3 py-2">
                <ActionCell item={{ row, lifecycle, entry }} users={users} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeedPager({
  total, from, to, page, pages, hrefFor, showAllHref, showingAll,
}: {
  total: number;
  from: number;
  to: number;
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  showAllHref: string;
  showingAll: boolean;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2">
      <span className="t-body-sm text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
        Showing {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
        {showingAll ? " — every matching row" : ` · page ${formatCount(page)} of ${formatCount(pages)}`}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {!showingAll && pages > 1 ? (
          <>
            <Link
              href={hrefFor(Math.max(1, page - 1))}
              aria-disabled={page === 1}
              className={cn(
                "t-overline rounded-md border border-line px-2 py-1",
                page === 1 ? "pointer-events-none text-text-lo opacity-50" : "text-text-mid hover:border-line-strong hover:text-text-hi",
              )}
            >
              Previous
            </Link>
            <Link
              href={hrefFor(Math.min(pages, page + 1))}
              aria-disabled={page === pages}
              className={cn(
                "t-overline rounded-md border border-line px-2 py-1",
                page === pages ? "pointer-events-none text-text-lo opacity-50" : "text-text-mid hover:border-line-strong hover:text-text-hi",
              )}
            >
              Next
            </Link>
          </>
        ) : null}
        <Link
          href={showAllHref}
          className="t-overline rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          {showingAll ? "Back to pages" : `Show all ${formatCount(total)}`}
        </Link>
      </div>
    </div>
  );
}

export function NoExceptions({ lastEvaluated }: { lastEvaluated: Date }) {
  return (
    <EmptyState
      icon={Inbox}
      title="No exceptions requiring attention"
      body={`All sixteen exception rules were evaluated against the current scope at ${formatDateTime(lastEvaluated)} IST and none matched. Nothing is failing quietly.`}
      action={
        <Link
          href="/service/dispatch"
          className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          Open the dispatch board
        </Link>
      }
    />
  );
}

export function FilteredEmpty({ active, basePath }: { active: string[]; basePath: string }) {
  return (
    <EmptyState
      icon={ListFilter}
      title="No exception matches these filters"
      body={`${active.join(" · ")} excluded every row. The rules still hold — nothing here is dismissed, only hidden.`}
      action={
        <Link
          href={basePath}
          className="t-body-sm inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-1.5 text-text-hi hover:bg-surface-2"
        >
          <X className="size-3.5" aria-hidden />
          Clear filters
        </Link>
      }
    />
  );
}
