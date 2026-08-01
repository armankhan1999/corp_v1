import { Skeleton } from "@/components/patterns/primitives";

/** E14-S2 — skeleton matches the final geometry exactly, so nothing reflows. */
export default function CommandLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading the Command Centre">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className={i === 2 ? "sm:col-span-2 xl:col-span-2" : undefined}>
            <Skeleton className="h-[8.75rem] w-full rounded-lg" />
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
        <Skeleton className="h-[34rem] w-full rounded-lg" />
      </div>
    </div>
  );
}
