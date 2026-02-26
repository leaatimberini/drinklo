"use client";

import { useEffect, useMemo, useState } from "react";

type SetupStatus = { initialized: boolean };

type SetupPayload = {
  companyName: string;
  brandName: string;
  domain: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

type ThemeTemplate = { id: "A" | "B" | "C"; name: string };

const steps = ["Empresa", "Admin", "Confirmaci�n"] as const;

type Step = (typeof steps)[number];

type ThemeResponse = {
  admin: { id?: string };
  storefront: { id?: string };
  templates: ThemeTemplate[];
};

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<SetupPayload>({
    companyName: "",
    brandName: "",
    domain: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [token, setToken] = useState("");
  const [themeData, setThemeData] = useState<ThemeResponse | null>(null);
  const [adminTheme, setAdminTheme] = useState<"A" | "B" | "C">("A");
  const [storefrontTheme, setStorefrontTheme] = useState<"A" | "B" | "C">("A");
  const [themeMsg, setThemeMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/setup/status`)
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ initialized: false }));
  }, [apiUrl]);

  useEffect(() => {
    if (status?.initialized) {
      fetch(`${apiUrl}/themes/public`)
        .then((res) => res.json())
        .then((data: ThemeResponse) => {
          setThemeData(data);
          if (data.admin?.id) {
            setAdminTheme(data.admin.id as "A" | "B" | "C");
          }
          if (data.storefront?.id) {
            setStorefrontTheme(data.storefront.id as "A" | "B" | "C");
          }
        })
        .catch(() => undefined);
    }
  }, [apiUrl, status?.initialized]);

  const step: Step = steps[stepIndex];

  const canContinue = useMemo(() => {
    if (step === "Empresa") {
      return form.companyName && form.brandName && form.domain;
    }
    if (step === "Admin") {
      return form.adminName && form.adminEmail && form.adminPassword.length >= 6;
    }
    return true;
  }, [form, step]);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/setup/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message ?? "Setup failed");
      }
      setSuccess(true);
      setStatus({ initialized: true });
    } catch (err: unknown) {
      setError(err.message ?? "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleThemeUpdate() {
    setThemeMsg(null);
    try {
      const res = await fetch(`${apiUrl}/themes`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adminTheme, storefrontTheme }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message ?? "Update failed");
      }
      setThemeMsg("Theme actualizado.");
    } catch (err: unknown) {
      setThemeMsg(err.message ?? "Error al actualizar.");
    }
  }

  if (!status) {
    return <main style={{ padding: 32 }}>Cargando...</main>;
  }

  if (status.initialized) {
    return (
      <main style={{ padding: 32, maxWidth: 720 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8, fontFamily: "var(--font-heading)" }}>Admin</h1>
        <p>La instancia ya fue inicializada.</p>

        <section style={{ marginTop: 24, padding: 16, borderRadius: "var(--radius-md)", background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <h2 style={{ marginTop: 0 }}>Selector de themes</h2>
          <p style={{ color: "#555" }}>Requiere rol con permiso `settings:write`.</p>

          <label style={{ display: "block", marginBottom: 12 }}>
            Token JWT
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token"
              style={{ marginTop: 6 }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Theme Admin
              <select value={adminTheme} onChange={(e) => setAdminTheme(e.target.value as unknown)}>
                {(themeData?.templates ?? []).map((theme) => (
                  <option key={`admin-${theme.id}`} value={theme.id}>
                    {theme.id} - {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Theme Storefront
              <select value={storefrontTheme} onChange={(e) => setStorefrontTheme(e.target.value as unknown)}>
                {(themeData?.templates ?? []).map((theme) => (
                  <option key={`store-${theme.id}`} value={theme.id}>
                    {theme.id} - {theme.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button style={{ marginTop: 16 }} onClick={handleThemeUpdate}>Guardar</button>
          {themeMsg && <p style={{ marginTop: 12 }}>{themeMsg}</p>}
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui", maxWidth: 520 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Configuraci�n inicial</h1>
      <p style={{ color: "#555" }}>
        Paso {stepIndex + 1} de {steps.length}: {step}
      </p>

      {step === "Empresa" && (
        <section style={{ marginTop: 24 }}>
          <label style={{ display: "block", marginBottom: 12 }}>
            Nombre de empresa
            <input
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Nombre de marca
            <input
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Dominio
            <input
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              placeholder="erp.tudominio.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </label>
        </section>
      )}

      {step === "Admin" && (
        <section style={{ marginTop: 24 }}>
          <label style={{ display: "block", marginBottom: 12 }}>
            Nombre
            <input
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Email
            <input
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            Password
            <input
              type="password"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 6 }}
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            />
          </label>
        </section>
      )}

      {step === "Confirmaci�n" && (
        <section style={{ marginTop: 24, background: "#f6f6f6", padding: 16, borderRadius: 8 }}>
          <p>
            <strong>Empresa:</strong> {form.companyName}
          </p>
          <p>
            <strong>Marca:</strong> {form.brandName}
          </p>
          <p>
            <strong>Dominio:</strong> {form.domain}
          </p>
          <p>
            <strong>Admin:</strong> {form.adminName} ({form.adminEmail})
          </p>
          <p>
            <strong>Timezone:</strong> America/Argentina/Buenos_Aires
          </p>
          <p>
            <strong>Moneda:</strong> ARS
          </p>
        </section>
      )}

      {error && <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>}
      {success && <p style={{ color: "green", marginTop: 16 }}>Setup completado.</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <button
          type="button"
          onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
          disabled={stepIndex === 0 || isSubmitting}
        >
          Atr�s
        </button>
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            disabled={!canContinue || isSubmitting}
            onClick={() => setStepIndex((prev) => prev + 1)}
          >
            Continuar
          </button>
        ) : (
          <button type="button" disabled={!canContinue || isSubmitting} onClick={handleSubmit}>
            Finalizar
          </button>
        )}
      </div>
    </main>
  );
}
