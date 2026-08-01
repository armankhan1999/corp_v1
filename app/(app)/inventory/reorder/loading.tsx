import { Skeleton } from "@/components/patterns/primitives";

/** Matches the reorder list's geometry: header, five metrics, two notification
 *  panels, then the grid at 36px rows. Nothing moves when the data arrives. */
export default function ReorderLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Building the reorder list">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-[40rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-[220px]" />
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-44" />
        </div>
        <div className="flex items-center gap-3 border-b border-line-strong bg-surface-2 px-3" style={{ height: 32 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: 14 }, (_, r) => (
          <div key={r} className="flex items-center gap-3 border-b border-line/70 px-3" style={{ height: 36 }}>
            {Array.from({ length: 10 }, (_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
