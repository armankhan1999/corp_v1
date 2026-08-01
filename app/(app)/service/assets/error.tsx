"use client";

import { ErrorPanel } from "@/components/domain/assets/ErrorPanel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel surface="The installed asset register" error={error} reset={reset} />;
}
