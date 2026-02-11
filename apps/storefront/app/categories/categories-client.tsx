"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Category = { id: string; name: string };

export default function CategoriesClient({ items }: { items: Category[] }) {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16, fontFamily: "var(--font-heading)" }}>Categorías</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {items.map((cat) => (
          <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
    </main>
  );
}
