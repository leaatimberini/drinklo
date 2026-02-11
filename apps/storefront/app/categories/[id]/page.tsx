import { Metadata } from "next";
import CategoryClient from "./category-client";

type Product = { id: string; name: string; description?: string | null };

type Category = { id: string; name: string };

type ProductResponse = { items: Product[] };

async function fetchCategory(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/categories`, {
    next: { revalidate: 30 },
  });
  const data = (await res.json()) as { items: Category[] };
  return data.items.find((cat) => cat.id === id);
}

async function fetchProducts(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/products?categoryId=${id}&page=1&pageSize=24`,
    { next: { revalidate: 30 } },
  );
  return res.json() as Promise<ProductResponse>;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const category = await fetchCategory(params.id);
  return {
    title: category ? `${category.name} | Categorías` : "Categoría",
    description: category ? `Productos de ${category.name}` : "Categoría",
  };
}

export default async function CategoryDetail({ params }: { params: { id: string } }) {
  const category = await fetchCategory(params.id);
  const data = await fetchProducts(params.id);

  return <CategoryClient title={category?.name ?? "Categoría"} items={data.items} />;
}
