"use client";

import { RouteError } from "@/components/domain/service/RouteError";

export default function JobCardDetailError({
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
      surface="Job card"
      back={{ href: "/service/job-cards", label: "Back to the job-card register" }}
    />
  );
}
