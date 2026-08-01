import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/patterns/Shell";
import { decodeSession, SESSION_COOKIE, isExpired } from "@/lib/rbac/session";
import { getDataset } from "@/lib/seed";
import { buildPaletteIndex } from "@/components/domain/admin/paletteIndex";
import { CommandPaletteMount } from "@/components/domain/admin/CommandPaletteMount";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    // Deliberately not redirecting from here. This layout renders before the
    // per-route guards and does not know which path was requested, so it would
    // send the user to a bare /login and lose their destination. Every route
    // beneath it carries a guard that does know its own path and redirects with
    // `?next=`, satisfying E1-S1. Rendering children unwrapped lets that guard
    // run; the Shell needs a session and is skipped.
    return <>{children}</>;
  }
  if (isExpired(session, Date.now())) redirect("/login?reason=idle");

  const ds = getDataset();
  const unread = ds.notifications.filter((n) => n.userId === session.userId && !n.read).length;

  // E1-S5 — the palette is global. It was mounted in the Admin layout while the
  // shell was frozen, which left the header's Ctrl-K affordance inert on the
  // other 71 routes. The index is scoped to the signed-in user, so it is built
  // here where the session is resolved.
  const user = ds.users.find((u) => u.id === session.userId) ?? null;
  const palette = buildPaletteIndex(ds, {
    userId: session.userId,
    role: session.role,
    branchId: session.branchId,
    employeeId: user?.employeeId ?? null,
  });

  return (
    <Shell session={session} unread={unread}>
      <CommandPaletteMount records={palette.records} note={palette.note} />
      {children}
    </Shell>
  );
}
