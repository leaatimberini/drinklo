"use client";

import { useEffect, useState } from "react";

type ComplianceSettings = {
  ageGateMode: string;
  termsUrl: string | null;
  privacyUrl: string | null;
  cookiesUrl: string | null;
  marketingConsentRequired: boolean;
  hasAlcoholicProducts: boolean;
};

export function AgeGate() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [settings, setSettings] = useState<ComplianceSettings | null>(null);
  const [allowed, setAllowed] = useState<boolean>(true);
  const [marketingOptIn, setMarketingOptIn] = useState<boolean>(false);

  useEffect(() => {
    fetch(`${apiUrl}/compliance/public`)
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch(() => setSettings(null));
  }, [apiUrl]);

  useEffect(() => {
    if (!settings) return;
    if (settings.ageGateMode === "DISABLED" || !settings.hasAlcoholicProducts) {
      setAllowed(true);
      return;
    }
    const stored = window.localStorage.getItem("age_gate_ok");
    setAllowed(stored === "true");
  }, [settings]);

  async function confirmAge() {
    window.localStorage.setItem("age_gate_ok", "true");
    document.cookie = "age_gate_ok=true; path=/; max-age=31536000";
    setAllowed(true);
    await fetch(`${apiUrl}/compliance/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "age_gate", accepted: true }),
    }).catch(() => undefined);

    if (settings?.marketingConsentRequired || marketingOptIn) {
      await fetch(`${apiUrl}/compliance/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "marketing", accepted: marketingOptIn }),
      }).catch(() => undefined);
    }
  }

  if (!settings || allowed) return null;

  const ageLabel = settings.ageGateMode === "21" ? "21" : "18";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--card-bg)",
          color: "var(--color-fg)",
          padding: 24,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--card-border)",
          maxWidth: 420,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Verificación de edad</h2>
        <p>Debes ser mayor de {ageLabel} años para ver productos alcohólicos.</p>

        {settings.marketingConsentRequired && (
          <label style={{ display: "block", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
            />{" "}
            Acepto recibir comunicaciones de marketing.
          </label>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={confirmAge}>Soy mayor</button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-muted)" }}>
          {settings.termsUrl && (
            <a href={settings.termsUrl} style={{ marginRight: 8 }}>
              Términos
            </a>
          )}
          {settings.privacyUrl && (
            <a href={settings.privacyUrl} style={{ marginRight: 8 }}>
              Privacidad
            </a>
          )}
          {settings.cookiesUrl && <a href={settings.cookiesUrl}>Cookies</a>}
        </div>
      </div>
    </div>
  );
}

