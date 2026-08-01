import Link from "next/link";
import { Explainer } from "@/components/patterns/primitives";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { getViewer } from "@/components/domain/projects/server";
import { ProjectForm, type FormOption } from "@/components/domain/projects/ProjectForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New project — Pravaah" };

export default async function NewProjectPage() {
  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const viewer = await getViewer();

  const customers: FormOption[] = ds.customers
    .filter((c) => c.active && (c.type === "INSTITUTIONAL" || c.type === "GOVERNMENT" || c.type === "INDUSTRIAL"))
    .slice(0, 60)
    .map((c) => ({ id: c.id, label: c.tradeName || c.legalName, extra: c.type }));

  const managers: FormOption[] = ds.users
    .filter((u) => u.active && (u.role === "PROJECT_MANAGER" || u.role === "DIRECTOR_BUSINESS"))
    .map((u) => ({ id: u.id, label: u.name, sub: u.designation }));

  const branches: FormOption[] = ds.branches.map((b) => ({ id: b.id, label: `${b.name}, ${b.city}` }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">Record a project</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">The full contractual position, captured once.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          The full contractual position, captured once. Retention percentage, defect-liability period and
          schedule tolerance entered here govern the retention register and the At Risk flag for the life of
          the contract.{" "}
          <Link href="/projects" className="underline decoration-line underline-offset-2 hover:text-text-hi">
            Back to the portfolio
          </Link>
        </Explainer>
      </div>

      <ProjectForm
        customers={customers}
        managers={managers}
        branches={branches}
        today={ctx.now.toISOString()}
        actor={{ id: viewer.userId, name: viewer.name }}
        canCreate={viewer.canCreateProjects}
      />
    </div>
  );
}
