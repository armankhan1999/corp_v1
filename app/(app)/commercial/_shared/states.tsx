import { Skeleton } from "@/components/patterns/primitives";

/**
 * E14-S2 — the loading geometry for the commercial routes.
 *
 * The skeleton mirrors the final layout block for block, so the page does not
 * reflow when the real figures arrive: same header, same metric row, same
 * filter bar, same row height.
 */

export function ListSkeleton({
  stats = 4, rows = 14, filters = 5, label,
}: { stats?: number; rows?: number; filters?: number; label: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={label}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: stats }).map((_, i) => (
          <li key={i}><Skeleton className="h-[5.5rem] w-full rounded-lg" /></li>
        ))}
      </ul>

      <Skeleton className="h-10 w-full rounded-lg" />

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-40 rounded-md" />
          ))}
        </div>
        <div className="flex flex-col gap-px bg-line">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex h-9 items-center gap-4 bg-surface-1 px-3">
              {[18, 22, 14, 12, 16, 10].map((w, c) => (
                <div key={c} style={{ width: `${w}%` }}>
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={label}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-56 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_26rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
