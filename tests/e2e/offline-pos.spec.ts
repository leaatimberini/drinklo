import { test, expect } from "@playwright/test";

test("pos queues sale offline and syncs", async ({ page, context }) => {
  await page.route("**/sales/offline/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        items: [
          {
            productId: "p1",
            variantId: "v1",
            name: "Agua",
            sku: "AGUA-1",
            barcode: "123",
            price: 1000,
            stock: 10,
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route("**/sales/offline/sync", async (route) => {
    const body = await route.request().postDataJSON();
    const created = (body?.drafts ?? []).map((draft: any) => ({
      clientTxnId: draft.clientTxnId,
      saleId: "sale-1",
      status: "created",
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ created, failed: [] }),
    });
  });

  await page.goto("http://localhost:3002/pos");

  await page.getByPlaceholder("Bearer token").fill("test-token");
  await page.getByRole("button", { name: "Actualizar catálogo" }).click();

  await page.getByPlaceholder("Escanear o buscar...").fill("Agua");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Agua/ }).click();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  await page.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByText("Venta guardada en cola offline")).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await page.getByRole("button", { name: "Sync ahora" }).click();
  await expect(page.getByText(/Cola: 0/)).toBeVisible();
});
