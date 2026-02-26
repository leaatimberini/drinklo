CREATE TYPE "CrmDealStage" AS ENUM ('NEW', 'CONTACTED', 'DEMO', 'TRIAL', 'NEGOTIATION', 'WON', 'LOST');

CREATE TABLE "CrmLead" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT,
  "companyId" TEXT,
  "leadAttributionId" TEXT,
  "trialCampaignId" TEXT,
  "trialRedemptionId" TEXT,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "companyName" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "businessType" TEXT,
  "ownerUserId" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDeal" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT,
  "companyId" TEXT,
  "billingAccountId" TEXT,
  "sourceTrialCampaignId" TEXT,
  "sourceTrialRedemptionId" TEXT,
  "title" TEXT NOT NULL,
  "stage" "CrmDealStage" NOT NULL DEFAULT 'NEW',
  "ownerUserId" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "amount" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source" TEXT NOT NULL DEFAULT 'manual',
  "lossReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDealStageTransition" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "fromStage" "CrmDealStage",
  "toStage" "CrmDealStage" NOT NULL,
  "reason" TEXT,
  "changedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDealStageTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDealNote" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDealNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDealTask" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "doneAt" TIMESTAMP(3),
  "assignedTo" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmDealTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDealAttachment" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDealAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmDeal_sourceTrialRedemptionId_key" ON "CrmDeal"("sourceTrialRedemptionId");
CREATE INDEX "CrmLead_email_createdAt_idx" ON "CrmLead"("email", "createdAt");
CREATE INDEX "CrmLead_businessType_createdAt_idx" ON "CrmLead"("businessType", "createdAt");
CREATE INDEX "CrmLead_ownerUserId_createdAt_idx" ON "CrmLead"("ownerUserId", "createdAt");
CREATE INDEX "CrmLead_trialCampaignId_createdAt_idx" ON "CrmLead"("trialCampaignId", "createdAt");
CREATE INDEX "CrmLead_trialRedemptionId_idx" ON "CrmLead"("trialRedemptionId");
CREATE INDEX "CrmLead_status_createdAt_idx" ON "CrmLead"("status", "createdAt");
CREATE INDEX "CrmLead_installationId_createdAt_idx" ON "CrmLead"("installationId", "createdAt");
CREATE INDEX "CrmDeal_stage_createdAt_idx" ON "CrmDeal"("stage", "createdAt");
CREATE INDEX "CrmDeal_ownerUserId_stage_idx" ON "CrmDeal"("ownerUserId", "stage");
CREATE INDEX "CrmDeal_leadId_createdAt_idx" ON "CrmDeal"("leadId", "createdAt");
CREATE INDEX "CrmDeal_installationId_createdAt_idx" ON "CrmDeal"("installationId", "createdAt");
CREATE INDEX "CrmDeal_nextActionAt_idx" ON "CrmDeal"("nextActionAt");
CREATE INDEX "CrmDealStageTransition_dealId_createdAt_idx" ON "CrmDealStageTransition"("dealId", "createdAt");
CREATE INDEX "CrmDealStageTransition_toStage_createdAt_idx" ON "CrmDealStageTransition"("toStage", "createdAt");
CREATE INDEX "CrmDealNote_dealId_createdAt_idx" ON "CrmDealNote"("dealId", "createdAt");
CREATE INDEX "CrmDealTask_dealId_createdAt_idx" ON "CrmDealTask"("dealId", "createdAt");
CREATE INDEX "CrmDealTask_dueAt_idx" ON "CrmDealTask"("dueAt");
CREATE INDEX "CrmDealTask_doneAt_idx" ON "CrmDealTask"("doneAt");
CREATE INDEX "CrmDealAttachment_dealId_createdAt_idx" ON "CrmDealAttachment"("dealId", "createdAt");

ALTER TABLE "CrmLead"
  ADD CONSTRAINT "CrmLead_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead"
  ADD CONSTRAINT "CrmLead_leadAttributionId_fkey"
  FOREIGN KEY ("leadAttributionId") REFERENCES "LeadAttribution"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDeal"
  ADD CONSTRAINT "CrmDeal_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeal"
  ADD CONSTRAINT "CrmDeal_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDealStageTransition"
  ADD CONSTRAINT "CrmDealStageTransition_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDealNote"
  ADD CONSTRAINT "CrmDealNote_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDealTask"
  ADD CONSTRAINT "CrmDealTask_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDealAttachment"
  ADD CONSTRAINT "CrmDealAttachment_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
