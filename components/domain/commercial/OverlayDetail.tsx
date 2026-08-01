"use client";

import * as React from "react";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { EmptyState } from "@/components/patterns/primitives";
import { ChallanDetailClient } from "./ChallanDetailClient";
import { useCommercialOverlay } from "./store";
import { mergedChallans, mergedEway } from "./merge";
import type { Actor } from "./types";

/**
 * A challan raised in this browser session lives only in the localStorage
 * overlay, so the server render cannot find it. Resolving it on the client
 * keeps a document the user just created from 404-ing (E14-S2: never a blank
 * screen), while a genuinely unknown id still gets an honest empty state.
 */
export function OverlayChallanDetail({
  id, actor, todayIso, seededEwayCount,
}: {
  id: string;
  actor: Actor;
  todayIso: string;
  seededEwayCount: number;
}) {
  const overlay = useCommercialOverlay();
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => setHydrated(true), []);

  const challan = React.useMemo(
    () => mergedChallans([], overlay, now).find((c) => c.id === id) ?? null,
    [overlay, now, id],
  );
  const eway = React.useMemo(
    () => mergedEway([], overlay).find((e) => e.baseDocId === id) ?? null,
    [overlay, id],
  );

  // Before hydration the overlay is empty by definition; showing "not found"
  // at that moment would be a lie, so hold the skeleton geometry instead.
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <div className="pv-skeleton h-8 w-64" />
        <div className="pv-skeleton h-64 w-full" />
      </div>
    );
  }

  if (!challan) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Delivery challan not found"
        body={`No challan with reference ${id} exists in the seeded records or in this browser session. A challan raised on another device is not visible here.`}
        action={
          <Link
            href="/commercial/challans"
            className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to all delivery challans
          </Link>
        }
      />
    );
  }

  return (
    <ChallanDetailClient
      challan={challan}
      eway={eway}
      actor={actor}
      todayIso={todayIso}
      seededEwayCount={seededEwayCount}
      sourceHref={null}
    />
  );
}
