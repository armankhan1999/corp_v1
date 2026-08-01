import { loadProject } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { MilestonesPanel } from "@/components/domain/projects/MilestonesPanel";
import type { MilestonePoint } from "@/components/domain/projects/compute";

export const dynamic = "force-dynamic";

export default async function ProjectMilestonesPage({ params }: { params: Promise<{ id: string }> }) {
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
  const { ds, project, head, now } = loaded;

  const milestones: MilestonePoint[] = ds.milestones
    .filter((m) => m.projectId === project.id)
    .sort((a, b) => (a.plannedDate < b.plannedDate ? -1 : 1))
    .map((m) => ({
      name: m.name,
      plannedDate: m.plannedDate,
      actualDate: m.actualDate,
      weightage: m.weightage,
      status: m.status,
    }));

  return (
    <MilestonesPanel
      projectCode={project.code}
      milestones={milestones}
      variancePct={head.scheduleVariancePct}
      tolerancePct={project.varianceTolerancePct}
      atRisk={head.atRisk}
      managerName={head.managerName}
      today={now.toISOString()}
      contractualCompletion={project.contractualCompletion}
      revisedCompletion={project.revisedCompletion}
    />
  );
}
