import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { ErpSdkClient } from "../src/client";

type CreatedOrderResponse = { id: string; status: string };

test("contract: sdk matches mock developer api", async () => {
  const received: Array<{ method: string; path: string; headers: http.IncomingHttpHeaders; body: unknown }> = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : undefined;
      received.push({ method: req.method ?? "GET", path: url.pathname, headers: req.headers, body });

      if (url.pathname === "/developer/v1/categories") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify([{ id: "c1", name: "Bebidas" }]));
        return;
      }

      if (url.pathname === "/developer/v1/products") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ items: [{ id: "p1", name: "Cola" }], total: 1, page: 1, pageSize: 50 }));
        return;
      }

      if (url.pathname === "/developer/v1/pricelists") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ lists: [], rules: [] }));
        return;
      }

      if (url.pathname === "/developer/v1/stock/availability") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify([]));
        return;
      }

      if (url.pathname === "/checkout/orders") {
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "ord_1", status: "CREATED" }));
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "not found" }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const client = new ErpSdkClient({ baseUrl, apiKey: "dpk_contract.secret" });

    const products = await client.listProducts();
    const categories = await client.listCategories();
    await client.listPriceLists();
    await client.listStockAvailability();
    const created = (await client.createOrder({
      customerName: "Demo",
      customerEmail: "demo@example.com",
      shippingMode: "PICKUP",
      items: [{ productId: "p1", quantity: 1 }],
    })) as CreatedOrderResponse;

    assert.equal(products.total, 1);
    assert.equal(categories[0].name, "Bebidas");
    assert.equal(created.status, "CREATED");

    assert.ok(received.length >= 5);
    for (const req of received) {
      assert.equal(req.headers["x-api-key"], "dpk_contract.secret");
    }
  } finally {
    server.close();
  }
});
