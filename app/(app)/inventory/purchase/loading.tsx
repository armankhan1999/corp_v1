import { Skeleton } from "@/components/patterns/primitives";

/** Header, five metrics, the boundary note, tabs and a 36px grid — the same
 *  geometry the purchase screen settles into. */
export default function PurchaseLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading purchase orders">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-[42rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[86px]" />
        ))}
      </div>

      <Skeleton className="h-[76px]" />

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="flex items-center gap-4 border-b border-line px-3 py-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center gap-3 border-b border-line-strong bg-surface-2 px-3" style={{ height: 32 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: 12 }, (_, r) => (
          <div key={r} className="flex items-center gap-3 border-b border-line/70 px-3" style={{ height: 36 }}>
            {Array.from({ length: 9 }, (_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
