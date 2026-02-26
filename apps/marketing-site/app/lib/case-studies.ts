import { buildControlPlaneUrl } from "./marketing-site";

export type PublicCaseStudy = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  summary: string;
  icp?: string | null;
  tags: string[];
  stack: string[];
  timeframeDays?: number | null;
  metrics?: {
    before?: Array<{ key: string; label: string; value: string | number }>;
    after?: Array<{ key: string; label: string; value: string | number }>;
    highlights?: Array<{ key: string; label: string; value: string | number }>;
  } | null;
  content?: {
    context?: string;
    problem?: string;
    solution?: string;
    metricsBeforeAfter?: string;
    stack?: string;
    timing?: string;
  } | null;
  publishedAt?: string | null;
  installation?: { clientName?: string | null; domain?: string | null; instanceId?: string | null };
};

export async function fetchPublicCaseStudies() {
  const res = await fetch(buildControlPlaneUrl("/api/case-studies/public"), {
    next: { revalidate: 300 },
    headers: { "x-marketing-site": "1" },
  }).catch(() => null);
  if (!res || !res.ok) return { items: [] as PublicCaseStudy[] };
  return (await res.json()) as { items: PublicCaseStudy[] };
}

export async function fetchPublicCaseStudy(slug: string) {
  const res = await fetch(buildControlPlaneUrl(`/api/case-studies/public?slug=${encodeURIComponent(slug)}`), {
    next: { revalidate: 300 },
    headers: { "x-marketing-site": "1" },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const body = (await res.json()) as { item?: PublicCaseStudy };
  return body.item ?? null;
}
