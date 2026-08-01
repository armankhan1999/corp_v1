import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Skeleton geometry mirrors the portfolio exactly so nothing reflows. E14-S2 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <span className="sr-only">Loading the project portfolio</span>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-[34rem]" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>

      <Panel>
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 bg-surface-1 px-3 py-2.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-96" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex gap-2 border-b border-line px-3 py-2.5">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="px-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex h-9 items-center gap-4 border-b border-line last:border-b-0">
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="ml-auto h-3.5 w-20" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
