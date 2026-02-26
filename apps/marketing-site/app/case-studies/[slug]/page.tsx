import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsPageView } from "../../AnalyticsPageView";
import { fetchPublicCaseStudy, fetchPublicCaseStudies } from "../../lib/case-studies";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const data = await fetchPublicCaseStudies();
  return (data.items ?? []).slice(0, 20).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchPublicCaseStudy(slug);
  if (!item) return { title: "Caso de éxito" };
  return {
    title: item.title,
    description: item.summary,
  };
}

export default async function CaseStudyDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await fetchPublicCaseStudy(slug);
  if (!item) notFound();

  const content = item.content ?? {};
  const metrics = item.metrics ?? {};

  return (
    <main>
      <AnalyticsPageView page="case_study_detail" />
      <section className="hero">
        <div className="badge">{item.icp ?? "bebidas"}</div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", margin: "12px 0 8px" }}>{item.title}</h1>
        <p className="muted" style={{ maxWidth: 820 }}>
          {item.summary}
        </p>
        <div className="muted" style={{ fontSize: 13 }}>
          {item.installation?.clientName ?? item.installation?.domain ?? item.installation?.instanceId ?? "Cliente"} · Publicado{" "}
          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("es-AR") : "n/d"}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="section-title">Contexto</h2>
        <p>{content.context ?? "-"}</p>
        <h2 className="section-title">Problema</h2>
        <p>{content.problem ?? "-"}</p>
        <h2 className="section-title">Solución</h2>
        <p>{content.solution ?? "-"}</p>
        <h2 className="section-title">Métricas (antes/después)</h2>
        <p>{content.metricsBeforeAfter ?? "-"}</p>
        <h2 className="section-title">Stack</h2>
        <p>{content.stack ?? "-"}</p>
        <h2 className="section-title">Tiempos</h2>
        <p>{content.timing ?? "-"}</p>
      </section>

      <section className="pricing-grid" style={{ marginTop: 18 }}>
        <article className="card">
          <h3 className="section-title">Antes</h3>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            {Array.isArray(metrics.before) ? metrics.before.map((row) => <li key={row.key}>{row.label}: {String(row.value)}</li>) : null}
          </ul>
        </article>
        <article className="card">
          <h3 className="section-title">Después</h3>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            {Array.isArray(metrics.after) ? metrics.after.map((row) => <li key={row.key}>{row.label}: {String(row.value)}</li>) : null}
          </ul>
        </article>
        <article className="card">
          <h3 className="section-title">Highlights</h3>
          <ul className="muted" style={{ paddingLeft: 18 }}>
            {Array.isArray(metrics.highlights) ? metrics.highlights.map((row) => <li key={row.key}>{row.label}: {String(row.value)}</li>) : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
