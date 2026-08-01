import { defineConfig } from "vitest/config";

/**
 * Unit tests only. `tests/e2e` is Playwright's — it imports `@playwright/test`
 * and cannot run under Vitest, so without this scoping every E2E spec is
 * reported as a failed test file.
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
  },
});
