"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

export default function ReorderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The reorder list failed to build", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="The reorder list could not be built"
        sub="A partial buying list is worse than none — a line missing from it reads as a line that is in stock."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          Membership, velocity and the service-critical links are all derived from the movement ledger and the parts
          requests raised against it. That derivation stopped part-way, so nothing is listed rather than a list that
          would look complete. Retry to recompute it.
        </p>
        {error.digest ? (
          <p className="t-body-sm text-text-lo">
            Reference <span className="t-mono text-text-mid">{error.digest}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="t-body-sm inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-text-hi hover:bg-surface-2"
          >
            <RotateCw className="size-3.5" aria-hidden />
            Recompute the list
          </button>
          <Link
            href="/inventory/purchase"
            className="t-body-sm inline-flex min-h-8 items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Purchase orders
          </Link>
        </div>
      </div>
    </Panel>
  );
}
