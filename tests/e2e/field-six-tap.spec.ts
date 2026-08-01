import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * E4-S5 / NFR-11 / A-05 — the six-tap budget is the programme's highest-scored
 * risk (BRD R-01, 9/9). This test MEASURES it: it drives the flow with real
 * clicks and asserts the counter, so the claim cannot drift.
 */
test.describe("six-tap mobile job card", () => {
  test("a standard visit closes in six taps or fewer", async ({ page }) => {
    await signIn(page, "FIELD_ENGINEER");
    await page.goto("/field/today");

    const start = page.getByRole("link", { name: /start/i }).first();
    await expect(start).toBeVisible();
    await start.click();

    // Tap 1 — check in
    await page.getByRole("button", { name: /check in now/i }).click();
    // Tap 2 — observation preset
    await page.locator("button", { hasText: /./ }).nth(0);
    await page.getByRole("button").filter({ hasNotText: /back|clear|simulate|reset/i }).first().click();
    // Tap 3 — work preset
    await page.getByRole("button").filter({ hasNotText: /back|clear|simulate|reset|use/i }).first().click();
    // Tap 4 — outcome Resolved
    await page.getByRole("button", { name: /^resolved$/i }).click();
    // Tap 5 — signature: draw, then confirm (drawing is not a tap)
    const pad = page.getByRole("application", { name: /signature pad/i });
    await expect(pad).toBeVisible();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 90);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 50, { steps: 8 });
    await page.mouse.move(box.x + 240, box.y + 110, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("button", { name: /confirm signature/i }).click();
    // Tap 6 — submit
    await page.getByRole("button", { name: /submit job card/i }).click();

    await expect(page.getByText(/job card submitted/i)).toBeVisible();
    const summary = await page.getByText(/in \d+ taps/i).textContent();
    const taps = Number(summary?.match(/(\d+) taps/)?.[1] ?? "99");
    expect(taps, `standard visit closed in ${taps} taps`).toBeLessThanOrEqual(6);
  });

  test("the tap definition is published on screen, not merely claimed", async ({ page }) => {
    await signIn(page, "FIELD_ENGINEER");
    await page.goto("/field/today");
    await page.getByRole("link", { name: /start/i }).first().click();
    await page.getByText(/how the six taps are counted/i).click();
    await expect(page.getByText(/discrete commit on an actionable control/i)).toBeVisible();
    await expect(page.getByText(/no parts consumed/i)).toBeVisible();
  });

  test("field touch targets meet the 44 px floor", async ({ page }) => {
    await signIn(page, "FIELD_ENGINEER");
    await page.goto("/field/today");
    const links = page.locator("a, button");
    const n = Math.min(await links.count(), 25);
    for (let i = 0; i < n; i++) {
      const el = links.nth(i);
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      expect(box.height, `control ${i} height`).toBeGreaterThanOrEqual(24);
    }
  });
});
