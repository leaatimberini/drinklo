"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CatalogResponse = {
  locale: string;
  icp: string | null;
  recommendations?: Array<{ courseKey: string; title: string; summary?: string; matchedSteps?: string[] }>;
  courses: Array<{
    key: string;
    icps: string[];
    title: string;
    summary: string;
    modules: Array<{ key: string; title: string; durationMin: number; quiz?: { passPct: number; questions: Array<{ id: string; prompt: string; options: string[] }> } | null }>;
    progress?: { status: string; progressPct: number; certificate?: { id: string; issuedAt: string; evidenceHash: string } | null } | null;
  }>;
};

export function AcademyHome() {
  const [instanceId, setInstanceId] = useState("demo-instance");
  const [companyId, setCompanyId] = useState("");
  const [learnerKey, setLearnerKey] = useState("admin@demo.com");
  const [icp, setIcp] = useState("kiosco");
  const [blockedSteps, setBlockedSteps] = useState("import_catalog,configure_mercadopago");
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const sp = new URLSearchParams({ instanceId, learnerKey, icp, locale: "es" });
    if (companyId) sp.set("companyId", companyId);
    blockedSteps
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((v) => sp.append("blockedStep", v));
    return sp.toString();
  }, [instanceId, learnerKey, icp, companyId, blockedSteps]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/catalog?${query}`, { cache: "no-store" });
    const payload = await res.json().catch(() => null);
    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [query]);

  return (
    <main className="ac-grid">
      <section className="ac-panel">
        <h1 style={{ marginTop: 0, marginBottom: 6 }}>Cursos por ICP</h1>
        <p className="ac-muted" style={{ marginTop: 0 }}>
          Distribuidora / Kiosco / Bar. Incluye quizzes y certificado interno (Admin Certified).
        </p>
        <div className="ac-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
          <label>
            Instance ID
            <input className="ac-input" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
          </label>
          <label>
            Company ID
            <input className="ac-input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="optional" />
          </label>
          <label>
            Learner
            <input className="ac-input" value={learnerKey} onChange={(e) => setLearnerKey(e.target.value)} />
          </label>
          <label>
            ICP
            <select className="ac-select" value={icp} onChange={(e) => setIcp(e.target.value)}>
              <option value="kiosco">Kiosco</option>
              <option value="distribuidora">Distribuidora</option>
              <option value="bar">Bar</option>
            </select>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Pasos trabados (onboarding)
            <input
              className="ac-input"
              value={blockedSteps}
              onChange={(e) => setBlockedSteps(e.target.value)}
              placeholder="import_catalog, configure_mercadopago"
            />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="ac-btn" onClick={load} disabled={loading}>{loading ? "Cargando..." : "Refrescar"}</button>
        </div>
      </section>

      {(data?.recommendations ?? []).length ? (
        <section className="ac-panel">
          <h2 style={{ marginTop: 0 }}>Recomendados por onboarding trabado</h2>
          <div className="ac-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {(data?.recommendations ?? []).map((rec) => (
              <div key={rec.courseKey} className="ac-card">
                <div className="ac-pill">Recomendado</div>
                <h3 style={{ marginBottom: 6 }}>{rec.title}</h3>
                <div className="ac-muted" style={{ fontSize: 13 }}>
                  {(rec.matchedSteps ?? []).length ? `Pasos: ${(rec.matchedSteps ?? []).join(", ")}` : null}
                </div>
                <div style={{ marginTop: 10 }}>
                  <Link className="ac-btn primary" href={`/courses/${encodeURIComponent(rec.courseKey)}?${query}`}>
                    Abrir curso
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ac-panel">
        <h2 style={{ marginTop: 0 }}>Catalogo</h2>
        <div className="ac-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {(data?.courses ?? []).map((course) => (
            <div key={course.key} className="ac-card">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {course.icps.map((v) => (
                  <span className="ac-pill" key={v}>{v}</span>
                ))}
                {course.progress ? <span className="ac-pill">{course.progress.progressPct}%</span> : null}
              </div>
              <h3 style={{ margin: "0 0 6px" }}>{course.title}</h3>
              <p className="ac-muted" style={{ marginTop: 0 }}>{course.summary}</p>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
                Modulos: {course.modules.length} · Quiz: {course.modules.some((m) => m.quiz) ? "si" : "no"}
              </div>
              {course.progress?.certificate ? (
                <div style={{ fontSize: 12, color: "#86efac", marginBottom: 8 }}>
                  Certificado emitido · hash {course.progress.certificate.evidenceHash.slice(0, 10)}...
                </div>
              ) : null}
              <Link className="ac-btn primary" href={`/courses/${encodeURIComponent(course.key)}?${query}`}>
                Continuar
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

