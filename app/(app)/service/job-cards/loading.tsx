import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Geometry matches the loaded register exactly so nothing reflows. E14-S2. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </li>
        ))}
      </ul>

      <Skeleton className="h-4 w-[30rem] max-w-full" />

      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1.5 h-3.5 w-[30rem] max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2.5">
          <Skeleton className="h-9 flex-1 min-w-56" />
          <Skeleton className="h-[3.25rem] w-48" />
          <Skeleton className="h-[3.25rem] w-44" />
          <Skeleton className="h-[3.25rem] w-40" />
          <Skeleton className="h-[3.25rem] w-40" />
        </div>
        <div className="px-3 py-1.5">
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-3 py-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
