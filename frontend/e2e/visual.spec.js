import { test, expect } from "@playwright/test";

/**
 * Visual regression baselines for the unauthenticated surface. These
 * pages are SSR-stable and don't depend on the backend, so they're
 * deterministic in CI.
 *
 * Adding auth'd-page snapshots would require either mocking the API or
 * spinning up the backend; deferred for now to keep the suite cheap.
 *
 * Update baselines after intentional UI changes with:
 *   npx playwright test --update-snapshots
 */

test.describe("Public surface", () => {
  test("login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  });

  test("register page", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("register.png", { fullPage: true });
  });
});
