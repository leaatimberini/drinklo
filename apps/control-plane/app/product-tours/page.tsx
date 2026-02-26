"use client";

import { useEffect, useState } from "react";

type TourRow = {
  id: string;
  key: string;
  name: string;
  surface: "ADMIN" | "STOREFRONT";
  status: string;
  locale: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown> | null;
  condition?: Record<string, unknown> | null;
  steps: Array<{
    id: string;
    order: number;
    title: string;
    body: string;
    targetSelector: string;
    placement?: string | null;
    locale?: string | null;
    condition?: Record<string, unknown> | null;
  }>;
  stats30d?: { started: number; completed: number; abandoned: number };
};

type DashboardPayload = {
  generatedAt: string;
  tours: TourRow[];
  recentEvents: Array<Record<string, unknown>>;
  impact: {
    activationSampleSize: number;
    tours: Array<{
      key: string;
      completionRate: number;
      started: number;
      completed: number;
      abandoned: number;
      avgActivationScoreCompleted: number | null;
    }>;
  };
};

const emptySteps = [
  {
    order: 1,
    title: "Bienvenido",
    body: "Este tour te muestra el flujo principal.",
    targetSelector: "#main-content",
    placement: "bottom",
  },
];

export default function ProductToursPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tourId: "",
    key: "",
    name: "",
    surface: "ADMIN",
    status: "ACTIVE",
    locale: "es",
    triggerType: "FIRST_TIME",
    triggerConfig: '{ "featureKey": "checkout_used", "minCount": 1 }',
    condition: '{ "rolesIn": ["admin"], "icpIn": ["kiosco"] }',
    stepsJson: JSON.stringify(emptySteps, null, 2),
  });

  async function load() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/product-tours", { credentials: "include" });
    const payload = (await res.json().catch(() => ({}))) as DashboardPayload & { error?: string };
    setLoading(false);
    if (!res.ok) return setMessage(payload.error ?? "load_failed");
    setData(payload);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveTour() {
    setMessage(null);
    let steps;
    let triggerConfig = null;
    let condition = null;
    try {
      steps = JSON.parse(form.stepsJson);
      triggerConfig = form.triggerConfig.trim() ? JSON.parse(form.triggerConfig) : null;
      condition = form.condition.trim() ? JSON.parse(form.condition) : null;
    } catch {
      setMessage("JSON inválido en steps/trigger/condition");
      return;
    }
    const res = await fetch("/api/product-tours", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert",
        tourId: form.tourId || undefined,
        key: form.key,
        name: form.name,
        surface: form.surface,
        status: form.status,
        locale: form.locale,
        triggerType: form.triggerType,
        triggerConfig,
        condition,
        steps,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setMessage(payload.error ?? "save_failed");
    setMessage("Tour guardado.");
    await load();
  }

  function editTour(tour: TourRow) {
    setForm({
      tourId: tour.id,
      key: tour.key,
      name: tour.name,
      surface: tour.surface,
      status: tour.status,
      locale: tour.locale,
      triggerType: tour.triggerType,
      triggerConfig: JSON.stringify(tour.triggerConfig ?? {}, null, 2),
      condition: JSON.stringify(tour.condition ?? {}, null, 2),
      stepsJson: JSON.stringify(
        tour.steps.map((s) => ({
          order: s.order,
          locale: s.locale ?? undefined,
          title: s.title,
          body: s.body,
          targetSelector: s.targetSelector,
          placement: s.placement ?? undefined,
          condition: s.condition ?? undefined,
        })),
        null,
        2,
      ),
    });
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Product Tours Editor</h1>
      <p>Tours guiados para admin/storefront con condiciones por rol/ICP y triggers por uso/trial.</p>
      {loading ? <p>Cargando...</p> : null}
      {message ? <p>{message}</p> : null}

      <section className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 8 }}>
        <h2 style={{ marginTop: 0 }}>Crear / editar tour</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          <label>
            Tour ID (para editar)
            <input value={form.tourId} onChange={(e) => setForm({ ...form, tourId: e.target.value })} />
          </label>
          <label>
            Key
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          </label>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Surface
            <select value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })}>
              <option value="ADMIN">ADMIN</option>
              <option value="STOREFRONT">STOREFRONT</option>
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
          <label>
            Locale
            <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
              <option value="es">es</option>
              <option value="en">en</option>
            </select>
          </label>
          <label>
            Trigger
            <select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })}>
              <option value="ALWAYS">ALWAYS</option>
              <option value="FIRST_TIME">FIRST_TIME</option>
              <option value="FEATURE_UNUSED">FEATURE_UNUSED</option>
              <option value="TRIAL_NEARING_END">TRIAL_NEARING_END</option>
            </select>
          </label>
        </div>
        <label>
          Trigger Config (JSON)
          <textarea rows={4} value={form.triggerConfig} onChange={(e) => setForm({ ...form, triggerConfig: e.target.value })} />
        </label>
        <label>
          Condition (JSON: rolesIn/icpIn/localesIn/pathPrefixes)
          <textarea rows={4} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />
        </label>
        <label>
          Steps (JSON array)
          <textarea rows={12} value={form.stepsJson} onChange={(e) => setForm({ ...form, stepsJson: e.target.value })} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void saveTour()}>Guardar</button>
          <button onClick={() => void load()}>Refresh</button>
        </div>
      </section>

      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Impacto en activación (correlación)</h2>
        <p>Sample activación: {data?.impact?.activationSampleSize ?? 0} instancias.</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Tour</th>
              <th align="left">Started</th>
              <th align="left">Completed</th>
              <th align="left">Abandoned</th>
              <th align="left">Completion %</th>
              <th align="left">Avg activation score (completed)</th>
            </tr>
          </thead>
          <tbody>
            {(data?.impact?.tours ?? []).map((tour) => (
              <tr key={tour.key} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "8px 0" }}>{tour.key}</td>
                <td>{tour.started}</td>
                <td>{tour.completed}</td>
                <td>{tour.abandoned}</td>
                <td>{tour.completionRate}</td>
                <td>{tour.avgActivationScoreCompleted ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tours</h2>
        {(data?.tours ?? []).length === 0 ? <p>Sin tours.</p> : null}
        <div style={{ display: "grid", gap: 10 }}>
          {(data?.tours ?? []).map((tour) => (
            <div key={tour.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <strong>{tour.name}</strong> ({tour.key}) · {tour.surface} · {tour.status} · {tour.locale}
                </div>
                <button onClick={() => editTour(tour)}>Editar</button>
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                Trigger: {tour.triggerType} · started={tour.stats30d?.started ?? 0} · completed={tour.stats30d?.completed ?? 0} · abandoned=
                {tour.stats30d?.abandoned ?? 0}
              </div>
              <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: "8px 0 0" }}>
                {JSON.stringify(
                  {
                    condition: tour.condition ?? null,
                    triggerConfig: tour.triggerConfig ?? null,
                    steps: tour.steps,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

