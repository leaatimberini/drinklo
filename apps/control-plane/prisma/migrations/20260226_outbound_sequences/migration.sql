-- CreateEnum
CREATE TYPE "OutboundSequenceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "OutboundSequenceStepChannel" AS ENUM ('EMAIL');
CREATE TYPE "OutboundSequenceEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED', 'OPTED_OUT');
CREATE TYPE "OutboundSequenceEventType" AS ENUM ('ENROLLED', 'SENT', 'OPEN', 'CLICK', 'BOUNCE', 'REPLY', 'UNSUBSCRIBE', 'STEP_SKIPPED', 'COMPLIANCE_BLOCKED', 'COMPLETED');

-- CreateTable
CREATE TABLE "OutboundSequence" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "OutboundSequenceStatus" NOT NULL DEFAULT 'DRAFT',
  "locale" TEXT NOT NULL DEFAULT 'es',
  "icpFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "description" TEXT,
  "variables" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundSequenceStep" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "channel" "OutboundSequenceStepChannel" NOT NULL DEFAULT 'EMAIL',
  "delayDays" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "subjectTpl" TEXT NOT NULL,
  "bodyTpl" TEXT NOT NULL,
  "ctaUrlTpl" TEXT,
  "variablesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundSequenceEnrollment" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "dealId" TEXT,
  "installationId" TEXT,
  "instanceId" TEXT,
  "email" TEXT NOT NULL,
  "status" "OutboundSequenceEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStepOrder" INTEGER NOT NULL DEFAULT 1,
  "nextRunAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "optedOutAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'manual',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundSequenceEvent" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "stepId" TEXT,
  "leadId" TEXT,
  "dealId" TEXT,
  "eventType" "OutboundSequenceEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider" TEXT DEFAULT 'mock',
  "providerMessageId" TEXT,
  "trackingToken" TEXT,
  "url" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboundSequenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundSequenceOptOut" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'unsubscribe_link',
  "reason" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundSequenceOptOut_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "OutboundSequence_key_key" ON "OutboundSequence"("key");
CREATE INDEX "OutboundSequence_status_createdAt_idx" ON "OutboundSequence"("status", "createdAt");
CREATE INDEX "OutboundSequence_locale_status_idx" ON "OutboundSequence"("locale", "status");

CREATE UNIQUE INDEX "OutboundSequenceStep_sequenceId_stepOrder_key" ON "OutboundSequenceStep"("sequenceId", "stepOrder");
CREATE INDEX "OutboundSequenceStep_sequenceId_stepOrder_idx" ON "OutboundSequenceStep"("sequenceId", "stepOrder");

CREATE UNIQUE INDEX "OutboundSequenceEnrollment_sequenceId_leadId_key" ON "OutboundSequenceEnrollment"("sequenceId", "leadId");
CREATE INDEX "OutboundSequenceEnrollment_status_nextRunAt_idx" ON "OutboundSequenceEnrollment"("status", "nextRunAt");
CREATE INDEX "OutboundSequenceEnrollment_leadId_createdAt_idx" ON "OutboundSequenceEnrollment"("leadId", "createdAt");
CREATE INDEX "OutboundSequenceEnrollment_email_createdAt_idx" ON "OutboundSequenceEnrollment"("email", "createdAt");
CREATE INDEX "OutboundSequenceEnrollment_installationId_createdAt_idx" ON "OutboundSequenceEnrollment"("installationId", "createdAt");

CREATE UNIQUE INDEX "OutboundSequenceEvent_trackingToken_key" ON "OutboundSequenceEvent"("trackingToken");
CREATE INDEX "OutboundSequenceEvent_sequenceId_occurredAt_idx" ON "OutboundSequenceEvent"("sequenceId", "occurredAt");
CREATE INDEX "OutboundSequenceEvent_enrollmentId_occurredAt_idx" ON "OutboundSequenceEvent"("enrollmentId", "occurredAt");
CREATE INDEX "OutboundSequenceEvent_leadId_occurredAt_idx" ON "OutboundSequenceEvent"("leadId", "occurredAt");
CREATE INDEX "OutboundSequenceEvent_eventType_occurredAt_idx" ON "OutboundSequenceEvent"("eventType", "occurredAt");

CREATE UNIQUE INDEX "OutboundSequenceOptOut_email_key" ON "OutboundSequenceOptOut"("email");
CREATE INDEX "OutboundSequenceOptOut_createdAt_idx" ON "OutboundSequenceOptOut"("createdAt");

-- Foreign keys
ALTER TABLE "OutboundSequenceStep"
ADD CONSTRAINT "OutboundSequenceStep_sequenceId_fkey"
FOREIGN KEY ("sequenceId") REFERENCES "OutboundSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutboundSequenceEnrollment"
ADD CONSTRAINT "OutboundSequenceEnrollment_sequenceId_fkey"
FOREIGN KEY ("sequenceId") REFERENCES "OutboundSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutboundSequenceEvent"
ADD CONSTRAINT "OutboundSequenceEvent_sequenceId_fkey"
FOREIGN KEY ("sequenceId") REFERENCES "OutboundSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OutboundSequenceEvent"
ADD CONSTRAINT "OutboundSequenceEvent_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "OutboundSequenceEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundSequenceEvent"
ADD CONSTRAINT "OutboundSequenceEvent_stepId_fkey"
FOREIGN KEY ("stepId") REFERENCES "OutboundSequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

