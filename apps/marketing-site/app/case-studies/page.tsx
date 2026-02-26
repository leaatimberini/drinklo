import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsPageView } from "../AnalyticsPageView";
import { fetchPublicCaseStudies } from "../lib/case-studies";

export const metadata: Metadata = {
  title: "Casos de éxito | Sucht Platform",
  description: "Historias reales de activación y operación en retail y distribuidoras de bebidas.",
};

export default async function CaseStudiesPage() {
  const data = await fetchPublicCaseStudies();
  const items = data.items ?? [];

  return (
    <main>
      <AnalyticsPageView page="case_studies" />
      <section className="hero">
        <div className="badge">Casos de éxito</div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", margin: "12px 0 8px" }}>Resultados publicados con aprobación</h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          Casos generados desde métricas de activación/uso, feedback NPS/CSAT y notas comerciales, revisados antes de publicar.
        </p>
      </section>

      <section className="pricing-grid" style={{ marginTop: 18 }}>
        {items.map((item) => (
          <article className="card" key={item.id}>
            <div className="badge">{item.icp ?? "bebidas"}</div>
            <h2 className="section-title" style={{ marginTop: 10 }}>
              <Link href={`/case-studies/${item.slug}`}>{item.title}</Link>
            </h2>
            <p className="muted">{item.summary}</p>
            <div className="muted" style={{ fontSize: 13 }}>
              {item.installation?.clientName ?? item.installation?.domain ?? item.installation?.instanceId ?? "Cliente"} ·{" "}
              {item.timeframeDays != null ? `${item.timeframeDays} días` : "tiempo n/d"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {(item.tags ?? []).slice(0, 6).map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href={`/case-studies/${item.slug}`}>Leer caso →</Link>
            </div>
          </article>
        ))}
      </section>

      {items.length === 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <strong>Aún no hay casos publicados.</strong>
          <p className="muted">Generá un borrador desde Control-plane, aprobalo y publicalo para verlo aquí.</p>
        </section>
      ) : null}
    </main>
  );
}

