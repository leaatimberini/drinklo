"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { emitEvent } from "../lib/events";

export type CartItem = {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateItem: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "erp.cart";
const TOKEN_KEY = "erp.token";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const eventToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setItems(JSON.parse(raw));
      } catch {
        setItems([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/cart/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    }).catch(() => undefined);
  }, [items]);

  useEffect(() => {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    emitEvent(
      apiUrl,
      "CartUpdated",
      { itemsCount: items.length, totalQty },
      { token: eventToken },
    );
  }, [apiUrl, eventToken, items]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY && event.newValue) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/catalog/cart/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${event.newValue}`,
          },
          body: JSON.stringify({ items }),
        }).catch(() => undefined);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem: (item) => {
        setItems((prev) => {
          const existing = prev.find((i) => i.id === item.id);
          if (existing) {
            return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i));
          }
          return [...prev, item];
        });
      },
      updateItem: (id, quantity) => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
      },
      removeItem: (id) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      },
      clear: () => setItems([]),
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
