"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../cart/cart-context";
import { emitEvent } from "../lib/events";

type ShippingOption = { id: string; label: string; price: number; etaDays?: number };

type QuoteResponse = {
  mode: "PICKUP" | "DELIVERY";
  provider?: "ANDREANI" | "OWN";
  options: ShippingOption[];
};

export default function CheckoutPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const eventToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;
  const { items } = useCart();
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [provider, setProvider] = useState<"ANDREANI" | "OWN">("OWN");
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Argentina",
  });
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [option, setOption] = useState<ShippingOption | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  const canQuote = useMemo(() => {
    if (items.length === 0) return false;
    if (mode === "PICKUP") return true;
    return address.line1 && address.city && address.postalCode;
  }, [items.length, mode, address]);

  useEffect(() => {
    emitEvent(apiUrl, "CheckoutStarted", { itemsCount: items.length }, { token: eventToken });
  }, [apiUrl, eventToken, items.length]);

  async function handleQuote() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/checkout/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shippingMode: mode,
        shippingProvider: mode === "DELIVERY" ? provider : undefined,
        address: mode === "DELIVERY" ? address : undefined,
        items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
      }),
    });
    if (!res.ok) {
      setMessage("No se pudo cotizar.");
      return;
    }
    const data = (await res.json()) as QuoteResponse;
    setQuote(data);
    setOption(data.options[0] ?? null);
  }

  async function handleOrder() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/checkout/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        customerName: "Cliente",
        customerEmail: "cliente@demo.local",
        shippingMode: mode,
        shippingProvider: mode === "DELIVERY" ? provider : undefined,
        address: mode === "DELIVERY" ? address : undefined,
        shippingOptionId: option?.id,
        couponCode: couponCode || undefined,
        giftCardCode: giftCardCode || undefined,
        loyaltyPointsToUse: loyaltyPoints || undefined,
        items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
      }),
    });
    if (!res.ok) {
      setMessage("No se pudo crear la orden.");
      return;
    }
    const data = await res.json();
    setOrderId(data.id);
    setMessage(`Orden creada: ${data.id}`);

    try {
      await fetch(`${apiUrl}/experiments/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "CONVERSION", target: "CHECKOUT", orderId: data.id }),
      });
    } catch {
      // ignore
    }
  }

  async function handleCheckoutPro() {
    if (!orderId) {
      await handleOrder();
    }
    const finalOrderId = orderId ?? undefined;
    if (!finalOrderId) return;

    const res = await fetch(`${apiUrl}/payments/mercadopago/preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: finalOrderId }),
    });
    if (!res.ok) {
      setMessage("No se pudo crear preferencia.");
      return;
    }
    const data = await res.json();
    if (data.initPoint) {
      window.location.href = data.initPoint;
    }
  }

  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: 32, marginBottom: 12, fontFamily: "var(--font-heading)" }}>Checkout</h1>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Modo</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <label>
            <input type="radio" checked={mode === "PICKUP"} onChange={() => setMode("PICKUP")} />
            Retiro por local
          </label>
          <label>
            <input type="radio" checked={mode === "DELIVERY"} onChange={() => setMode("DELIVERY")} />
            Envio
          </label>
        </div>
      </section>

      {mode === "DELIVERY" && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Proveedor</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <label>
              <input type="radio" checked={provider === "ANDREANI"} onChange={() => setProvider("ANDREANI")} />
              Andreani
            </label>
            <label>
              <input type="radio" checked={provider === "OWN"} onChange={() => setProvider("OWN")} />
              Reparto propio
            </label>
          </div>
        </section>
      )}

      {mode === "DELIVERY" && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Direccion</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="address-line1">
              Direccion
              <input id="address-line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
            </label>
            <label htmlFor="address-city">
              Ciudad
              <input id="address-city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </label>
            <label htmlFor="address-state">
              Provincia
              <input id="address-state" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
            </label>
            <label htmlFor="address-postal">
              Codigo postal
              <input id="address-postal" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
            </label>
            <label htmlFor="address-country">
              Pais
              <input id="address-country" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} />
            </label>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Promos</h2>
        <div style={{ display: "grid", gap: 8 }}>
          <label htmlFor="coupon-code">
            Cupon
            <input id="coupon-code" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
          </label>
          <label htmlFor="gift-card-code">
            Gift card
            <input id="gift-card-code" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} />
          </label>
          <label htmlFor="loyalty-points">
            Puntos a canjear
            <input id="loyalty-points" type="number" value={loyaltyPoints} onChange={(e) => setLoyaltyPoints(Number(e.target.value))} />
          </label>
        </div>
      </section>

      <motion.button whileTap={{ scale: 0.98 }} onClick={handleQuote} disabled={!canQuote}>
        Cotizar envio
      </motion.button>

      {quote && (
        <section style={{ marginTop: 20 }}>
          <h3>Opciones</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {quote.options.map((opt) => (
              <label key={opt.id} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: "var(--radius-sm)" }}>
                <input type="radio" checked={option?.id === opt.id} onChange={() => setOption(opt)} />
                {opt.label} - ${opt.price}
              </label>
            ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <button onClick={handleOrder} disabled={!option && mode === "DELIVERY"}>
          Crear orden
        </button>
        <button onClick={handleCheckoutPro} disabled={!option && mode === "DELIVERY"}>
          Checkout Pro
        </button>
      </div>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </main>
  );
}
