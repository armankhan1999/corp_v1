import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, decodeSession, type Session } from "@/lib/rbac/session";
import type { ActorInfo } from "./types";

/**
 * The admin screens are server components; the session lives in the cookie
 * mirror described in PLAN.md conflict C-06. Middleware has already denied a
 * route the role cannot hold, so this is a type-narrowing guard, not the
 * enforcement point.
 */
export async function requireSession(): Promise<Session> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return session;
}

export function actorOf(session: Session): ActorInfo {
  return {
    userId: session.userId,
    name: session.name,
    role: session.role,
    branchId: session.branchId,
    impersonatedBy: session.impersonatedFrom?.userId ?? null,
  };
}
