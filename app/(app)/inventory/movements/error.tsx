"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

export default function MovementsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The parts issue queue failed to build", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="The issue queue could not be built"
        sub="Nothing was written. The ledger is untouched — this screen only ever appends, and it never got that far."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          Pending parts requests are folded over the stock ledger to work out availability at each location. That
          fold stopped part-way, so no queue is shown rather than a partial one that would read as complete. Retry
          to rebuild it from the ledger.
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
            Rebuild the queue
          </button>
          <Link
            href="/inventory/stock"
            className="t-body-sm inline-flex min-h-8 items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Stock balances
          </Link>
        </div>
      </div>
    </Panel>
  );
}
