import { test, expect } from "@playwright/test";

test("api health", async ({ request }) => {
  const res = await request.get("http://localhost:3001/health");
  expect(res.ok()).toBeTruthy();
});

test("admin loads", async ({ page }) => {
  await page.goto("http://localhost:3002");
  await expect(page).toHaveTitle(/Admin/i);
});

test("storefront loads", async ({ page }) => {
  await page.goto("http://localhost:3003");
  await expect(page).toHaveTitle(/Storefront/i);
});
