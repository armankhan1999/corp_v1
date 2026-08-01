import Link from "next/link";
import { Explainer } from "@/components/patterns/primitives";
import { getDataset } from "@/lib/seed";
import { canWrite } from "@/lib/rbac/matrix";
import { formatCount } from "@/lib/format";
import { buildMasters } from "@/components/domain/admin/mastersData";
import { MastersClient } from "@/components/domain/admin/MastersClient";
import { actorOf, requireSession } from "@/components/domain/admin/serverSession";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reference data masters — Pravaah",
};

export default async function MastersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const ds = getDataset();
  const { sets, series } = buildMasters(ds);
  const requested = typeof sp.set === "string" ? sp.set : null;

  const totalValues = sets.reduce((n, s) => n + s.rows.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="t-display-md text-text-hi">Reference data</h1>
          <p className="t-body-sm mt-1 text-text-mid">Business vocabulary as data — edited here, not released.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          {formatCount(totalValues)} values across eighteen sets. Business rules and vocabulary
            live here as data, so a client answer is an edit rather than a release. A value that
            existing records point at cannot be deleted — the platform says how many and offers
            deactivation instead.
        </Explainer>
        </div>
        <Link
          href="/admin"
          className="t-body-sm rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          Administration
        </Link>
      </div>

      <MastersClient
        sets={sets}
        series={series}
        actor={actorOf(session)}
        canEdit={canWrite(session.role, "admin.masters")}
        initialSet={requested}
      />
    </div>
  );
}
