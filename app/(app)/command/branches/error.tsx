"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

export default function BranchesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Branch league table failed to build", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="The league table could not be computed"
        sub="A ranking built on a partial computation would be worse than no ranking at all."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          One of the four columns did not resolve for at least one branch, so no composite has been
          published. Retry to recompute every column from source records; if the selected period is
          unusual, returning to This FY will use the period the targets are set against.
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
            className="t-body-sm inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-text-hi hover:bg-surface-2"
          >
            <RotateCw className="size-3.5" aria-hidden />
            Recompute
          </button>
          <Link
            href="/command/branches"
            className="t-body-sm inline-flex items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Reset to This FY
          </Link>
        </div>
      </div>
    </Panel>
  );
}
