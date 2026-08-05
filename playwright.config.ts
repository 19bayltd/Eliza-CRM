import { defineConfig } from "@playwright/test";

// E2E runs against a local dev server (or BASE_URL) connected to the
// STAGING Supabase project. Never point E2E at production.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // Single worker: specs share one staging account, and Supabase sign-out
  // is global — a parallel spec signing out revokes the other worker's
  // session mid-test (observed 2026-08-05).
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Server actions against the deployed app cross a cold start plus
  // several database round-trips; 5s (the default) is too tight for
  // asserting an action's result.
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    actionTimeout: 15000,
    // Sandbox/CI images may pre-install a Chromium build that differs from
    // the @playwright/test pin; point at it via CHROMIUM_PATH when set.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
