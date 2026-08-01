import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, Boxes, CircleCheck, CircleDashed,
  HardHat, Minus, TriangleAlert, Wrench,
} from "lucide-react";
import { Panel, PanelHeader, Overline, StatusBadge } from "@/components/patterns/primitives";
import { abbreviateINR, formatCount, formatDateTime } from "@/lib/format";
import { VERTICAL_LABEL, VERTICAL_TOKEN, type HealthState, type Vertical } from "@/lib/schemas/enums";
import { cn } from "@/lib/utils";
import type * as D from "@/lib/derive";
import type { Kpi, VerticalTile } from "./metrics";

const VERTICAL_ICON: Record<Vertical, React.ComponentType<{ className?: string }>> = {
  EQUIPMENT_SALES: Boxes,
  SERVICE_AMC: Wrench,
  PROJECTS: HardHat,
  RENTAL: Banknote,
};

const HEALTH_META: Record<
  HealthState,
  { tone: "ok" | "warn" | "danger" | "neutral"; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  HEALTHY: { tone: "ok", label: "Healthy", icon: CircleCheck },
  WATCH: { tone: "warn", label: "Watch", icon: TriangleAlert },
  ACTION: { tone: "danger", label: "Action", icon: TriangleAlert },
  NO_ACTIVITY: { tone: "neutral", label: "No activity", icon: CircleDashed },
};

/** Bare inline sparkline — no chart library, no axis, no decoration. */
export function Sparkline({ series, label }: { series: number[]; label: string }) {
  if (series.length < 2) return null;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const w = 100;
  const h = 22;
  const points = series
    .map((v, i) => `${((i / (series.length - 1)) * w).toFixed(2)},${(h - ((v - min) / span) * h).toFixed(2)}`)
    .join(" ");
  const last = series[series.length - 1]!;
  const first = series[0]!;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-5 w-full text-text-lo"
      role="img"
      aria-label={`${label}. First point ${formatCount(Math.round(first))}, last point ${formatCount(Math.round(last))}.`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DeltaGlyph({ direction }: { direction: Kpi["direction"] }) {
  if (direction === "up") return <ArrowUpRight className="size-3 shrink-0" aria-hidden />;
  if (direction === "down") return <ArrowDownRight className="size-3 shrink-0" aria-hidden />;
  return <Minus className="size-3 shrink-0" aria-hidden />;
}

export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    /* Six equal cards on a three-column grid — two clean rows. The hero used to
       span two columns of a six-column grid, which made seven units fight for
       six slots and stranded the last card alone on a second row. The hero now
       earns its emphasis from `panel-hero` alone, and the grid stays even. */
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((k) => (
        <li key={k.id}>
          <Link
            href={k.href}
            className={cn(
              "group flex h-full flex-col gap-1.5 panel-pad lift",
              k.hero ? "panel-hero" : "panel",
            )}
          >
            <Overline>{k.label}</Overline>
            <span
              className={cn("text-text-hi", k.hero ? "t-display-lg" : "t-display-md")}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {k.value}
            </span>
            <span
              className={cn(
                "t-body-sm flex items-center gap-1",
                k.direction === "flat" ? "text-text-mid" : k.favourable ? "text-ok" : "text-warn",
              )}
            >
              <DeltaGlyph direction={k.direction} />
              <span>{k.delta}</span>
            </span>
            <Sparkline series={k.series} label={k.seriesLabel} />
            {/* The as-at timestamp is stated once in the page header. Repeating
                it on every card added a line of identical text to each one and
                was most of what made this grid read as a wall of prose. */}
            <span className="t-body-sm mt-auto text-text-lo">{k.basis}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function VerticalTiles({ tiles }: { tiles: VerticalTile[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Vertical health"
        sub="State is declared by a published rule — hover a chip to read it."
      />
      <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = VERTICAL_ICON[t.vertical];
          const meta = HEALTH_META[t.state];
          const HealthIcon = meta.icon;
          return (
            <li key={t.vertical} className="bg-surface-1">
              <div className="flex h-full gap-3 p-4">
                <span
                  aria-hidden
                  className="w-[3px] shrink-0 rounded-full"
                  style={{ background: VERTICAL_TOKEN[t.vertical] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={t.href}
                      className="t-body flex items-center gap-2 font-medium text-text-hi hover:underline"
                    >
                      <Icon className="size-4 text-text-mid" aria-hidden />
                      {VERTICAL_LABEL[t.vertical]}
                    </Link>
                    <StatusBadge tone={meta.tone} icon={false} className="cursor-help" >
                      <HealthIcon className="size-3 shrink-0" aria-hidden />
                      <span tabIndex={0} title={t.rule}>{meta.label}</span>
                    </StatusBadge>
                  </div>
                  {t.state === "NO_ACTIVITY" ? (
                    <p className="t-body-sm mt-2 text-text-mid">
                      No activity in this period. This is an absence of records, not a zero result.
                    </p>
                  ) : (
                    <>
                      <p className="t-body-sm mt-2 text-text-lo">{t.headline}</p>
                      <p
                        className="t-display-md text-text-hi"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {t.metric}
                      </p>
                      <p className="t-body-sm mt-1 text-text-mid">{t.supportA}</p>
                      <p className="t-body-sm text-text-mid">{t.supportB}</p>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function LockedCashPanel({
  locked, rec, ret, asOf,
}: {
  locked: { total: number; receivables: number; retention: number };
  rec: ReturnType<typeof D.receivables>;
  ret: ReturnType<typeof D.retention>;
  asOf: Date;
}) {
  const buckets = [
    ["0–30 days", rec.buckets.B0_30, "/commercial/receivables?bucket=B0_30"],
    ["31–60 days", rec.buckets.B31_60, "/commercial/receivables?bucket=B31_60"],
    ["61–90 days", rec.buckets.B61_90, "/commercial/receivables?bucket=B61_90"],
    ["90+ days", rec.buckets.B90_PLUS, "/commercial/receivables?bucket=B90_PLUS"],
  ] as const;

  return (
    <Panel className="self-start">
      <PanelHeader
        title="Locked cash"
        sub="Receivables outstanding plus project retention. The two components sum exactly to the headline."
        right={<StatusBadge tone="danger">Action</StatusBadge>}
      />
      <div className="p-4">
        <p className="t-display-lg text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
          {abbreviateINR(locked.total)}
        </p>
        <p className="t-body-sm mt-1 text-text-mid">
          {abbreviateINR(locked.receivables)} receivable · {abbreviateINR(locked.retention)} retention
        </p>
        <p className="t-body-sm text-text-lo">
          Data as of <span className="t-mono text-text-mid">{formatDateTime(asOf)}</span> IST
        </p>

        <div className="mt-4 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
          {buckets.map(([label, b, href]) => (
            <Link
              key={label}
              href={href}
              className="flex items-center justify-between gap-3 bg-surface-1 px-3 py-2 hover:bg-surface-2"
            >
              <span className="t-body-sm text-text-mid">{label}</span>
              <span className="flex items-center gap-3">
                <span className="t-body-sm text-text-lo">{formatCount(b.count)} inv</span>
                <span
                  className="t-body font-medium text-text-hi"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {abbreviateINR(b.value)}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="t-overline text-text-lo">Institutional &amp; govt</dt>
            <dd className="t-body font-medium text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              <Link href="/commercial/receivables?segment=institutional" className="hover:underline">
                {abbreviateINR(rec.institutional)}
              </Link>{" "}
              <span className="t-body-sm text-text-lo">
                ({Math.round((rec.institutional / (rec.total || 1)) * 100)}%)
              </span>
            </dd>
          </div>
          <div>
            <dt className="t-overline text-text-lo">Private sector</dt>
            <dd className="t-body font-medium text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              <Link href="/commercial/receivables?segment=private" className="hover:underline">
                {abbreviateINR(rec.privateSector)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="t-overline text-text-lo">Retention claimable now</dt>
            <dd className="t-body font-medium text-warn" style={{ fontVariantNumeric: "tabular-nums" }}>
              <Link href="/projects/retention?state=ELIGIBLE" className="hover:underline">
                {abbreviateINR(ret.eligible)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="t-overline text-text-lo">Projects holding retention</dt>
            <dd className="t-body font-medium text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCount(ret.projectCount)}
            </dd>
          </div>
        </dl>

        <Link
          href="/projects/retention"
          className="t-body-sm mt-4 inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          Open retention register
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}

/** E2-S7 — six figures, display type, nothing else. Legible on a phone without zooming. */
export function ExecutiveFigures({ kpis }: { kpis: Kpi[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((k) => (
        <li key={k.id}>
          <Link
            href={k.href}
            className="panel lift flex min-h-[9rem] flex-col justify-between gap-2 p-6"
          >
            <Overline>{k.label}</Overline>
            <span
              className="t-display-lg text-text-hi"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {k.value}
            </span>
            <span
              className={cn(
                "t-body flex items-center gap-1.5",
                k.direction === "flat" ? "text-text-mid" : k.favourable ? "text-ok" : "text-warn",
              )}
            >
              <DeltaGlyph direction={k.direction} />
              <span>{k.delta}</span>
            </span>
            <span className="t-body-sm text-text-lo">
              {k.basis}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
