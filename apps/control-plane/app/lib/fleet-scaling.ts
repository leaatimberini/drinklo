import crypto from "node:crypto";

export const DEFAULT_FLEET_SHARD_COUNT = 64;

export type TechnicalQuota = {
  normalizedPlan: "starter" | "pro" | "enterprise";
  jobsPerMin: number;
  apiCallsPerMin: number;
  eventsPerMin: number;
  storageGb: number;
  webhooksPerMin: number;
};

export const TECHNICAL_QUOTA_MATRIX: Record<TechnicalQuota["normalizedPlan"], Omit<TechnicalQuota, "normalizedPlan">> = {
  starter: {
    jobsPerMin: 120,
    apiCallsPerMin: 600,
    eventsPerMin: 1200,
    storageGb: 20,
    webhooksPerMin: 120,
  },
  pro: {
    jobsPerMin: 600,
    apiCallsPerMin: 3000,
    eventsPerMin: 6000,
    storageGb: 200,
    webhooksPerMin: 600,
  },
  enterprise: {
    jobsPerMin: 5000,
    apiCallsPerMin: 30000,
    eventsPerMin: 50000,
    storageGb: 2000,
    webhooksPerMin: 5000,
  },
};

export type TechnicalUsage = {
  jobsPerMin?: number | null;
  apiCallsPerMin?: number | null;
  eventsPerMin?: number | null;
  storageGb?: number | null;
  webhooksPerMin?: number | null;
};

export function normalizePlan(planLike?: string | null): TechnicalQuota["normalizedPlan"] {
  const raw = String(planLike ?? "").toLowerCase();
  if (raw.includes("enterprise")) return "enterprise";
  if (raw.includes("starter")) return "starter";
  if (raw.includes("pro")) return "pro";
  return "pro";
}

export function resolveTechnicalQuota(planLike?: string | null): TechnicalQuota {
  const normalizedPlan = normalizePlan(planLike);
  return {
    normalizedPlan,
    ...TECHNICAL_QUOTA_MATRIX[normalizedPlan],
  };
}

export function computeShardKey(instanceId: string, shardCount = DEFAULT_FLEET_SHARD_COUNT) {
  const safeShardCount = Math.max(1, Math.trunc(shardCount || DEFAULT_FLEET_SHARD_COUNT));
  const hash = crypto.createHash("sha256").update(String(instanceId || "")).digest();
  const n = hash.readUInt32BE(0);
  return n % safeShardCount;
}

export function summarizeShardDistribution(instanceIds: string[], shardCount = DEFAULT_FLEET_SHARD_COUNT) {
  const buckets = Array.from({ length: Math.max(1, shardCount) }, (_, shard) => ({ shard, count: 0 }));
  for (const instanceId of instanceIds) {
    const shard = computeShardKey(instanceId, buckets.length);
    buckets[shard].count += 1;
  }
  const counts = buckets.map((b) => b.count);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const min = counts.length ? Math.min(...counts) : 0;
  const max = counts.length ? Math.max(...counts) : 0;
  const avg = counts.length ? total / counts.length : 0;
  const p95 = percentile(counts, 95);
  const imbalanceRatio = avg > 0 ? Number((max / avg).toFixed(3)) : 0;
  return {
    shardCount: buckets.length,
    totalInstances: total,
    avgPerShard: Number(avg.toFixed(2)),
    minPerShard: min,
    maxPerShard: max,
    p95PerShard: p95,
    imbalanceRatio,
    hotspots: buckets.filter((b) => avg > 0 && b.count > avg * 1.5).slice(0, 10),
    buckets,
  };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

export function evaluateTechnicalQuota(usage: TechnicalUsage, quota: TechnicalQuota) {
  const checks = [
    { key: "jobsPerMin", limit: quota.jobsPerMin, value: toNum(usage.jobsPerMin) },
    { key: "apiCallsPerMin", limit: quota.apiCallsPerMin, value: toNum(usage.apiCallsPerMin) },
    { key: "eventsPerMin", limit: quota.eventsPerMin, value: toNum(usage.eventsPerMin) },
    { key: "storageGb", limit: quota.storageGb, value: toNum(usage.storageGb) },
    { key: "webhooksPerMin", limit: quota.webhooksPerMin, value: toNum(usage.webhooksPerMin) },
  ] as const;

  const violations = checks
    .filter((c) => c.value != null && c.value > c.limit)
    .map((c) => ({
      metric: c.key,
      limit: c.limit,
      value: c.value!,
      ratio: Number((c.value! / c.limit).toFixed(2)),
    }));

  return {
    ok: violations.length === 0,
    checks: checks.map((c) => ({
      metric: c.key,
      value: c.value,
      limit: c.limit,
      ok: c.value == null ? true : c.value <= c.limit,
    })),
    violations,
  };
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type AutoTuningInput = {
  monthlyOrders?: number | null;
  eventsPerMin?: number | null;
  apiCallsPerMin?: number | null;
  jobsPerMin?: number | null;
  jobsPending?: number | null;
  cpuUsagePct?: number | null;
  memoryUsedBytes?: bigint | number | null;
  memoryTotalBytes?: bigint | number | null;
  trafficMultiplier?: number | null;
};

export function computeAutoTuningRecommendation(input: AutoTuningInput) {
  const monthlyOrders = Math.max(0, Number(input.monthlyOrders ?? 0));
  const eventsPerMin = Math.max(0, Number(input.eventsPerMin ?? 0));
  const apiCallsPerMin = Math.max(0, Number(input.apiCallsPerMin ?? 0));
  const jobsPerMin = Math.max(0, Number(input.jobsPerMin ?? 0));
  const jobsPending = Math.max(0, Number(input.jobsPending ?? 0));
  const cpuUsagePct = clamp(Number(input.cpuUsagePct ?? 0), 0, 100);
  const memoryUsed = bigToNumber(input.memoryUsedBytes);
  const memoryTotal = bigToNumber(input.memoryTotalBytes);
  const memoryPct = memoryTotal > 0 ? clamp((memoryUsed / memoryTotal) * 100, 0, 100) : 0;
  const trafficMultiplier = Math.max(0.5, Number(input.trafficMultiplier ?? 1));

  const loadScore =
    monthlyOrders / 800 +
    eventsPerMin / 1500 +
    apiCallsPerMin / 800 +
    jobsPerMin / 120 +
    jobsPending / 80 +
    cpuUsagePct / 35 +
    memoryPct / 40;
  const adjusted = loadScore * trafficMultiplier;

  const profile =
    adjusted < 2 ? "xs" : adjusted < 5 ? "s" : adjusted < 10 ? "m" : adjusted < 20 ? "l" : "xl";

  const base = {
    xs: { apiWorkers: 2, jobWorkers: 2, queueConcurrency: 4, cacheTtlSec: 60, cacheMaxItems: 2_000 },
    s: { apiWorkers: 4, jobWorkers: 4, queueConcurrency: 8, cacheTtlSec: 45, cacheMaxItems: 5_000 },
    m: { apiWorkers: 6, jobWorkers: 8, queueConcurrency: 16, cacheTtlSec: 30, cacheMaxItems: 15_000 },
    l: { apiWorkers: 10, jobWorkers: 16, queueConcurrency: 32, cacheTtlSec: 20, cacheMaxItems: 30_000 },
    xl: { apiWorkers: 16, jobWorkers: 32, queueConcurrency: 64, cacheTtlSec: 15, cacheMaxItems: 80_000 },
  }[profile];

  const backlogBoost = jobsPending > 200 ? 1.5 : jobsPending > 50 ? 1.25 : 1;
  const cpuThrottle = cpuUsagePct > 85 ? 0.8 : 1;
  const memThrottle = memoryPct > 90 ? 0.75 : 1;
  const modifier = backlogBoost * cpuThrottle * memThrottle;

  const apiWorkers = Math.max(1, Math.round(base.apiWorkers * modifier));
  const jobWorkers = Math.max(1, Math.round(base.jobWorkers * modifier));
  const queueConcurrency = Math.max(1, Math.round(base.queueConcurrency * modifier));
  const cacheTtlSec = Math.max(10, Math.round(base.cacheTtlSec * (cpuUsagePct > 85 ? 1.5 : 1)));
  const cacheMaxItems = Math.max(1000, Math.round(base.cacheMaxItems * (memoryPct > 90 ? 0.7 : 1)));

  return {
    profile,
    score: Number(adjusted.toFixed(2)),
    workers: { api: apiWorkers, jobs: jobWorkers },
    queues: { defaultConcurrency: queueConcurrency, retryBackoffBaseMs: 500 },
    cache: { ttlSec: cacheTtlSec, maxItems: cacheMaxItems },
    signals: {
      monthlyOrders,
      eventsPerMin,
      apiCallsPerMin,
      jobsPerMin,
      jobsPending,
      cpuUsagePct: Number(cpuUsagePct.toFixed(1)),
      memoryPct: Number(memoryPct.toFixed(1)),
    },
  };
}

function bigToNumber(v: bigint | number | null | undefined) {
  if (typeof v === "bigint") return Number(v);
  return Number(v ?? 0);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function buildFleetInstanceScaling(input: {
  instanceId: string;
  planName?: string | null;
  monthlyOrders?: number | null;
  eventsTotal1h?: number | null;
  jobsProcessed1h?: number | null;
  jobsPending?: number | null;
  apiCallsPerMin?: number | null;
  webhooksPerMin?: number | null;
  storageSizeBytes?: bigint | number | null;
  cpuUsagePct?: number | null;
  memoryUsedBytes?: bigint | number | null;
  memoryTotalBytes?: bigint | number | null;
}) {
  const quota = resolveTechnicalQuota(input.planName);
  const usage: TechnicalUsage = {
    jobsPerMin: toNum(input.jobsProcessed1h) != null ? Number(input.jobsProcessed1h) / 60 : null,
    apiCallsPerMin: toNum(input.apiCallsPerMin),
    eventsPerMin: toNum(input.eventsTotal1h) != null ? Number(input.eventsTotal1h) / 60 : null,
    storageGb: toNum(input.storageSizeBytes) != null ? Number(input.storageSizeBytes) / 1_000_000_000 : null,
    webhooksPerMin: toNum(input.webhooksPerMin),
  };
  const quotaCheck = evaluateTechnicalQuota(usage, quota);
  const tuning = computeAutoTuningRecommendation({
    monthlyOrders: input.monthlyOrders,
    eventsPerMin: usage.eventsPerMin,
    apiCallsPerMin: usage.apiCallsPerMin,
    jobsPerMin: usage.jobsPerMin,
    jobsPending: input.jobsPending,
    cpuUsagePct: input.cpuUsagePct,
    memoryUsedBytes: input.memoryUsedBytes,
    memoryTotalBytes: input.memoryTotalBytes,
  });
  return {
    instanceId: input.instanceId,
    shardKey: computeShardKey(input.instanceId),
    quota,
    usage,
    quotaCheck,
    tuning,
  };
}

export function simulateFleetStability(input: {
  instances: number;
  shardCount?: number;
  planMix?: Partial<Record<TechnicalQuota["normalizedPlan"], number>>;
  seed?: number;
}) {
  const total = Math.max(1, Math.min(50_000, Math.trunc(input.instances || 1)));
  const shardCount = Math.max(1, Math.min(1024, Math.trunc(input.shardCount || DEFAULT_FLEET_SHARD_COUNT)));
  const rng = createLcg(input.seed ?? 42);
  const mix = normalizePlanMix(input.planMix);
  const rows: Array<ReturnType<typeof buildFleetInstanceScaling>> = [];

  for (let i = 0; i < total; i += 1) {
    const plan = pickPlan(rng(), mix);
    const loadFactor = plan === "enterprise" ? 10 : plan === "pro" ? 3 : 1;
    rows.push(
      buildFleetInstanceScaling({
        instanceId: `sim-${i.toString().padStart(5, "0")}`,
        planName: plan,
        monthlyOrders: Math.round(randRange(rng, 50, 1500) * loadFactor),
        eventsTotal1h: Math.round(randRange(rng, 100, 10_000) * loadFactor),
        jobsProcessed1h: Math.round(randRange(rng, 30, 4000) * loadFactor),
        jobsPending: Math.round(randRange(rng, 0, 600) * Math.min(loadFactor, 4)),
        apiCallsPerMin: Math.round(randRange(rng, 20, 1200) * loadFactor),
        webhooksPerMin: Math.round(randRange(rng, 5, 500) * loadFactor),
        storageSizeBytes: Math.round(randRange(rng, 0.5, 800) * 1_000_000_000 * loadFactor),
        cpuUsagePct: randRange(rng, 20, 95),
        memoryUsedBytes: Math.round(randRange(rng, 0.5, 7) * 1_000_000_000),
        memoryTotalBytes: 8_000_000_000,
      }),
    );
  }

  const shardDistribution = summarizeShardDistribution(rows.map((r) => r.instanceId), shardCount);
  const quotaViolations = rows.filter((r) => !r.quotaCheck.ok).length;
  const overloaded = rows.filter((r) => r.tuning.profile === "xl" && r.tuning.signals.cpuUsagePct > 90).length;
  const avgQueueConcurrency =
    rows.reduce((sum, r) => sum + r.tuning.queues.defaultConcurrency, 0) / Math.max(1, rows.length);
  const stable =
    shardDistribution.imbalanceRatio <= 1.5 &&
    quotaViolations / rows.length < 0.35 &&
    overloaded / rows.length < 0.2;

  return {
    stable,
    instances: rows.length,
    shardDistribution,
    summary: {
      quotaViolations,
      overloaded,
      avgQueueConcurrency: Number(avgQueueConcurrency.toFixed(2)),
      byPlan: rows.reduce(
        (acc, row) => {
          acc[row.quota.normalizedPlan] += 1;
          return acc;
        },
        { starter: 0, pro: 0, enterprise: 0 } as Record<TechnicalQuota["normalizedPlan"], number>,
      ),
      tuningProfiles: rows.reduce(
        (acc, row) => {
          acc[row.tuning.profile] = (acc[row.tuning.profile] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
    sample: rows.slice(0, 25),
  };
}

function createLcg(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function randRange(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng();
}

function normalizePlanMix(mix?: Partial<Record<TechnicalQuota["normalizedPlan"], number>>) {
  const starter = Math.max(0, Number(mix?.starter ?? 0.6));
  const pro = Math.max(0, Number(mix?.pro ?? 0.3));
  const enterprise = Math.max(0, Number(mix?.enterprise ?? 0.1));
  const total = starter + pro + enterprise || 1;
  return {
    starter: starter / total,
    pro: pro / total,
    enterprise: enterprise / total,
  };
}

function pickPlan(r: number, mix: { starter: number; pro: number; enterprise: number }): TechnicalQuota["normalizedPlan"] {
  if (r < mix.starter) return "starter";
  if (r < mix.starter + mix.pro) return "pro";
  return "enterprise";
}

