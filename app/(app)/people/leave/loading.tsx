import { Skeleton } from "@/components/patterns/primitives";

/** Header, coverage-rule strip, metric chips, tabs and the request list —
 *  the same geometry the leave workspace settles into. */
export default function LeaveLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading leave balances and requests">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-[38rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      <Skeleton className="h-16" />

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-44" />
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="flex items-center gap-4 border-b border-line px-3 py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-32" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="ml-auto h-8 w-24" />
            </div>
            <Skeleton className="h-4 w-[32rem] max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
