import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveMobileBranding, type MobileBrandingConfig } from "../branding/whiteLabel";

const BRANDING_CACHE_KEY = "mobile_branding_config";
const DEFAULT_CONFIG_URL = process.env.EXPO_PUBLIC_MOBILE_BRANDING_CONFIG_URL ?? "";

export async function downloadBrandingConfig(input?: {
  configUrl?: string;
  instanceId?: string;
  channel?: "stable" | "beta";
}) {
  const explicit = String(input?.configUrl ?? "").trim();
  const base = explicit || DEFAULT_CONFIG_URL;
  if (!base) return null;

  const url = new URL(base);
  if (input?.instanceId && !url.searchParams.get("instanceId")) {
    url.searchParams.set("instanceId", input.instanceId);
  }
  if (input?.channel) {
    url.searchParams.set("channel", input.channel);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`branding config request failed: ${res.status}`);
  }
  const payload = (await res.json()) as any;
  const config = (payload?.config ?? payload) as MobileBrandingConfig;
  await AsyncStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(config));
  return resolveMobileBranding(config);
}

export async function getCachedBrandingConfig() {
  const raw = await AsyncStorage.getItem(BRANDING_CACHE_KEY);
  if (!raw) return null;
  try {
    return resolveMobileBranding(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearBrandingCache() {
  await AsyncStorage.removeItem(BRANDING_CACHE_KEY);
}

