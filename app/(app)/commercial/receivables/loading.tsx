import { ListSkeleton } from "../_shared/states";

export default function Loading() {
  return <ListSkeleton label="Loading receivables ageing" stats={4} filters={5} rows={12} />;
}
