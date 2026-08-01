import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, isExpired, SESSION_COOKIE, type Session } from "./session";
import { can, type Capability } from "./matrix";

/**
 * RBAC-1 layer 2 — the route guard, enforced in server layouts.
 *
 * This was Edge middleware, and it is not any more. Middleware faults do not
 * degrade: they replace the entire response with MIDDLEWARE_INVOCATION_FAILED.
 * On Vercel the deployed Edge bundle threw `__dirname is not defined` at module
 * scope — a Node global absent from the Edge runtime — which is uncatchable
 * from inside the handler and took down every route, including the login page
 * that would have cleared the offending cookie. The symbol appears nowhere in a
 * locally built bundle, so it was never reproducible here; `next start` runs
 * middleware in a permissive Node sandbox rather than a real Edge isolate.
 *
 * A layout is an ordinary server component on the same Node runtime as the
 * page. What passes locally is what runs in production, a fault renders one
 * route's error boundary instead of blanking the site, and the guard is still
 * server-side — which is what RBAC-1 actually requires: a typed URL is refused
 * by the server, not merely hidden from the navigation.
 *
 * Placement mirrors `capabilityForPath`'s longest-prefix rule. A guard sits at
 * each route-rule prefix and covers everything beneath it. Nesting means an
 * inner route must satisfy its ancestors' capabilities too, which is normally
 * identical to longest-prefix — verified across all twelve roles and every
 * prefix — with one exception: PROJECT_MANAGER and ACCOUNTS_EXECUTIVE hold
 * `command.exceptions` but not `command`. `/command` therefore carries no
 * ancestor guard; its own page guards itself. See `scripts/_equiv.ts`.
 */

/**
 * Resolves the signed-in session, or redirects to login.
 *
 * `path` is the route being guarded. E1-S1 retains it across the sign-in so the
 * user returns to what they asked for; each generated guard passes its own
 * route, which is how that survived the move off middleware.
 */
export async function requireSession(path?: string): Promise<Session> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    redirect(path ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }
  // FR-M1-20 — inactivity returns the user to login with a resumable notice.
  if (isExpired(session, Date.now())) redirect("/login?reason=idle");
  return session;
}

/**
 * Resolves the session and refuses the route unless the role holds `cap`.
 * Returns the session so callers need not decode the cookie twice.
 */
export async function requireCapability(cap: Capability, path?: string): Promise<Session> {
  const session = await requireSession(path);
  if (!can(session.role, cap)) {
    // RBAC-6 — the denial carries its reason so /denied can record it.
    const q = new URLSearchParams({ cap });
    if (path) q.set("path", path);
    redirect(`/denied?${q.toString()}`);
  }
  return session;
}
