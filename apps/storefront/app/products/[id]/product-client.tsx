"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../../cart/cart-context";
import { emitEvent } from "../../lib/events";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  variants?: { sku?: string }[];
};

export default function ProductClient({ id, abVariant }: { id: string; abVariant?: { id: string; name: string; payload: any } | null }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const eventToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;

  useEffect(() => {
    fetch(`${apiUrl}/catalog/products/${id}`)
      .then((res) => res.json())
      .then((data) => setProduct(data))
      .catch(() => setProduct(null));
  }, [apiUrl, id]);

  useEffect(() => {
    if (!product) return;
    emitEvent(
      apiUrl,
      "ProductViewed",
      {
        productId: product.id,
        name: product.name,
        sku: product.variants?.[0]?.sku ?? null,
      },
      { subjectId: product.id, token: eventToken },
    );
  }, [apiUrl, eventToken, product]);

  if (!product) {
    return <main style={{ padding: 32 }}>Cargando...</main>;
  }

  const variant = product.variants?.[0];

  async function trackAddToCart() {
    try {
      await fetch(`${apiUrl}/experiments/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "ADD_TO_CART", target: "PDP" }),
      });
    } catch {
      // ignore
    }
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 32, marginBottom: 8, fontFamily: "var(--font-heading)" }}>{product.name}</h1>
      <p style={{ marginBottom: 16 }}>{product.description ?? "Sin descripción"}</p>
      {abVariant?.payload?.badge && (
        <p style={{ marginBottom: 16, color: "#b45309" }}>{abVariant.payload.badge}</p>
      )}
      {variant && <p style={{ marginBottom: 16, color: "#666" }}>SKU: {variant.sku}</p>}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          addItem({
            id: product.id,
            name: product.name,
            sku: variant?.sku,
            quantity: 1,
          });
          setAdded(true);
          trackAddToCart();
          setTimeout(() => setAdded(false), 1200);
        }}
      >
        {added ? "Agregado" : "Agregar al carrito"}
      </motion.button>

      {added && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 12 }}>
          Se agregó al carrito.
        </motion.p>
      )}
    </main>
  );
}

