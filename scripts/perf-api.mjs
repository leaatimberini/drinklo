import autocannon from "autocannon";

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3001";
const adminToken = process.env.PERF_ADMIN_TOKEN ?? "";

const thresholds = {
  catalogP95: Number(process.env.PERF_P95_CATALOG_MS ?? 500),
  checkoutP95: Number(process.env.PERF_P95_CHECKOUT_MS ?? 800),
  adminP95: Number(process.env.PERF_P95_ADMIN_MS ?? 800),
};

function runTest(config) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        ...config,
        duration: Number(process.env.PERF_DURATION ?? 10),
        connections: Number(process.env.PERF_CONNECTIONS ?? 20),
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
  });
}

async function main() {
  const results = [];

  const catalogResult = await runTest({
    url: `${baseUrl}/catalog/products?page=1&pageSize=20`,
    method: "GET",
  });
  results.push({
    name: "catalog",
    p95: catalogResult.latency.p95,
    threshold: thresholds.catalogP95,
  });

  const categoriesResult = await runTest({
    url: `${baseUrl}/catalog/categories`,
    method: "GET",
  });
  results.push({
    name: "categories",
    p95: categoriesResult.latency.p95,
    threshold: thresholds.catalogP95,
  });

  const checkoutPayload = {
    customerName: "Perf",
    customerEmail: "perf@example.com",
    shippingMode: "PICKUP",
    items: [{ productId: "perf", quantity: 1 }],
  };

  const checkoutResult = await runTest({
    url: `${baseUrl}/checkout/quote`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload),
  });
  results.push({
    name: "checkout_quote",
    p95: checkoutResult.latency.p95,
    threshold: thresholds.checkoutP95,
  });

  if (adminToken) {
    const adminResult = await runTest({
      url: `${baseUrl}/products`,
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    results.push({
      name: "admin_products",
      p95: adminResult.latency.p95,
      threshold: thresholds.adminP95,
    });
  } else {
    console.log("PERF_ADMIN_TOKEN not set. Skipping admin endpoint.");
  }

  let failed = false;
  for (const item of results) {
    const ok = item.p95 <= item.threshold;
    if (!ok) failed = true;
    console.log(`${item.name}: p95=${Math.round(item.p95)}ms threshold=${item.threshold}ms ${ok ? "OK" : "FAIL"}`);
  }

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
