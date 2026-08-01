"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

/** E14-S2 — plain-language cause, a retry, and a way out. Never a stack trace. */
export default function CommandError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the server log; the reader gets the sentence below instead.
    console.error("Command Centre failed to render", error);
  }, [error]);

  return (
    <Panel>
      <PanelHeader
        title="The Command Centre could not be assembled"
        sub="No figure is shown rather than a figure that might be wrong."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">
          One of the derivations behind this screen did not complete, so the page has stopped
          instead of publishing a partial position. Retrying re-runs every derivation against the
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
            Retry
          </button>
          <Link
            href="/command/exceptions"
            className="t-body-sm inline-flex items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Go to the exception feed
          </Link>
        </div>
      </div>
    </Panel>
  );
}
