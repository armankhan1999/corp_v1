import Link from "next/link";
import { CalendarRange, CircleAlert } from "lucide-react";
import { Overline } from "@/components/patterns/primitives";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, type ResolvedPeriod } from "./period";

/**
 * E2-S7 — period control. Server-rendered: the presets are links and the
 * custom range is a GET form, so the control works with scripting disabled and
 * every period is a shareable URL.
 */
export function PeriodBar({
  resolved, basePath, preserve, asOfNote,
}: {
  resolved: ResolvedPeriod;
  basePath: string;
  /** Query keys carried across a period change, e.g. the executive view flag. */
  preserve?: Record<string, string>;
  asOfNote?: string;
}) {
  const href = (key: string) => {
    const q = new URLSearchParams(preserve ?? {});
    if (key !== "THIS_FY") q.set("period", key);
    if (key === "CUSTOM") {
      q.set("from", resolved.fromInput);
      q.set("to", resolved.toInput);
    }
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Overline className="mr-1 flex items-center gap-1.5">
          <CalendarRange className="size-3.5" aria-hidden />
          Period
        </Overline>
        {PERIOD_OPTIONS.map((o) => (
          <Link
            key={o.key}
            href={href(o.key)}
            aria-current={resolved.key === o.key ? "true" : undefined}
            className={cn(
              "t-overline rounded-md border px-2 py-1 transition-colors duration-150",
              resolved.key === o.key
                ? "border-primary-500 bg-primary-100 text-text-hi"
                : "border-line text-text-mid hover:border-line-strong hover:text-text-hi",
            )}
          >
            {o.label}
          </Link>
        ))}
        <span className="t-body-sm ml-auto text-text-mid">
          Showing <span className="text-text-hi">{resolved.label}</span> · compared with{" "}
          {resolved.priorLabel}
        </span>
      </div>

      {resolved.key === "CUSTOM" ? (
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
          {Object.entries(preserve ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="period" value="CUSTOM" />
          <div className="flex flex-col gap-1">
            <label className="t-overline text-text-lo" htmlFor="period-from">From</label>
            <input
              id="period-from"
              type="date"
              name="from"
              defaultValue={resolved.fromInput}
              aria-invalid={resolved.error ? true : undefined}
              aria-describedby={resolved.error ? "period-error" : undefined}
              className={cn(
                "t-body-sm rounded-md border bg-surface-0 px-2 py-1 text-text-hi",
                resolved.error ? "border-danger" : "border-line",
              )}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="t-overline text-text-lo" htmlFor="period-to">To</label>
            <input
              id="period-to"
              type="date"
              name="to"
              defaultValue={resolved.toInput}
              aria-invalid={resolved.error ? true : undefined}
              aria-describedby={resolved.error ? "period-error" : undefined}
              className={cn(
                "t-body-sm rounded-md border bg-surface-0 px-2 py-1 text-text-hi",
                resolved.error ? "border-danger" : "border-line",
              )}
            />
          </div>
          <button
            type="submit"
            className="t-overline rounded-md border border-line-strong px-3 py-1.5 text-text-hi hover:bg-surface-2"
          >
            Apply range
          </button>
        </form>
      ) : null}

      {resolved.error ? (
        <p
          id="period-error"
          role="alert"
          className="t-body-sm flex items-start gap-2 rounded-md border border-danger/40 bg-danger-bg px-3 py-2 text-danger"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {resolved.error} The range was not applied — figures below remain on{" "}
            {resolved.label}.
          </span>
        </p>
      ) : null}

      <p className="t-body-sm text-text-lo">
        Flow figures — revenue, conversion, SLA compliance — follow the selected period. Position
        figures — locked cash, order book, open commitments — are stated as at{" "}
        <span className="t-mono text-text-mid">{formatDate(resolved.asOf)}</span>
        {asOfNote ? `, ${asOfNote}` : ", because a balance cannot be reported for a date that has not happened."}
      </p>
    </div>
  );
}
