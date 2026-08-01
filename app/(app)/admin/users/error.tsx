"use client";

import Link from "next/link";
import { OctagonAlert, RefreshCw } from "lucide-react";
import { Panel } from "@/components/patterns/primitives";
import { Btn } from "@/components/domain/admin/ui";

/**
 * E14-S2 error state — the cause in plain words, a retry that actually retries,
 * and a route out. No stack trace, and no apology without information.
 */
export default function UsersError({
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
          <h1 className="t-heading-lg text-text-hi">The user register could not be rendered</h1>
          <p className="t-body-sm mt-1 text-text-mid">
            The screen stopped while assembling the seeded accounts and their activity counts.
            Nothing was written — no account was created, changed or deactivated, and the audit log
            is untouched.
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
          If a retry fails repeatedly, the browser overlay under{" "}
          <span className="t-mono">pravaah.v1.users</span> may hold a shape this build cannot read.
          Demo Controls clears it and returns the register to the seeded twelve accounts.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn tone="primary" icon={RefreshCw} onClick={reset}>
            Retry
          </Btn>
          <Link
            href="/admin"
            className="t-body-sm inline-flex h-8 items-center rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Back to Administration
          </Link>
          <Link
            href="/admin/demo"
            className="t-body-sm inline-flex h-8 items-center rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Open Demo Controls
          </Link>
        </div>
      </div>
    </Panel>
  );
}
