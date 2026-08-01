import { boqSeedLines, loadProject, seedBillRows } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { RaBillPrint } from "@/components/domain/projects/RaBillPrint";
import type { BuilderProject } from "@/components/domain/projects/RaBillBuilder";

export const dynamic = "force-dynamic";

export default async function RaBillPrintPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
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

  const builderProject: BuilderProject = {
    id: project.id,
    code: project.code,
    name: project.name,
    clientName: head.clientName,
    workOrderRef: project.workOrderRef,
    contractValue: project.contractValue,
    mobilisationAdvance: project.mobilisationAdvance,
    retentionPct: project.retentionPct,
    dlpExpiry: head.dlpExpiry,
  };

  return (
    <RaBillPrint
      project={builderProject}
      sequence={Number(n)}
      seedBills={seedBillRows(ds, project.id)}
      lines={boqSeedLines(ds, project.id)}
    />
  );
}
