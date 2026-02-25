type LifecycleBanner = {
  kind: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_RESTRICTED_CAPABILITIES = {
  keepsData: true,
  basicSalesAllowed: true,
  blockedActions: [
    "premium_features",
    "new_plugins_install",
    "new_branches_creation",
    "advanced_integrations",
  ],
  degradedActions: ["admin_write_non_critical"],
};

export function computeLifecycleBanners(subscription: {
  status: string;
  trialEndAt?: Date | string | null;
  graceEndAt?: Date | string | null;
}) {
  const now = new Date();
  const banners: LifecycleBanner[] = [];
  const trialEndAt = subscription.trialEndAt ? new Date(subscription.trialEndAt) : null;
  const graceEndAt = subscription.graceEndAt ? new Date(subscription.graceEndAt) : null;

  if (subscription.status === "TRIAL_ACTIVE" && trialEndAt) {
    const daysLeft = Math.ceil((trialEndAt.getTime() - now.getTime()) / DAY_MS);
    if ([7, 3, 1].includes(daysLeft)) {
      banners.push({
        kind: `trial_reminder_${daysLeft}`,
        severity: "warning",
        title: `Trial finaliza en ${daysLeft} dia(s)`,
        message: "Revisar plan y facturacion para evitar pasar a gracia/restringido.",
      });
    } else if (daysLeft <= 0) {
      banners.push({
        kind: "trial_expired",
        severity: "danger",
        title: "Trial expirado",
        message: "El ciclo de trial expiro. Se aplican politicas de gracia/restriccion segun estado.",
      });
    }
  }

  if (subscription.status === "PAST_DUE") {
    banners.push({
      kind: "past_due",
      severity: "warning",
      title: "Pago vencido",
      message: "Suscripcion en mora. Regularizar pago para evitar pasar a gracia/restringido.",
    });
  }

  if (subscription.status === "GRACE") {
    const suffix = graceEndAt ? ` (vence ${graceEndAt.toLocaleString()})` : "";
    banners.push({
      kind: "grace",
      severity: "warning",
      title: "Periodo de gracia activo",
      message: `Regularizar pago/plan antes de restriccion${suffix}.`,
    });
  }

  if (subscription.status === "RESTRICTED") {
    banners.push({
      kind: "restricted",
      severity: "danger",
      title: "Suscripcion restringida",
      message: "No se borran datos. Se limitan capacidades premium y operaciones no esenciales.",
    });
  }

  return banners;
}

