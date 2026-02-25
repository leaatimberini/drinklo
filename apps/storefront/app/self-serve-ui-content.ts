export type PricingTierCard = {
  tier: "C1" | "C2" | "C3";
  label: string;
  tagline: string;
  limits: Array<{ key: string; value: string }>;
  benefits: string[];
  recommended?: boolean;
};

export const storefrontSelfServeNav = [
  { href: "/pricing", label: "Pricing" },
  { href: "/billing/manage", label: "Billing Manage" },
  { href: "/", label: "Catalogo" },
] as const;

export const pricingTierCards: PricingTierCard[] = [
  {
    tier: "C1",
    label: "C1",
    tagline: "Inicio rapido para una operacion chica",
    limits: [
      { key: "Pedidos/mes", value: "1.000" },
      { key: "API calls/mes", value: "50.000" },
      { key: "Storage", value: "10 GB" },
      { key: "Sucursales", value: "1" },
      { key: "Admins", value: "3" },
    ],
    benefits: ["Storefront + POS", "Bot consultas", "Reportes base", "Soporte standard"],
  },
  {
    tier: "C2",
    label: "C2",
    tagline: "Escala comercial con automatizaciones y mas volumen",
    recommended: true,
    limits: [
      { key: "Pedidos/mes", value: "10.000" },
      { key: "API calls/mes", value: "500.000" },
      { key: "Storage", value: "50 GB" },
      { key: "Sucursales", value: "5" },
      { key: "Admins", value: "15" },
    ],
    benefits: ["Automatizaciones marketing", "Integraciones marketplace", "Dashboards ampliados", "Soporte prioritario"],
  },
  {
    tier: "C3",
    label: "C3",
    tagline: "Operacion avanzada multi-sucursal e integraciones enterprise",
    limits: [
      { key: "Pedidos/mes", value: "100.000" },
      { key: "API calls/mes", value: "5.000.000" },
      { key: "Storage", value: "250 GB" },
      { key: "Sucursales", value: "25" },
      { key: "Admins", value: "50" },
    ],
    benefits: ["SLA/SLO avanzado", "DR mas frecuente", "Soporte enterprise", "Capacidad operativa extendida"],
  },
];

export const pricingLegalCopy = {
  trialTerms: [
    "Trial de 30 dias corridos desde la activacion.",
    "Se puede solicitar extension manual sujeto a aprobacion del proveedor.",
    "Al terminar el trial puede aplicar GRACE y luego RESTRICTED segun la politica vigente.",
  ],
  graceRestricted: [
    "GRACE permite regularizar pago sin borrar datos.",
    "RESTRICTED no borra datos: limita capacidades premium y operaciones no esenciales.",
    "La variante RESTRICTED puede ser catalog-only o allow-basic-sales segun configuracion del proveedor.",
  ],
  marketingConsent: [
    "El consentimiento de marketing debe solicitarse por separado.",
    "Aceptar terminos del servicio no implica aceptar comunicaciones promocionales.",
  ],
} as const;

