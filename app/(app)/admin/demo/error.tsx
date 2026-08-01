"use client";

import Link from "next/link";
import { OctagonAlert, RefreshCw } from "lucide-react";
import { Panel } from "@/components/patterns/primitives";
import { Btn } from "@/components/domain/admin/ui";

/**
 * E14-S2 error state. Demo Controls is the screen an operator reaches for when
 * something has gone wrong, so its own failure has to be legible: the cause, a
 * retry, and the one route that does not depend on this screen working.
 */
export default function DemoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Panel className="mx-auto mt-6 max-w-2xl">
      <div className="flex flex-col items-start gap-3 p-5">
        <span className="grid size-9 place-items-center rounded-lg border border-danger/45 bg-danger-bg">
          <OctagonAlert className="size-5 text-danger" aria-hidden />
        </span>
        <div>
          <h1 className="t-heading-lg text-text-hi">Demo Controls could not be rendered</h1>
          <p className="t-body-sm mt-1 text-text-mid">
            The screen stopped while re-deriving the before-and-after figures. Nothing was reset,
            the simulated clock was not moved and no scenario switch changed state — every control
            here writes only after you confirm it.
          </p>
        </div>
        <div className="w-full rounded-md border border-line bg-surface-2 p-3">
          <p className="t-overline text-text-lo">Reported cause</p>
          <p className="t-mono mt-1 break-words text-text-hi">{error.message || "Unknown error"}</p>
          {error.digest ? (
            <p className="t-body-sm mt-1 text-text-lo">
              Digest <span className="t-mono">{error.digest}</span>
            </p>
          ) : null}
        </div>
        <p className="t-body-sm text-text-mid">
          A date in the address that this build cannot read is the most common cause. Retrying
          without <span className="t-mono">?at=</span> returns the screen to the seeded today.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn tone="primary" icon={RefreshCw} onClick={reset}>
            Retry
          </Btn>
          <Link
            href="/admin/demo"
            className="t-body-sm inline-flex h-8 items-center rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Reload on the seeded today
          </Link>
          <Link
            href="/admin"
            className="t-body-sm inline-flex h-8 items-center rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to Administration
          </Link>
        </div>
      </div>
    </Panel>
  );
}
