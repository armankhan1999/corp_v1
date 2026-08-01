import Link from "next/link";
import * as D from "@/lib/derive";
import {
  abbreviateINR, formatCount, formatDate, formatINR, formatPercent, daysBetween,
} from "@/lib/format";
import { Panel, PanelHeader, KeyValue, StatusBadge } from "@/components/patterns/primitives";
import { loadProject } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { ProjectStatusControl } from "@/components/domain/projects/ProjectStatusControl";
import { CLIENT_TYPE_LABEL, RA_BILL_STATUS_LABEL, RA_BILL_STATUS_TONE } from "@/components/domain/projects/labels";
import { omPhase } from "@/components/domain/projects/compute";
import { ProgressBar, StatBlock } from "@/components/domain/projects/ui";
import type { ProjectStatus, RABillStatus } from "@/lib/schemas/enums";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
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
  const { ds, project, head, viewer, now } = loaded;
  const base = `/projects/${project.id}`;

  const bills = ds.raBills.filter((b) => b.projectId === project.id).sort((a, b) => a.sequence - b.sequence);
  const lastBill = bills[bills.length - 1];
  const dprs = ds.dprs.filter((d) => d.projectId === project.id);
  const lastDpr = dprs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const milestones = ds.milestones.filter((m) => m.projectId === project.id);
  const nextMilestone = milestones
    .filter((m) => !m.actualDate)
    .sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1))[0];
  const omLines = ds.boqLines.filter((l) => l.projectId === project.id && l.section === "Operation & Maintenance");
  const om = omPhase(omLines, project.actualCompletion ?? project.contractualCompletion, now);
  const costs = ds.projectCosts.filter((c) => c.projectId === project.id);
  const incurred = costs.reduce((s, c) => s + c.incurred, 0);
  const committed = costs.reduce((s, c) => s + c.committed, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader
              title="Contract record"
              sub="Every commercial obligation captured on the project form, in one place."
            />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 md:grid-cols-3">
              <KeyValue label="Project code"><span className="t-mono">{project.code}</span></KeyValue>
              <KeyValue label="Client">{head.clientName}</KeyValue>
              <KeyValue label="Client type">{CLIENT_TYPE_LABEL[project.clientType] ?? project.clientType}</KeyValue>
              <KeyValue label="Site location">{project.siteLocation}</KeyValue>
              <KeyValue label="District">{project.district}</KeyValue>
              <KeyValue label="Branch">{head.branchName}</KeyValue>
              <KeyValue label="Contract type">{project.contractType}</KeyValue>
              <KeyValue label="Work order reference"><span className="t-mono">{project.workOrderRef}</span></KeyValue>
              <KeyValue label="Work order date">{formatDate(project.workOrderDate)}</KeyValue>
              <KeyValue label="Contract value">{formatINR(project.contractValue)}</KeyValue>
              <KeyValue label="Mobilisation advance">
                {formatINR(project.mobilisationAdvance)}
                <span className="t-body-sm block text-text-lo">
                  {formatPercent((project.mobilisationAdvance / project.contractValue) * 100)} of contract value,
                  recovered across RA-bills
                </span>
              </KeyValue>
              <KeyValue label="Retention percentage">{formatPercent(project.retentionPct, 0)}</KeyValue>
              <KeyValue label="Start date">{formatDate(project.startDate)}</KeyValue>
              <KeyValue label="Contractual completion">{formatDate(project.contractualCompletion)}</KeyValue>
              <KeyValue label="Revised completion">
                {project.revisedCompletion ? (
                  <span className="text-warn">{formatDate(project.revisedCompletion)}</span>
                ) : (
                  <span className="text-text-lo">Not extended</span>
                )}
              </KeyValue>
              <KeyValue label="Actual completion">
                {project.actualCompletion ? formatDate(project.actualCompletion) : <span className="text-text-lo">Works in progress</span>}
              </KeyValue>
              <KeyValue label="Defect-liability period">{project.defectLiabilityMonths} months</KeyValue>
              <KeyValue label="Defect-liability expiry">{formatDate(head.dlpExpiry)}</KeyValue>
              <KeyValue label="Price-variation clause">
                {project.priceVariationClause ? (
                  <StatusBadge tone="info">Present</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Absent — firm rates</StatusBadge>
                )}
              </KeyValue>
              <KeyValue label="Schedule tolerance">±{project.varianceTolerancePct}%</KeyValue>
              <KeyValue label="Project manager">{head.managerName}</KeyValue>
              <div className="col-span-2 md:col-span-3">
                <KeyValue label="Scope summary">
                  <span className="t-body-sm text-text-mid">{project.scopeSummary}</span>
                </KeyValue>
              </div>
              <div className="col-span-2 md:col-span-3">
                <KeyValue label="Liquidated-damages terms">
                  <span className="t-body-sm text-text-mid">{project.liquidatedDamagesTerms}</span>
                </KeyValue>
              </div>
            </dl>
          </Panel>

          <ProjectStatusControl
            projectId={project.id}
            seedStatus={project.status as ProjectStatus}
            contractualCompletion={project.contractualCompletion}
            revisedCompletion={project.revisedCompletion}
            actualCompletion={project.actualCompletion}
            defectLiabilityMonths={project.defectLiabilityMonths}
            today={now.toISOString()}
            actor={{ id: viewer.userId, name: viewer.name }}
            canWrite={viewer.canWriteProjects}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Where the money stands" sub="Executed, claimed, certified and withheld." />
            <ul className="grid grid-cols-2 gap-px bg-line">
              <li className="bg-surface-1">
                <StatBlock label="Executed value" value={abbreviateINR(head.executedValue)} sub={`${formatPercent(head.physicalPct)} of priced BOQ`} />
              </li>
              <li className="bg-surface-1">
                <StatBlock label="Certified to date" value={abbreviateINR(head.certifiedValue)} sub={`${formatPercent(head.financialPct)} of contract value`} />
              </li>
              <li className="bg-surface-1">
                <StatBlock
                  label="Billing realisation"
                  value={formatPercent(head.billingRealisationPct)}
                  sub="Certified against executed — K-18"
                />
              </li>
              <li className="bg-surface-1">
                <StatBlock
                  label="Retention withheld"
                  value={abbreviateINR(head.retentionOutstanding)}
                  tone={head.retentionEligible ? "warn" : undefined}
                  sub={head.retentionEligible ? `${abbreviateINR(head.retentionEligible)} claimable now` : "Not yet claimable"}
                />
              </li>
            </ul>
            <div className="border-t border-line px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="t-body-sm text-text-mid">Cost incurred against certified revenue</span>
                <span className="t-body-sm tabular-nums text-text-hi">
                  {abbreviateINR(incurred)} / {abbreviateINR(head.certifiedValue)}
                </span>
              </div>
              <ProgressBar
                className="mt-1.5"
                pct={head.certifiedValue ? (incurred / head.certifiedValue) * 100 : 0}
                tone={incurred > head.certifiedValue ? "danger" : "ok"}
                label="Cost against certified revenue"
              />
              <Link href={`${base}/cost`} className="t-body-sm mt-2 inline-block text-text-mid underline decoration-line underline-offset-2 hover:text-text-hi">
                Open billed-versus-cost — {abbreviateINR(committed)} committed
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Live position" sub="What needs attention on this project today." />
            <ul className="flex flex-col">
              <li className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
                <div>
                  <p className="t-body-sm text-text-hi">Last progress entry</p>
                  <p className="t-body-sm text-text-lo">
                    {lastDpr
                      ? `${lastDpr.number} · ${formatDate(lastDpr.date)} · ${daysBetween(lastDpr.date, now)} days ago`
                      : "No DPR has been filed against this project"}
                  </p>
                </div>
                <Link href={`${base}/dpr`} className="t-body-sm shrink-0 text-text-mid underline decoration-line underline-offset-2 hover:text-text-hi">
                  DPR log
                </Link>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
                <div>
                  <p className="t-body-sm text-text-hi">Next milestone</p>
                  <p className="t-body-sm text-text-lo">
                    {nextMilestone
                      ? `${nextMilestone.name} · planned ${formatDate(nextMilestone.plannedDate)} · ${nextMilestone.weightage}% weightage`
                      : "All milestones recorded complete"}
                  </p>
                </div>
                <Link href={`${base}/milestones`} className="t-body-sm shrink-0 text-text-mid underline decoration-line underline-offset-2 hover:text-text-hi">
                  S-curve
                </Link>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
                <div>
                  <p className="t-body-sm text-text-hi">Latest RA-bill</p>
                  <p className="t-body-sm text-text-lo">
                    {lastBill ? (
                      <>
                        <span className="t-mono">{lastBill.number}</span> · claimed {abbreviateINR(lastBill.claimedValue)}
                      </>
                    ) : (
                      "No running-account bill has been raised"
                    )}
                  </p>
                </div>
                {lastBill ? (
                  <StatusBadge tone={RA_BILL_STATUS_TONE[lastBill.status as RABillStatus]}>
                    {RA_BILL_STATUS_LABEL[lastBill.status as RABillStatus]}
                  </StatusBadge>
                ) : null}
              </li>
              <li className="flex items-start justify-between gap-3 px-3 py-2">
                <div>
                  <p className="t-body-sm text-text-hi">O&amp;M phase</p>
                  <p className="t-body-sm text-text-lo">
                    {om.contracted
                      ? `${om.termMonths} months contracted · ${formatCount(om.completedVisits)} of ${formatCount(om.visits.length)} visits behind us`
                      : "No O&M is contracted on this project"}
                  </p>
                </div>
                <Link href={`${base}/om`} className="t-body-sm shrink-0 text-text-mid underline decoration-line underline-offset-2 hover:text-text-hi">
                  Schedule
                </Link>
              </li>
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Running-account history" sub={`${bills.length} bills raised on this project.`} />
            {bills.length === 0 ? (
              <p className="t-body-sm px-3 py-4 text-text-lo">No bills yet. Raise the first from the RA-bills tab.</p>
            ) : (
              <ul className="flex flex-col">
                {bills.map((b) => (
                  <li key={b.id} className="border-b border-line last:border-b-0">
                    <Link href={`${base}/ra-bills/${b.sequence}`} className="flex h-9 items-center justify-between gap-3 px-3 hover:bg-surface-2">
                      <span className="t-mono text-text-hi">RA {String(b.sequence).padStart(2, "0")}</span>
                      <span className="t-body-sm tabular-nums text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {abbreviateINR(D.raBillCurrentPeriodValue(b))}
                      </span>
                      <StatusBadge tone={RA_BILL_STATUS_TONE[b.status as RABillStatus]} icon={false}>
                        {RA_BILL_STATUS_LABEL[b.status as RABillStatus]}
                      </StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
