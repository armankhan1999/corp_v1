import { boqSeedLines, loadProject } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { BoqSheet } from "@/components/domain/projects/BoqSheet";

export const dynamic = "force-dynamic";

export default async function ProjectBoqPage({ params }: { params: Promise<{ id: string }> }) {
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
  const { ds, project, viewer } = loaded;

  return (
    <BoqSheet
      projectId={project.id}
      projectCode={project.code}
      contractValue={project.contractValue}
      lines={boqSeedLines(ds, project.id)}
      canWrite={viewer.canWriteProjects}
      actor={{ id: viewer.userId, name: viewer.name }}
    />
  );
}
