import { ErpSdkClient } from "@erp/sdk";

async function main() {
  const client = new ErpSdkClient({
    baseUrl: process.env.ERP_API_BASE_URL ?? "http://localhost:3001",
    apiKey: process.env.ERP_API_KEY ?? "",
  });

  const products = [];
  for await (const product of client.paginateProducts({ pageSize: 100 })) {
    products.push({ id: product.id, name: product.name });
  }

  console.log(`Synced ${products.length} products`);
  console.log(products.slice(0, 10));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
