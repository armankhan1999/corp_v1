import { boqSeedLines, loadProject, LIVE_STATES } from "@/components/domain/projects/server";
import { ProjectAccessDenied } from "@/components/domain/projects/AccessDenied";
import { DprWorkspace, type DprRow } from "@/components/domain/projects/DprWorkspace";

export const dynamic = "force-dynamic";

export default async function ProjectDprPage({ params }: { params: Promise<{ id: string }> }) {
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

  const userName = new Map(ds.users.map((u) => [u.id, u.name]));
  const seedDprs: DprRow[] = ds.dprs
    .filter((d) => d.projectId === project.id)
    .map((d) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      weather: d.weather,
      manpower: d.manpower,
      plant: d.plant,
      execution: d.execution,
      materialsReceived: d.materialsReceived,
      siteInstructions: d.siteInstructions,
      hindrance: d.hindrance,
      hindranceCause: d.hindranceCause,
      safetyObservations: d.safetyObservations,
      photos: d.photos,
      byUserName: userName.get(d.byUserId) ?? "—",
      submittedAt: d.submittedAt,
      supersedesId: d.supersedesId,
      supersedesNumber: null,
      supersedeReason: d.supersedeReason,
      source: "SEED",
    }));

  const holidays = ds.holidays
    .filter((h) => h.branchId === null || h.branchId === project.branchId)
    .map((h) => h.date);

  return (
    <DprWorkspace
      projectId={project.id}
      projectCode={project.code}
      projectLive={LIVE_STATES.has(project.status)}
      managerName={head.managerName}
      lines={boqSeedLines(ds, project.id)}
      seedDprs={seedDprs}
      holidays={holidays}
      today={now.toISOString()}
      actor={{ id: viewer.userId, name: viewer.name }}
      canWrite={viewer.canWriteDpr}
    />
  );
}
