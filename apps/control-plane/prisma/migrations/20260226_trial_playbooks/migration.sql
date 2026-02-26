CREATE TYPE "TrialPlaybookKey" AS ENUM (
  'D3_NO_CATALOG_IMPORT',
  'D7_NO_FIRST_SALE_POS_NUDGE',
  'D21_WHOLESALE_UPGRADE_OFFER',
  'D3_BEFORE_TRIAL_END_ADD_PAYMENT'
);

CREATE TABLE "TrialPlaybookConfig" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "playbookKey" "TrialPlaybookKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "config" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrialPlaybookConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrialPlaybookRun" (
  "id" TEXT NOT NULL,
  "playbookKey" "TrialPlaybookKey" NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "campaignId" TEXT,
  "campaignCode" TEXT,
  "billingAccountId" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TRIGGERED',
  "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT,
  "triggerDateBa" TEXT,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialPlaybookRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialPlaybookConfig_campaignId_playbookKey_key"
ON "TrialPlaybookConfig"("campaignId", "playbookKey");

CREATE INDEX "TrialPlaybookConfig_campaignId_enabled_idx"
ON "TrialPlaybookConfig"("campaignId", "enabled");

CREATE INDEX "TrialPlaybookConfig_playbookKey_enabled_idx"
ON "TrialPlaybookConfig"("playbookKey", "enabled");

CREATE UNIQUE INDEX "TrialPlaybookRun_dedupeKey_key"
ON "TrialPlaybookRun"("dedupeKey");

CREATE INDEX "TrialPlaybookRun_campaignId_createdAt_idx"
ON "TrialPlaybookRun"("campaignId", "createdAt");

CREATE INDEX "TrialPlaybookRun_billingAccountId_createdAt_idx"
ON "TrialPlaybookRun"("billingAccountId", "createdAt");

CREATE INDEX "TrialPlaybookRun_playbookKey_createdAt_idx"
ON "TrialPlaybookRun"("playbookKey", "createdAt");

CREATE INDEX "TrialPlaybookRun_instanceId_createdAt_idx"
ON "TrialPlaybookRun"("instanceId", "createdAt");

CREATE INDEX "TrialPlaybookRun_status_createdAt_idx"
ON "TrialPlaybookRun"("status", "createdAt");

ALTER TABLE "TrialPlaybookConfig"
ADD CONSTRAINT "TrialPlaybookConfig_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "TrialCampaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
