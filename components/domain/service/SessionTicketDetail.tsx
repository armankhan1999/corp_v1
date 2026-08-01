"use client";

import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/patterns/primitives";
import { TicketDetail } from "./TicketDetail";
import { useHydrated, useOverlay } from "./store";
import { btnClass } from "./ui";
import type { EngineerView } from "./types";

/**
 * A ticket raised during this session lives in the browser overlay, never in
 * the seeded dataset. The server cannot resolve it, so the detail screen is
 * rendered client-side from the same view model.
 */
export function SessionTicketDetail({
  ticketId, engineers, nowMs, holidays, canWrite, actorName, nextJobCardSeq,
}: {
  ticketId: string;
  engineers: EngineerView[];
  nowMs: number;
  holidays: string[];
  canWrite: boolean;
  actorName: string;
  nextJobCardSeq: number;
}) {
  const hydrated = useHydrated();
  const overlay = useOverlay();
  const ticket = overlay.newTickets.find((t) => t.id === ticketId);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <EmptyState
        icon={Inbox}
        title="This session ticket is no longer held on the device"
        body={`${ticketId} was raised in a browser session and stored locally under pravaah.v1.service. Clearing site data, or opening the reference on another device, removes it — the seeded register is unaffected.`}
        action={
          <Link href="/service/tickets" className={btnClass("secondary")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to the ticket register
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/service/tickets"
        className="t-body-sm inline-flex w-fit items-center gap-1 text-text-mid hover:text-text-hi"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Ticket register
      </Link>
      <TicketDetail
        ticket={ticket}
        ladder={ticket.sessionLadder ?? []}
        liveCoverage={
          ticket.sessionCoverage ?? {
            coverage: ticket.coverage,
            basis: ticket.coverageBasis,
            steps: [],
            amcContractId: ticket.amcContractId,
            amcNumber: ticket.amcNumber,
            amcCoverage: ticket.amcCoverage,
            warrantyEndMs: null,
            requiresApproval: ticket.coverage === "CHARGEABLE",
          }
        }
        jobCards={[]}
        parts={[]}
        seededEvents={[]}
        engineers={engineers}
        seededNotifications={[]}
        nowMs={nowMs}
        holidays={holidays}
        canWrite={canWrite}
        actorName={actorName}
        nextJobCardSeq={nextJobCardSeq}
      />
    </div>
  );
}
