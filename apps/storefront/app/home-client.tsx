"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Category = { id: string; name: string };

type Product = { id: string; name: string; description?: string | null; plugins?: Array<{ plugin: string; data: any }> };

type SlotBlock = { plugin: string; title: string; body: string };

export default function HomeClient({
  categories,
  products,
  slots,
  abVariant,
}: {
  categories: Category[];
  products: Product[];
  slots: SlotBlock[];
  abVariant?: { id: string; name: string; payload: any } | null;
}) {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 34, marginBottom: 8, fontFamily: "var(--font-heading)" }}>
        {abVariant?.payload?.headline ?? "Storefront"}
      </h1>
      <p style={{ marginBottom: 24 }}>Explorá categorías y productos.</p>

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
                  <p style={{ marginTop: 8, color: "#666" }}>{slot.body}</p>
                  <small style={{ color: "#999" }}>{slot.plugin}</small>
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
                <p style={{ marginTop: 8, color: "#666" }}>{product.description ?? "Sin descripción"}</p>
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
                          color: "#444",
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
