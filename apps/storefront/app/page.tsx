import { Metadata } from "next";
import { cookies } from "next/headers";
import HomeClient from "./home-client";

export const metadata: Metadata = {
  title: "Storefront",
  description: "ERP storefront",
};

type Category = { id: string; name: string };

type Product = { id: string; name: string; description?: string | null; plugins?: any[] };

type CatalogResponse = { items: Product[] };

type SlotBlock = { plugin: string; title: string; body: string };

async function fetchCategories() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/categories`, {
    next: { revalidate: 30 },
  });
  return res.json() as Promise<{ items: Category[] }>;
}

async function fetchProducts() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/products?page=1&pageSize=6`, {
    next: { revalidate: 30 },
  });
  return res.json() as Promise<CatalogResponse>;
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

export default async function Page() {
  const categories = await fetchCategories();
  const products = await fetchProducts();
  const slots = await fetchSlots();
  const abVariant = await fetchExperiment("HOME");

  return <HomeClient categories={categories.items} products={products.items} slots={slots} abVariant={abVariant} />;
}
