"use client";

import { useEffect, useMemo, useState } from "react";

type CaseStudy = {
  id: string;
  installationId: string;
  instanceId: string;
  slug: string;
  title: string;
  summary: string;
  status: "DRAFT" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
  locale: string;
  icp?: string | null;
  tags: string[];
  stack: string[];
  timeframeDays?: number | null;
  content: any;
  metrics?: any;
  approvedAt?: string | null;
  publishedAt?: string | null;
  installation?: { clientName?: string | null; domain?: string | null; instanceId?: string | null };
  updatedAt: string;
};

export default function CaseStudiesPage() {
  const [token, setToken] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [items, setItems] = useState<CaseStudy[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  async function api(path: string, init?: RequestInit) {
    return fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        "x-cp-admin-token": token,
      },
    });
  }

  async function loadList() {
    setLoading(true);
    const res = await api("/api/case-studies");
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage((payload as any).error ?? "No se pudo cargar");
      return;
    }
    const nextItems = (payload as any).items ?? [];
    setItems(nextItems);
    if (!selectedId && nextItems[0]?.id) {
      setSelectedId(nextItems[0].id);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadList();
  }, [token]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({
      title: selected.title,
      summary: selected.summary,
      locale: selected.locale,
      timeframeDays: selected.timeframeDays ?? "",
      tags: (selected.tags ?? []).join(", "),
      stack: (selected.stack ?? []).join(", "),
      content: JSON.stringify(selected.content ?? {}, null, 2),
    });
  }, [selected]);

  async function generateDraft() {
    if (!installationId.trim()) {
      setMessage("Ingresá installationId.");
      return;
    }
    setLoading(true);
    const res = await api("/api/case-studies", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cp-admin-token": token },
      body: JSON.stringify({ action: "generate", installationId: installationId.trim(), locale: "es" }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage((payload as any).error ?? "No se pudo generar borrador");
      return;
    }
    setMessage("Borrador generado.");
    await loadList();
    if ((payload as any).item?.id) setSelectedId((payload as any).item.id);
  }

  async function saveDraft() {
    if (!selectedId || !draft) return;
    let parsedContent = {};
    try {
      parsedContent = JSON.parse(draft.content || "{}");
    } catch {
      setMessage("Content JSON inválido.");
      return;
    }
    const res = await api(`/api/case-studies/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-cp-admin-token": token },
      body: JSON.stringify({
        title: draft.title,
        summary: draft.summary,
        locale: draft.locale,
        timeframeDays: draft.timeframeDays === "" ? null : Number(draft.timeframeDays),
        tags: String(draft.tags ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        stack: String(draft.stack ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        content: parsedContent,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage((payload as any).error ?? "No se pudo guardar");
      return;
    }
    setMessage("Borrador guardado.");
    await loadList();
  }

  async function runAction(action: "approve" | "publish") {
    if (!selectedId) return;
    const res = await api(`/api/case-studies/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cp-admin-token": token },
      body: JSON.stringify({ action }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage((payload as any).error ?? `No se pudo ${action}`);
      return;
    }
    setMessage(action === "approve" ? "Borrador aprobado." : "Caso publicado.");
    await loadList();
  }

  return (
    <main style={{ padding: 24, maxWidth: 1280 }}>
      <h1 style={{ marginTop: 0 }}>Case Studies (auto + approval)</h1>
      <p style={{ marginTop: 0 }}>
        Generar borradores automáticos desde activación/uso + NPS + CRM, editar, aprobar y publicar en marketing site.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          Admin token
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="CONTROL_PLANE_ADMIN_TOKEN" />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          installationId
          <input value={installationId} onChange={(e) => setInstallationId(e.target.value)} placeholder="uuid instalación" />
        </label>
        <button onClick={generateDraft} disabled={loading}>
          Generar borrador
        </button>
        <button onClick={loadList} disabled={loading || !token}>
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </section>

      {message ? <p>{message}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, marginTop: 16 }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12, maxHeight: 720, overflow: "auto" }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Borradores / Publicados</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  textAlign: "left",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 10,
                  background: selectedId === item.id ? "#eff6ff" : "#fff",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {item.status} · {item.icp ?? "-"} · {item.installation?.clientName ?? item.instanceId}
                </div>
                <strong>{item.title}</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{item.slug}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(item.updatedAt).toLocaleString()}</div>
              </button>
            ))}
            {items.length === 0 ? <p style={{ margin: 0 }}>Sin casos todavía.</p> : null}
          </div>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          {!selected || !draft ? (
            <p style={{ margin: 0 }}>Seleccioná un caso para editar/aprobar/publicar.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div>
                  <strong>{selected.status}</strong> · <code>{selected.slug}</code>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveDraft}>Guardar</button>
                  <button onClick={() => runAction("approve")} disabled={selected.status === "PUBLISHED"}>
                    Aprobar
                  </button>
                  <button onClick={() => runAction("publish")}>Publicar</button>
                </div>
              </div>

              <label style={{ display: "grid", gap: 4 }}>
                Título
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                Summary
                <textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={3} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "120px 160px 1fr 1fr", gap: 8 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  Locale
                  <input value={draft.locale} onChange={(e) => setDraft({ ...draft, locale: e.target.value })} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Días
                  <input value={draft.timeframeDays} onChange={(e) => setDraft({ ...draft, timeframeDays: e.target.value })} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Tags (coma)
                  <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  Stack (coma)
                  <input value={draft.stack} onChange={(e) => setDraft({ ...draft, stack: e.target.value })} />
                </label>
              </div>
              <label style={{ display: "grid", gap: 4 }}>
                Content JSON (context/problem/solution/metricsBeforeAfter/stack/timing)
                <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={18} />
              </label>

              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#fafafa" }}>
                <strong>Métricas snapshot</strong>
                <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontSize: 12 }}>
                  {JSON.stringify(selected.metrics ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
