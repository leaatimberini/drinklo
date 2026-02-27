CREATE TYPE "PlanTier" AS ENUM ('C1', 'C2', 'C3');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL_ACTIVE', 'ACTIVE_PAID', 'PAST_DUE', 'GRACE', 'RESTRICTED', 'CANCELLED');

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "tier" "PlanTier" NOT NULL,
  "ordersMonth" INTEGER NOT NULL,
  "apiCallsMonth" INTEGER NOT NULL,
  "storageGb" INTEGER NOT NULL,
  "pluginsMax" INTEGER NOT NULL,
  "branchesMax" INTEGER NOT NULL,
  "adminUsersMax" INTEGER NOT NULL,
  "sloTarget" TEXT NOT NULL,
  "drFrequency" TEXT NOT NULL,
  "supportLevel" TEXT NOT NULL,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "currentTier" "PlanTier" NOT NULL,
  "nextTier" "PlanTier",
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "trialEndAt" TIMESTAMP(3),
  "graceEndAt" TIMESTAMP(3),
  "lastPaymentAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "billingProvider" TEXT,
  "mpPreapprovalId" TEXT,
  "mpPreapprovalStatus" TEXT,
  "mpNextBillingDate" TIMESTAMP(3),
  "mpSubscriptionRaw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageCounter" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "ordersCount" INTEGER NOT NULL DEFAULT 0,
  "apiCallsCount" INTEGER NOT NULL DEFAULT 0,
  "storageGbUsed" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "pluginsCount" INTEGER NOT NULL DEFAULT 0,
  "branchesCount" INTEGER NOT NULL DEFAULT 0,
  "adminUsersCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanEntitlement_tier_key" ON "PlanEntitlement"("tier");

CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_currentTier_idx" ON "Subscription"("currentTier");
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_mpPreapprovalId_key" ON "Subscription"("mpPreapprovalId");
CREATE INDEX IF NOT EXISTS "Subscription_mpPreapprovalStatus_idx" ON "Subscription"("mpPreapprovalStatus");

CREATE UNIQUE INDEX "UsageCounter_companyId_periodKey_key" ON "UsageCounter"("companyId", "periodKey");
CREATE INDEX "UsageCounter_companyId_periodStart_idx" ON "UsageCounter"("companyId", "periodStart");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

