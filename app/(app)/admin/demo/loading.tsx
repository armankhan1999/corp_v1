import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Geometry matches the loaded screen exactly, so nothing reflows. E14-S2. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-[42rem] max-w-full" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>

      {/* 1 — reset */}
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="mt-1.5 h-3.5 w-[32rem] max-w-full" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="bg-surface-1 px-2.5 py-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="mt-1 h-3 w-56 max-w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-48" />
        </div>
      </Panel>

      {/* 2 — clock */}
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-1.5 h-3.5 w-[30rem] max-w-full" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] p-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-5 w-32" />
                <Skeleton className="mt-2 h-3 w-40" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28" />
            ))}
          </div>
        </div>
      </Panel>

      {/* what recomputes */}
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-1.5 h-3.5 w-[34rem] max-w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, g) => (
          <div key={g} className="border-b border-line last:border-b-0">
            <div className="bg-surface-2 px-4 py-2">
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="px-4 py-2">
              <Skeleton className="h-3.5 w-full max-w-3xl" />
            </div>
            <div className="flex flex-col gap-px bg-line">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 bg-surface-1 px-4 py-2">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="ml-auto h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Panel>

      {/* 3 — scenarios */}
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-1.5 h-3.5 w-[28rem] max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-3.5 w-full" />
              <Skeleton className="mt-1 h-3.5 w-4/5" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-52" />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
