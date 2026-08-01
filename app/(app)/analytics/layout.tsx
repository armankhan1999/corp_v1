import { requireSession } from "@/lib/rbac/guard";

/**
 * `/analytics` is an index with no entry in `ROUTE_RULES`, so it carries no
 * capability of its own — it only requires a session, which is what the old
 * middleware enforced for unmatched paths. Naming the route here keeps E1-S1's
 * post-login return working for it.
 *
 * Safe as an ancestor of `/analytics/*`: those children each hold their own
 * capability guard, and needing a session is already implied by holding one.
 */
export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  await requireSession("/analytics");
  return <>{children}</>;
}
