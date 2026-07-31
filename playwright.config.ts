import { defineConfig } from "@playwright/test";

// E2E runs against a local dev server (or BASE_URL) connected to the
// STAGING Supabase project. Never point E2E at production.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
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
