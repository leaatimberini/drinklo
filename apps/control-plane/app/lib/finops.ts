import { prisma } from "./prisma";

export type FinOpsUsageInput = {
  cpuUsagePct?: number;
  memoryUsedBytes?: bigint | null;
  diskUsedBytes?: bigint | null;
  networkRxDeltaBytes?: bigint | null;
  networkTxDeltaBytes?: bigint | null;
  dbSizeBytes?: bigint | null;
  storageSizeBytes?: bigint | null;
  jobsProcessed1h?: number;
};

export type FinOpsCostBreakdown = {
  totalUsd: number;
  byResource: Record<string, number>;
};

const DEFAULT_PRICING: Array<{
  resourceKey: string;
  unit: string;
  usdPerUnit: number;
  description: string;
}> = [
  { resourceKey: "cpu_vcpu_hour", unit: "vcpu-hour", usdPerUnit: 0.03, description: "CPU usage per vCPU hour" },
  { resourceKey: "memory_gb_hour", unit: "gb-hour", usdPerUnit: 0.004, description: "RAM usage per GB hour" },
  { resourceKey: "disk_gb_month", unit: "gb-month", usdPerUnit: 0.12, description: "Disk footprint per GB month" },
  { resourceKey: "network_gb", unit: "gb", usdPerUnit: 0.08, description: "Network transfer per GB" },
  { resourceKey: "db_gb_month", unit: "gb-month", usdPerUnit: 0.18, description: "Postgres data size per GB month" },
  { resourceKey: "storage_gb_month", unit: "gb-month", usdPerUnit: 0.023, description: "Object storage per GB month" },
  { resourceKey: "jobs_1k", unit: "1k-jobs", usdPerUnit: 0.01, description: "Background jobs per 1k units" },
];

const GB = 1024 * 1024 * 1024;
const HOURS_MONTH = 24 * 30;
let defaultsEnsuredAt = 0;

function asNumber(value: bigint | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

export async function ensureFinOpsPricingDefaults() {
  if (Date.now() - defaultsEnsuredAt < 5 * 60 * 1000) {
    return;
  }
  for (const entry of DEFAULT_PRICING) {
    await prisma.finOpsPricing.upsert({
      where: { resourceKey: entry.resourceKey },
      update: {},
      create: entry,
    });
  }
  defaultsEnsuredAt = Date.now();
}

export async function getFinOpsPricingMap() {
  await ensureFinOpsPricingDefaults();
  const rows = await prisma.finOpsPricing.findMany({ where: { enabled: true } });
  return Object.fromEntries(rows.map((row) => [row.resourceKey, row.usdPerUnit]));
}

export async function estimateMonthlyCost(usage: FinOpsUsageInput): Promise<FinOpsCostBreakdown> {
  const pricing = await getFinOpsPricingMap();
  const byResource: Record<string, number> = {};

  const cpuVcpuHours = Math.max(0, Number(usage.cpuUsagePct ?? 0) / 100) * HOURS_MONTH;
  byResource.cpu_vcpu_hour = cpuVcpuHours * (pricing.cpu_vcpu_hour ?? 0);

  const memoryGbHours = Math.max(0, asNumber(usage.memoryUsedBytes) / GB) * HOURS_MONTH;
  byResource.memory_gb_hour = memoryGbHours * (pricing.memory_gb_hour ?? 0);

  const diskGbMonth = Math.max(0, asNumber(usage.diskUsedBytes) / GB);
  byResource.disk_gb_month = diskGbMonth * (pricing.disk_gb_month ?? 0);

  const dbGbMonth = Math.max(0, asNumber(usage.dbSizeBytes) / GB);
  byResource.db_gb_month = dbGbMonth * (pricing.db_gb_month ?? 0);

  const storageGbMonth = Math.max(0, asNumber(usage.storageSizeBytes) / GB);
  byResource.storage_gb_month = storageGbMonth * (pricing.storage_gb_month ?? 0);

  const networkGb = Math.max(
    0,
    (asNumber(usage.networkRxDeltaBytes) + asNumber(usage.networkTxDeltaBytes)) / GB,
  );
  byResource.network_gb = networkGb * (pricing.network_gb ?? 0);

  const jobsIn1k = Math.max(0, Number(usage.jobsProcessed1h ?? 0)) / 1000;
  byResource.jobs_1k = jobsIn1k * (pricing.jobs_1k ?? 0);

  const totalUsd = Number(
    Object.values(byResource)
      .reduce((acc, current) => acc + current, 0)
      .toFixed(4),
  );

  return { totalUsd, byResource };
}

export function toBigIntOrNull(value: unknown): bigint | null {
  if (value == null || value === "") return null;
  try {
    const n = typeof value === "number" ? Math.trunc(value) : Number(String(value));
    if (!Number.isFinite(n) || n < 0) return null;
    return BigInt(n);
  } catch {
    return null;
  }
}

export function bigIntDelta(current: bigint | null, previous: bigint | null) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  return delta >= 0n ? delta : 0n;
}

