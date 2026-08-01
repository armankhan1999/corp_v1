import { defineConfig, devices } from "@playwright/test";

/**
 * E14-S5 — critical-path coverage. The suite runs against a production build so
 * the figures under test are the ones a client would see, and RBAC is exercised
 * through the real middleware rather than a test double.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  /**
   * Two workers, not four. Routes marked `force-dynamic` re-derive their
   * aggregates from the full dataset on every request — receivables walks 618
   * invoices and their allocations, the attendance board builds a roster over
   * ~20k records — so four concurrent workers against a single `next start`
   * starve each other and time out. Memoising those aggregates is the real fix
   * and is recorded in the README as outstanding.
   */
  workers: 2,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive|field/ },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100/login",
    /**
     * Never reuse. A `next start` left over from a previous run stays bound to
     * the port while serving a `.next` directory that a later rebuild has
     * replaced, and every request then throws `a[d] is not a function` from the
     * stale webpack runtime — which reads as an application crash when it is
     * really a stale server. Always boot fresh against the current build.
     *
     * Related, and worth knowing before trusting a red run: deleting `.next`
     * alone is not a clean build. The webpack cache under `node_modules/.cache`
     * survives it and can emit page bundles that `require` a vendor chunk the
     * fresh build never writes. `next build` still reports success, then every
     * request dies with `Cannot find module './vendor-chunks/zod.js'` and the
     * whole suite fails at sign-in — 60 red tests, one broken artefact.
     *
     * `npm run build` therefore clears the cache first. The same corruption hit
     * the deployed Edge bundle, where the restored Vercel cache produced a
     * middleware that threw `__dirname is not defined` at module scope — a
     * Node global that does not exist in the Edge runtime, and which appears
     * nowhere in a locally built bundle. Use `build:incremental` only when you
     * want speed and are willing to re-check a red result against a clean one.
     */
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
