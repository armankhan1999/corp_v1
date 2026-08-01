import { boqSeedLines, loadProject, seedBillRows } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { RaBillsList } from "@/components/domain/projects/RaBillsList";

export const dynamic = "force-dynamic";

export default async function ProjectRaBillsPage({ params }: { params: Promise<{ id: string }> }) {
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
  const { ds, project, viewer, now } = loaded;

  return (
    <RaBillsList
      projectId={project.id}
      projectCode={project.code}
      contractValue={project.contractValue}
      mobilisationAdvance={project.mobilisationAdvance}
      retentionPct={project.retentionPct}
      seedBills={seedBillRows(ds, project.id)}
      lines={boqSeedLines(ds, project.id)}
      today={now.toISOString()}
      actor={{ id: viewer.userId, name: viewer.name }}
      canWrite={viewer.canWriteBills}
    />
  );
}
