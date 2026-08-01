"use client";

import { RouteError } from "../_shared/RouteError";

export default function InvoicesError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="The invoice register could not be assembled"
      cause="One of the derivations behind this register — the GST treatment, the outstanding balance or the e-invoice reporting window — did not complete, so no invoice list is shown. Retrying re-runs every derivation against the simulated clock."
      error={error}
      reset={reset}
      backHref="/commercial/receivables"
      backLabel="Go to Receivables"
    />
  );
}
