import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression suite. Boots `vite preview` against the built bundle,
 * takes screenshots of static pages (no auth required), compares them
 * against committed baselines in `e2e/__screenshots__/`.
 *
 * Run locally:
 *   npm run build && npx playwright test
 *
 * To accept new baselines after an intentional UI change:
 *   npx playwright test --update-snapshots
 *
 * CI invokes the same flow; baselines must be committed to the repo.
 */
export default defineConfig({
  testDir: "./e2e",
  // Snapshot files live alongside the tests in __screenshots__/.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",

  // Visual regression needs a stable environment, no retries, no
  // parallelism, fixed viewport, fixed timezone.
  workers: 1,
  retries: 0,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  expect: {
    toHaveScreenshot: {
      // Tolerate tiny rendering differences (font hinting, antialiasing).
      maxDiffPixelRatio: 0.02,
    },
  },

  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Boot `vite preview` for the duration of the test run. Build must
  // have run first (CI does `npm run build` before this).
  webServer: {
    command: "npm run preview -- --port 4173 --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
