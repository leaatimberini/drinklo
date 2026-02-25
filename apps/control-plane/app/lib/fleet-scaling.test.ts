import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFleetInstanceScaling,
  computeAutoTuningRecommendation,
  evaluateTechnicalQuota,
  resolveTechnicalQuota,
  simulateFleetStability,
  summarizeShardDistribution,
} from "./fleet-scaling";

test("unknown plan falls back to pro quotas", () => {
  const quota = resolveTechnicalQuota("weird-custom-plan");
  assert.equal(quota.normalizedPlan, "pro");
  assert.equal(quota.apiCallsPerMin, 3000);
});

test("quota evaluation flags exceeded limits", () => {
  const quota = resolveTechnicalQuota("starter");
  const result = evaluateTechnicalQuota(
    { jobsPerMin: 200, apiCallsPerMin: 500, storageGb: 25, eventsPerMin: 1000, webhooksPerMin: 10 },
    quota,
  );
  assert.equal(result.ok, false);
  assert.ok(result.violations.find((v) => v.metric === "jobsPerMin"));
  assert.ok(result.violations.find((v) => v.metric === "storageGb"));
});

test("shard distribution remains balanced at scale", () => {
  const ids = Array.from({ length: 5000 }, (_, i) => `instance-${i}`);
  const distribution = summarizeShardDistribution(ids, 64);
  assert.equal(distribution.totalInstances, 5000);
  assert.ok(distribution.imbalanceRatio < 1.5, `imbalance ratio too high: ${distribution.imbalanceRatio}`);
});

test("auto tuning increases worker counts for high load", () => {
  const low = computeAutoTuningRecommendation({
    monthlyOrders: 100,
    eventsPerMin: 20,
    jobsPerMin: 5,
    jobsPending: 0,
    cpuUsagePct: 20,
    memoryUsedBytes: 1_000_000_000,
    memoryTotalBytes: 8_000_000_000,
  });
  const high = computeAutoTuningRecommendation({
    monthlyOrders: 5000,
    eventsPerMin: 5000,
    apiCallsPerMin: 3000,
    jobsPerMin: 400,
    jobsPending: 300,
    cpuUsagePct: 70,
    memoryUsedBytes: 6_500_000_000,
    memoryTotalBytes: 8_000_000_000,
  });
  assert.ok(high.workers.api >= low.workers.api);
  assert.ok(high.workers.jobs >= low.workers.jobs);
  assert.ok(high.queues.defaultConcurrency >= low.queues.defaultConcurrency);
});

test("fleet simulation with thousands of instances returns stable summary shape", () => {
  const sim = simulateFleetStability({ instances: 3000, shardCount: 64, seed: 123 });
  assert.equal(sim.instances, 3000);
  assert.equal(typeof sim.stable, "boolean");
  assert.ok(sim.shardDistribution.avgPerShard > 0);
  assert.ok(sim.summary.byPlan.starter + sim.summary.byPlan.pro + sim.summary.byPlan.enterprise === 3000);
});

test("instance scaling view includes shard/quota/tuning", () => {
  const view = buildFleetInstanceScaling({
    instanceId: "inst-demo",
    planName: "enterprise",
    monthlyOrders: 20000,
    eventsTotal1h: 120_000,
    jobsProcessed1h: 20_000,
    jobsPending: 50,
    storageSizeBytes: 50n * 1_000_000_000n,
    cpuUsagePct: 45,
    memoryUsedBytes: 4n * 1_000_000_000n,
    memoryTotalBytes: 8n * 1_000_000_000n,
  });
  assert.equal(view.instanceId, "inst-demo");
  assert.equal(view.quota.normalizedPlan, "enterprise");
  assert.equal(typeof view.shardKey, "number");
  assert.ok(view.tuning.workers.api >= 1);
});

