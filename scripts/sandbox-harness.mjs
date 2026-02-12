#!/usr/bin/env node

const baseUrl = process.env.API_URL ?? "http://localhost:3001";
const adminToken = process.env.ADMIN_JWT ?? "";

async function request(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  console.log("1) sandbox reset");
  await request("/admin/sandbox/reset", { method: "POST" });

  console.log("2) storefront catalog read");
  const products = await request("/catalog/products?page=1&pageSize=5");
  const firstProduct = products.items?.[0];
  if (!firstProduct) throw new Error("No products after sandbox reset");

  console.log("3) shipping quote (Andreani sandbox)");
  const quote = await request("/checkout/quote", {
    method: "POST",
    body: JSON.stringify({
      shippingMode: "DELIVERY",
      shippingProvider: "ANDREANI",
      address: {
        line1: "Av Corrientes 1234",
        city: "CABA",
        state: "CABA",
        postalCode: "C1000",
        country: "AR",
      },
      items: [{ productId: firstProduct.id, quantity: 1 }],
    }),
  });

  const shippingOption = quote.options?.[0];
  if (!shippingOption) throw new Error("No shipping options");

  console.log("4) create order");
  const order = await request("/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      customerName: "Sandbox User",
      customerEmail: "sandbox@example.com",
      customerPhone: "+541100000000",
      shippingMode: "DELIVERY",
      shippingProvider: "ANDREANI",
      shippingOptionId: shippingOption.id,
      address: {
        line1: "Av Corrientes 1234",
        city: "CABA",
        state: "CABA",
        postalCode: "C1000",
        country: "AR",
      },
      items: [{ productId: firstProduct.id, variantId: firstProduct.variants?.[0]?.id, quantity: 1 }],
    }),
  });

  console.log("5) payment preference (sandbox deterministic)");
  const preference = await request("/payments/mercadopago/preference", {
    method: "POST",
    body: JSON.stringify({ orderId: order.id }),
  });

  console.log("6) simulate payment approval");
  await request(`/admin/sandbox/simulate-payment/${order.id}`, { method: "POST" });

  console.log("7) invoice no fiscal");
  const invoice = await request("/billing/invoices", {
    method: "POST",
    body: JSON.stringify({ type: "B", pointOfSale: 1, total: 1000, currency: "ARS" }),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        orderId: order.id,
        preferenceId: preference.preferenceId,
        preferenceUrl: preference.initPoint,
        invoice,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
