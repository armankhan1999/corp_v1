"use client";

import { RouteError } from "../_shared/RouteError";

export default function HandoffError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="The hand-off could not be prepared"
      cause="The period's documents, their counts and their values could not be assembled, and an export whose totals cannot be stated in advance is worse than no export — the accounting package would have nothing to reconcile against. Nothing has been sent. Retrying rebuilds the period from the same records."
      error={error}
      reset={reset}
      backHref="/commercial/invoices"
      backLabel="Go to the invoice register"
    />
  );
}
