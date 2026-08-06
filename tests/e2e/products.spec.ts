import { expect, test } from "@playwright/test";

/**
 * Phase 02 end-to-end specs — the product master, exercised the way the
 * owner would. Run against the STAGING deployment (never production):
 *   BASE_URL=... E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run test:e2e
 *
 * The account needs products.catalog.manage / create / update / archive
 * and products.intelligence.view (Owner or Administrator by default).
 *
 * Every run creates its own catalog entries and product under a unique
 * suffix, so repeated runs never collide and never disturb real data.
 * Nothing is deleted (the system is archive-only by design) — the run
 * leaves an archived product behind, which is the intended end state.
 */

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

// Uppercase alphanumeric suffix: codes and SKUs allow no other characters.
// Timestamp-based so separate runs never collide. Within one run the value
// is stable, so a retry re-uses the same codes — the specs below treat an
// "already exists" response from a previous attempt as acceptable.
const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const UNIT = `E2EU${RUN}`;
const CATEGORY = `E2EC${RUN}`;
const ATTRIBUTE = `E2EA${RUN}`;
const SKU = `E2E-${RUN}`;

test.describe("product master", () => {
  test.skip(!email || !password, "E2E_USER_EMAIL / E2E_USER_PASSWORD not set");
  // One ordered journey: later steps build on earlier ones.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  /**
   * Assert the RESULT of a create, not its confirmation message.
   *
   * The success banner is transient: the action calls revalidatePath, the
   * server tree re-renders, and the banner can be gone before an assertion
   * catches it — three live runs failed this way while the database showed
   * every write succeeding. The durable, meaningful check is that the new
   * entity is now listed on the page, which is also true when a previous
   * attempt of the same run created it.
   */
  async function expectListed(
    page: import("@playwright/test").Page,
    text: string,
  ) {
    await page.reload();
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
  }

  test("catalog: create a unit, category, and attribute with a value", async ({
    page,
  }) => {
    await page.goto("/products/catalog");

    const unitForm = page.locator("form").filter({ hasText: "Add unit" }).first();
    await unitForm.getByLabel("Code").fill(UNIT);
    await unitForm.getByLabel("Name").fill("E2E pieces");
    await unitForm.getByRole("button", { name: "Add unit" }).click();
    await expectListed(page, UNIT);

    const categoryForm = page
      .locator("form")
      .filter({ hasText: "Add category" })
      .first();
    await categoryForm.getByLabel("Code").fill(CATEGORY);
    await categoryForm.getByLabel("Name").fill("E2E category");
    await categoryForm.getByRole("button", { name: "Add category" }).click();
    await expectListed(page, CATEGORY);

    const attributeForm = page
      .locator("form")
      .filter({ hasText: "Add attribute" })
      .first();
    await attributeForm.getByLabel("Code").fill(ATTRIBUTE);
    await attributeForm.getByLabel("Name").fill("E2E size");
    await attributeForm.getByRole("button", { name: "Add attribute" }).click();
    await expectListed(page, ATTRIBUTE);

    // The value form belongs to the attribute just created.
    const valueForm = page
      .locator("li")
      .filter({ hasText: ATTRIBUTE })
      .locator("form")
      .filter({ hasText: "Add value" })
      .first();
    await valueForm.getByLabel("New value").fill("E2E-M");
    await valueForm.getByRole("button", { name: "Add value" }).click();
    // The value appears in its attribute's "Values:" line once stored.
    await page.reload();
    await expect(
      page.locator("li").filter({ hasText: ATTRIBUTE }).getByText("E2E-M"),
    ).toBeVisible();
  });

  test("product: create, reject a duplicate SKU, then add a variant", async ({
    page,
  }) => {
    await page.goto("/products");
    // Forms live inside <details>; the summary must be clicked to reveal
    // them — a collapsed form's inputs are hidden and cannot be filled.
    await page.getByText("New product", { exact: true }).first().click();

    const create = async () => {
      const form = page
        .locator("form")
        .filter({ hasText: "Create product" })
        .first();
      await form.getByLabel("SKU").fill(SKU);
      await form.getByLabel("Name").fill(`E2E product ${RUN}`);
      await form.getByRole("button", { name: "Create product" }).click();
    };

    await create();
    // The product is now listed (whether created just now or by an earlier
    // attempt of this run) — durable state, not a transient banner.
    await page.goto("/products");
    await expect(page.getByRole("link", { name: SKU })).toBeVisible();

    // Same SKU again must be refused by the server, not silently accepted.
    // This error IS durable: it persists until the next navigation.
    await page.getByText("New product", { exact: true }).first().click();
    await create();
    await expect(
      page.getByRole("alert").filter({ hasText: "SKU already exists" }),
    ).toBeVisible();

    // Open the product and add a variant.
    await page.goto("/products");
    await page.getByRole("link", { name: SKU }).click();
    await expect(page.getByText(SKU)).toBeVisible();

    await page.getByText("Add variant", { exact: true }).first().click();
    const variantForm = page
      .locator("form")
      .filter({ hasText: "Add variant" })
      .first();
    await variantForm.getByLabel("Variant SKU").fill(`${SKU}-A`);
    await variantForm.getByRole("button", { name: "Add variant" }).click();
    // The variant now appears in the product's variants table.
    await page.reload();
    await expect(page.getByText(`${SKU}-A`)).toBeVisible();
  });

  test("intelligence panel is present for a permitted user and saves", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.getByRole("link", { name: SKU }).click();

    await expect(
      page.getByRole("heading", { name: "Confidential intelligence" }),
    ).toBeVisible();

    const form = page
      .locator("form")
      .filter({ hasText: "Save intelligence" })
      .first();
    await form.getByLabel("Sourcing notes").fill(`E2E sourcing note ${RUN}`);
    await form.getByLabel("Target cost").fill("142.50");
    await form.getByLabel("Currency").fill("BDT");
    await form.getByRole("button", { name: "Save intelligence" }).click();
    // Reload and confirm the confidential values were persisted.
    await page.reload();
    await expect(page.getByLabel("Sourcing notes")).toHaveValue(
      `E2E sourcing note ${RUN}`,
    );
    await expect(page.getByLabel("Target cost")).toHaveValue("142.50");
  });

  test("status machine: activate, then archive with a reason", async ({ page }) => {
    page.on("dialog", (d) => d.accept());

    await page.goto("/products");
    await page.getByRole("link", { name: SKU }).click();

    const activate = page
      .locator("form")
      .filter({ hasText: "Activate product" })
      .first();
    await activate.getByLabel("Reason").fill("E2E activation");
    await activate.getByRole("button", { name: "Activate product" }).click();
    // Status badge is durable state; the success banner is not.
    await page.reload();
    await expect(page.locator(".status-active").first()).toBeVisible();

    const archive = page
      .locator("form")
      .filter({ hasText: "Archive product" })
      .first();
    await archive.getByLabel("Reason").fill("E2E archival");
    await archive.getByRole("button", { name: "Archive product" }).click();
    await page.reload();
    await expect(page.locator(".status-archived").first()).toBeVisible();

    // Archived products expose no edit affordance.
    await expect(
      page.locator("form").filter({ hasText: "Save changes" }),
    ).toHaveCount(0);
  });

  test("audit log records the product lifecycle", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("product.created").first()).toBeVisible();
    await expect(page.getByText("product.archived").first()).toBeVisible();
  });
});
