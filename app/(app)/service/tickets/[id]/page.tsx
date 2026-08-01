import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import * as D from "@/lib/derive";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canWrite as rbacCanWrite } from "@/lib/rbac/matrix";
import { ROLE_LABEL, type Role } from "@/lib/schemas/enums";
import { EmptyState } from "@/components/patterns/primitives";
import {
  deriveCoverage, projectEngineers, projectParts, projectTicket, resolveSlaFor,
  seededTrail, serviceCtx,
} from "@/components/domain/service/project";
import { TicketDetail, type JobCardSummary, type SeedNotification } from "@/components/domain/service/TicketDetail";
import { SessionTicketDetail } from "@/components/domain/service/SessionTicketDetail";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const { ds, now, nowMs, holidayKeys } = serviceCtx();
  const canWrite = session ? rbacCanWrite(session.role, "tickets") : false;
  const engineers = projectEngineers(ds, now);
  const nextJobCardSeq = ds.jobCards.length + 1;

  const raw = ds.tickets.find((t) => t.id === id);

  // Tickets raised during this session live only in the browser overlay, so the
  // server cannot resolve them. The client component reads them from there.
  if (!raw) {
    if (id.startsWith("TKT-S")) {
      return (
        <SessionTicketDetail
          ticketId={id}
          engineers={engineers}
          nowMs={nowMs}
          holidays={holidayKeys}
          canWrite={canWrite}
          actorName={session?.name ?? "Service desk"}
          nextJobCardSeq={nextJobCardSeq}
        />
      );
    }
    return (
      <EmptyState
        icon={Inbox}
        title="No ticket with that reference"
        body={`Nothing on the register matches ${id}. The reference may belong to another environment, or the ticket may have been logged under a different number.`}
        action={
          <Link
            href="/service/tickets"
            className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to the ticket register
          </Link>
        }
      />
    );
  }

  const asset = ds.assets.find((a) => a.id === raw.assetId);
  const ticket = projectTicket(ds, raw, now);
  const ladder = asset
    ? resolveSlaFor(ds, asset, raw.severity, new Date(raw.loggedAt)).ladder
    : [];
  const liveCoverage = asset
    ? deriveCoverage(ds, asset, now)
    : {
      coverage: raw.coverage, basis: raw.coverageBasis, steps: [], amcContractId: null,
      amcNumber: null, amcCoverage: null, warrantyEndMs: null, requiresApproval: false,
    };

  const jobCards: JobCardSummary[] = ds.jobCards
    .filter((j) => j.ticketId === raw.id)
    .sort((a, b) => a.visitSequence - b.visitSequence)
    .map((j) => ({
      id: j.id,
      number: j.number,
      visitSequence: j.visitSequence,
      visitType: j.visitType,
      scheduledDateMs: new Date(j.scheduledDate).getTime(),
      checkInAtMs: j.checkInAt ? new Date(j.checkInAt).getTime() : null,
      checkOutAtMs: j.checkOutAt ? new Date(j.checkOutAt).getTime() : null,
      engineerName: ds.employees.find((e) => e.id === j.engineerUserId)?.name ?? "—",
      outcome: j.outcome,
      rootCause: j.rootCause,
      workPerformed: j.workPerformed,
      submittedAtMs: j.submittedAt ? new Date(j.submittedAt).getTime() : null,
    }));

  const parts = jobCards.flatMap((j) => projectParts(ds, j.id));

  const seededNotifications: SeedNotification[] = ds.notifications
    .filter((n) => n.entityType === "TICKET" && n.entityId === raw.id)
    .map((n) => {
      const user = ds.users.find((u) => u.id === n.userId);
      return {
        id: n.id,
        type: n.type,
        title: n.title.charAt(0).toUpperCase() + n.title.slice(1),
        body: n.body,
        atMs: new Date(n.at).getTime(),
        recipient: user ? ROLE_LABEL[user.role as Role] : "Recipient",
      };
    });

  const isOpen = D.isOpenTicket(raw);

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={`/service/tickets${isOpen ? "" : "?scope=ALL"}`}
        className="t-body-sm inline-flex w-fit items-center gap-1 text-text-mid hover:text-text-hi"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Ticket register
      </Link>
      <TicketDetail
        ticket={ticket}
        ladder={ladder}
        liveCoverage={liveCoverage}
        jobCards={jobCards}
        parts={parts}
        seededEvents={seededTrail(ds, raw)}
        engineers={engineers}
        seededNotifications={seededNotifications}
        nowMs={nowMs}
        holidays={holidayKeys}
        canWrite={canWrite}
        actorName={session?.name ?? "Service desk"}
        nextJobCardSeq={nextJobCardSeq}
      />
    </div>
  );
}
