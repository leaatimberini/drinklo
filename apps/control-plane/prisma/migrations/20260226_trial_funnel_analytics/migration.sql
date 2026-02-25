CREATE TYPE "TrialLifecycleEventType" AS ENUM ('TrialStarted', 'TrialExtended', 'TrialExpired', 'PaymentMethodAdded', 'ConvertedToPaid', 'BecamePastDue', 'BecameRestricted');

ALTER TABLE "LeadAttribution"
  ADD COLUMN "businessType" TEXT;

CREATE TABLE "TrialLifecycleEvent" (
  "id" TEXT NOT NULL,
  "eventType" "TrialLifecycleEventType" NOT NULL,
  "campaignId" TEXT,
  "redemptionId" TEXT,
  "billingAccountId" TEXT,
  "installationId" TEXT,
  "instanceId" TEXT,
  "businessType" TEXT,
  "eventAt" TIMESTAMP(3) NOT NULL,
  "dedupeKey" TEXT,
  "source" TEXT,
  "properties" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrialLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialLifecycleEvent_dedupeKey_key" ON "TrialLifecycleEvent"("dedupeKey");
CREATE INDEX "TrialLifecycleEvent_campaignId_eventAt_idx" ON "TrialLifecycleEvent"("campaignId", "eventAt");
CREATE INDEX "TrialLifecycleEvent_eventType_eventAt_idx" ON "TrialLifecycleEvent"("eventType", "eventAt");
CREATE INDEX "TrialLifecycleEvent_instanceId_eventAt_idx" ON "TrialLifecycleEvent"("instanceId", "eventAt");
CREATE INDEX "TrialLifecycleEvent_billingAccountId_eventAt_idx" ON "TrialLifecycleEvent"("billingAccountId", "eventAt");
CREATE INDEX "TrialLifecycleEvent_businessType_eventAt_idx" ON "TrialLifecycleEvent"("businessType", "eventAt");
