export type MobileThemeTokens = {
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryText: string;
    border: string;
    danger: string;
    accent: string;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
  };
};

export type MobileBrandingConfig = {
  instanceId?: string;
  appName?: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  assets?: Record<string, string> | null;
  apiBaseUrl?: string | null;
  channel?: "stable" | "beta";
  configVersion?: number;
  themeTokens?: Partial<MobileThemeTokens>;
  ota?: {
    provider?: "eas" | "custom";
    channel?: string;
    runtimeVersion?: string;
    rolloutChannel?: string | null;
    updateUrl?: string | null;
  };
};

export function defaultMobileTheme(): MobileThemeTokens {
  return {
    colors: {
      background: "#f6f6f6",
      surface: "#ffffff",
      text: "#111111",
      textMuted: "#6b7280",
      primary: "#111111",
      primaryText: "#ffffff",
      border: "#e5e7eb",
      danger: "#dc2626",
      accent: "#f97316",
    },
    radii: { sm: 6, md: 8, lg: 12 },
  };
}

export function mergeThemeTokens(input?: Partial<MobileThemeTokens> | null): MobileThemeTokens {
  const base = defaultMobileTheme();
  return {
    colors: {
      ...base.colors,
      ...(input?.colors ?? {}),
    },
    radii: {
      ...base.radii,
      ...(input?.radii ?? {}),
    },
  };
}

export function resolveMobileBranding(input?: MobileBrandingConfig | null) {
  const theme = mergeThemeTokens(input?.themeTokens);
  return {
    appName: input?.appName?.trim() || "ERP Mobile",
    logoUrl: input?.logoUrl ?? null,
    iconUrl: input?.iconUrl ?? null,
    assets: input?.assets ?? null,
    apiBaseUrl: input?.apiBaseUrl ?? null,
    channel: input?.channel ?? "stable",
    configVersion: Math.max(1, Number(input?.configVersion ?? 1)),
    ota: {
      provider: input?.ota?.provider ?? "eas",
      channel: input?.ota?.channel ?? "stable",
      runtimeVersion: input?.ota?.runtimeVersion ?? "0.1.0",
      rolloutChannel: input?.ota?.rolloutChannel ?? null,
      updateUrl: input?.ota?.updateUrl ?? null,
    },
    theme,
  };
}

export function buildAppPalette(input?: MobileBrandingConfig | null) {
  const resolved =
    input && typeof input === "object" && "theme" in (input as any)
      ? (input as any)
      : resolveMobileBranding(input);
  return {
    bg: resolved.theme.colors.background,
    surface: resolved.theme.colors.surface,
    text: resolved.theme.colors.text,
    primary: resolved.theme.colors.primary,
    primaryText: resolved.theme.colors.primaryText,
    accent: resolved.theme.colors.accent,
    border: resolved.theme.colors.border,
    danger: resolved.theme.colors.danger,
    radii: resolved.theme.radii,
  };
}
