import { Skeleton } from "@/components/patterns/primitives";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-24 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </main>
  );
}
