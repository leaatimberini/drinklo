"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Product = { id: string; name: string; description?: string | null };

export default function CategoryClient({
  title,
  items,
}: {
  title: string;
  items: Product[];
}) {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 32, marginBottom: 12, fontFamily: "var(--font-heading)" }}>{title}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {items.map((product) => (
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
              <p style={{ marginTop: 8, color: "var(--color-text-muted)" }}>{product.description ?? "Sin descripcion"}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
