"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Panel } from "@/components/patterns/primitives";

/**
 * Error surface — plain cause, one retry. No stack traces, no apology copy.
 * E14-S2.
 */
export function ErrorPanel({
  surface,
  error,
  reset,
}: {
  surface: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Panel className="mx-auto max-w-2xl">
      <div className="flex flex-col items-start gap-3 p-5">
        <span className="t-overline inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-1.5 py-0.5 text-danger">
          <TriangleAlert className="size-3" aria-hidden />
          Could not load
        </span>
        <div>
          <h1 className="t-heading-lg text-text-hi">{surface} did not load</h1>
          <p className="t-body-sm mt-1 text-text-mid">
            {error.message || "The data for this screen could not be read."}
          </p>
          {error.digest ? (
            <p className="t-mono mt-1 text-text-lo">Reference {error.digest}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={reset}
          className="t-body-sm inline-flex min-h-9 items-center gap-2 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
      </div>
    </Panel>
  );
}
