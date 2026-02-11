import { Metadata } from "next";
import CategoriesClient from "./categories-client";

export const metadata: Metadata = {
  title: "Categorías",
  description: "Categorías del catálogo",
};

type Category = { id: string; name: string };

type CategoryResponse = { items: Category[] };

async function fetchCategories() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/categories`, {
    next: { revalidate: 30 },
  });
  return res.json() as Promise<CategoryResponse>;
}

export default async function CategoriesPage() {
  const data = await fetchCategories();

  return <CategoriesClient items={data.items} />;
}
