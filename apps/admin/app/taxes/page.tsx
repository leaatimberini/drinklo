"use client";

import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const defaultRules = [
  {
    name: "IVA 21%",
    kind: "IVA",
    rate: 0.21,
    priceMode: "EXCLUDED",
    priority: 10,
    isActive: true,
  },
];

const defaultSimulation = {
  currency: "ARS",
  shippingCost: 500,
  discountTotal: 0,
  address: {
    country: "AR",
    state: "Buenos Aires",
    city: "CABA",
    postalCode: "1425",
  },
  items: [
    {
      name: "Producto demo",
      quantity: 2,
      unitPrice: 1500,
      categoryIds: [],
    },
  ],
};

export default function TaxesAdminPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: "Default",
    currency: "ARS",
    ivaDefaultMode: "EXCLUDED",
    roundingMode: "HALF_UP",
    roundingScope: "TOTAL",
    roundingIncrement: 0.01,
    enabled: true,
  });
  const [rulesJson, setRulesJson] = useState(JSON.stringify(defaultRules, null, 2));
  const [simulationJson, setSimulationJson] = useState(JSON.stringify(defaultSimulation, null, 2));
  const [simulationResult, setSimulationResult] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("admin_token", token);
    }
  }, [token]);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function loadAll() {
    setMessage(null);
    try {
      const [loadedProfile, loadedRules] = await Promise.all([
        api<any>("/admin/taxes/profile"),
        api<any[]>("/admin/taxes/rules"),
      ]);
      setProfile({
        name: loadedProfile.name ?? "Default",
        currency: loadedProfile.currency ?? "ARS",
        ivaDefaultMode: loadedProfile.ivaDefaultMode ?? "EXCLUDED",
        roundingMode: loadedProfile.roundingMode ?? "HALF_UP",
        roundingScope: loadedProfile.roundingScope ?? "TOTAL",
        roundingIncrement: Number(loadedProfile.roundingIncrement ?? 0.01),
        enabled: Boolean(loadedProfile.enabled ?? true),
      });
      setRulesJson(
        JSON.stringify(
          loadedRules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: Number(rule.rate),
            priceMode: rule.priceMode,
            priority: rule.priority,
            applyToShipping: rule.applyToShipping,
            isActive: rule.isActive,
            categoryId: rule.categoryId,
            productId: rule.productId,
            locationCountry: rule.locationCountry,
            locationState: rule.locationState,
            locationCity: rule.locationCity,
            postalCodePrefix: rule.postalCodePrefix,
            metadata: rule.metadata ?? undefined,
          })),
          null,
          2,
        ),
      );
      setMessage("Configuración cargada");
    } catch (error: any) {
      setMessage(`Error al cargar: ${error.message}`);
    }
  }

  async function saveProfile() {
    setMessage(null);
    try {
      await api("/admin/taxes/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...profile,
          roundingIncrement: Number(profile.roundingIncrement),
        }),
      });
      setMessage("Perfil fiscal guardado");
    } catch (error: any) {
      setMessage(`Error al guardar perfil: ${error.message}`);
    }
  }

  async function saveRules() {
    setMessage(null);
    try {
      const items = JSON.parse(rulesJson);
      await api("/admin/taxes/rules", {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
      setMessage("Reglas guardadas");
      await loadAll();
    } catch (error: any) {
      setMessage(`Error en reglas: ${error.message}`);
    }
  }

  async function runSimulation() {
    setMessage(null);
    try {
      const payload = JSON.parse(simulationJson);
      const result = await api<any>("/admin/taxes/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSimulationResult(JSON.stringify(result, null, 2));
      setMessage("Simulación OK");
    } catch (error: any) {
      setMessage(`Error en simulación: ${error.message}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Motor de impuestos</h1>
      <p style={{ margin: 0 }}>
        Perfil fiscal, reglas por producto/categoría/ubicación y simulador de cálculo auditable.
      </p>

      <label style={{ display: "grid", gap: 6 }}>
        Token JWT (admin/manager)
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" />
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={loadAll}>Cargar</button>
        <button onClick={saveProfile}>Guardar perfil</button>
        <button onClick={saveRules}>Guardar reglas</button>
        <button onClick={runSimulation}>Simular carrito</button>
      </div>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Perfil fiscal</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label>
            Nombre
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </label>
          <label>
            Moneda
            <input value={profile.currency} onChange={(e) => setProfile({ ...profile, currency: e.target.value })} />
          </label>
          <label>
            IVA default
            <select value={profile.ivaDefaultMode} onChange={(e) => setProfile({ ...profile, ivaDefaultMode: e.target.value })}>
              <option value="EXCLUDED">EXCLUDED</option>
              <option value="INCLUDED">INCLUDED</option>
            </select>
          </label>
          <label>
            Redondeo modo
            <select value={profile.roundingMode} onChange={(e) => setProfile({ ...profile, roundingMode: e.target.value })}>
              <option value="HALF_UP">HALF_UP</option>
              <option value="UP">UP</option>
              <option value="DOWN">DOWN</option>
            </select>
          </label>
          <label>
            Redondeo scope
            <select value={profile.roundingScope} onChange={(e) => setProfile({ ...profile, roundingScope: e.target.value })}>
              <option value="TOTAL">TOTAL</option>
              <option value="LINE">LINE</option>
            </select>
          </label>
          <label>
            Incremento
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={profile.roundingIncrement}
              onChange={(e) => setProfile({ ...profile, roundingIncrement: Number(e.target.value) })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={profile.enabled}
              onChange={(e) => setProfile({ ...profile, enabled: e.target.checked })}
            />
            Habilitado
          </label>
        </div>
      </section>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Reglas (JSON)</h2>
        <p style={{ marginTop: 0 }}>
          Cada regla admite filtros opcionales: <code>productId</code>, <code>categoryId</code>,{" "}
          <code>locationCountry/state/city/postalCodePrefix</code>, y <code>applyToShipping</code>.
        </p>
        <textarea
          rows={16}
          value={rulesJson}
          onChange={(e) => setRulesJson(e.target.value)}
          style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
      </section>

      <section style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Simulador (given cart -&gt; taxes)</h2>
        <textarea
          rows={14}
          value={simulationJson}
          onChange={(e) => setSimulationJson(e.target.value)}
          style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        />
        <h3>Resultado</h3>
        <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{simulationResult || "Ejecutá una simulación"}</pre>
      </section>

      {message ? <p>{message}</p> : null}
    </main>
  );
}

