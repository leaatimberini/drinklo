ALTER TABLE "BillingPlan"
  ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "includedOrdersPerMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "gmvIncludedArs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "overagePerOrderArs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "gmvTiers" JSONB;

ALTER TABLE "BillingAccount"
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "monthlyOrders" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "monthlyGmvArs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "softLimitedAt" TIMESTAMP(3),
  ADD COLUMN "hardLimitedAt" TIMESTAMP(3);

CREATE TABLE "BillingUsageRecord" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "ordersCount" INTEGER NOT NULL DEFAULT 0,
  "gmvArs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPlanChange" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "fromPlanId" TEXT NOT NULL,
  "toPlanId" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "prorationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPlanChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingUsageRecord_accountId_periodStart_periodEnd_idx" ON "BillingUsageRecord"("accountId", "periodStart", "periodEnd");
CREATE INDEX "BillingPlanChange_accountId_effectiveAt_idx" ON "BillingPlanChange"("accountId", "effectiveAt");

ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "BillingUsageRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPlanChange" ADD CONSTRAINT "BillingPlanChange_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
