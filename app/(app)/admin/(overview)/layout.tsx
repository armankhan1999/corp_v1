import { requireCapability } from "@/lib/rbac/guard";

/**
 * RBAC-1 — guards `/admin` alone.
 *
 * The route group keeps this out of the path, so the guard applies to
 * `/admin` without becoming an ancestor of its children — which each carry
 * their own capability. A guard on `app/(app)/admin/layout.tsx` would demand
 * `admin.users` of every child route as well, and roles exist that hold a child
 * capability without holding this one.
 */
export default async function Guarded({ children }: { children: React.ReactNode }) {
  await requireCapability("admin.users", "/admin");
  return <>{children}</>;
}
