import { test, expect } from "@playwright/test";
import { ROLES, LANDING, signIn } from "./helpers";

/** E14-S5 / A-01 / A-16 — identity and access, exercised through real middleware. */

test.describe("login and landing", () => {
  test("all twelve seeded personas are offered", async ({ page }) => {
    await page.goto("/login");
    for (const role of ROLES) {
      await expect(page.getByTestId(`login-${role}`)).toBeVisible();
    }
  });

  for (const role of ROLES) {
    test(`${role} lands on its designated route`, async ({ page }) => {
      await signIn(page, role);
      // Landing may 404 where the screen is not yet built; the assertion is that
      // the router took the role to its OWN route, which is what A-01 tests.
      expect(page.url()).toContain(LANDING[role]);
    });
  }
});

test.describe("RBAC — denial is server-side, not cosmetic", () => {
  test("an unauthenticated request is redirected to login with the path retained", async ({ page }) => {
    await page.goto("/command");
    await expect(page).toHaveURL(/\/login\?next=%2Fcommand/);
  });

  test("a field engineer requesting receivables by URL is denied", async ({ page }) => {
    await signIn(page, "FIELD_ENGINEER");
    await page.goto("/commercial/receivables");
    await expect(page.getByRole("heading", { name: /access not permitted/i })).toBeVisible();
    // E14-S2 — the denial names the roles that DO hold access.
    await expect(page.getByText(/available to/i)).toBeVisible();
  });

  test("a sales executive cannot reach the audit log", async ({ page }) => {
    await signIn(page, "SALES_EXECUTIVE");
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /access not permitted/i })).toBeVisible();
  });

  test("the auditor CAN reach the audit log (RBAC-5)", async ({ page }) => {
    await signIn(page, "AUDITOR");
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /access not permitted/i })).toHaveCount(0);
  });

  test("a store in-charge cannot reach the permission matrix", async ({ page }) => {
    await signIn(page, "STORE_INCHARGE");
    await page.goto("/admin/permissions");
    await expect(page.getByRole("heading", { name: /access not permitted/i })).toBeVisible();
  });
});
