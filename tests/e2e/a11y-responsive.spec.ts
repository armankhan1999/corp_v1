import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signIn } from "./helpers";

/**
 * E14-S3 / NFR-07 / A-18 — WCAG 2.2 AA, zero serious or critical violations,
 * and E14-S4 / NFR-06 responsive behaviour with no horizontal overflow.
 */

const SURFACES: { path: string; role: Parameters<typeof signIn>[1] }[] = [
  { path: "/login", role: "DIRECTOR_BUSINESS" },
  { path: "/command", role: "DIRECTOR_BUSINESS" },
  { path: "/command/exceptions", role: "DIRECTOR_BUSINESS" },
  { path: "/command/branches", role: "DIRECTOR_BUSINESS" },
  { path: "/projects", role: "PROJECT_MANAGER" },
  { path: "/projects/retention", role: "PROJECT_MANAGER" },
  { path: "/service/tickets", role: "SERVICE_MANAGER" },
  { path: "/service/assets", role: "SERVICE_MANAGER" },
  { path: "/service/commissioning", role: "SERVICE_MANAGER" },
  { path: "/service/amc", role: "SERVICE_MANAGER" },
  { path: "/sales/customers", role: "BRANCH_MANAGER" },
  { path: "/sales/enquiries", role: "BRANCH_MANAGER" },
  { path: "/commercial/challans", role: "ACCOUNTS_EXECUTIVE" },
  { path: "/inventory/items", role: "STORE_INCHARGE" },
  { path: "/inventory/stock", role: "STORE_INCHARGE" },
  { path: "/people/attendance", role: "HR_ADMIN" },
  { path: "/people/employees", role: "HR_ADMIN" },
  { path: "/vault", role: "SERVICE_MANAGER" },
  { path: "/vault/ask", role: "SERVICE_MANAGER" },
  { path: "/workflow/approvals", role: "DIRECTOR_BUSINESS" },
  { path: "/analytics/cash", role: "DIRECTOR_BUSINESS" },
  { path: "/admin/audit", role: "AUDITOR" },
  { path: "/admin/permissions", role: "SUPER_ADMIN" },
  { path: "/admin/integrations", role: "SUPER_ADMIN" },
  { path: "/admin/compliance", role: "SUPER_ADMIN" },
];

for (const s of SURFACES) {
  test(`axe: ${s.path} has no serious or critical violations`, async ({ page }) => {
    if (s.path !== "/login") await signIn(page, s.role);
    await page.goto(s.path);
    await page.waitForLoadState("domcontentloaded");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    const detail = blocking
      .map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.help}`)
      .join("\n");
    expect(blocking, `${s.path}\n${detail}`).toHaveLength(0);
  });
}

const WIDTHS = [375, 768, 1024, 1440, 1920];

for (const width of WIDTHS) {
  test(`responsive: command centre has no horizontal overflow at ${width}px`, async ({ page }) => {
    await signIn(page, "DIRECTOR_BUSINESS");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/command");
    await page.waitForLoadState("domcontentloaded");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  });
}

test("both themes render and the toggle persists", async ({ page }) => {
  await signIn(page, "DIRECTOR_BUSINESS");
  await page.goto("/command");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /switch to light theme/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
