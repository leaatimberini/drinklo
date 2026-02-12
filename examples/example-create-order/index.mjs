import { ErpSdkClient, createIdempotencyKey } from "@erp/sdk";

async function main() {
  const client = new ErpSdkClient({
    baseUrl: process.env.ERP_API_BASE_URL ?? "http://localhost:3001",
    apiKey: process.env.ERP_API_KEY ?? "",
  });

  const order = await client.createOrder(
    {
      customerName: "Cliente Demo",
      customerEmail: "cliente@example.com",
      customerPhone: "+541100000000",
      shippingMode: "PICKUP",
      items: [{ productId: process.env.PRODUCT_ID ?? "", quantity: 1 }],
    },
    { idempotencyKey: createIdempotencyKey("example-order") },
  );

  console.log("Order created", order);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
