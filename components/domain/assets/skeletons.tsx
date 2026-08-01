import { Panel, Skeleton } from "@/components/patterns/primitives";

/** Skeletons match the final geometry so the page does not reflow. E14-S2. */

export function RegisterSkeleton({
  metrics = 5,
  rows = 10,
  columns = 8,
}: {
  metrics?: number;
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      {metrics > 0 ? (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: metrics }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-[5.25rem] w-full" />
            </li>
          ))}
        </ul>
      ) : null}

      <Panel>
        <div className="flex flex-wrap gap-2 border-b border-line px-3 py-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[3.25rem] w-40" />
          ))}
        </div>
        <div className="flex flex-col gap-px bg-line">
          <div className="flex gap-3 bg-surface-1 px-3 py-2">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface-1 px-3 py-2">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-[28rem]" />
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="h-[5.25rem] w-full" />
          </li>
        ))}
      </ul>
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}
