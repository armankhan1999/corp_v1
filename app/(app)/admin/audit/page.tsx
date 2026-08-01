import Link from "next/link";
import { Explainer } from "@/components/patterns/primitives";
import { ScrollText } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { ROLE_LABEL, type AuditAction, type Role } from "@/lib/schemas/enums";
import { formatDate } from "@/lib/format";
import { linkTableFor } from "@/components/domain/admin/links";
import { actorOf, requireSession } from "@/components/domain/admin/serverSession";
import { AuditClient } from "@/components/domain/admin/AuditClient";
import type { AuditFacets, AuditRow } from "@/components/domain/admin/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit log — Pravaah",
};

export default async function AuditPage() {
  const session = await requireSession();
  const ds = getDataset();

  // Newest first, with sequence as the tie-break so equal timestamps stay stable.
  const rows: AuditRow[] = ds.auditLog
    .map((a) => ({
      id: a.id,
      seq: a.seq,
      actorUserId: a.actorUserId,
      actorName: a.actorName,
      actorRole: a.actorRole,
      impersonatedBy: a.impersonatedBy,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      entityLabel: a.entityLabel,
      summary: a.summary,
      before: a.before,
      after: a.after,
      at: a.at,
      ip: a.ip,
    }))
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime() || y.seq - x.seq);

  const actorMap = new Map<string, { id: string; name: string; role: Role }>();
  for (const a of ds.auditLog) {
    if (!actorMap.has(a.actorUserId)) {
      actorMap.set(a.actorUserId, { id: a.actorUserId, name: a.actorName, role: a.actorRole });
    }
  }

  const facets: AuditFacets = {
    actors: [...actorMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    roles: [...new Set(ds.auditLog.map((a) => a.actorRole))].sort((a, b) =>
      ROLE_LABEL[a].localeCompare(ROLE_LABEL[b]),
    ),
    actions: [...new Set(ds.auditLog.map((a) => a.action))].sort() as AuditAction[],
    entityTypes: [...new Set(ds.auditLog.map((a) => a.entityType))].sort(),
    earliest: rows.length > 0 ? rows[rows.length - 1]!.at : ds.meta.today,
    latest: rows.length > 0 ? rows[0]!.at : ds.meta.today,
  };

  const baseSeq = ds.auditLog.reduce((m, a) => Math.max(m, a.seq), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="t-display-md text-text-hi">Audit log</h1>
          <p className="t-body-sm mt-1 text-text-mid">Every mutation, written once and never altered.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Every create, update, delete, state transition, approval, export, login and access
            denial in Pravaah, written once and never altered. Held from{" "}
            <span className="t-mono text-text-hi">{formatDate(facets.earliest)}</span> to{" "}
            <span className="t-mono text-text-hi">{formatDate(facets.latest)}</span>.
        </Explainer>
        </div>
        <div className="flex items-center gap-2">
          <ScrollText className="size-4 text-text-lo" aria-hidden />
          <Link
            href="/admin"
            className="t-body-sm rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Administration
          </Link>
        </div>
      </div>

      <AuditClient
        rows={rows}
        facets={facets}
        links={linkTableFor(session.role)}
        actor={actorOf(session)}
        baseSeq={baseSeq}
        today={ds.meta.today}
      />
    </div>
  );
}
