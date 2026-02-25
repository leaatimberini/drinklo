import type { Metadata } from "next";
import { AnalyticsPageView } from "./AnalyticsPageView";
import { CtaButton } from "./CtaButton";
import { buildTrialSignupHref } from "./lib/marketing-site";

export const metadata: Metadata = {
  title: "ERP para Bebidas (Retail, Distribuidora, Enterprise)",
  description:
    "Operá retail, e-commerce, distribución y backoffice fiscal/comercial de bebidas desde una sola plataforma.",
};

function SegmentCard(props: { title: string; subtitle: string; bullets: string[] }) {
  return (
    <article className="card">
      <div className="badge">{props.title}</div>
      <h2 className="section-title" style={{ marginTop: 10 }}>{props.subtitle}</h2>
      <ul className="muted" style={{ paddingLeft: 18, margin: 0 }}>
        {props.bullets.map((line) => (
          <li key={line} style={{ marginBottom: 6 }}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

export default function MarketingHomePage() {
  const trialHref = buildTrialSignupHref(null);
  return (
    <main>
      <AnalyticsPageView page="home" />
      <section className="hero">
        <div className="badge">Vertical Bebidas</div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", margin: "12px 0 10px", lineHeight: 1.05 }}>
          Retail, Distribuidora y Enterprise en una sola operación
        </h1>
        <p className="muted" style={{ maxWidth: 780, fontSize: 18 }}>
          POS, e-commerce, pricing, stock, integraciones, fiscalidad ARCA (ex AFIP) y control multi-canal con foco en bebidas.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <CtaButton href={trialHref}>Probar 30 días</CtaButton>
          <CtaButton href="/pricing" variant="secondary" eventName="pricing_click">Ver pricing</CtaButton>
        </div>
      </section>

      <section style={{ marginTop: 18 }} className="grid-3">
        <SegmentCard
          title="Retail"
          subtitle="Kioscos, maxikioscos, stores"
          bullets={[
            "POS rápido con lector barcode y modo offline.",
            "Precios por lista y promociones por canal.",
            "Stock, vencimientos y alertas operativas.",
          ]}
        />
        <SegmentCard
          title="Distribuidora"
          subtitle="Venta mayorista y reparto"
          bullets={[
            "Listas de precio, presupuestos y ventas por cuenta.",
            "Ruteo de reparto y seguimiento de pedidos.",
            "Compras, recepciones y costos por proveedor.",
          ]}
        />
        <SegmentCard
          title="Enterprise"
          subtitle="Gobierno, compliance y escalabilidad"
          bullets={[
            "RBAC, SoD, auditoría inmutable y eDiscovery.",
            "Control-plane, rollouts, backups y monitoreo.",
            "Integraciones, plugins y APIs para partners.",
          ]}
        />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="section-title">¿Qué resolvés con SUCHT?</h2>
        <div className="grid-3">
          <div>
            <strong>Comercial</strong>
            <p className="muted">Precios, promociones, catálogo, checkout, campañas y funnel de trial -&gt; pago.</p>
          </div>
          <div>
            <strong>Operaciones</strong>
            <p className="muted">Stock, reservas, picking, compras, reparto y conciliación.</p>
          </div>
          <div>
            <strong>Control</strong>
            <p className="muted">Facturación ARCA, seguridad, observabilidad, compliance y control multi-instancia.</p>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 className="section-title">Próximo paso</h2>
        <p className="muted">Activá un trial de 30 días o dejá tus datos para una demo guiada según tu operación.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <CtaButton href={trialHref}>Quiero probar</CtaButton>
          <CtaButton href="/signup" variant="secondary" eventName="lead_form_click">Quiero una demo</CtaButton>
        </div>
      </section>
    </main>
  );
}
