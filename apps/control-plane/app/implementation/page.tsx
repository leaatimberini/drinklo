"use client";

import { useEffect, useMemo, useState } from "react";

type ImplPayload = any;

export default function ImplementationPage() {
  const [installationId, setInstallationId] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [icp, setIcp] = useState("kiosco");
  const [ownerName, setOwnerName] = useState("");
  const [targetGoLiveAt, setTargetGoLiveAt] = useState("");
  const [payload, setPayload] = useState<ImplPayload | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function loadDetail() {
    const qs = installationId ? `installationId=${encodeURIComponent(installationId)}` : instanceId ? `instanceId=${encodeURIComponent(instanceId)}` : "";
    const res = await fetch(`/api/implementation${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error ?? "load_failed"));
    setPayload(data);
    if (data?.mode === "detail") {
      setInstallationId(String(data.installation?.id ?? installationId));
      setInstanceId(String(data.installation?.instanceId ?? instanceId));
      setIcp(String(data.project?.icp ?? icp));
      setOwnerName(String(data.project?.ownerName ?? ownerName));
      setTargetGoLiveAt(data.project?.targetGoLiveAt ? String(data.project.targetGoLiveAt).slice(0, 10) : targetGoLiveAt);
    }
  }

  useEffect(() => {
    fetch("/api/implementation", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setPayload(data))
      .catch(() => undefined);
  }, []);

  async function postAction(body: any) {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/implementation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "request_failed"));
      setStatusMsg("OK");
      await loadDetail();
      return data;
    } catch (error: any) {
      setStatusMsg(String(error?.message ?? "request_failed"));
      throw error;
    } finally {
      setLoading(false);
    }
  }

  const detail = payload?.mode === "detail" ? payload : null;
  const listRows = payload?.mode === "list" ? payload.rows ?? [] : [];

  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of detail?.project?.items ?? []) {
      const phase = String(item.phase ?? "other");
      groups[phase] = groups[phase] ?? [];
      groups[phase].push(item);
    }
    return groups;
  }, [detail]);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Implementation</h1>
      <p>Checklist por ICP con responsables, fechas, estado, integración con Activation Score / Tours / Academy y semáforo de go-live.</p>
      {statusMsg ? <p><strong>Status:</strong> {statusMsg}</p> : null}

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
        <h2>Cargar / crear proyecto</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 8 }}>
          <label>
            Installation ID
            <input value={installationId} onChange={(e) => setInstallationId(e.target.value)} />
          </label>
          <label>
            Instance ID (fallback)
            <input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </label>
          <label>
            ICP
            <select value={icp} onChange={(e) => setIcp(e.target.value)}>
              {["kiosco", "distribuidora", "bar", "enterprise"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>
            Responsable
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </label>
          <label>
            Target Go-Live
            <input type="date" value={targetGoLiveAt} onChange={(e) => setTargetGoLiveAt(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" disabled={loading} onClick={() => loadDetail()}>
            Cargar
          </button>
          <button
            type="button"
            disabled={loading || !installationId}
            onClick={() =>
              postAction({
                action: "upsertProject",
                installationId,
                icp,
                ownerName,
                targetGoLiveAt: targetGoLiveAt ? `${targetGoLiveAt}T00:00:00.000Z` : null,
                seedChecklist: true,
              })
            }
          >
            Crear/Actualizar proyecto
          </button>
          <button type="button" disabled={loading || !installationId} onClick={() => postAction({ action: "syncSignals", installationId })}>
            Sync Activation/Tours/Academy
          </button>
          <button
            type="button"
            disabled={loading || !detail?.project?.id}
            onClick={() => postAction({ action: "syncChecklistTemplate", projectId: detail.project.id })}
          >
            Sync checklist template
          </button>
          <button
            type="button"
            disabled={loading || !installationId}
            onClick={() => postAction({ action: "generateFinalReport", installationId })}
          >
            Generar reporte final
          </button>
        </div>
      </section>

      {!detail && listRows.length > 0 ? (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h2>Proyectos recientes</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Instance</th>
                <th style={{ textAlign: "left" }}>Cliente</th>
                <th style={{ textAlign: "left" }}>ICP</th>
                <th style={{ textAlign: "left" }}>Estado</th>
                <th style={{ textAlign: "left" }}>Semáforo</th>
                <th style={{ textAlign: "left" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {listRows.slice(0, 50).map((row: any) => (
                <tr key={row.id} style={{ borderTop: "1px solid #eee" }}>
                  <td>{row.instanceId}</td>
                  <td>{row.clientName ?? "-"}</td>
                  <td>{row.icp}</td>
                  <td>{row.status}</td>
                  <td>{row.readiness?.color ?? "-"}</td>
                  <td>{row.readiness?.score ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {detail ? (
        <>
          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2>Go-live readiness</h2>
            <p>
              <strong>Semáforo:</strong> {detail.goLiveReadiness?.semaphore} | <strong>Score:</strong> {detail.goLiveReadiness?.score}
            </p>
            <p>
              Checklist requerido: {detail.goLiveReadiness?.doneRequired}/{detail.goLiveReadiness?.requiredCount} ({detail.goLiveReadiness?.checklistPct}%)
            </p>
            <p>Razones: {(detail.goLiveReadiness?.reasons ?? []).join(" | ") || "Sin observaciones"}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <a href={detail.goLiveReadiness?.goLiveReportLinks?.json} target="_blank" rel="noreferrer">Preview report JSON</a>
              <a href={detail.goLiveReadiness?.goLiveReportLinks?.pdf} target="_blank" rel="noreferrer">Descargar reporte PDF</a>
            </div>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2>Integraciones (Activation / Tours / Academy)</h2>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(
                {
                  activation: detail.integrations?.activation
                    ? {
                        score: detail.integrations.activation.score,
                        state: detail.integrations.activation.state,
                        detectedSignals: (detail.integrations.activation.signals ?? []).filter((s: any) => s.detected).map((s: any) => s.key),
                      }
                    : null,
                  tours: detail.integrations?.tours ?? null,
                  academy: detail.integrations?.academy
                    ? {
                        learners: detail.integrations.academy.learners,
                        coursesCompleted: detail.integrations.academy.coursesCompleted,
                        certificatesIssued: detail.integrations.academy.certificatesIssued,
                        avgProgressPct: detail.integrations.academy.avgProgressPct,
                      }
                    : null,
                  academyRecommendations: detail.integrations?.academyRecommendations ?? [],
                },
                null,
                2,
              )}
            </pre>
          </section>

          <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2>Checklist</h2>
            {Object.entries(groupedItems).map(([phase, items]) => (
              <div key={phase} style={{ marginBottom: 16 }}>
                <h3 style={{ textTransform: "capitalize" }}>{phase}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Task</th>
                      <th style={{ textAlign: "left" }}>Estado</th>
                      <th style={{ textAlign: "left" }}>Resp.</th>
                      <th style={{ textAlign: "left" }}>Due</th>
                      <th style={{ textAlign: "left" }}>Req</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items as any[]).map((item) => (
                      <tr key={item.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: "6px 0" }}>
                          <div>{item.title}</div>
                          <small>{item.taskKey}</small>
                        </td>
                        <td>
                          <select
                            value={item.status}
                            onChange={(e) =>
                              postAction({
                                action: "updateItem",
                                itemId: item.id,
                                status: e.target.value,
                              }).catch(() => undefined)
                            }
                          >
                            {["PENDING", "IN_PROGRESS", "BLOCKED", "DONE", "WAIVED"].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>{item.responsibleName ?? item.responsibleRole ?? "-"}</td>
                        <td>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "-"}</td>
                        <td>{item.required ? "Sí" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

