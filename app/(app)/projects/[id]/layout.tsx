import Link from "next/link";

import * as D from "@/lib/derive";
import { abbreviateINR, formatCount, formatDate, formatPercent } from "@/lib/format";
import { Panel, StatusBadge } from "@/components/patterns/primitives";
import type { ProjectStatus } from "@/lib/schemas/enums";
import { loadProject } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/domain/projects/WorkspaceTabs";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/components/domain/projects/labels";
import { ProgressBar } from "@/components/domain/projects/ui";

export const dynamic = "force-dynamic";

export default async function ProjectWorkspaceLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadProject(id);

  if (!loaded.ok) {
    return (
      <ProjectAccessDenied
        projectId={loaded.projectId}
        reason={loaded.reason}
        actor={{ id: loaded.viewer.userId, name: loaded.viewer.name, role: loaded.viewer.role }}
      />
    );
  }

  const { ds, project, head } = loaded;
  const base = `/projects/${project.id}`;
  const dprCount = ds.dprs.filter((d) => d.projectId === project.id).length;
  const billCount = ds.raBills.filter((b) => b.projectId === project.id).length;
  const msCount = ds.milestones.filter((m) => m.projectId === project.id).length;
  const boqCount = ds.boqLines.filter((l) => l.projectId === project.id).length;
  const docCount = ds.documents.filter((d) => d.linkedType === "PROJECT" && d.linkedId === project.id && !d.deletedAt).length;
  const retCount = ds.retentionEntries.filter((e) => e.projectId === project.id).length;

  const tabs: WorkspaceTab[] = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/boq`, label: "BOQ", count: formatCount(boqCount) },
    { href: `${base}/dpr`, label: "DPR log", count: formatCount(dprCount) },
    { href: `${base}/milestones`, label: "Milestones", count: formatCount(msCount) },
    { href: `${base}/ra-bills`, label: "RA-bills", count: formatCount(billCount) },
    { href: `${base}/retention`, label: "Retention", count: formatCount(retCount) },
    { href: `${base}/cost`, label: "Cost" },
    { href: `${base}/om`, label: "O&M" },
    { href: `${base}/documents`, label: "Documents", count: formatCount(docCount) },
    { href: `${base}/team`, label: "Team" },
  ];

  const variance = D.scheduleVariancePct(ds, project, D.ctxOf(ds).now);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-mono text-text-lo">{project.code}</span>
              <StatusBadge tone={PROJECT_STATUS_TONE[project.status as ProjectStatus]}>
                {PROJECT_STATUS_LABEL[project.status as ProjectStatus]}
              </StatusBadge>
              {head.atRisk ? <StatusBadge tone="danger">At Risk</StatusBadge> : null}
            </div>
            <h1 className="t-heading-lg mt-1 text-text-hi">{project.name}</h1>
            <p className="t-body-sm mt-0.5 text-text-mid">
              {head.clientName} · {project.siteLocation} ·{" "}
              <Link href="/projects" className="underline decoration-line underline-offset-2 hover:text-text-hi">
                Portfolio
              </Link>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
            {[
              { k: "Contract value", v: abbreviateINR(project.contractValue) },
              { k: "Physical", v: formatPercent(head.physicalPct), bar: head.physicalPct },
              { k: "Financial", v: formatPercent(head.financialPct), bar: head.financialPct, ok: true },
              {
                k: "Schedule variance",
                v: `${variance > 0 ? "+" : ""}${formatPercent(variance)}`,
                tone: head.atRisk ? "text-danger" : variance < 0 ? "text-warn" : "text-ok",
              },
            ].map((x) => (
              <div key={x.k} className="min-w-28">
                <dt className="t-overline text-text-lo">{x.k}</dt>
                <dd
                  className={`t-heading-md tabular-nums ${x.tone ?? "text-text-hi"}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {x.v}
                </dd>
                {x.bar !== undefined ? (
                  <ProgressBar className="mt-1" pct={x.bar} tone={x.ok ? "ok" : "projects"} label={`${x.k} ${x.v}`} />
                ) : null}
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-1.5">
          <span className="t-body-sm text-text-lo">
            Start <span className="text-text-mid">{formatDate(project.startDate)}</span>
          </span>
          <span className="t-body-sm text-text-lo">
            Contractual completion <span className="text-text-mid">{formatDate(project.contractualCompletion)}</span>
          </span>
          {project.revisedCompletion ? (
            <span className="t-body-sm text-text-lo">
              Revised <span className="text-warn">{formatDate(project.revisedCompletion)}</span>
            </span>
          ) : null}
          {project.actualCompletion ? (
            <span className="t-body-sm text-text-lo">
              Actual <span className="text-ok">{formatDate(project.actualCompletion)}</span>
            </span>
          ) : null}
          <span className="t-body-sm text-text-lo">
            DLP expiry <span className="text-text-mid">{formatDate(head.dlpExpiry)}</span>
          </span>
          <span className="t-body-sm text-text-lo">
            Manager <span className="text-text-mid">{head.managerName}</span>
          </span>
        </div>
        <WorkspaceTabs tabs={tabs} />
      </Panel>

      {children}
    </div>
  );
}
