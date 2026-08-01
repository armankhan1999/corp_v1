"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import type { TicketCategory, TicketSeverity, TicketStatus } from "@/lib/schemas/enums";
import { EmptyState, Skeleton } from "@/components/patterns/primitives";
import { JobCardDetail } from "./JobCardDetail";
import { useHydrated, useOverlay } from "./store";
import { btnClass } from "./ui";

/**
 * A visit created during this session lives only in the browser overlay, so the
 * server cannot resolve it. The detail screen is rendered client-side from the
 * same view model the seeded cards use.
 */
export function SessionJobCardDetail({
  jobCardId,
  nowMs,
}: {
  jobCardId: string;
  nowMs: number;
}) {
  const hydrated = useHydrated();
  const overlay = useOverlay();
  const card = overlay.newJobCards.find((j) => j.id === jobCardId);
  const ticket = card ? overlay.newTickets.find((t) => t.id === card.ticketId) : undefined;

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-[30rem] max-w-full" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="This session job card is no longer held on the device"
        body={`${jobCardId} was created in a browser session and stored locally under pravaah.v1.service. Clearing site data, or opening the reference on another device, removes it — the seeded register is unaffected.`}
        action={
          <Link href="/service/job-cards" className={btnClass("secondary")}>
            <ArrowLeft className="size-4" aria-hidden />
            Back to the job-card register
          </Link>
        }
      />
    );
  }

  return (
    <JobCardDetail
      card={card}
      parts={overlay.parts.filter((p) => p.jobCardId === card.id)}
      ticket={{
        id: card.ticketId,
        number: card.ticketNumber,
        status: (ticket?.status ?? "ASSIGNED") as TicketStatus,
        severity: (ticket?.severity ?? "NORMAL") as TicketSeverity,
        category: (ticket?.category ?? "BREAKDOWN") as TicketCategory,
        problem: ticket?.problem ?? "Recorded on the parent ticket.",
      }}
      siteAddress={card.siteAddress}
      engineerCode=""
      nowMs={nowMs}
    />
  );
}
