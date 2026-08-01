import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/patterns/primitives";
import { projectJobCard, projectParts, serviceCtx } from "@/components/domain/service/project";
import { JobCardDetail } from "@/components/domain/service/JobCardDetail";
import { SessionJobCardDetail } from "@/components/domain/service/SessionJobCardDetail";

export const dynamic = "force-dynamic";

/** E4-S4 — the full card for one visit, with its service report preview. */
export default async function JobCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ds, now, nowMs } = serviceCtx();

  const raw = ds.jobCards.find((j) => j.id === id);

  if (!raw) {
    // Cards written in this session live only in the browser overlay.
    if (id.startsWith("JC-S")) return <SessionJobCardDetail jobCardId={id} nowMs={nowMs} />;
    return (
      <EmptyState
        icon={ClipboardList}
        title="No job card with that reference"
        body={`Nothing on the register matches ${id}. The reference may belong to another environment, or the visit may have been recorded under a different number.`}
        action={
          <Link
            href="/service/job-cards"
            className="t-body-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the job-card register
          </Link>
        }
      />
    );
  }

  const card = projectJobCard(ds, raw, now);
  const parts = projectParts(ds, raw.id);
  const ticket = ds.tickets.find((t) => t.id === raw.ticketId);
  const engineer = ds.employees.find((e) => e.id === raw.engineerUserId);

  return (
    <JobCardDetail
      card={card}
      parts={parts}
      ticket={{
        id: raw.ticketId,
        number: ticket?.number ?? "—",
        status: ticket?.status ?? "CLOSED",
        severity: ticket?.severity ?? "NORMAL",
        category: ticket?.category ?? "BREAKDOWN",
        problem: ticket?.problem ?? "No parent ticket found for this card.",
      }}
      siteAddress={card.siteAddress}
      engineerCode={engineer?.code ?? ""}
      nowMs={nowMs}
    />
  );
}
