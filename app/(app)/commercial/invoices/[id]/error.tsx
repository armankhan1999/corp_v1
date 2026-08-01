"use client";

import { RouteError } from "../../_shared/RouteError";

export default function InvoiceDetailError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="This tax invoice could not be rendered"
      cause="The invoice, its lines, its tax derivation or its e-invoice particulars could not be assembled, so nothing is shown in their place — a partially rendered statutory document would be worse than none. Retrying rebuilds the document from the same records."
      error={error}
      reset={reset}
      backHref="/commercial/invoices"
      backLabel="Back to all tax invoices"
    />
  );
}
