"use client";

import Link from "next/link";
import { OctagonAlert, RefreshCw } from "lucide-react";
import { Panel } from "@/components/patterns/primitives";
import { btnClass, Btn } from "./ui";

/**
 * E14-S2 error state — plain cause, a retry that actually retries, and a route
 * out. No stack traces, no apologies without information.
 */
export function RouteError({
  error, reset, surface, back,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  surface: string;
  back: { href: string; label: string };
}) {
  return (
    <Panel className="mx-auto mt-6 max-w-2xl">
      <div className="flex flex-col items-start gap-3 p-5">
        <span className="grid size-9 place-items-center rounded-lg border border-danger/45 bg-danger-bg">
          <OctagonAlert className="size-5 text-danger" aria-hidden />
        </span>
        <div>
          <h1 className="t-heading-lg text-text-hi">{surface} could not be rendered</h1>
          <p className="t-body-sm mt-1 text-text-mid">
            The screen stopped while assembling its data. Nothing was written — service records are
            unchanged.
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
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={reset}>
            <RefreshCw className="size-4" aria-hidden />
            Retry
          </Btn>
          <Link href={back.href} className={btnClass("secondary")}>
            {back.label}
          </Link>
        </div>
      </div>
    </Panel>
  );
}
