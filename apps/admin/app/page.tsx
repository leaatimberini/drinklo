"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";

type ThemeTemplate = { id: "A" | "B" | "C"; name: string };

type ThemeResponse = {
  admin: { id?: string };
  storefront: { id?: string };
  templates: ThemeTemplate[];
};

export default function HomePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const { user, token, logout, hasPermission } = useAuth();
  const [themeData, setThemeData] = useState<ThemeResponse | null>(null);
  const [adminTheme, setAdminTheme] = useState<"A" | "B" | "C">("A");
  const [storefrontTheme, setStorefrontTheme] = useState<"A" | "B" | "C">("A");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
      .catch(() => setThemeData({ admin: {}, storefront: {}, templates: [] }));
  }, [apiUrl]);

  async function handleThemeSave() {
    if (!token) {
      setMessage("No active session.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiUrl}/settings/themes`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adminTheme,
          storefrontTheme,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "Unable to update themes");
      }

      setMessage("Themes updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  const canWriteSettings = hasPermission("settings:write");

  return (
    <main style={{ padding: 32, maxWidth: 860 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32, marginBottom: 8 }}>Admin backoffice</h1>
          <p style={{ margin: 0, color: "var(--color-text-subtle)" }}>
            Signed in as {user?.email ?? "-"} ({user?.role ?? "-"})
          </p>
        </div>
        <button type="button" onClick={() => void logout()}>
          Logout
        </button>
      </header>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--card-border)",
          background: "var(--card-bg)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Theme settings</h2>
        <p style={{ color: "var(--color-text-subtle)" }}>
          Permission required: <code>settings:write</code>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Admin theme
            <select
              value={adminTheme}
              onChange={(event) => setAdminTheme(event.target.value as "A" | "B" | "C")}
              disabled={!canWriteSettings || saving}
            >
              {(themeData?.templates ?? []).map((theme) => (
                <option key={`admin-${theme.id}`} value={theme.id}>
                  {theme.id} - {theme.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Storefront theme
            <select
              value={storefrontTheme}
              onChange={(event) => setStorefrontTheme(event.target.value as "A" | "B" | "C")}
              disabled={!canWriteSettings || saving}
            >
              {(themeData?.templates ?? []).map((theme) => (
                <option key={`storefront-${theme.id}`} value={theme.id}>
                  {theme.id} - {theme.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          style={{ marginTop: 16 }}
          disabled={!canWriteSettings || saving}
          onClick={handleThemeSave}
          title={!canWriteSettings ? "You do not have settings:write permission." : undefined}
        >
          Save themes
        </button>

        {!canWriteSettings ? (
          <p style={{ color: "#b45309", marginTop: 8 }}>
            Read-only mode: your role cannot change settings.
          </p>
        ) : null}

        {message ? <p style={{ marginTop: 8 }}>{message}</p> : null}
      </section>
    </main>
  );
}
