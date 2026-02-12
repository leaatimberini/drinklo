export type LicensePayload = {
  companyId: string;
  plan: string;
  expiresAt: string;
  features: string[];
  issuedAt: string;
};

export type LicenseValidationResult = {
  valid: boolean;
  plan: string | null;
  expiresAt: string | null;
  features: string[];
  source: "local" | "remote";
  reason?: string;
};

export type LicenseEnforcementResult = {
  stage: "ok" | "warning" | "soft_limit" | "hard_limit";
  message?: string;
  basicSalesAllowed: true;
  premiumBlocked: boolean;
};

export const PremiumFeatures = {
  AFIP: "afip",
  ANDREANI: "andreani",
  MERCADOLIBRE: "mercadolibre",
  RAPPI: "rappi",
  PEDIDOSYA: "pedidosya",
  EMAIL_AI: "email_ai",
} as const;

export type PremiumFeature = (typeof PremiumFeatures)[keyof typeof PremiumFeatures];
