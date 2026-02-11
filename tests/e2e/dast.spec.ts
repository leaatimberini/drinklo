import { test, expect } from "@playwright/test";

const apiUrl = process.env.DAST_API_URL ?? "http://localhost:3001";
const storefrontUrl = process.env.DAST_STOREFRONT_URL ?? "http://localhost:3003";

test("api rejects obvious injection payloads", async ({ request }) => {
  const res = await request.post(`${apiUrl}/auth/login`, {
    data: { email: "admin@acme.local' OR 1=1 --", password: "x" },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("storefront does not reflect xss payload in url", async ({ page }) => {
  const payload = "<script>alert(1)</script>";
  await page.goto(`${storefrontUrl}/?q=${encodeURIComponent(payload)}`);
  const content = await page.content();
  expect(content).not.toContain(payload);
});

test("security headers present on api", async ({ request }) => {
  const res = await request.get(`${apiUrl}/health`);
  expect(res.headers()["x-content-type-options"]).toBeDefined();
});
