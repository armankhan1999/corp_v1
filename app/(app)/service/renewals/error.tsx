"use client";

import { ErrorPanel } from "@/components/domain/assets/ErrorPanel";

export default function RenewalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel surface="The renewal radar" error={error} reset={reset} />;
}
