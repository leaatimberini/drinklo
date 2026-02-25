import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLAN_CATALOG } from "./plan-catalog";

test("default Plan C catalog is deterministic and complete", () => {
  assert.equal(DEFAULT_PLAN_CATALOG.length, 3);
  assert.deepEqual(
    DEFAULT_PLAN_CATALOG.map((item) => item.tier),
    ["C1", "C2", "C3"],
  );
  assert.deepEqual(DEFAULT_PLAN_CATALOG[0], {
    tier: "C1",
    ordersMonth: 2500,
    apiCallsMonth: 150000,
    storageGb: 10,
    pluginsMax: 5,
    branchesMax: 1,
    adminUsersMax: 5,
    sloTarget: "99.5%",
    drFrequency: "weekly",
    supportLevel: "standard",
  });
});

test("migration contains plan tier, subscription and usage counter schema", () => {
  const sql = readFileSync(
    join(process.cwd(), "prisma", "migrations", "20260226_plan_c_tiers_entitlements", "migration.sql"),
    "utf8",
  );
  assert.match(sql, /CREATE TYPE "PlanTier"/);
  assert.match(sql, /CREATE TABLE "PlanEntitlement"/);
  assert.match(sql, /CREATE TABLE "Subscription"/);
  assert.match(sql, /CREATE TABLE "UsageCounter"/);
});
