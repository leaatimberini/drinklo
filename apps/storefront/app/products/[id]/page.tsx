import { Metadata } from "next";
import { cookies } from "next/headers";
import ProductClient from "./product-client";
import { fetchCatalog } from "../../lib/catalog-fetch";

async function fetchProduct(id: string) {
  const res = await fetchCatalog(`/catalog/products/${id}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
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

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await fetchProduct(params.id);
  return {
    title: product?.name ?? "Producto",
    description: product?.description ?? "Detalle de producto",
  };
}

export default async function ProductDetail({ params }: { params: { id: string } }) {
  const abVariant = await fetchExperiment("PDP");
  return <ProductClient id={params.id} abVariant={abVariant} />;
}
