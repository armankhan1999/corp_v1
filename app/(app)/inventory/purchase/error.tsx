"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

export default function PurchaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The purchase screen failed to build", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="Purchase orders could not be loaded"
        sub="No receipt was recorded and no balance moved. Inbound stock only ever changes through a receipt this screen writes."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          Order values, received quantities and the outstanding balance per line are folded from the purchase lines
          and the goods receipts recorded against them. That fold failed, so nothing is listed rather than an order
          book with quantities that might be wrong. Retry to rebuild it.
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
            Rebuild the order book
          </button>
          <Link
            href="/inventory/reorder"
            className="t-body-sm inline-flex min-h-8 items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Reorder list
          </Link>
        </div>
      </div>
    </Panel>
  );
}
