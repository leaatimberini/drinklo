"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../../cart/cart-context";
import { emitEvent } from "../../lib/events";
import { fetchCatalogJson } from "../../lib/catalog-fetch";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  variants?: { sku?: string }[];
};

type ExperimentVariant = {
  id: string;
  name: string;
  payload?: Record<string, unknown> | null;
};

type NearExpiryResponse = {
  error?: string;
  hasNearExpiry?: boolean;
  nextLotCode?: string | null;
  nextExpiryDate?: string | null;
};

type RotationHint = {
  lotId: string;
  lotCode?: string | null;
  suggestion?: string | null;
  productId: string;
};

function getStringField(obj: Record<string, unknown> | null | undefined, key: string) {
  const value = obj?.[key];
  return typeof value === "string" ? value : null;
}

export default function ProductClient({
  id,
  abVariant,
}: {
  id: string;
  abVariant?: ExperimentVariant | null;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [added, setAdded] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [nearExpiry, setNearExpiry] = useState<NearExpiryResponse | null>(null);
  const [rotationHints, setRotationHints] = useState<RotationHint[]>([]);
  const { addItem } = useCart();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const eventToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;

  useEffect(() => {
    fetchCatalogJson<Product>(`/catalog/products/${id}`)
      .then((data) => setProduct(data))
      .catch(() => setProduct(null));
  }, [id]);

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

  async function loadNearExpiry() {
    if (!product || !adminToken.trim()) return;
    const [productRes, rotationRes] = await Promise.all([
      fetch(`${apiUrl}/stock/lots/product/${product.id}`, {
        headers: { Authorization: `Bearer ${adminToken.trim()}` },
      }),
      fetch(`${apiUrl}/stock/lots/rotation?limit=50`, {
        headers: { Authorization: `Bearer ${adminToken.trim()}` },
      }),
    ]);
    if (!productRes.ok || !rotationRes.ok) {
      setNearExpiry({ error: "No autorizado o sin datos de lotes." });
      setRotationHints([]);
      return;
    }
    const [productData, rotationData] = await Promise.all([
      productRes.json() as Promise<NearExpiryResponse>,
      rotationRes.json() as Promise<unknown>,
    ]);
    setNearExpiry(productData);
    const rows = Array.isArray(rotationData) ? (rotationData as RotationHint[]) : [];
    setRotationHints(rows.filter((row) => row.productId === product.id).slice(0, 3));
  }

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
      <p style={{ marginBottom: 16 }}>{product.description ?? "Sin descripcion"}</p>
      {getStringField(abVariant?.payload ?? undefined, "badge") && (
        <p style={{ marginBottom: 16, color: "#92400e" }}>
          {getStringField(abVariant?.payload ?? undefined, "badge")}
        </p>
      )}
      {variant && <p style={{ marginBottom: 16, color: "var(--color-text-muted)" }}>SKU: {variant.sku}</p>}

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
          Se agrego al carrito.
        </motion.p>
      )}

      <section style={{ marginTop: 28, borderTop: "1px solid #e5e5e5", paddingTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Modo admin: proximos a vencer</h2>
        <p style={{ color: "var(--color-text-muted)" }}>Solo para usuarios admin con permiso de inventario.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <label htmlFor="admin-token" className="sr-only">JWT admin</label>
          <input
            id="admin-token"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="JWT admin"
            style={{ minWidth: 280 }}
          />
          <button type="button" onClick={loadNearExpiry}>
            Consultar
          </button>
        </div>
        {nearExpiry?.error && <p style={{ color: "crimson", marginTop: 8 }}>{nearExpiry.error}</p>}
        {nearExpiry && !nearExpiry.error && (
          <div style={{ marginTop: 10 }}>
            <p>
              {nearExpiry.hasNearExpiry
                ? `Lote proximo: ${nearExpiry.nextLotCode ?? "-"}`
                : "Sin lotes proximos a vencer"}
            </p>
            {nearExpiry.hasNearExpiry && (
              <p style={{ color: "#92400e" }}>
                Proximo a vencer: {new Date(nearExpiry.nextExpiryDate).toLocaleDateString()}
              </p>
            )}
            {rotationHints.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong>Sugerencias de rotacion</strong>
                <ul style={{ marginTop: 6 }}>
                  {rotationHints.map((hint) => (
                    <li key={hint.lotId}>
                      Lote {hint.lotCode}: {hint.suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
