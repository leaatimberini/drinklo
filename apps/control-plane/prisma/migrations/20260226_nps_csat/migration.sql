CREATE TYPE "FeedbackSurveyType" AS ENUM ('NPS', 'CSAT');
CREATE TYPE "FeedbackSurveyCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "FeedbackSurveySendStatus" AS ENUM ('QUEUED', 'SENT_MOCK', 'SENT', 'FAILED', 'RESPONDED');
CREATE TYPE "FeedbackIssueStatus" AS ENUM ('OPEN', 'TRIAGED', 'CLOSED');

CREATE TABLE "FeedbackSurveyCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FeedbackSurveyType" NOT NULL,
  "status" "FeedbackSurveyCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "trialCampaignId" TEXT,
  "planFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "icpFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "emailSubject" TEXT NOT NULL,
  "emailBody" TEXT NOT NULL,
  "lowScoreThreshold" INTEGER,
  "createIssueOnLow" BOOLEAN NOT NULL DEFAULT true,
  "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeedbackSurveyCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedbackSurveySend" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "billingAccountId" TEXT,
  "installationId" TEXT,
  "instanceId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "planName" TEXT,
  "icp" TEXT,
  "trialCampaignId" TEXT,
  "status" "FeedbackSurveySendStatus" NOT NULL DEFAULT 'QUEUED',
  "responseToken" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeedbackSurveySend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedbackSurveyResponse" (
  "id" TEXT NOT NULL,
  "sendId" TEXT NOT NULL,
  "surveyType" "FeedbackSurveyType" NOT NULL,
  "score" INTEGER NOT NULL,
  "category" TEXT,
  "comment" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeedbackIssue" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "campaignId" TEXT,
  "installationId" TEXT,
  "instanceId" TEXT,
  "status" "FeedbackIssueStatus" NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL DEFAULT 'warning',
  "category" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "FeedbackIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackSurveyCampaign_status_createdAt_idx" ON "FeedbackSurveyCampaign"("status", "createdAt");
CREATE INDEX "FeedbackSurveyCampaign_type_status_createdAt_idx" ON "FeedbackSurveyCampaign"("type", "status", "createdAt");
CREATE INDEX "FeedbackSurveyCampaign_trialCampaignId_idx" ON "FeedbackSurveyCampaign"("trialCampaignId");

CREATE UNIQUE INDEX "FeedbackSurveySend_responseToken_key" ON "FeedbackSurveySend"("responseToken");
CREATE UNIQUE INDEX "FeedbackSurveySend_campaignId_billingAccountId_key" ON "FeedbackSurveySend"("campaignId", "billingAccountId");
CREATE INDEX "FeedbackSurveySend_campaignId_createdAt_idx" ON "FeedbackSurveySend"("campaignId", "createdAt");
CREATE INDEX "FeedbackSurveySend_installationId_createdAt_idx" ON "FeedbackSurveySend"("installationId", "createdAt");
CREATE INDEX "FeedbackSurveySend_instanceId_createdAt_idx" ON "FeedbackSurveySend"("instanceId", "createdAt");
CREATE INDEX "FeedbackSurveySend_status_createdAt_idx" ON "FeedbackSurveySend"("status", "createdAt");
CREATE INDEX "FeedbackSurveySend_planName_icp_createdAt_idx" ON "FeedbackSurveySend"("planName", "icp", "createdAt");

CREATE UNIQUE INDEX "FeedbackSurveyResponse_sendId_key" ON "FeedbackSurveyResponse"("sendId");
CREATE INDEX "FeedbackSurveyResponse_submittedAt_idx" ON "FeedbackSurveyResponse"("submittedAt");
CREATE INDEX "FeedbackSurveyResponse_surveyType_submittedAt_idx" ON "FeedbackSurveyResponse"("surveyType", "submittedAt");
CREATE INDEX "FeedbackSurveyResponse_score_submittedAt_idx" ON "FeedbackSurveyResponse"("score", "submittedAt");

CREATE UNIQUE INDEX "FeedbackIssue_responseId_key" ON "FeedbackIssue"("responseId");
CREATE INDEX "FeedbackIssue_campaignId_createdAt_idx" ON "FeedbackIssue"("campaignId", "createdAt");
CREATE INDEX "FeedbackIssue_installationId_createdAt_idx" ON "FeedbackIssue"("installationId", "createdAt");
CREATE INDEX "FeedbackIssue_instanceId_createdAt_idx" ON "FeedbackIssue"("instanceId", "createdAt");
CREATE INDEX "FeedbackIssue_status_createdAt_idx" ON "FeedbackIssue"("status", "createdAt");

ALTER TABLE "FeedbackSurveyCampaign"
ADD CONSTRAINT "FeedbackSurveyCampaign_trialCampaignId_fkey"
FOREIGN KEY ("trialCampaignId") REFERENCES "TrialCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedbackSurveySend"
ADD CONSTRAINT "FeedbackSurveySend_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "FeedbackSurveyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackSurveySend"
ADD CONSTRAINT "FeedbackSurveySend_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedbackSurveySend"
ADD CONSTRAINT "FeedbackSurveySend_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedbackSurveyResponse"
ADD CONSTRAINT "FeedbackSurveyResponse_sendId_fkey"
FOREIGN KEY ("sendId") REFERENCES "FeedbackSurveySend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackIssue"
ADD CONSTRAINT "FeedbackIssue_responseId_fkey"
FOREIGN KEY ("responseId") REFERENCES "FeedbackSurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackIssue"
ADD CONSTRAINT "FeedbackIssue_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "FeedbackSurveyCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedbackIssue"
ADD CONSTRAINT "FeedbackIssue_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
