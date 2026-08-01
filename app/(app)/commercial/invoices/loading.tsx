import { ListSkeleton } from "../_shared/states";

export default function Loading() {
  return <ListSkeleton label="Loading the tax invoice register" stats={4} filters={6} rows={14} />;
}
