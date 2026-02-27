CREATE TYPE "SodPolicyMode" AS ENUM ('DENY', 'ALERT');
CREATE TYPE "SodViolationOutcome" AS ENUM ('DENIED', 'ALLOWED_ALERTED');
CREATE TYPE "AccessReviewCadence" AS ENUM ('MONTHLY', 'QUARTERLY');
CREATE TYPE "AccessReviewCampaignStatus" AS ENUM ('OPEN', 'APPROVED', 'COMPLETED', 'CANCELED');
CREATE TYPE "AccessReviewDecision" AS ENUM ('PENDING', 'APPROVE', 'REVOKE', 'CHANGES_REQUIRED');

CREATE TABLE "SodPolicy" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "pairKey" TEXT NOT NULL,
  "actionA" TEXT NOT NULL,
  "actionB" TEXT NOT NULL,
  "mode" "SodPolicyMode" NOT NULL DEFAULT 'DENY',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SodPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SodViolationEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "policyId" TEXT,
  "requestAction" TEXT NOT NULL,
  "conflictingAction" TEXT,
  "route" TEXT,
  "method" TEXT,
  "outcome" "SodViolationOutcome" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SodViolationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessReviewCampaign" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cadence" "AccessReviewCadence" NOT NULL,
  "status" "AccessReviewCampaignStatus" NOT NULL DEFAULT 'OPEN',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessReviewCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessReviewItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT,
  "roleName" TEXT,
  "permissionCodes" JSONB NOT NULL,
  "decision" "AccessReviewDecision" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SodPolicy_companyId_code_key" ON "SodPolicy"("companyId", "code");
CREATE UNIQUE INDEX "SodPolicy_companyId_pairKey_key" ON "SodPolicy"("companyId", "pairKey");
CREATE INDEX "SodPolicy_companyId_idx" ON "SodPolicy"("companyId");
CREATE INDEX "SodPolicy_enabled_idx" ON "SodPolicy"("enabled");

CREATE INDEX "SodViolationEvent_companyId_createdAt_idx" ON "SodViolationEvent"("companyId", "createdAt");
CREATE INDEX "SodViolationEvent_userId_createdAt_idx" ON "SodViolationEvent"("userId", "createdAt");
CREATE INDEX "SodViolationEvent_policyId_createdAt_idx" ON "SodViolationEvent"("policyId", "createdAt");
CREATE INDEX "SodViolationEvent_outcome_createdAt_idx" ON "SodViolationEvent"("outcome", "createdAt");

CREATE INDEX "AccessReviewCampaign_companyId_status_idx" ON "AccessReviewCampaign"("companyId", "status");
CREATE INDEX "AccessReviewCampaign_companyId_cadence_createdAt_idx" ON "AccessReviewCampaign"("companyId", "cadence", "createdAt");
CREATE INDEX "AccessReviewCampaign_dueAt_idx" ON "AccessReviewCampaign"("dueAt");

CREATE UNIQUE INDEX "AccessReviewItem_campaignId_userId_key" ON "AccessReviewItem"("campaignId", "userId");
CREATE INDEX "AccessReviewItem_companyId_campaignId_idx" ON "AccessReviewItem"("companyId", "campaignId");
CREATE INDEX "AccessReviewItem_userId_idx" ON "AccessReviewItem"("userId");
CREATE INDEX "AccessReviewItem_decision_idx" ON "AccessReviewItem"("decision");

ALTER TABLE "SodPolicy" ADD CONSTRAINT "SodPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SodPolicy" ADD CONSTRAINT "SodPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SodPolicy" ADD CONSTRAINT "SodPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SodViolationEvent" ADD CONSTRAINT "SodViolationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SodViolationEvent" ADD CONSTRAINT "SodViolationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SodViolationEvent" ADD CONSTRAINT "SodViolationEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SodPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessReviewCampaign" ADD CONSTRAINT "AccessReviewCampaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessReviewCampaign" ADD CONSTRAINT "AccessReviewCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessReviewCampaign" ADD CONSTRAINT "AccessReviewCampaign_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AccessReviewCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessReviewItem" ADD CONSTRAINT "AccessReviewItem_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

