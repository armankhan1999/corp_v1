import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Geometry matches the loaded radar exactly so nothing reflows. E14-S2. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-[34rem] max-w-full" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="h-[5.25rem] w-full" />
          </li>
        ))}
      </ul>

      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-1.5 h-3.5 w-[34rem] max-w-full" />
        </div>
        <div className="flex flex-col gap-2 px-4 py-3">
          <Skeleton className="h-4 w-[30rem] max-w-full" />
          <Skeleton className="h-4 w-[26rem] max-w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2.5">
          <Skeleton className="h-[3.25rem] flex-1 min-w-52" />
          <Skeleton className="h-[3.25rem] w-44" />
        </div>
        <div className="flex flex-wrap gap-4 border-b border-line px-3 py-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-32" />
          ))}
        </div>
        <div className="flex flex-col gap-px bg-line p-px">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 bg-surface-1 px-3 py-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
