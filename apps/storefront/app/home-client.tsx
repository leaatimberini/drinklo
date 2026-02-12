"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type Category = { id: string; name: string };

type Product = { id: string; name: string; description?: string | null; plugins?: Array<{ plugin: string; data: any }> };

type SlotBlock = { plugin: string; title: string; body: string };

type RecommendationItem = {
  productId: string;
  name: string;
  sku?: string | null;
  price: number;
  stock: number;
  reason: string;
};

type Recommendations = {
  reorder?: { items: RecommendationItem[] };
  cross?: { items: RecommendationItem[] };
  upsell?: { items: RecommendationItem[] };
};

export default function HomeClient({
  categories,
  products,
  slots,
  recommendations,
  abVariant,
}: {
  categories: Category[];
  products: Product[];
  slots: SlotBlock[];
  recommendations?: Recommendations;
  abVariant?: { id: string; name: string; payload: any } | null;
}) {
  const [optOut, setOptOut] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const match = document.cookie.match(/reco_opt_out=([^;]+)/);
    if (match?.[1] === "true") {
      setOptOut(true);
    }
  }, []);

  function handleOptOut() {
    document.cookie = "reco_opt_out=true; path=/; max-age=31536000";
    setOptOut(true);
  }

  function renderBlock(title: string, items?: RecommendationItem[]) {
    if (optOut) return null;
    if (!items || items.length === 0) return null;
    return (
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20 }}>{title}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
          {items.map((item) => (
            <motion.div key={item.productId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Link
                href={`/products/${item.productId}`}
                style={{
                  display: "block",
                  padding: 16,
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong>{item.name}</strong>
                {item.sku && <p style={{ marginTop: 6 }}>SKU: {item.sku}</p>}
                <p style={{ marginTop: 6 }}>Precio: ${item.price}</p>
                <small style={{ color: "var(--color-text-muted)" }}>{item.reason}</small>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 34, marginBottom: 8, fontFamily: "var(--font-heading)" }}>
        {abVariant?.payload?.headline ?? "Storefront"}
      </h1>
      <p style={{ marginBottom: 12 }}>Explorá categorías y productos.</p>
      <Link
        href="/search"
        style={{
          display: "inline-block",
          marginBottom: 24,
          padding: "8px 14px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--card-border)",
          background: "var(--button-bg)",
          color: "var(--button-text)",
          textDecoration: "none",
        }}
      >
        Buscar productos
      </Link>

      {slots.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20 }}>Novedades</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
            {slots.map((slot, index) => (
              <motion.div key={`${slot.plugin}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div
                  style={{
                    display: "block",
                    padding: 16,
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <strong>{slot.title}</strong>
                  <p style={{ marginTop: 8, color: "var(--color-text-muted)" }}>{slot.body}</p>
                  <small style={{ color: "var(--color-text-subtle)" }}>{slot.plugin}</small>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20 }}>Categorías</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
          {categories.map((cat) => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Link
                href={`/categories/${cat.id}`}
                style={{
                  display: "block",
                  padding: 16,
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {cat.name}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {recommendations && !optOut && (
        <div style={{ marginBottom: 24 }}>
          <button aria-label="Ocultar recomendaciones personalizadas" onClick={handleOptOut}>Ocultar recomendaciones</button>
        </div>
      )}

      {renderBlock("Recomendado para vos", recommendations?.reorder?.items)}
      {renderBlock("Combiná con", recommendations?.cross?.items)}
      {renderBlock("Upsell sugerido", recommendations?.upsell?.items)}

      <section>
        <h2 style={{ fontSize: 20 }}>Productos destacados</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
          {products.map((product) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Link
                href={`/products/${product.id}`}
                style={{
                  display: "block",
                  padding: 16,
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong>{product.name}</strong>
                <p style={{ marginTop: 8, color: "var(--color-text-muted)" }}>{product.description ?? "Sin descripción"}</p>
                {product.plugins && product.plugins.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {product.plugins.map((pluginItem, index) => (
                      <span
                        key={`${product.id}-plugin-${index}`}
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid var(--card-border)",
                          color: "var(--color-text-subtle)",
                        }}
                      >
                        {pluginItem.data?.label ?? pluginItem.plugin}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
