import { requireCapability } from "@/lib/rbac/guard";

/** RBAC-1 — generated route guard. See lib/rbac/guard.ts. */
export default async function Guarded({ children }: { children: React.ReactNode }) {
  await requireCapability("stock", "/inventory/stock");
  return <>{children}</>;
}
