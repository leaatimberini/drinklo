export type RestrictedCheckoutRuntime = {
  enabled: boolean;
  variant?: "CATALOG_ONLY" | "ALLOW_BASIC_SALES";
  storefrontCheckoutBlocked?: boolean;
};

export function isCheckoutBlockedByRestrictedMode(runtime?: RestrictedCheckoutRuntime | null) {
  return Boolean(runtime?.enabled && (runtime?.storefrontCheckoutBlocked || runtime?.variant === "CATALOG_ONLY"));
}

export function parseRestrictedCheckoutError(payload: any) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.code !== "SUBSCRIPTION_RESTRICTED") return null;
  const message =
    typeof payload.message === "string"
      ? payload.message
      : "El checkout esta temporalmente deshabilitado por estado de suscripcion.";
  const ctaLabel = typeof payload?.cta?.label === "string" ? payload.cta.label : "Actualizar plan";
  return { message, ctaLabel };
}

