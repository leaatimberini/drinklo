"use client";

import { useEffect, useMemo, useState } from "react";

type CourseState = {
  key: string;
  title: string;
  summary: string;
  modules: Array<{
    key: string;
    title: string;
    description: string;
    durationMin: number;
    quiz?: { passPct: number; questions: Array<{ id: string; prompt: string; options: string[] }> } | null;
  }>;
  progress?: {
    status: string;
    progressPct: number;
    completedModuleKeys: string[];
    certificate?: { id: string; issuedAt: string; evidenceHash: string } | null;
  } | null;
};

type LearnerPayload = {
  courses: CourseState[];
};

function parseBlockedSteps(searchParams: URLSearchParams) {
  const explicit = searchParams.getAll("blockedStep");
  if (explicit.length) return explicit;
  const csv = searchParams.get("blockedSteps") ?? "";
  return csv.split(",").map((v) => v.trim()).filter(Boolean);
}

export function CoursePlayer({ courseKey, searchParams }: { courseKey: string; searchParams: Record<string, string | string[] | undefined> }) {
  const [payload, setPayload] = useState<LearnerPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (Array.isArray(v)) v.forEach((item) => sp.append(k, item));
      else if (typeof v === "string") sp.set(k, v);
    }
    if (!sp.get("instanceId")) sp.set("instanceId", "demo-instance");
    if (!sp.get("learnerKey")) sp.set("learnerKey", "admin@demo.com");
    if (!sp.get("locale")) sp.set("locale", "es");
    parseBlockedSteps(sp).forEach((s) => sp.append("blockedStep", s));
    return sp;
  }, [searchParams]);

  const instanceId = params.get("instanceId") ?? "demo-instance";
  const learnerKey = params.get("learnerKey") ?? "admin@demo.com";
  const icp = params.get("icp") ?? "kiosco";
  const companyId = params.get("companyId") ?? "";
  const locale = params.get("locale") ?? "es";

  const course = useMemo(
    () => payload?.courses?.find((c) => c.key === courseKey) ?? null,
    [payload, courseKey],
  );

  async function refresh() {
    setLoading(true);
    const res = await fetch(`/api/progress?${params.toString()}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setPayload(json);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, [params.toString()]);

  async function post(body: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch(`/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error ?? "Operacion fallida");
      return;
    }
    setMessage("Guardado");
    await refresh();
  }

  if (!course) {
    return (
      <main className="ac-panel">
        <p>{loading ? "Cargando curso..." : "Curso no encontrado"}</p>
      </main>
    );
  }

  const completedKeys = new Set(course.progress?.completedModuleKeys ?? []);

  return (
    <main className="ac-grid">
      <section className="ac-panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>{course.title}</h1>
            <p className="ac-muted" style={{ marginTop: 0 }}>{course.summary}</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <div className="ac-card">
              <div>Instancia: <strong>{instanceId}</strong></div>
              <div>Learner: <strong>{learnerKey}</strong></div>
              <div>ICP: <strong>{icp}</strong></div>
              <div>Progreso: <strong>{course.progress?.progressPct ?? 0}%</strong></div>
              <div>Estado: <strong>{course.progress?.status ?? "NOT_STARTED"}</strong></div>
              {course.progress?.certificate ? (
                <div style={{ marginTop: 8, color: "#86efac", fontSize: 12 }}>
                  Certificado emitido · {new Date(course.progress.certificate.issuedAt).toLocaleString()}<br />
                  hash: {course.progress.certificate.evidenceHash}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {message ? <p style={{ marginTop: 8 }}>{message}</p> : null}
      </section>

      <section className="ac-panel">
        <h2 style={{ marginTop: 0 }}>Modulos y quizzes</h2>
        <div className="ac-grid">
          {course.modules.map((mod) => (
            <div key={mod.key} className="ac-card">
              {(() => {
                const quiz = mod.quiz ?? null;
                return (
                  <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <strong>{mod.title}</strong>
                  <div className="ac-muted" style={{ fontSize: 13 }}>{mod.description}</div>
                  <div className="ac-muted" style={{ fontSize: 12 }}>{mod.durationMin} min</div>
                </div>
                <div>
                  {completedKeys.has(mod.key) ? <span className="ac-pill">Completo</span> : <span className="ac-pill">Pendiente</span>}
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="ac-btn"
                  onClick={() =>
                    post({
                      action: "module_complete",
                      instanceId,
                      companyId,
                      learnerKey,
                      icp,
                      locale,
                      courseKey,
                      moduleKey: mod.key,
                    })
                  }
                >
                  Marcar modulo
                </button>
                {quiz ? (
                  <button
                    className="ac-btn primary"
                    onClick={() =>
                      post({
                        action: "quiz_submit",
                        instanceId,
                        companyId,
                        learnerKey,
                        icp,
                        locale,
                        courseKey,
                        moduleKey: mod.key,
                        quizAnswers: quiz.questions.map(() => 0),
                      })
                    }
                  >
                    Enviar quiz (demo)
                  </button>
                ) : null}
              </div>
              {quiz ? (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Quiz: {quiz.questions.length} preguntas · aprobación {quiz.passPct}% (demo responde opción 1)
                </div>
              ) : null}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </section>

      <section className="ac-panel">
        <h2 style={{ marginTop: 0 }}>Certificación interna</h2>
        <p className="ac-muted">Admin Certified. Se emite con evidencia hash + timestamp y queda auditada en compliance evidence.</p>
        <button
          className="ac-btn primary"
          onClick={() =>
            post({
              action: "issue_certificate",
              instanceId,
              learnerKey,
              courseKey,
              locale,
            })
          }
        >
          Emitir certificado
        </button>
      </section>
    </main>
  );
}

