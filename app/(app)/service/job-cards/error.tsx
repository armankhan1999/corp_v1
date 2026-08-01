"use client";

import { RouteError } from "@/components/domain/service/RouteError";

export default function JobCardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      surface="Job cards"
      back={{ href: "/service/dispatch", label: "Open the dispatch board" }}
    />
  );
}
