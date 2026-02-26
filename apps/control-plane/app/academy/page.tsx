"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardResponse = {
  summary: { instances: number; progressRows: number; certificates: number };
  instances: Array<{
    installationId: string;
    instanceId: string;
    clientName: string | null;
    learners: number;
    coursesStarted: number;
    coursesCompleted: number;
    certificatesIssued: number;
    avgProgressPct: number;
    progressRows: Array<{
      courseKey: string;
      courseTitle: string;
      learnerKey: string;
      learnerName: string | null;
      progressPct: number;
      status: string;
      lastActivityAt?: string | null;
      certificateIssuedAt?: string | null;
    }>;
  }>;
};

export default function AcademyAdminPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/academy/admin", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "No se pudo cargar academy");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => data?.summary ?? { instances: 0, progressRows: 0, certificates: 0 }, [data]);

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ marginBottom: 6 }}>Academy</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>Progreso de cursos y certificados por empresa/instancia.</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={load} disabled={loading}>{loading ? "Cargando..." : "Actualizar"}</button>
        <div>Instancias: <strong>{totals.instances}</strong></div>
        <div>Progresos: <strong>{totals.progressRows}</strong></div>
        <div>Certificados: <strong>{totals.certificates}</strong></div>
      </div>
      {error ? <p>{error}</p> : null}
      <div style={{ display: "grid", gap: 12 }}>
        {(data?.instances ?? []).map((inst) => (
          <section key={inst.instanceId} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{inst.clientName ?? inst.instanceId}</strong>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{inst.instanceId}</div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                <span>Learners: {inst.learners}</span>
                <span>Started: {inst.coursesStarted}</span>
                <span>Completed: {inst.coursesCompleted}</span>
                <span>Certificados: {inst.certificatesIssued}</span>
                <span>Avg: {inst.avgProgressPct}%</span>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 13 }}>
              <thead>
                <tr>
                  <th align="left">Curso</th>
                  <th align="left">Learner</th>
                  <th align="left">Estado</th>
                  <th align="left">Progreso</th>
                  <th align="left">Ultima actividad</th>
                  <th align="left">Certificado</th>
                </tr>
              </thead>
              <tbody>
                {inst.progressRows.map((row, idx) => (
                  <tr key={`${row.courseKey}:${row.learnerKey}:${idx}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 0" }}>{row.courseTitle}</td>
                    <td>{row.learnerName ?? row.learnerKey}</td>
                    <td>{row.status}</td>
                    <td>{row.progressPct}%</td>
                    <td>{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : "-"}</td>
                    <td>{row.certificateIssuedAt ? new Date(row.certificateIssuedAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}

