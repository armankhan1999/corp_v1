import type { Page } from "@playwright/test";

export const ROLES = [
  "SUPER_ADMIN", "DIRECTOR_BUSINESS", "DIRECTOR_STRATEGY", "BRANCH_MANAGER",
  "SALES_EXECUTIVE", "SERVICE_MANAGER", "FIELD_ENGINEER", "PROJECT_MANAGER",
  "ACCOUNTS_EXECUTIVE", "HR_ADMIN", "STORE_INCHARGE", "AUDITOR",
] as const;

export type Role = (typeof ROLES)[number];

/** Landing routes from lib/rbac/matrix.ts — asserted, not assumed. */
export const LANDING: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  DIRECTOR_BUSINESS: "/command",
  DIRECTOR_STRATEGY: "/command",
  BRANCH_MANAGER: "/sales/pipeline",
  SALES_EXECUTIVE: "/sales/my-desk",
  SERVICE_MANAGER: "/service/dispatch",
  FIELD_ENGINEER: "/field/today",
  PROJECT_MANAGER: "/projects",
  ACCOUNTS_EXECUTIVE: "/commercial/receivables",
  HR_ADMIN: "/people/attendance",
  STORE_INCHARGE: "/inventory/movements",
  AUDITOR: "/admin/audit",
};

/**
 * E1-S1 — sign in by clicking the seeded persona, as a user would.
 *
 * `networkidle` is not usable here: the App Router keeps RSC prefetch requests
 * in flight, so it never settles and every heavy landing route times out.
 * Waiting for the URL to leave /login is the real signal.
 */
export async function signIn(page: Page, role: Role) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByTestId(`login-${role}`).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");
}
