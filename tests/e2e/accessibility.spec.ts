import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const storefrontUrl = process.env.A11Y_STOREFRONT_URL ?? "http://localhost:3003";
const adminUrl = process.env.A11Y_ADMIN_URL ?? "http://localhost:3002";
const controlPlaneUrl = process.env.A11Y_CONTROL_PLANE_URL ?? "http://localhost:3010";
const apiUrl = process.env.A11Y_API_URL ?? "http://localhost:3001";

type PageAudit = {
  key: string;
  url: string;
  criticalViolations: number;
  seriousViolations: number;
  totalViolations: number;
};

const audits: PageAudit[] = [];

async function runAxeAudit(page: Page, key: string, url: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);

  const axeResult = await new AxeBuilder({ page }).analyze();
  const critical = axeResult.violations.filter((violation) => violation.impact === "critical");
  const serious = axeResult.violations.filter((violation) => violation.impact === "serious");

  audits.push({
    key,
    url,
    criticalViolations: critical.length,
    seriousViolations: serious.length,
    totalViolations: axeResult.violations.length,
  });

  expect(
    critical,
    `${key} has critical accessibility violations:\n${critical.map((item) => `${item.id}: ${item.help}`).join("\n")}`,
  ).toHaveLength(0);
}

async function resolveCatalogTargets(request: APIRequestContext) {
  const categoriesRes = await request.get(`${apiUrl}/catalog/categories`);
  expect(categoriesRes.ok()).toBeTruthy();
  const categoriesPayload = (await categoriesRes.json()) as { items?: Array<{ id: string }> };
  const categoryId = categoriesPayload.items?.[0]?.id;
  expect(categoryId).toBeTruthy();

  const productsRes = await request.get(`${apiUrl}/catalog/products?page=1&pageSize=1`);
  expect(productsRes.ok()).toBeTruthy();
  const productsPayload = (await productsRes.json()) as { items?: Array<{ id: string }> };
  const productId = productsPayload.items?.[0]?.id;
  expect(productId).toBeTruthy();

  return { categoryId: categoryId as string, productId: productId as string };
}

test("axe audit: home/category/pdp/cart/checkout/login/dashboard", async ({ page, request }) => {
  audits.length = 0;
  const { categoryId, productId } = await resolveCatalogTargets(request);

  const targets = [
    { key: "home", url: `${storefrontUrl}/` },
    { key: "category", url: `${storefrontUrl}/categories/${categoryId}` },
    { key: "pdp", url: `${storefrontUrl}/products/${productId}` },
    { key: "cart", url: `${storefrontUrl}/cart` },
    { key: "checkout", url: `${storefrontUrl}/checkout` },
    { key: "login", url: `${controlPlaneUrl}/login` },
    { key: "dashboard", url: `${adminUrl}/dashboard` },
  ];

  for (const target of targets) {
    await runAxeAudit(page, target.key, target.url);
  }
});

test("accessibility score ingest to control-plane (optional)", async ({ request }) => {
  if (!audits.length) {
    test.skip(true, "No audits collected in this run.");
  }

  const ingestUrl = process.env.A11Y_REPORT_URL ?? `${controlPlaneUrl}/api/accessibility/report`;
  const ingestToken = process.env.CONTROL_PLANE_INGEST_TOKEN ?? "";
  const instanceId = process.env.A11Y_INSTANCE_ID ?? "local-dev";
  const version = process.env.A11Y_VERSION ?? process.env.GIT_SHA ?? "dev";

  if (!ingestToken) {
    test.skip(true, "CONTROL_PLANE_INGEST_TOKEN missing.");
  }

  const totalCritical = audits.reduce((sum, item) => sum + item.criticalViolations, 0);
  const totalSerious = audits.reduce((sum, item) => sum + item.seriousViolations, 0);
  const maxScore = audits.length * 100;
  const penalty = totalCritical * 25 + totalSerious * 10;
  const score = Math.max(0, Math.round(((maxScore - penalty) / maxScore) * 100));

  const res = await request.post(ingestUrl, {
    headers: {
      "Content-Type": "application/json",
      "x-cp-ingest-token": ingestToken,
    },
    data: {
      instanceId,
      version,
      score,
      criticalViolations: totalCritical,
      seriousViolations: totalSerious,
      pages: audits,
      measuredAt: new Date().toISOString(),
    },
  });

  expect(res.ok()).toBeTruthy();
});
