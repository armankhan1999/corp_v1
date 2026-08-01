import { ListSkeleton } from "../_shared/states";

export default function Loading() {
  return <ListSkeleton label="Loading e-way bills" stats={4} filters={3} rows={12} />;
}
