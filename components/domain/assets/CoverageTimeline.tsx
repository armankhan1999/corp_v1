import * as React from "react";
import { FileCheck, ShieldCheck, ShieldOff } from "lucide-react";
import { daysBetween, formatDate } from "@/lib/format";
import { Overline } from "@/components/patterns/primitives";
import type { CoverageBand } from "./types";

/**
 * E5-S2 — the coverage timeline. Warranty and every AMC period render as bands
 * against one date axis; the intervals nothing covered are marked explicitly so
 * a gap is visible rather than inferred.
 */

const DAY = 86_400_000;

const LANE_META = {
  WARRANTY: {
    label: "Warranty",
    icon: ShieldCheck,
    bar: "bg-ok-bg border-ok/60",
    text: "text-ok",
  },
  AMC: {
    label: "AMC contracts",
    icon: FileCheck,
    bar: "bg-info-bg border-info/60",
    text: "text-info",
  },
  GAP: {
    label: "Uncovered",
    icon: ShieldOff,
    bar: "bg-danger-bg border-danger/70 border-dashed",
    text: "text-danger",
  },
} as const;

function yearTicks(from: number, to: number): { at: number; label: string }[] {
  const out: { at: number; label: string }[] = [];
  const startYear = new Date(from).getFullYear();
  const endYear = new Date(to).getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const at = new Date(y, 0, 1).getTime();
    if (at < from || at > to) continue;
    out.push({ at, label: String(y) });
  }
  return out;
}

export function CoverageTimeline({
  bands,
  now,
  emptyNote,
}: {
  bands: CoverageBand[];
  now: Date;
  emptyNote: string;
}) {
  if (!bands.length) {
    return (
      <div className="px-4 py-6">
        <p className="t-body-sm text-text-mid">{emptyNote}</p>
      </div>
    );
  }

  const starts = bands.map((b) => new Date(b.from).getTime());
  const ends = bands.map((b) => new Date(b.to).getTime());
  const rawFrom = Math.min(...starts);
  const rawTo = Math.max(...ends, now.getTime());
  const pad = Math.max((rawTo - rawFrom) * 0.02, 10 * DAY);
  const from = rawFrom - pad;
  const to = rawTo + pad;
  const span = to - from || 1;

  const pct = (t: number) => ((t - from) / span) * 100;
  const lanes: (keyof typeof LANE_META)[] = ["WARRANTY", "AMC", "GAP"];
  const ticks = yearTicks(from, to);
  const nowPct = pct(now.getTime());

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="relative">
        {/* Year gridlines */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {ticks.map((t) => (
            <span
              key={t.at}
              className="absolute top-0 h-full w-px bg-line"
              style={{ left: `${pct(t.at)}%` }}
            />
          ))}
          <span
            className="absolute top-0 h-full w-px bg-primary-500"
            style={{ left: `${nowPct}%` }}
          />
        </div>

        <div className="relative flex flex-col gap-2">
          {lanes.map((lane) => {
            const laneBands = bands.filter((b) => b.kind === lane);
            const meta = LANE_META[lane];
            const Icon = meta.icon;
            if (!laneBands.length && lane === "GAP") return null;
            return (
              <div key={lane} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
                <span className={`t-overline flex items-center gap-1 ${meta.text}`}>
                  <Icon className="size-3 shrink-0" aria-hidden />
                  {meta.label}
                </span>
                <div className="relative h-6 rounded-md border border-line bg-surface-0">
                  {laneBands.map((b) => {
                    const left = pct(new Date(b.from).getTime());
                    const width = Math.max(pct(new Date(b.to).getTime()) - left, 0.6);
                    return (
                      <span
                        key={`${b.kind}-${b.from}-${b.to}`}
                        title={`${b.label} · ${formatDate(b.from)} to ${formatDate(b.to)}`}
                        className={`absolute top-1/2 h-4 -translate-y-1/2 rounded border ${meta.bar} ${
                          b.live ? "ring-1 ring-inset ring-current" : ""
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    );
                  })}
                  {!laneBands.length ? (
                    <span className="t-body-sm absolute left-2 top-1/2 -translate-y-1/2 text-text-lo">
                      None recorded
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Date axis */}
        <div className="relative mt-2 grid grid-cols-[7.5rem_1fr] gap-2">
          <span className="t-overline text-text-lo">Date axis</span>
          <div className="relative h-5 border-t border-line">
            {ticks.map((t) => (
              <span
                key={t.at}
                className="t-mono absolute top-1 -translate-x-1/2 text-[0.6875rem] text-text-lo"
                style={{ left: `${pct(t.at)}%` }}
              >
                {t.label}
              </span>
            ))}
            <span
              className="t-overline absolute top-1 -translate-x-1/2 whitespace-nowrap text-primary-400"
              style={{ left: `${nowPct}%` }}
            >
              Today
            </span>
          </div>
        </div>
      </div>

      {/* Tabular equivalent — every chart has one. */}
      <div className="mt-2">
        <Overline>Periods</Overline>
        <ul className="mt-1 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
          {[...bands]
            .sort((a, b) => a.from.localeCompare(b.from))
            .map((b) => {
              const meta = LANE_META[b.kind];
              const Icon = meta.icon;
              const days = daysBetween(b.from, b.to);
              return (
                <li
                  key={`${b.kind}-${b.from}-${b.to}`}
                  className="flex flex-wrap items-center justify-between gap-2 bg-surface-1 px-3 py-1.5"
                >
                  <span className={`t-body-sm flex items-center gap-1.5 ${meta.text}`}>
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {b.label}
                    {b.live ? (
                      <span className="t-overline rounded border border-line bg-surface-2 px-1 text-text-mid">
                        In force
                      </span>
                    ) : null}
                  </span>
                  <span className="t-body-sm tabular-nums text-text-mid">
                    {formatDate(b.from)} → {formatDate(b.to)}{" "}
                    <span className="text-text-lo">({days} days)</span>
                  </span>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
