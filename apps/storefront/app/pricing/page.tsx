"use client";

import Link from "next/link";
import { pricingLegalCopy, pricingTierCards, storefrontSelfServeNav } from "../self-serve-ui-content";

export default function StorefrontPricingPage() {
  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: 8 }}>Planes C1 / C2 / C3</h1>
      <p>Compará límites y beneficios del servicio. La gestión de cambios se realiza desde Billing Manage.</p>

      <nav style={{ display: "flex", gap: 12, margin: "12px 0 20px" }}>
        {storefrontSelfServeNav.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
      </nav>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        {pricingTierCards.map((card) => (
          <article
            key={card.tier}
            style={{
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--card-bg)",
              padding: 16,
              outline: card.recommended ? "2px solid var(--color-primary)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{card.label}</h2>
              {card.recommended ? <span style={{ fontSize: 12 }}>Recomendado</span> : null}
            </div>
            <p>{card.tagline}</p>
            <ul>
              {card.limits.map((l) => <li key={`${card.tier}-${l.key}`}>{l.key}: {l.value}</li>)}
            </ul>
            <ul>
              {card.benefits.map((b) => <li key={`${card.tier}-${b}`}>{b}</li>)}
            </ul>
            <Link href="/billing/manage">Gestionar plan</Link>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Términos y consentimiento</h2>
        <h3>Trial 30 días</h3>
        <ul>{pricingLegalCopy.trialTerms.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Grace y Restricted (sin borrado de datos)</h3>
        <ul>{pricingLegalCopy.graceRestricted.map((line) => <li key={line}>{line}</li>)}</ul>
        <h3>Consentimiento marketing separado</h3>
        <ul>{pricingLegalCopy.marketingConsent.map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
    </main>
  );
}

