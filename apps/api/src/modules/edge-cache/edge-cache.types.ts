export const EdgeCacheHeaders = {
  catalog: "public, max-age=60, stale-while-revalidate=300",
  images: "public, max-age=86400, stale-while-revalidate=604800",
  assets: "public, max-age=31536000, immutable",
  sitemap: "public, max-age=600, stale-while-revalidate=3600",
};

export type InvalidationEvent = {
  instanceId: string;
  companyId?: string;
  reason: string;
  tags: string[];
  paths: string[];
  payload?: Record<string, any>;
};

export type WebVitalSample = {
  instanceId: string;
  name: string;
  value: number;
  rating?: string;
  path?: string;
  id?: string;
  userAgent?: string;
  ip?: string;
  capturedAt: string;
};
