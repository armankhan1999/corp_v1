"use client";

import { RouteError } from "../_shared/RouteError";

export default function ReceivablesError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="Receivables ageing could not be computed"
      cause="The ageing is only meaningful when the buckets reconcile to the total outstanding, and that reconciliation did not complete. An unreconciled figure is not published. Retrying recomputes the ageing from every open invoice."
      error={error}
      reset={reset}
      backHref="/commercial/invoices"
      backLabel="Go to the invoice register"
    />
  );
}
