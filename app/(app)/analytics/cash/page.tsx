import Link from "next/link";
import { ArrowRight } from "lucide-react";
import * as D from "@/lib/derive";
import { abbreviateINR, formatCount, formatPercent } from "@/lib/format";
import { Overline, Panel, PanelHeader, StatusBadge, Explainer } from "@/components/patterns/primitives";
import { buildKpiTile, kpisForSurface } from "@/components/domain/analytics/kpiRegistry";
import { SurfaceLayout } from "@/components/domain/analytics/SurfaceLayout";
import { buildSurfaceContext, type SearchParams } from "@/components/domain/analytics/surfaceContext";
import { buildCashCharts } from "@/components/domain/analytics/surfaces/cash";

export const dynamic = "force-dynamic";

export default async function CashAnalytics({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await buildSurfaceContext("Cash analytics", "analytics.cash", await searchParams);
  const kpis = kpisForSurface("cash").map((def) => buildKpiTile(def, context.kpiInput, context.comparison));
  const charts = buildCashCharts(context);

  const locked = D.lockedCash({ ds: context.ds, now: context.now });
  const commandCentre = D.lockedCash({ ds: context.full, now: context.now });
  const rec = D.receivables({ ds: context.ds, now: context.now });
  const ret = D.retention({ ds: context.ds, now: context.now });
  const reconciles = locked.total === commandCentre.total;

  return (
    <SurfaceLayout
      title="Cash analytics"
      intent="What has been earned, what has been collected, and what is sitting outside the business. The locked-cash figure here is the same figure the Command Centre opens on."
      context={context}
      kpis={kpis}
      charts={charts}
      csvName="pravaah-cash-analytics.csv"
    >
      {/* E12-S3 — the reconciliation is asserted on screen, not left to be trusted. */}
      <Panel>
        <PanelHeader
          title="Locked cash"
          sub="Receivables outstanding plus project retention — a position as at the simulated clock, not a period figure."
          right={
            <StatusBadge tone={reconciles ? "ok" : "info"}>
              {reconciles ? "Reconciles to Command Centre" : "Branch-scoped view"}
            </StatusBadge>
          }
        />
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
          <Figure label="Locked cash" value={abbreviateINR(locked.total)} hero
            sub={`${abbreviateINR(locked.receivables)} receivable · ${abbreviateINR(locked.retention)} retention`} />
          <Figure
            label="Receivables outstanding"
            value={abbreviateINR(rec.total)}
            sub={`${formatCount(rec.openInvoices.length)} open invoices · ${abbreviateINR(rec.buckets.B90_PLUS.value)} beyond 90 days`}
          />
          <Figure
            label="Retention outstanding"
            value={abbreviateINR(ret.outstanding)}
            sub={`${abbreviateINR(ret.eligible)} claimable now across ${formatCount(ret.eligibleProjectCount)} projects`}
          />
        </div>
        <div className="border-t border-line px-4 py-3">
          <Overline>Reconciliation</Overline>
          <Explainer className="mt-1 text-text-mid">
            {reconciles ? (
              <>
                The Command Centre locked-cash panel reads{" "}
                <span className="t-mono text-text-hi">{abbreviateINR(commandCentre.total)}</span> and this surface
                reads <span className="t-mono text-text-hi">{abbreviateINR(locked.total)}</span> — identical, because
                both call the same implementation with the same scope. Institutional and government customers hold{" "}
                {formatPercent(rec.total ? (rec.institutional / rec.total) * 100 : 0)} of the receivable.
              </>
            ) : (
              <>
                This view is filtered to {context.scope.branchLabel} and reads{" "}
                <span className="t-mono text-text-hi">{abbreviateINR(locked.total)}</span>. The Command Centre panel is
                company-wide and reads{" "}
                <span className="t-mono text-text-hi">{abbreviateINR(commandCentre.total)}</span>. Clear the branch
                filter in the header above and the two become the same number.
              </>
            )}
          </Explainer>
          <Link
            href="/commercial/receivables"
            className="t-body-sm mt-2 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Open the receivables ledger
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </Panel>
    </SurfaceLayout>
  );
}

function Figure({
  label, value, sub, hero = false,
}: { label: string; value: string; sub: string; hero?: boolean }) {
  return (
    <div className="bg-surface-1 p-4">
      <Overline>{label}</Overline>
      <p
        className={hero ? "t-display-lg text-text-hi" : "t-display-md text-text-hi"}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      <p className="t-body-sm mt-1 text-text-mid">{sub}</p>
    </div>
  );
}
