"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

export default function LeaveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The leave workspace failed to load", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="Leave could not be loaded"
        sub="No request was submitted and no decision was recorded. Balances and coverage are always derived, never stored, so nothing is left half-written."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          Balances are accrued per leave type and the coverage position is computed per branch against the configured
          field-engineer minimum. One of those derivations failed, so no balance is shown rather than a figure that
          could be wrong in either direction. Retry to recompute them.
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
            Recompute leave
          </button>
          <Link
            href="/people/attendance"
            className="t-body-sm inline-flex min-h-8 items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Attendance board
          </Link>
        </div>
      </div>
    </Panel>
  );
}
