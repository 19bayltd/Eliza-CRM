import { expect, test } from "@playwright/test";

/**
 * Phase 01 end-to-end specs. Run against a dev server connected to the
 * STAGING Supabase project (never production):
 *   npm run test:e2e
 * Authenticated-flow specs additionally need E2E_USER_EMAIL /
 * E2E_USER_PASSWORD for an active staging account.
 */

test.describe("unauthenticated access", () => {
  test("protected routes redirect to login", async ({ page }) => {
    for (const path of ["/dashboard", "/admin/users", "/admin/audit"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("login page renders with accessible fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("invalid credentials show an error and stay on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid email or password");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot-password gives a non-enumerating response", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists");
  });
});

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe("authenticated flows", () => {
  test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");

  test("sign in, view dashboard, sign out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
