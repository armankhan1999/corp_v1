import Link from "next/link";
import { Info } from "lucide-react";
import { TODAY_ISO, getDataset } from "@/lib/seed";
import { canWrite, grantFor } from "@/lib/rbac/matrix";
import { formatDate } from "@/lib/format";
import { DemoClient } from "@/components/domain/admin/DemoClient";
import { buildDemoMetrics } from "@/components/domain/admin/demoMetrics";
import {
  composeSimulatedIso,
  dateOnly,
  parseDateOnly,
} from "@/components/domain/admin/demoDates";
import { actorOf, requireSession } from "@/components/domain/admin/serverSession";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Demo Controls — Pravaah",
};

/** Five years of headroom is enough for any AMC or defect-liability window. */
const MAX_FORWARD_DAYS = 1825;

/**
 * E14-S6 / FR-M1-18 — Demo Controls.
 *
 * The date under demonstration arrives as `?at=YYYY-MM-DD`, written by the
 * client whenever the operator moves the clock and mirrored into
 * `pravaah.v1.demo`. The derive layer is pure over `(dataset, now)`, so both the
 * seeded and the simulated columns are produced by the same implementation with
 * a different date argument — and the seeded dataset itself is never mutated.
 */
export default async function DemoControlsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const ds = getDataset();

  const seededTodayIso = TODAY_ISO;
  const seededDate = dateOnly(seededTodayIso);

  const rawAt = typeof sp.at === "string" ? sp.at : null;
  const parsed = parseDateOnly(rawAt);
  const withinRange =
    parsed !== null &&
    parsed >= seededDate &&
    parsed <= dateOnly(new Date(new Date(`${seededDate}T00:00:00`).getTime() + MAX_FORWARD_DAYS * 86_400_000));

  const projectedDate = withinRange ? parsed : null;
  const projectedIso = projectedDate ? composeSimulatedIso(seededTodayIso, projectedDate) : null;
  const invalidAt = rawAt && !projectedDate ? rawAt : null;

  const seeded = buildDemoMetrics(ds, seededTodayIso);
  const projected =
    projectedIso && projectedIso !== seededTodayIso ? buildDemoMetrics(ds, projectedIso) : null;

  const maxDate = dateOnly(
    new Date(new Date(`${seededDate}T00:00:00`).getTime() + MAX_FORWARD_DAYS * 86_400_000),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="t-display-md text-text-hi">Demo Controls</h1>
          <p className="t-body-sm mt-1 text-text-mid">
            These controls exist so a demonstration is reproducible: the same seed, the same
            starting date and the same awkward states, on demand, every time. Nothing here contacts
            a real system — there is no server behind this prototype to contact. Reset removes
            browser overlays, the clock changes the date derivations are measured against, and a
            scenario switch sets a flag that the owning screen reads.
          </p>
          <p className="t-body-sm mt-2 flex items-start gap-1.5 text-text-lo">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              The seeded world is generated from a fixed seed against{" "}
              <span className="t-mono">{formatDate(seededTodayIso)}</span>, so it is byte-identical
              on every run.
            </span>
          </p>
        </div>
        <Link
          href="/admin"
          className="t-body-sm rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          Administration
        </Link>
      </div>

      <DemoClient
        actor={actorOf(session)}
        canOperate={canWrite(session.role, "admin.demo")}
        canReset={grantFor(session.role, "admin.demo").level === "F"}
        seededTodayIso={seededTodayIso}
        seededDate={seededDate}
        projectedDate={projectedDate}
        projectedIso={projectedIso}
        invalidAt={invalidAt}
        seeded={seeded}
        projected={projected}
        maxDate={maxDate}
      />
    </div>
  );
}
