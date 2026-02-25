"use client";

import Link from "next/link";
import { adminSelfServeNav, pricingLegalCopy, pricingTierCards } from "../self-serve-ui-content";

export default function AdminPricingPage() {
  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: 8 }}>Pricing (C1 / C2 / C3)</h1>
      <p>Compará límites y beneficios. Desde aquí podés pasar a autogestión de plan y facturación.</p>

      <nav style={{ display: "flex", gap: 12, margin: "12px 0 20px" }}>
        {adminSelfServeNav.map((item) => (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{card.label}</h2>
              {card.recommended ? <span style={{ fontSize: 12 }}>Recomendado</span> : null}
            </div>
            <p>{card.tagline}</p>
            <h3 style={{ marginBottom: 8 }}>Límites</h3>
            <ul>
              {card.limits.map((l) => (
                <li key={`${card.tier}-${l.key}`}>{l.key}: {l.value}</li>
              ))}
            </ul>
            <h3 style={{ marginBottom: 8 }}>Beneficios</h3>
            <ul>
              {card.benefits.map((b) => <li key={`${card.tier}-${b}`}>{b}</li>)}
            </ul>
            <Link href="/billing/manage">Gestionar plan</Link>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 24, border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Copy legal (trial, grace, restricted)</h2>
        <h3>Términos de trial</h3>
        <ul>{pricingLegalCopy.trialTerms.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>Grace y Restricted</h3>
        <ul>{pricingLegalCopy.graceRestricted.map((x) => <li key={x}>{x}</li>)}</ul>
        <h3>Consentimiento marketing (separado)</h3>
        <ul>{pricingLegalCopy.marketingConsent.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
    </main>
  );
}

