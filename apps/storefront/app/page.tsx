import { Metadata } from "next";
import { cookies } from "next/headers";
import HomeClient from "./home-client";
import { fetchCatalogJson } from "./lib/catalog-fetch";

export const metadata: Metadata = {
  title: "Storefront",
  description: "ERP storefront",
};

type Category = { id: string; name: string };

type Product = { id: string; name: string; description?: string | null; plugins?: any[] };

type CatalogResponse = { items: Product[] };

type SlotBlock = { plugin: string; title: string; body: string };

type RecommendationBlock = { items: Array<{ productId: string; name: string; sku?: string | null; price: number; stock: number; reason: string }> };

type RecommendationsResponse = { blocks: { reorder?: RecommendationBlock; cross?: RecommendationBlock; upsell?: RecommendationBlock } };

async function fetchCategories() {
  return fetchCatalogJson<{ items: Category[] }>("/catalog/categories", {
    next: { revalidate: 30 },
  });
}

async function fetchProducts() {
  return fetchCatalogJson<CatalogResponse>("/catalog/products?page=1&pageSize=6", {
    next: { revalidate: 30 },
  });
}

async function fetchSlots() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/plugins/ui?slot=storefront.home`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return [] as SlotBlock[];
  return res.json() as Promise<SlotBlock[]>;
}

async function fetchExperiment(target: string) {
  const cookieStore = cookies();
  const cookie = cookieStore.get("erp_ab")?.value;
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/experiments/assign?target=${target}`, {
    headers: cookie ? { cookie: `erp_ab=${cookie}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.variant ?? null;
}

async function fetchRecommendations(ageVerified: boolean, optOut: boolean) {
  if (optOut) return null;
  const params = new URLSearchParams({
    blocks: "reorder,cross,upsell",
    limit: "6",
    ageVerified: ageVerified ? "true" : "false",
    optOut: optOut ? "true" : "false",
  });
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/recommendations?${params.toString()}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<RecommendationsResponse>;
}

export default async function Page() {
  const categories = await fetchCategories();
  const products = await fetchProducts();
  const slots = await fetchSlots();
  const abVariant = await fetchExperiment("HOME");
  const cookieStore = cookies();
  const ageVerified = cookieStore.get("age_gate_ok")?.value === "true";
  const optOut = cookieStore.get("reco_opt_out")?.value === "true";
  const recommendations = await fetchRecommendations(ageVerified, optOut);

  return (
    <HomeClient
      categories={categories.items}
      products={products.items}
      slots={slots}
      recommendations={recommendations?.blocks ?? undefined}
      abVariant={abVariant}
    />
  );
}
