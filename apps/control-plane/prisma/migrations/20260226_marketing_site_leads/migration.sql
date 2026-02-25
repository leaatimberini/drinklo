CREATE TABLE "MarketingLead" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT,
  "companyId" TEXT,
  "leadAttributionId" TEXT,
  "email" TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  "city" TEXT,
  "trialCode" TEXT,
  "source" TEXT NOT NULL DEFAULT 'marketing-site',
  "status" TEXT NOT NULL DEFAULT 'CAPTURED',
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingLead_email_createdAt_idx" ON "MarketingLead"("email", "createdAt");
CREATE INDEX "MarketingLead_businessType_createdAt_idx" ON "MarketingLead"("businessType", "createdAt");
CREATE INDEX "MarketingLead_trialCode_createdAt_idx" ON "MarketingLead"("trialCode", "createdAt");
CREATE INDEX "MarketingLead_instanceId_createdAt_idx" ON "MarketingLead"("instanceId", "createdAt");
CREATE INDEX "MarketingLead_status_createdAt_idx" ON "MarketingLead"("status", "createdAt");

ALTER TABLE "MarketingLead"
  ADD CONSTRAINT "MarketingLead_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingLead"
  ADD CONSTRAINT "MarketingLead_leadAttributionId_fkey"
  FOREIGN KEY ("leadAttributionId") REFERENCES "LeadAttribution"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
