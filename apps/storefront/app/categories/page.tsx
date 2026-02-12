import { Metadata } from "next";
import CategoriesClient from "./categories-client";
import { fetchCatalogJson } from "../lib/catalog-fetch";

export const metadata: Metadata = {
  title: "Categorías",
  description: "Categorías del catálogo",
};

type Category = { id: string; name: string };

type CategoryResponse = { items: Category[] };

async function fetchCategories() {
  return fetchCatalogJson<CategoryResponse>("/catalog/categories", {
    next: { revalidate: 30 },
  });
}

export default async function CategoriesPage() {
  const data = await fetchCategories();

  return <CategoriesClient items={data.items} />;
}
