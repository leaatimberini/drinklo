import { expect, test } from "@playwright/test";

const primary = process.env.STAGING_PRIMARY_API_URL;
const secondary = process.env.STAGING_SECONDARY_API_URL;
const storefront = process.env.STAGING_STOREFRONT_URL;

test.describe("staging failover simulation", () => {
  test.skip(!secondary || !storefront, "requires STAGING_SECONDARY_API_URL and STAGING_STOREFRONT_URL");

  test("secondary region stays readable", async ({ request, page }) => {
    const secondaryHealth = await request.get(`${secondary}/health`);
    expect(secondaryHealth.ok()).toBeTruthy();

    if (primary) {
      const primaryHealth = await request.get(`${primary}/health`);
      expect(primaryHealth.ok()).toBeTruthy();
    }

    await page.goto(`${storefront}/products`);
    await expect(page.getByText("Productos")).toBeVisible();
  });
});
