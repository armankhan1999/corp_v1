import Link from "next/link";
import { CircleDot, Info, TriangleAlert } from "lucide-react";
import {
  INTEGRATIONS, INTEGRATION_VERTICALS, PREREQ_LABEL, type Integration,
} from "@/components/domain/admin/integrations";
import { Panel, PanelHeader, Overline, StatusBadge, SimulatedBadge } from "@/components/patterns/primitives";
import { formatCount } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * E1-S8 — Integration Readiness disclosure. Every "Simulated" chip in the
 * product links here, so this screen carries the honesty of the whole
 * prototype: what is mocked, how faithfully, and exactly what a live
 * connection would require in Phase 2 (BRD X-02, R-04).
 */
export default function IntegrationReadinessPage() {
  const byVertical = INTEGRATION_VERTICALS.map((v) => ({
    vertical: v,
    items: INTEGRATIONS.filter((i) => i.vertical === v),
  })).filter((g) => g.items.length > 0);

  const prereqCount = INTEGRATIONS.reduce(
    (s, i) => s + i.prerequisites.filter((p) => !p.none).length, 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">Integration Readiness</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
          Every external system in this prototype is simulated. Each simulation is behaviourally
          faithful — correct sequence, states and failure modes — so Phase 2 replaces the
          simulation without redesigning the interface. Nothing below is connected to a live
          service, and nothing here requests or holds client credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Simulated integrations", value: formatCount(INTEGRATIONS.length) },
          { label: "Phase 2 prerequisites", value: formatCount(prereqCount) },
          { label: "Live connections today", value: "0" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
            <Overline>{s.label}</Overline>
            <p className="t-display-md text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {byVertical.map((group) => (
        <section key={group.vertical} className="flex flex-col gap-3">
          <h2 className="t-overline text-text-lo">{group.vertical}</h2>
          {group.items.map((i) => (
            <IntegrationCard key={i.id} integration={i} />
          ))}
        </section>
      ))}
    </div>
  );
}

function IntegrationCard({ integration: i }: { integration: Integration }) {
  return (
    <Panel>
      <PanelHeader
        title={i.name}
        sub={i.purpose}
        right={
          <div className="flex items-center gap-2">
            <span className="t-mono text-text-lo">{i.id}</span>
            <SimulatedBadge what={i.name} />
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4 bg-surface-1 p-4">
          <div>
            <Overline>How it is simulated</Overline>
            <p className="t-body-sm mt-1 text-text-mid">{i.simulation}</p>
          </div>

          <div>
            <Overline>Visible states</Overline>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {i.states.map((s) => (
                <li key={s}>
                  <span className="t-overline inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
                    <CircleDot className="size-3" aria-hidden />
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {i.appearsAt.length > 0 ? (
            <div>
              <Overline>Where it appears</Overline>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {i.appearsAt.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} className="t-body-sm text-primary-500 hover:text-primary-400">
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {i.callout ? (
            <div
              className={
                i.callout.tone === "warn"
                  ? "rounded-md border border-warn/40 bg-warn-bg p-3"
                  : "rounded-md border border-info/40 bg-info-bg p-3"
              }
            >
              <p className={i.callout.tone === "warn" ? "t-label text-warn" : "t-label text-info"}>
                {i.callout.tone === "warn" ? (
                  <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />
                ) : (
                  <Info className="mr-1 inline size-3.5" aria-hidden />
                )}
                {i.callout.title}
              </p>
              <p className="t-body-sm mt-1 text-text-mid">{i.callout.body}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 bg-surface-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <Overline>Phase 2 effort</Overline>
            <StatusBadge tone="info">{i.effortBand}</StatusBadge>
          </div>
          <p className="t-body-sm text-text-mid">
            <span className="text-text-hi">Critical path:</span> {i.criticalPath}
          </p>

          <div>
            <Overline>Prerequisites</Overline>
            <ul className="mt-1.5 flex flex-col gap-2">
              {i.prerequisites.map((p) => (
                <li
                  key={`${p.category}-${p.label}`}
                  className="rounded-md border border-line bg-surface-2 p-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="t-overline text-text-lo">{PREREQ_LABEL[p.category]}</span>
                    {p.none ? <StatusBadge tone="ok">Not required</StatusBadge> : null}
                  </div>
                  <p className="t-body-sm mt-0.5 text-text-hi">{p.label}</p>
                  <p className="t-body-sm text-text-mid">{p.detail}</p>
                  <p className="t-body-sm mt-0.5 text-text-lo">
                    {p.owner} · {p.effort}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}
