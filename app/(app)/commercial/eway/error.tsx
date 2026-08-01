"use client";

import { RouteError } from "../_shared/RouteError";

export default function EwayError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="The e-way bill register could not be assembled"
      cause="The eligibility rule — consignment value against the threshold, base-document age against the limit — could not be evaluated for every document, so no generation control is offered. A control that cannot prove it is allowed to act should not be shown. Retrying re-evaluates every base document."
      error={error}
      reset={reset}
      backHref="/commercial/challans"
      backLabel="Go to delivery challans"
    />
  );
}
