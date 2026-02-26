export type RestrictedCheckoutRuntime = {
  enabled: boolean;
  variant?: "CATALOG_ONLY" | "ALLOW_BASIC_SALES";
  storefrontCheckoutBlocked?: boolean;
};

type RestrictedErrorPayload = {
  code?: string;
  message?: string;
  cta?: {
    label?: string;
  };
};

export function isCheckoutBlockedByRestrictedMode(runtime?: RestrictedCheckoutRuntime | null) {
  return Boolean(runtime?.enabled && (runtime?.storefrontCheckoutBlocked || runtime?.variant === "CATALOG_ONLY"));
}

export function parseRestrictedCheckoutError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as RestrictedErrorPayload;
  if (data.code !== "SUBSCRIPTION_RESTRICTED") return null;
  const message =
    typeof data.message === "string"
      ? data.message
      : "El checkout esta temporalmente deshabilitado por estado de suscripcion.";
  const ctaLabel = typeof data.cta?.label === "string" ? data.cta.label : "Actualizar plan";
  return { message, ctaLabel };
}

