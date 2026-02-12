"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchCatalogJson } from "../lib/catalog-fetch";

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canSearch = useMemo(() => q.trim().length > 1, [q]);

  async function handleSearch() {
    if (!canSearch) return;
    setIsLoading(true);
    try {
      const data = await fetchCatalogJson<any>(`/catalog/products?q=${encodeURIComponent(q)}&page=1&pageSize=24`);
      setResults(data.items ?? []);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 32, marginBottom: 12, fontFamily: "var(--font-heading)" }}>Productos</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Buscar por nombre, SKU o barcode"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={handleSearch} disabled={!canSearch || isLoading}>
          {isLoading ? "Buscando..." : "Buscar"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {results.map((product) => (
          <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Link href={`/products/${product.id}`} style={{
              display: "block",
              padding: 16,
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              color: "inherit",
            }}>
              <strong>{product.name}</strong>
              <p style={{ marginTop: 8, color: "#666" }}>{product.description ?? "Sin descripción"}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
