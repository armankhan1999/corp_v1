import { Skeleton } from "@/components/patterns/primitives";

/** Geometry matches the loaded card exactly so nothing reflows. E14-S2. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-[28rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </div>

      <Skeleton className="h-20 w-full" />
    </div>
  );
}
