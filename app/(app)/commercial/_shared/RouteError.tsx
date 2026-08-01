"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/patterns/primitives";

/**
 * E14-S2 — the error state for the commercial routes.
 *
 * A commercial screen carries statutory figures, so it stops rather than
 * publishing a partial one. The reader gets the plain cause, a retry that
 * re-runs the derivation, and a way out. Never a stack trace.
 */
export function RouteError({
  title, cause, error, reset, backHref, backLabel,
}: {
  title: string;
  cause: string;
  error: Error & { digest?: string };
  reset: () => void;
  backHref: string;
  backLabel: string;
}) {
  useEffect(() => {
    console.error(title, error);
  }, [title, error]);

  return (
    <Panel>
      <PanelHeader
        title={title}
        sub="No figure is shown rather than a figure that might be wrong."
        right={<TriangleAlert className="size-4 text-danger" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-4">
        <p className="t-body text-text-mid">{cause}</p>
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
            href={backHref}
            className="t-body-sm inline-flex items-center rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </Panel>
  );
}
