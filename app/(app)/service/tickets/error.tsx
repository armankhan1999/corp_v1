"use client";

import { RouteError } from "@/components/domain/service/RouteError";

export default function TicketsError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      surface="Service tickets"
      back={{ href: "/service/dispatch", label: "Open the dispatch board" }}
    />
  );
}
