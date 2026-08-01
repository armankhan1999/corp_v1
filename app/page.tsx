import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { LANDING_ROUTE } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

/**
 * The site root. Until now `/` had no page at all and relied entirely on the
 * middleware redirect, which meant the one URL every visitor hits first was
 * also the one with no fallback if the guard faulted. This is a plain server
 * component on the Node runtime, so the landing redirect holds independently.
 *
 * PRD §2.1 — each persona lands on their own route.
 */
export default async function RootPage() {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  redirect(LANDING_ROUTE[session.role] ?? "/login");
}
