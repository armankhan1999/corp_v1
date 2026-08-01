import { ListSkeleton } from "../_shared/states";

export default function Loading() {
  return <ListSkeleton label="Loading receipts and allocation" stats={4} filters={5} rows={14} />;
}
