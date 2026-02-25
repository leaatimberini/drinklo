import type { Metadata } from "next";
import { AnalyticsPageView } from "../AnalyticsPageView";
import { CtaButton } from "../CtaButton";
import { buildTrialSignupHref } from "../lib/marketing-site";
import { fetchPublicPricingCatalog, selectMonthlyTierPrices } from "../lib/pricing";

export const metadata: Metadata = {
  title: "Pricing C1/C2/C3",
  description: "Planes C1, C2 y C3 para retail, distribuidoras y operaciones enterprise de bebidas.",
};

function fmtAmount(amount?: number | null, currency?: string) {
  if (amount == null) return "Consultar";
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency ?? ""} ${amount}`;
  }
}

export default async function PricingPage() {
  const pricing = await fetchPublicPricingCatalog();
  const tiers = selectMonthlyTierPrices(pricing);

  return (
    <main>
      <AnalyticsPageView page="pricing" />
      <section className="hero">
        <div className="badge">Pricing Catalog</div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", margin: "12px 0 8px" }}>Planes C1 / C2 / C3</h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          Esta página lee precios desde el Pricing Catalog del proveedor. Los cambios programados se muestran como “próximo precio”.
        </p>
      </section>

      <section className="pricing-grid" style={{ marginTop: 18 }}>
        {tiers.map((tier) => {
          const usd = tier.usd?.current?.amount ?? null;
          const ars = tier.ars?.current?.amount ?? null;
          const nextUsd = tier.usd?.next;
          const trialHref = buildTrialSignupHref(null);
          const tierTrialHref = `${trialHref}${trialHref.includes("?") ? "&" : "?"}plan=${tier.tier}`;
          return (
            <article className="card" key={tier.tier}>
              <div className="badge">{tier.tier}</div>
              <h2 className="section-title" style={{ marginTop: 10 }}>
                {tier.tier === "C1" ? "Retail" : tier.tier === "C2" ? "Distribuidora" : "Enterprise"}
              </h2>
              <div className="price">{fmtAmount(usd, "USD")}</div>
              <div className="muted">USD base mensual</div>
              <div style={{ marginTop: 4 }}>{fmtAmount(ars, "ARS")} <span className="muted">(referencia ARS)</span></div>
              {nextUsd ? (
                <div style={{ marginTop: 10 }} className="card">
                  <strong>Próximo precio</strong>
                  <div>{fmtAmount(nextUsd.amount, "USD")}</div>
                  <div className="muted">Desde {new Date(nextUsd.effectiveFrom).toLocaleDateString("es-AR")}</div>
                </div>
              ) : null}
              <ul className="muted" style={{ paddingLeft: 18 }}>
                {tier.tier === "C1" ? (
                  <>
                    <li>POS + e-commerce básico</li>
                    <li>Stock y pricing por listas</li>
                    <li>Operación single branch</li>
                  </>
                ) : tier.tier === "C2" ? (
                  <>
                    <li>Mayorista + reparto + integraciones</li>
                    <li>Automatizaciones y reportes ampliados</li>
                    <li>Más capacidad y usuarios admin</li>
                  </>
                ) : (
                  <>
                    <li>Gobierno de datos, SoD, auditoría y eDiscovery</li>
                    <li>Control-plane, rollout y fleet ops</li>
                    <li>Customizaciones / plugins / enterprise IAM</li>
                  </>
                )}
              </ul>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <CtaButton href={tierTrialHref}>Probar 30 días</CtaButton>
                <CtaButton href={`/signup?plan=${tier.tier}`} variant="secondary" eventName="contact_sales_click">
                  Hablar con ventas
                </CtaButton>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

