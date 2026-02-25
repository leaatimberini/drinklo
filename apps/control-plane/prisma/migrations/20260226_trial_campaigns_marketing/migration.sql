CREATE TYPE "TrialCampaignTier" AS ENUM ('C1', 'C2');
CREATE TYPE "TrialCampaignStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "TrialRedemptionStatus" AS ENUM ('PENDING_APPROVAL', 'REDEEMED', 'REJECTED', 'BLOCKED', 'EXPIRED');

CREATE TABLE "TrialCampaign" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "tier" "TrialCampaignTier" NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "maxRedemptions" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "blockedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "status" "TrialCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "revokedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrialCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrialRedemption" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "companyId" TEXT,
  "instanceId" TEXT,
  "billingAccountId" TEXT,
  "email" TEXT,
  "emailDomain" TEXT,
  "ipHash" TEXT,
  "fingerprintHash" TEXT,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "TrialRedemptionStatus" NOT NULL DEFAULT 'REDEEMED',
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrialRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAttribution" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT,
  "redemptionId" TEXT,
  "companyId" TEXT,
  "instanceId" TEXT,
  "utmSource" TEXT,
  "utmCampaign" TEXT,
  "referral" TEXT,
  "landing" TEXT,
  "utmMedium" TEXT,
  "utmTerm" TEXT,
  "utmContent" TEXT,
  "ipHash" TEXT,
  "fingerprintHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialCampaign_code_key" ON "TrialCampaign"("code");
CREATE INDEX "TrialCampaign_status_createdAt_idx" ON "TrialCampaign"("status", "createdAt");
CREATE INDEX "TrialCampaign_tier_createdAt_idx" ON "TrialCampaign"("tier", "createdAt");
CREATE INDEX "TrialCampaign_expiresAt_idx" ON "TrialCampaign"("expiresAt");

CREATE INDEX "TrialRedemption_campaignId_redeemedAt_idx" ON "TrialRedemption"("campaignId", "redeemedAt");
CREATE INDEX "TrialRedemption_campaignId_status_redeemedAt_idx" ON "TrialRedemption"("campaignId", "status", "redeemedAt");
CREATE INDEX "TrialRedemption_emailDomain_redeemedAt_idx" ON "TrialRedemption"("emailDomain", "redeemedAt");
CREATE INDEX "TrialRedemption_fingerprintHash_redeemedAt_idx" ON "TrialRedemption"("fingerprintHash", "redeemedAt");
CREATE INDEX "TrialRedemption_ipHash_redeemedAt_idx" ON "TrialRedemption"("ipHash", "redeemedAt");
CREATE INDEX "TrialRedemption_instanceId_idx" ON "TrialRedemption"("instanceId");
CREATE INDEX "TrialRedemption_billingAccountId_idx" ON "TrialRedemption"("billingAccountId");

CREATE INDEX "LeadAttribution_campaignId_createdAt_idx" ON "LeadAttribution"("campaignId", "createdAt");
CREATE INDEX "LeadAttribution_redemptionId_idx" ON "LeadAttribution"("redemptionId");
CREATE INDEX "LeadAttribution_instanceId_idx" ON "LeadAttribution"("instanceId");
CREATE INDEX "LeadAttribution_utmSource_utmCampaign_createdAt_idx" ON "LeadAttribution"("utmSource", "utmCampaign", "createdAt");
