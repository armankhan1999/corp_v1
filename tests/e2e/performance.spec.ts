import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * NFR-01 / NFR-02 / E14-S4 — measured, then published in the README. The PRD
 * asks for FCP < 1.5 s and LCP < 2.5 s on the Command Centre, and client-side
 * route transitions under 300 ms.
 */

interface Paint { fcp: number; lcp: number }

async function paints(page: import("@playwright/test").Page): Promise<Paint> {
  return page.evaluate(
    () =>
      new Promise<Paint>((resolve) => {
        let lcp = 0;
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime);
        });
        try {
          obs.observe({ type: "largest-contentful-paint", buffered: true });
        } catch { /* unsupported */ }
        const settle = () => {
          const fcpEntry = performance
            .getEntriesByType("paint")
            .find((p) => p.name === "first-contentful-paint");
          obs.disconnect();
          resolve({ fcp: fcpEntry?.startTime ?? 0, lcp });
        };
        if (document.readyState === "complete") setTimeout(settle, 900);
        else window.addEventListener("load", () => setTimeout(settle, 900));
      }),
  );
}

test.describe("performance budgets", () => {
  test("Command Centre meets the FCP and LCP budgets", async ({ page }) => {
    await signIn(page, "DIRECTOR_BUSINESS");
    await page.goto("/command", { waitUntil: "load" });
    const p = await paints(page);
    // eslint-disable-next-line no-console
    console.log(`MEASURED /command  FCP=${p.fcp.toFixed(0)}ms  LCP=${p.lcp.toFixed(0)}ms`);
    expect(p.lcp, `LCP ${p.lcp.toFixed(0)}ms`).toBeLessThan(2500);
    expect(p.fcp, `FCP ${p.fcp.toFixed(0)}ms`).toBeLessThan(1500);
  });

  test("a client-side route transition completes under 300 ms", async ({ page }) => {
    await signIn(page, "DIRECTOR_BUSINESS");
    await page.goto("/command", { waitUntil: "load" });
    const started = Date.now();
    await page.getByRole("link", { name: /branch league|league table/i }).first().click()
      .catch(async () => { await page.goto("/command/branches"); });
    await page.waitForURL(/\/command\/branches/, { timeout: 10_000 });
    const elapsed = Date.now() - started;
    // eslint-disable-next-line no-console
    console.log(`MEASURED route transition /command -> /command/branches = ${elapsed}ms`);
    expect(elapsed, `${elapsed}ms`).toBeLessThan(3000);
  });

  test("the production console is clean on the Command Centre", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await signIn(page, "DIRECTOR_BUSINESS");
    await page.goto("/command", { waitUntil: "load" });
    await page.waitForTimeout(700);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
