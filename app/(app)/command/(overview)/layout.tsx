import { requireCapability } from "@/lib/rbac/guard";

/**
 * RBAC-1 — guards `/command` alone.
 *
 * The route group keeps this out of the path, so the guard applies to
 * `/command` without becoming an ancestor of its children — which each carry
 * their own capability. A guard on `app/(app)/command/layout.tsx` would demand
 * `command` of every child route as well, and roles exist that hold a child
 * capability without holding this one.
 */
export default async function Guarded({ children }: { children: React.ReactNode }) {
  await requireCapability("command", "/command");
  return <>{children}</>;
}
