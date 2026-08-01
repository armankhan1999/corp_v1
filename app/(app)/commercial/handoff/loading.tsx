import { ListSkeleton } from "../_shared/states";

export default function Loading() {
  return <ListSkeleton label="Loading the ledger hand-off" stats={4} filters={2} rows={10} />;
}
