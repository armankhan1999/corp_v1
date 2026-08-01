import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { abbreviateINR, formatDate } from "@/lib/format";
import { getViewer, portfolioRows } from "@/components/domain/projects/server";
import { projectExceptions } from "@/components/domain/projects/exceptions";
import { PortfolioTable } from "@/components/domain/projects/PortfolioTable";
import { ExceptionFeedPanel } from "@/components/domain/projects/ExceptionFeedPanel";
import { ROLE_LABEL } from "@/lib/schemas/enums";

export const dynamic = "force-dynamic";

export const metadata = { title: "Project portfolio — Pravaah" };

export default async function ProjectsPortfolioPage() {
  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const viewer = await getViewer();
  const rows = portfolioRows(ds, viewer, ctx.now);
  const exceptions = projectExceptions(ds, rows, ctx.now);
  const ret = D.retention(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Projects &amp; EPC execution</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
            Every rupee of executed BOQ is traceable to a dated progress entry, every running-account
            claim is built from cumulative quantities, and every rupee of retention is tracked to release.
          </p>
        </div>
        <div className="text-right">
          <p className="t-body-sm text-text-lo">
            Simulated date <span className="t-mono text-text-mid">{formatDate(ctx.now)}</span>
          </p>
          <p className="t-body-sm text-text-lo">
            Viewing as {ROLE_LABEL[viewer.role]} · {viewer.scope === "ASSIGNED" ? "assigned projects only" : "all projects"}
          </p>
        </div>
      </div>

      <PortfolioTable
        rows={rows}
        viewer={viewer}
        totalProjectCount={ds.projects.length}
        today={ctx.now.toISOString()}
      />

      <ExceptionFeedPanel items={exceptions} />

      <p className="t-body-sm text-text-lo">
        Retention outstanding across the portfolio is {abbreviateINR(ret.outstanding)} across {ret.projectCount} projects,
        of which {abbreviateINR(ret.eligible)} is claimable now across {ret.eligibleProjectCount}. This figure is the
        retention component of the Command Centre locked-cash panel.
      </p>
    </div>
  );
}
