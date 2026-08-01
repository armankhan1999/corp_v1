"use client";

import { RouteError } from "../_shared/RouteError";

export default function ReceiptsError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="Receipts could not be reconciled against invoices"
      cause="A receipt is only meaningful beside the invoice it settles, and that join did not complete — so neither the allocated nor the unallocated figure is shown rather than showing one that might be wrong. Retrying rebuilds the allocation from the recorded receipts."
      error={error}
      reset={reset}
      backHref="/commercial/receivables"
      backLabel="Go to Receivables"
    />
  );
}
