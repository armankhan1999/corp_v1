"use client";

import { RouteError } from "@/components/domain/service/RouteError";

export default function DispatchError({
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
      surface="Dispatch board"
      back={{ href: "/service/tickets", label: "Open the ticket register" }}
    />
  );
}
