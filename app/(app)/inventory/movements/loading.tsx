import { Skeleton } from "@/components/patterns/primitives";

/** Same geometry as the issue queue, so nothing reflows when it resolves. */
export default function MovementsLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading the parts issue queue">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-[38rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-40" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 border-b border-line px-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="ml-auto h-8 w-24" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton key={j} className="h-9" />
              ))}
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
