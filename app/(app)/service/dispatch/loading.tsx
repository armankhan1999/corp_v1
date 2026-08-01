import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Geometry matches the loaded board exactly so nothing reflows. E14-S2. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-[38rem] max-w-full" />
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

      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1.5 h-3.5 w-[32rem] max-w-full" />
        </div>
        <div className="flex gap-px overflow-hidden bg-line p-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-56 flex-1 bg-surface-1 p-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-24" />
              <Skeleton className="mt-2.5 h-5 w-20" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </div>
      </Panel>

      <Skeleton className="h-10 w-full" />

      <div className="flex gap-3 overflow-hidden pb-2">
        {Array.from({ length: 5 }).map((_, lane) => (
          <div key={lane} className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-5" />
            </div>
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 3 }).map((_, card) => (
                <Skeleton key={card} className="h-[13.5rem] w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
