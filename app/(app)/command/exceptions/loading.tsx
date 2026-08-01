import { Skeleton } from "@/components/patterns/primitives";

export default function ExceptionsLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Evaluating exception rules">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
          <Skeleton className="h-6 w-full max-w-xl" />
          <Skeleton className="h-6 w-full max-w-md" />
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-3 py-2">
              <Skeleton className="h-5 w-20 shrink-0" />
              <Skeleton className="h-5 w-40 shrink-0" />
              <Skeleton className="h-5 w-28 shrink-0" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-14 shrink-0" />
              <Skeleton className="h-5 w-24 shrink-0" />
              <Skeleton className="h-5 w-32 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
