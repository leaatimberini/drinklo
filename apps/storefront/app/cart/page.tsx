"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

export default function CartPage() {
  const { items, updateItem, removeItem, clear } = useCart();

  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: 32, marginBottom: 12, fontFamily: "var(--font-heading)" }}>Carrito</h1>
      {items.length === 0 ? (
        <p>No hay items.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 16,
                border: "1px solid var(--card-border)",
                borderRadius: "var(--radius-md)",
                background: "var(--card-bg)",
              }}
            >
              <strong>{item.name}</strong>
              {item.sku && <p style={{ marginTop: 4 }}>SKU: {item.sku}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  type="number"
                  min={1}
                  aria-label={`Cantidad para ${item.name}`}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, Number(e.target.value))}
                />
                <button onClick={() => removeItem(item.id)}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button onClick={clear} disabled={items.length === 0}>
          Vaciar
        </button>
        <Link
          href={items.length === 0 ? "#" : "/checkout"}
          aria-disabled={items.length === 0}
          tabIndex={items.length === 0 ? -1 : 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--card-border)",
            background: "var(--button-bg)",
            color: "var(--button-text)",
            textDecoration: "none",
            pointerEvents: items.length === 0 ? "none" : "auto",
            opacity: items.length === 0 ? 0.5 : 1,
          }}
        >
          Ir a checkout
        </Link>
      </div>
    </main>
  );
}
