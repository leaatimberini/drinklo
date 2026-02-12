import type { MetadataRoute } from "next";
import { getCatalogApiBases } from "./lib/catalog-fetch";

type Product = { id: string; updatedAt?: string };
type Category = { id: string; updatedAt?: string };

async function fetchJsonWithFallback<T>(path: string): Promise<T | null> {
  const bases = getCatalogApiBases();
  for (const base of bases) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        next: { revalidate: 600 },
      });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3003";
  const [categories, products] = await Promise.all([
    fetchJsonWithFallback<{ items: Category[] }>("/catalog/categories"),
    fetchJsonWithFallback<{ items: Product[] }>("/catalog/products?page=1&pageSize=1000"),
  ]);

  const now = new Date();
  const urls: MetadataRoute.Sitemap = [
    { url: `${site}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${site}/products`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${site}/categories`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  for (const category of categories?.items ?? []) {
    urls.push({
      url: `${site}/categories/${category.id}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const product of products?.items ?? []) {
    urls.push({
      url: `${site}/products/${product.id}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: "hourly",
      priority: 0.8,
    });
  }

  return urls;
}
