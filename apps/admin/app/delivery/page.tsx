"use client";

import { useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type DeliveryWindow = { id: string; name: string; startTime: string; endTime: string };

type DeliveryStop = {
  id: string;
  sequence: number;
  status: string;
  distanceKm?: number;
  etaMinutes?: number;
  order: {
    id: string;
    customerName: string;
    customerEmail?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
};

type DeliveryRoute = {
  id: string;
  date: string;
  driverName?: string | null;
  window?: DeliveryWindow | null;
  stops: DeliveryStop[];
};

export default function DeliveryPage() {
  const [token, setToken] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [windowId, setWindowId] = useState<string>("");
  const [driverName, setDriverName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("admin_token", token);
      loadWindows();
      loadRoutes();
    }
  }, [token]);

  async function loadWindows() {
    const res = await fetch(`${apiUrl}/admin/delivery/windows`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setWindows(data);
  }

  async function loadRoutes() {
    const res = await fetch(`${apiUrl}/admin/delivery/routes?date=${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setRoutes(data);
  }

  async function generateRoute() {
    setMessage(null);
    const res = await fetch(`${apiUrl}/admin/delivery/routes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, windowId: windowId || undefined, driverName: driverName || undefined }),
    });
    if (!res.ok) {
      setMessage("No se pudo generar ruta");
      return;
    }
    await loadRoutes();
  }

  async function updateStop(stopId: string, status: string) {
    await fetch(`${apiUrl}/admin/delivery/stops/${stopId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    await loadRoutes();
  }

  function buildMapsLink(route: DeliveryRoute) {
    const base = "https://www.google.com/maps/dir/";
    const addresses = route.stops
      .map((stop) => {
        const order = stop.order;
        return [order.addressLine1, order.city, order.state, order.postalCode, order.country]
          .filter(Boolean)
          .join(", ");
      })
      .filter(Boolean);
    return base + addresses.map(encodeURIComponent).join("/");
  }

  const totalStops = useMemo(() => routes.reduce((sum, r) => sum + r.stops.length, 0), [routes]);

  return (
    <main style={{ padding: 32, display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28 }}>Delivery Routing</h1>

      <label>
        Token
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Ventana
          <select value={windowId} onChange={(e) => setWindowId(e.target.value)}>
            <option value="">Todas</option>
            {windows.map((win) => (
              <option key={win.id} value={win.id}>
                {win.name} ({win.startTime}-{win.endTime})
              </option>
            ))}
          </select>
        </label>
        <label>
          Repartidor
          <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Nombre" />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={loadRoutes}>Cargar rutas</button>
        <button onClick={generateRoute}>Generar ruta</button>
      </div>

      {message && <p>{message}</p>}

      <p>Rutas: {routes.length} · Paradas: {totalStops}</p>

      {routes.map((route) => (
        <section key={route.id} style={{ border: "1px solid var(--card-border)", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginBottom: 8 }}>Ruta {route.id.slice(0, 6)} · {route.driverName ?? "Sin asignar"}</h2>
          <p style={{ color: "#666" }}>
            {route.window ? `${route.window.name} (${route.window.startTime}-${route.window.endTime})` : "Sin ventana"}
          </p>
          <a href={buildMapsLink(route)} target="_blank" rel="noreferrer">
            Exportar a Google Maps
          </a>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {route.stops.map((stop) => (
              <div key={stop.id} style={{ padding: 12, border: "1px solid var(--card-border)", borderRadius: 10 }}>
                <strong>#{stop.sequence} · {stop.order.customerName}</strong>
                <p>{[stop.order.addressLine1, stop.order.city].filter(Boolean).join(", ")}</p>
                <p>Estado: {stop.status}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => updateStop(stop.id, "EN_ROUTE")}>En camino</button>
                  <button onClick={() => updateStop(stop.id, "DELIVERED")}>Entregado</button>
                  <button onClick={() => updateStop(stop.id, "FAILED")}>Falló</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
