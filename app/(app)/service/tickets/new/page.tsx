import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { canCreate } from "@/lib/rbac/matrix";
import { EmptyState, Explainer } from "@/components/patterns/primitives";
import { Ban } from "lucide-react";
import { projectAssetIndex, projectContacts, serviceCtx } from "@/components/domain/service/project";
import { TicketIntake } from "@/components/domain/service/TicketIntake";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const { ds, now, nowMs, holidayKeys } = serviceCtx();

  if (!session || !canCreate(session.role, "tickets")) {
    return (
      <EmptyState
        icon={Ban}
        title="Ticket intake is not open to this role"
        body="Logging a service request is held by the Service Manager, Sales Executive and Super Admin roles. Ask the service desk to raise it, or switch persona from the header."
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

  const assets = projectAssetIndex(ds, now);
  const contacts = projectContacts(ds);
  const nextSeq = ds.tickets.length + 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/service/tickets"
          className="t-body-sm inline-flex items-center gap-1 text-text-mid hover:text-text-hi"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Ticket register
        </Link>
        <h1 className="t-display-md mt-1 text-text-hi">Log a service ticket</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">Coverage and the commitment clock are derived before you save.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Every ticket attaches to a serial-numbered machine. Coverage and the commitment clock are
          derived from that machine — the derivation is shown here before you save, not asserted
          afterwards.
        </Explainer>
      </div>

      <TicketIntake
        assets={assets}
        contacts={contacts}
        slaDefinitions={ds.slaDefinitions}
        nowMs={nowMs}
        holidays={holidayKeys}
        nextSeq={nextSeq}
        actorName={session.name}
      />
    </div>
  );
}
