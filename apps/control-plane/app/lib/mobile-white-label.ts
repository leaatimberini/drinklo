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
  instanceId: string;
  companyId?: string | null;
  appName: string;
  appSlug: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  splashUrl?: string | null;
  assets?: Record<string, string> | null;
  apiBaseUrl?: string | null;
  channel: "stable" | "beta";
  configVersion: number;
  themeTokens: MobileThemeTokens;
  ota: {
    provider: "eas" | "custom";
    channel: string;
    runtimeVersion: string;
    branch?: string | null;
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

export function mergeMobileTheme(input?: Partial<MobileThemeTokens> | null): MobileThemeTokens {
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

export function normalizeOtaChannel(
  requestedChannel: string | null | undefined,
  installationReleaseChannel: string | null | undefined,
  defaultChannel: string | null | undefined,
) {
  const explicit = String(requestedChannel ?? "").trim().toLowerCase();
  if (explicit === "stable" || explicit === "beta") return explicit as "stable" | "beta";

  const release = String(installationReleaseChannel ?? "").trim().toLowerCase();
  if (release === "stable" || release === "beta") return release as "stable" | "beta";

  const fallback = String(defaultChannel ?? "").trim().toLowerCase();
  return fallback === "beta" ? "beta" : "stable";
}

export function buildWhiteLabelMobileConfig(input: {
  instanceId: string;
  companyId?: string | null;
  apiBaseUrl?: string | null;
  appName: string;
  appSlug: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  splashUrl?: string | null;
  assets?: Record<string, string> | null;
  themeTokens?: Partial<MobileThemeTokens> | null;
  configVersion?: number | null;
  ota: {
    provider?: "eas" | "custom";
    stableChannel?: string | null;
    betaChannel?: string | null;
    requestedChannel?: string | null;
    installationReleaseChannel?: string | null;
    runtimeVersion?: string | null;
    appVersion?: string | null;
    updateUrl?: string | null;
  };
}) {
  const channel = normalizeOtaChannel(
    input.ota.requestedChannel,
    input.ota.installationReleaseChannel,
    "stable",
  );
  const stableChannel = String(input.ota.stableChannel ?? "stable");
  const betaChannel = String(input.ota.betaChannel ?? "beta");
  const effectiveChannelName = channel === "beta" ? betaChannel : stableChannel;
  const runtimeVersion = String(input.ota.runtimeVersion ?? input.ota.appVersion ?? "1.0.0");

  return {
    instanceId: input.instanceId,
    companyId: input.companyId ?? null,
    appName: input.appName,
    appSlug: input.appSlug,
    logoUrl: input.logoUrl ?? null,
    iconUrl: input.iconUrl ?? null,
    splashUrl: input.splashUrl ?? null,
    assets: input.assets ?? null,
    apiBaseUrl: input.apiBaseUrl ?? null,
    channel,
    configVersion: Math.max(1, Number(input.configVersion ?? 1)),
    themeTokens: mergeMobileTheme(input.themeTokens ?? undefined),
    ota: {
      provider: input.ota.provider ?? "eas",
      channel: effectiveChannelName,
      runtimeVersion,
      branch: effectiveChannelName,
      rolloutChannel: input.ota.installationReleaseChannel ?? null,
      updateUrl: input.ota.updateUrl ?? null,
    },
  } satisfies MobileBrandingConfig;
}

export function buildExpoBuildProfile(input: {
  instanceId: string;
  appName: string;
  appSlug: string;
  channel: "stable" | "beta";
  appVersion: string;
  runtimeVersion?: string | null;
  apiBaseUrl?: string | null;
  configUrl?: string | null;
  assets?: Record<string, string> | null;
}) {
  const runtimeVersion = String(input.runtimeVersion ?? input.appVersion);
  const profileName = `${input.instanceId}-${input.channel}`;
  return {
    profileName,
    channel: input.channel,
    runtimeVersion,
    appVersion: input.appVersion,
    eas: {
      channel: input.channel,
      branch: input.channel,
      autoIncrement: false,
    },
    expo: {
      name: input.appName,
      slug: input.appSlug,
      runtimeVersion,
      extra: {
        instanceId: input.instanceId,
        otaChannel: input.channel,
        apiUrl: input.apiBaseUrl ?? null,
        brandingConfigUrl: input.configUrl ?? null,
        assets: input.assets ?? {},
      },
    },
  };
}

export function buildMobileOtaPublication(input: {
  instanceId: string;
  requestedChannel?: string | null;
  installationReleaseChannel?: string | null;
  stableChannel?: string | null;
  betaChannel?: string | null;
  targetVersion: string;
  runtimeVersion: string;
  releaseId?: string | null;
  message?: string | null;
}) {
  const channel = normalizeOtaChannel(
    input.requestedChannel,
    input.installationReleaseChannel,
    "stable",
  );
  return {
    channel,
    rolloutChannel: input.installationReleaseChannel ?? null,
    otaChannelName: channel === "beta" ? String(input.betaChannel ?? "beta") : String(input.stableChannel ?? "stable"),
    targetVersion: input.targetVersion,
    runtimeVersion: input.runtimeVersion,
    releaseId: input.releaseId ?? null,
    message: input.message ?? null,
    status: "PUBLISHED" as const,
  };
}

