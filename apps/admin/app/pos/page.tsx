"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CatalogItem,
  OfflineSaleDraft,
  clearCatalog,
  deleteDraft,
  getCatalog,
  getDrafts,
  getMeta,
  saveCatalog,
  saveDraft,
  setMeta,
} from "../lib/offline-store";

type LineItem = {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

function formatEscPosReceipt(items: LineItem[], totals: { subtotal: number; discount: number; total: number }) {
  const ESC = "\x1b";
  const INIT = `${ESC}@`;
  const CENTER = `${ESC}a1`;
  const LEFT = `${ESC}a0`;
  const BOLD_ON = `${ESC}E1`;
  const BOLD_OFF = `${ESC}E0`;
  const CUT = `${ESC}i`;

  const lines = [
    INIT,
    CENTER,
    BOLD_ON,
    "ERP POS\n",
    BOLD_OFF,
    LEFT,
    ...items.map((i) => `${i.quantity} x ${i.name} (${i.sku}) ${i.unitPrice * i.quantity}\n`),
    "------------------------------\n",
    `Subtotal: ${totals.subtotal}\n`,
    `Descuento: ${totals.discount}\n`,
    BOLD_ON,
    `Total: ${totals.total}\n`,
    BOLD_OFF,
    "\nGracias\n",
    CUT,
  ];

  return lines.join("");
}

function formatEscPosKitchen(items: LineItem[]) {
  const ESC = "\x1b";
  const INIT = `${ESC}@`;
  const CENTER = `${ESC}a1`;
  const LEFT = `${ESC}a0`;
  const lines = [
    INIT,
    CENTER,
    "COMANDA\n",
    LEFT,
    ...items.map((i) => `${i.quantity} x ${i.name}\n`),
  ];

  return lines.join("");
}

function generateTxnId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `txn_${Math.random().toString(36).slice(2)}`;
}

export default function PosPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastCatalogSync, setLastCatalogSync] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), [items]);
  const total = Math.max(0, subtotal - discount);
  const change = Math.max(0, paidAmount - total);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("pos_token");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("pos_token", token);
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    async function loadOffline() {
      const [cachedCatalog, drafts, syncTime, catalogTime] = await Promise.all([
        getCatalog(),
        getDrafts(),
        getMeta<string>("lastSync"),
        getMeta<string>("lastCatalogSync"),
      ]);
      if (!mounted) return;
      setCatalog(cachedCatalog);
      setQueueCount(drafts.length);
      setLastSync(syncTime);
      setLastCatalogSync(catalogTime);
    }
    loadOffline();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (online && token) {
      refreshCatalog();
      syncQueuedSales();
    }
  }, [online, token]);

  async function refreshCatalog() {
    if (!online || !token) return;
    try {
      const res = await fetch(`${apiUrl}/sales/offline/catalog`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      await clearCatalog();
      await saveCatalog(data.items);
      await setMeta("lastCatalogSync", data.generatedAt);
      setCatalog(data.items);
      setLastCatalogSync(data.generatedAt);
    } catch {
      // stay with cached catalog
    }
  }

  function search(term: string) {
    if (!term.trim()) return;
    const lower = term.trim().toLowerCase();
    const filtered = catalog
      .filter((item) =>
        item.name.toLowerCase().includes(lower) ||
        item.sku.toLowerCase().includes(lower) ||
        (item.barcode ?? "").toLowerCase().includes(lower),
      )
      .slice(0, 20);
    setResults(filtered);
  }

  function addProduct(item: CatalogItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) => (i.variantId === item.variantId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: `${item.productId}-${item.variantId}`,
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          sku: item.sku,
          quantity: 1,
          unitPrice: item.price,
        },
      ];
    });
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  async function queueSale(draft: OfflineSaleDraft) {
    await saveDraft(draft);
    const drafts = await getDrafts();
    setQueueCount(drafts.length);
    setMessage("Venta guardada en cola offline");
  }

  async function handleSubmitSale() {
    setMessage(null);
    const clientTxnId = generateTxnId();
    const payload = {
      clientTxnId,
      items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      discount,
      paymentMethod,
      paidAmount: paidAmount || total,
    };

    if (!online || !token) {
      await queueSale({ ...payload, localCreatedAt: new Date().toISOString() });
      setItems([]);
      setDiscount(0);
      setPaidAmount(0);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        await queueSale({ ...payload, localCreatedAt: new Date().toISOString() });
        return;
      }
      const data = await res.json();
      setMessage(`Venta creada: ${data.id}`);
      setItems([]);
      setDiscount(0);
      setPaidAmount(0);
    } catch {
      await queueSale({ ...payload, localCreatedAt: new Date().toISOString() });
    }
  }

  async function syncQueuedSales() {
    if (!online || !token || syncing) return;
    const drafts = await getDrafts();
    if (drafts.length === 0) {
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch(`${apiUrl}/sales/offline/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ drafts }),
      });
      if (!res.ok) {
        setMessage("No se pudo sincronizar la cola");
        return;
      }
      const data = await res.json();
      for (const entry of data.created ?? []) {
        await deleteDraft(entry.clientTxnId);
      }
      const remaining = await getDrafts();
      setQueueCount(remaining.length);
      const syncTime = new Date().toISOString();
      await setMeta("lastSync", syncTime);
      setLastSync(syncTime);
      if ((data.failed ?? []).length > 0) {
        setMessage(`Sincronizado con ${data.failed.length} pendientes`);
      }
    } catch {
      setMessage("No se pudo sincronizar la cola");
    } finally {
      setSyncing(false);
    }
  }

  function previewReceipt() {
    return formatEscPosReceipt(items, { subtotal, discount, total });
  }

  function previewKitchen() {
    return formatEscPosKitchen(items);
  }

  function sendToPrintAgent(type: "receipt" | "kitchen") {
    const ws = new WebSocket("ws://localhost:4161");
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type,
          content: type === "receipt" ? previewReceipt() : previewKitchen(),
        }),
      );
      ws.close();
    };
  }

  return (
    <main style={{ padding: 32, display: "grid", gap: 24, gridTemplateColumns: "1.2fr 1fr" }}>
      <section>
        <h1 style={{ fontSize: 32, fontFamily: "var(--font-heading)" }}>POS</h1>
        <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: online ? "#16a34a" : "#dc2626",
              color: "#fff",
              fontSize: 12,
            }}
          >
            {online ? "ONLINE" : "OFFLINE"}
          </span>
          <span style={{ fontSize: 12 }}>Cola: {queueCount}</span>
          <button onClick={syncQueuedSales} disabled={!online || !token || syncing}>
            {syncing ? "Sincronizando..." : "Sync ahora"}
          </button>
          <button onClick={refreshCatalog} disabled={!online || !token}>
            Actualizar catálogo
          </button>
        </div>
        <div style={{ display: "grid", gap: 6, marginTop: 8, fontSize: 12 }}>
          <span>Último sync: {lastSync ?? "-"}</span>
          <span>Catálogo: {lastCatalogSync ?? "-"}</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12 }}>Bearer token</label>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
        </div>

        <input
          ref={inputRef}
          placeholder="Escanear o buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              search(query);
            }
          }}
          style={{ marginTop: 12 }}
        />

        {results.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {results.map((product) => (
              <button key={product.variantId} onClick={() => addProduct(product)}>
                {product.name} ({product.sku}) - ${product.price}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 8 }}>Items</h2>
          {items.length === 0 ? (
            <p>Sin items</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 12,
                    border: "1px solid var(--card-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--card-bg)",
                  }}
                >
                  <strong>{item.name}</strong>
                  <p>SKU: {item.sku}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, quantity: Number(e.target.value) } : i)),
                        )
                      }
                    />
                    <button onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 8 }}>Totales</h2>
        <p>Subtotal: {subtotal}</p>
        <label>
          Descuento
          <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </label>
        <p>Total: {total}</p>

        <label>
          Medio de pago
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as unknown)}>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
          </select>
        </label>

        <label>
          Pagado
          <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
        </label>
        <p>Cambio: {change}</p>

        <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmitSale} disabled={items.length === 0}>
          Confirmar venta
        </motion.button>

        {message && <p style={{ marginTop: 8 }}>{message}</p>}

        <div style={{ marginTop: 20 }}>
          <h3>Print Preview</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#111",
              color: "#e5e5e5",
              padding: 12,
              borderRadius: 8,
              minHeight: 160,
            }}
          >
            {previewReceipt()}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => sendToPrintAgent("receipt")}>Send Receipt</button>
            <button onClick={() => sendToPrintAgent("kitchen")}>Send Kitchen</button>
          </div>
        </div>
      </section>
    </main>
  );
}
