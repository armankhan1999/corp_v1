"use client";

import { ErrorPanel } from "@/components/domain/assets/ErrorPanel";

export default function RentalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel surface="The rental fleet register" error={error} reset={reset} />;
}
