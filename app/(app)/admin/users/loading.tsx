import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Geometry matches the loaded register exactly, so nothing reflows. E14-S2. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-[42rem] max-w-full" />
        <Skeleton className="h-4 w-[34rem] max-w-full" />
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-12" />
          </li>
        ))}
      </ul>

      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1.5 h-3.5 w-[30rem] max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2.5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex flex-col gap-px bg-line">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 bg-surface-1 px-3 py-2">
              <Skeleton className="h-9 w-52" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="ml-auto h-5 w-12" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
        <div className="border-t border-line px-4 py-2">
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
      </Panel>
    </div>
  );
}
