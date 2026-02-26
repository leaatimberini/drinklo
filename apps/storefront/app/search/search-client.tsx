"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type SearchHit = {
  id: string;
  type: string;
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  stock?: number;
  productId?: string;
  variantId?: string;
  brand?: string;
  categoryNames?: string[];
};

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = query.trim();
      if (!term) {
        setHits([]);
        setSuggestions([]);
        setDidYouMean(null);
        return;
      }
      setLoading(true);
      fetch(`${apiUrl}/search?q=${encodeURIComponent(term)}&limit=12`)
        .then((res) => res.json())
        .then((data) => {
          setHits(data.hits ?? []);
          setSuggestions(data.suggestions ?? []);
          setDidYouMean(data.didYouMean ?? null);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const grouped = useMemo(() => {
    return hits.reduce(
      (acc, hit) => {
        const key = hit.type ?? "variant";
        acc[key] = acc[key] ?? [];
        acc[key].push(hit);
        return acc;
      },
      {} as Record<string, SearchHit[]>,
    );
  }, [hits]);

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 32, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Buscar</h1>
      <p style={{ marginBottom: 20 }}>Encontrá productos, categorías y marcas al instante.</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, SKU o barcode"
        style={{ maxWidth: 520 }}
      />

      {didYouMean && <p style={{ marginTop: 12 }}>¿Quisiste decir &quot;{didYouMean}&quot;?</p>}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {suggestions.map((sug) => (
            <button key={sug} onClick={() => setQuery(sug)}>
              {sug}
            </button>
          ))}
        </div>
      )}

      {loading && <p style={{ marginTop: 16 }}>Buscando...</p>}

      {!loading && hits.length === 0 && query.trim() && <p style={{ marginTop: 16 }}>Sin resultados.</p>}

      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        {Object.entries(grouped).map(([group, items]) => (
          <section key={group}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{group.toUpperCase()}</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {items.map((hit) => (
                <motion.div key={hit.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "var(--radius-md)",
                      padding: 12,
                    }}
                  >
                    <strong>{hit.name}</strong>
                    {hit.sku && <p style={{ marginTop: 4 }}>SKU: {hit.sku}</p>}
                    {hit.barcode && <p>Barcode: {hit.barcode}</p>}
                    {typeof hit.price === "number" && <p>Precio: ${hit.price}</p>}
                    {typeof hit.stock === "number" && <p>Stock: {hit.stock}</p>}
                    {hit.brand && <p>Marca: {hit.brand}</p>}
                    {hit.categoryNames && hit.categoryNames.length > 0 && (
                      <p style={{ color: "#666" }}>{hit.categoryNames.join(" · ")}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
