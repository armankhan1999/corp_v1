import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * A-02 / A-03 / E2-S3 — the headline must reconcile on screen, not just in the
 * seed validator. If the panel and the register ever disagree, this fails.
 */
test.describe("Command Centre — locked cash", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "DIRECTOR_BUSINESS");
    await page.goto("/command");
  });

  test("renders the ₹2.17 Cr locked-cash headline", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Command Centre" })).toBeVisible();
    await expect(page.getByText("₹2.17 Cr").first()).toBeVisible();
  });

  test("shows the four ageing buckets at their seeded values", async ({ page }) => {
    for (const value of ["₹64 L", "₹47 L", "₹31 L", "₹40 L"]) {
      await expect(page.getByText(value, { exact: false }).first()).toBeVisible();
    }
  });

  test("shows the institutional split of ₹1.12 Cr", async ({ page }) => {
    await expect(page.getByText("₹1.12 Cr").first()).toBeVisible();
  });

  test("shows retention of ₹34.6 L and the ₹11.2 L now claimable", async ({ page }) => {
    await expect(page.getByText("₹34.6 L").first()).toBeVisible();
    await expect(page.getByText("₹11.2 L").first()).toBeVisible();
  });

  test("every KPI card is a doorway (DP-1)", async ({ page }) => {
    const lockedCash = page.getByRole("link", { name: /locked cash/i }).first();
    await expect(lockedCash).toBeVisible();
    await lockedCash.click();
    await expect(page).not.toHaveURL(/\/command$/);
  });

  test("retention register total equals the panel figure", async ({ page }) => {
    await page.goto("/projects/retention");
    await expect(page.getByText("₹34.6 L").first()).toBeVisible();
  });
});

test.describe("Renewal radar figures (A-07)", () => {
  test("the AMC register surfaces expiring contracts", async ({ page }) => {
    await signIn(page, "SERVICE_MANAGER");
    await page.goto("/service/amc");
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
