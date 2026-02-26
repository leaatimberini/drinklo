-- CreateEnum
CREATE TYPE "PricingExperimentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateTable
CREATE TABLE "PricingExperiment" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "PricingExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "targetTier" TEXT NOT NULL,
  "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
  "currencies" TEXT[] NOT NULL DEFAULT ARRAY['USD']::TEXT[],
  "trialCampaignCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "icpFilters" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "description" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingExperiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingExperimentVariant" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "isControl" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingExperimentVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingExperimentAssignment" (
  "id" TEXT NOT NULL,
  "experimentId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "installationId" TEXT,
  "billingAccountId" TEXT,
  "leadAttributionId" TEXT,
  "trialRedemptionId" TEXT,
  "instanceId" TEXT,
  "stickyKeyHash" TEXT NOT NULL,
  "cookieIdHash" TEXT,
  "emailDomain" TEXT,
  "source" TEXT NOT NULL DEFAULT 'signup',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "offerGrantedAt" TIMESTAMP(3),
  "offerExpiresAt" TIMESTAMP(3),
  "offerConsumedCycles" INTEGER NOT NULL DEFAULT 0,
  "offerMaxCycles" INTEGER,
  "offerStatus" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "offerMeta" JSONB,
  "lastInvoiceId" TEXT,
  "lastAppliedAt" TIMESTAMP(3),
  "abuseBlockedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PricingExperiment_key_key" ON "PricingExperiment"("key");
CREATE INDEX "PricingExperiment_status_targetTier_createdAt_idx" ON "PricingExperiment"("status", "targetTier", "createdAt");
CREATE INDEX "PricingExperiment_startAt_endAt_idx" ON "PricingExperiment"("startAt", "endAt");

CREATE UNIQUE INDEX "PricingExperimentVariant_experimentId_key_key" ON "PricingExperimentVariant"("experimentId", "key");
CREATE INDEX "PricingExperimentVariant_experimentId_weight_idx" ON "PricingExperimentVariant"("experimentId", "weight");

CREATE UNIQUE INDEX "PricingExperimentAssignment_experimentId_stickyKeyHash_key" ON "PricingExperimentAssignment"("experimentId", "stickyKeyHash");
CREATE INDEX "PricingExperimentAssignment_billingAccountId_offerStatus_updatedAt_idx" ON "PricingExperimentAssignment"("billingAccountId", "offerStatus", "updatedAt");
CREATE INDEX "PricingExperimentAssignment_leadAttributionId_idx" ON "PricingExperimentAssignment"("leadAttributionId");
CREATE INDEX "PricingExperimentAssignment_trialRedemptionId_idx" ON "PricingExperimentAssignment"("trialRedemptionId");
CREATE INDEX "PricingExperimentAssignment_instanceId_assignedAt_idx" ON "PricingExperimentAssignment"("instanceId", "assignedAt");
CREATE INDEX "PricingExperimentAssignment_variantId_assignedAt_idx" ON "PricingExperimentAssignment"("variantId", "assignedAt");

-- FKs
ALTER TABLE "PricingExperimentVariant"
ADD CONSTRAINT "PricingExperimentVariant_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "PricingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingExperimentAssignment"
ADD CONSTRAINT "PricingExperimentAssignment_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "PricingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingExperimentAssignment"
ADD CONSTRAINT "PricingExperimentAssignment_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "PricingExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingExperimentAssignment"
ADD CONSTRAINT "PricingExperimentAssignment_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingExperimentAssignment"
ADD CONSTRAINT "PricingExperimentAssignment_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingExperimentAssignment"
ADD CONSTRAINT "PricingExperimentAssignment_leadAttributionId_fkey"
FOREIGN KEY ("leadAttributionId") REFERENCES "LeadAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
