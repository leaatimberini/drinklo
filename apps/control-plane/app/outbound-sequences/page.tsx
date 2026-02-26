"use client";

import { useEffect, useMemo, useState } from "react";

type Dashboard = {
  generatedAt: string;
  sequences: Array<any>;
  recentEvents: Array<any>;
  recentEnrollments: Array<any>;
  leadPoolByIcp: Record<string, number>;
  metrics: Record<string, number>;
};

const DEFAULT_SEQUENCE = {
  key: "trial-nurture-es",
  name: "Trial Nurture ES",
  status: "DRAFT",
  locale: "es",
  icpFilters: ["kiosco", "distribuidora"],
  variables: { supportEmail: "soporte@example.com" },
  steps: [
    {
      stepOrder: 1,
      delayDays: 0,
      name: "Intro",
      subjectTpl: "Hola {{companyName}}, empecemos rapido",
      bodyTpl: "Te ayudamos a importar catalogo y vender hoy. Responde este email si queres ayuda.",
      ctaUrlTpl: "{{clickTrackingUrl}}",
    },
    {
      stepOrder: 2,
      delayDays: 3,
      name: "Nudge D+3",
      subjectTpl: "Checklist de activacion para {{businessType}}",
      bodyTpl: "Paso recomendado: importar catalogo. Ver guia: {{clickTrackingUrl}}",
      ctaUrlTpl: "https://docs.example.com/importacion-rapida",
    },
  ],
};

export default function OutboundSequencesPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sequenceJson, setSequenceJson] = useState(JSON.stringify(DEFAULT_SEQUENCE, null, 2));
  const [assignIcp, setAssignIcp] = useState("kiosco");
  const [assignSequenceId, setAssignSequenceId] = useState("");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function reload() {
    const res = await fetch("/api/outbound-sequences", { cache: "no-store" });
    const data = await res.json();
    setDashboard(data);
    if (!assignSequenceId && Array.isArray(data?.sequences) && data.sequences[0]?.id) {
      setAssignSequenceId(String(data.sequences[0].id));
    }
  }

  useEffect(() => {
    reload().catch((e) => setStatusMsg(String(e?.message ?? "load_error")));
  }, []);

  const seqOptions = useMemo(() => dashboard?.sequences ?? [], [dashboard]);

  async function postAction(payload: Record<string, unknown>) {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/outbound-sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "request_failed"));
      setStatusMsg("OK");
      await reload();
      return data;
    } catch (e: any) {
      setStatusMsg(String(e?.message ?? "request_failed"));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function saveSequence() {
    const parsed = JSON.parse(sequenceJson);
    const data = await postAction({ action: "upsertSequence", sequence: parsed });
    if (data?.sequence?.id) setAssignSequenceId(String(data.sequence.id));
  }

  async function assignByIcp() {
    if (!assignSequenceId) throw new Error("sequence_required");
    await postAction({ action: "enrollByIcp", sequenceId: assignSequenceId, icp: assignIcp, limit: 200 });
  }

  async function dispatchDue() {
    await postAction({ action: "dispatchDue", limit: 50 });
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 20 }}>
      <header>
        <h1>Outbound Sequences</h1>
        <p>Plantillas email con pasos, delays, tracking (open/click), opt-out y asignacion por ICP.</p>
        {statusMsg ? <p><strong>Status:</strong> {statusMsg}</p> : null}
      </header>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Secuencia (template + variables + pasos)</h2>
        <textarea
          value={sequenceJson}
          onChange={(e) => setSequenceJson(e.target.value)}
          rows={20}
          style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={saveSequence} disabled={loading}>Guardar secuencia</button>
          <button type="button" onClick={dispatchDue} disabled={loading}>Despachar pasos vencidos</button>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Asignar por ICP</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={assignSequenceId} onChange={(e) => setAssignSequenceId(e.target.value)}>
            <option value="">Seleccionar secuencia</option>
            {seqOptions.map((seq: any) => (
              <option key={seq.id} value={seq.id}>
                {seq.name} ({seq.status})
              </option>
            ))}
          </select>
          <select value={assignIcp} onChange={(e) => setAssignIcp(e.target.value)}>
            {["kiosco", "distribuidora", "bar", "enterprise"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button type="button" onClick={assignByIcp} disabled={loading || !assignSequenceId}>
            Asignar a leads por ICP
          </button>
        </div>
        {dashboard?.leadPoolByIcp ? (
          <p style={{ marginTop: 8 }}>
            Pool leads: {Object.entries(dashboard.leadPoolByIcp).map(([k, v]) => `${k}:${v}`).join(" | ")}
          </p>
        ) : null}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Metricas y tracking</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(dashboard?.metrics ?? {}, null, 2)}</pre>
        <h3>Eventos recientes</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Provider</th>
                <th>Lead</th>
                <th>Enrollment</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.recentEvents ?? []).slice(0, 20).map((evt: any) => (
                <tr key={evt.id}>
                  <td>{new Date(evt.occurredAt).toLocaleString()}</td>
                  <td>{evt.eventType}</td>
                  <td>{evt.provider ?? "-"}</td>
                  <td>{evt.leadId ?? "-"}</td>
                  <td>{evt.enrollmentId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
