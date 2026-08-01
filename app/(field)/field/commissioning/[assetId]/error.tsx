"use client";

import { ErrorPanel } from "@/components/domain/assets/ErrorPanel";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <ErrorPanel surface="This commissioning report" error={error} reset={reset} />
    </main>
  );
}
