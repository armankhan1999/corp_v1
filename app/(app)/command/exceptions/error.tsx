"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

export default function ExceptionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Exception feed failed to evaluate", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="The exception rules did not finish evaluating"
        sub="An incomplete feed is worse than none — a missing row reads as a problem that does not exist."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          The feed stopped part-way through the sixteen rules, so nothing is listed rather than a
          partial list that would look complete. Retry to re-evaluate every rule against the
          simulated clock.
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
            Re-evaluate
          </button>
          <Link
            href="/command"
            className="t-body-sm inline-flex items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to the Command Centre
          </Link>
        </div>
      </div>
    </Panel>
  );
}
