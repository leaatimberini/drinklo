import type { Metadata } from "next";
import { AnalyticsPageView } from "../AnalyticsPageView";
import { SignupForm } from "../SignupForm";
import { extractUtmFromSearchParams } from "../lib/marketing-site";

export const metadata: Metadata = {
  title: "Signup / Trial",
  description: "Activá tu trial de 30 días o dejá tus datos para demo comercial.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const paramsObject = (await searchParams) ?? {};
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(paramsObject)) {
    if (Array.isArray(value)) {
      for (const item of value) urlParams.append(key, item);
    } else if (value != null) {
      urlParams.set(key, value);
    }
  }

  const trial = String(paramsObject.trial ?? "").trim().toUpperCase() || null;
  const utm = extractUtmFromSearchParams(urlParams);

  return (
    <main>
      <AnalyticsPageView page="signup" />
      <section className="hero">
        <div className="badge">{trial ? `Campaña ${trial}` : "Lead capture"}</div>
        <h1 style={{ margin: "12px 0 8px" }}>
          {trial ? "Activá tu trial de 30 días" : "Contanos sobre tu operación de bebidas"}
        </h1>
        <p className="muted">
          Capturamos lead + attribution (UTM/referral) y, si enviás un código de campaña, intentamos el alta de trial en control-plane.
        </p>
      </section>

      <SignupForm trialCode={trial} utm={utm} />
    </main>
  );
}

