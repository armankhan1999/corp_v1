import { Skeleton } from "@/components/patterns/primitives";

export default function BranchesLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Building the branch league table">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-[40rem] max-w-full" />
        </div>
        <Skeleton className="h-4 w-56" />
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />

      <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="flex items-center gap-3 border-b border-line-strong px-3 py-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-3 py-3">
            {Array.from({ length: 7 }, (_, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}
