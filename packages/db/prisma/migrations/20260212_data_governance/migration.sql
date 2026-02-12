CREATE TYPE "GovernanceEntity" AS ENUM ('ORDERS', 'LOGS', 'EVENTS', 'MARKETING');
CREATE TYPE "LegalHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

CREATE TABLE "DataRetentionPolicy" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "entity" "GovernanceEntity" NOT NULL,
  "retentionDays" INTEGER NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalHold" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "customerEmailSnapshot" TEXT,
  "periodFrom" TIMESTAMP(3),
  "periodTo" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "LegalHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "releasedById" TEXT,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GovernanceRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "triggeredBy" TEXT,
  "triggerType" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "summary" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataRetentionPolicy_companyId_plan_entity_key" ON "DataRetentionPolicy"("companyId", "plan", "entity");
CREATE INDEX "DataRetentionPolicy_companyId_idx" ON "DataRetentionPolicy"("companyId");
CREATE INDEX "DataRetentionPolicy_plan_idx" ON "DataRetentionPolicy"("plan");

CREATE INDEX "LegalHold_companyId_idx" ON "LegalHold"("companyId");
CREATE INDEX "LegalHold_customerId_idx" ON "LegalHold"("customerId");
CREATE INDEX "LegalHold_status_idx" ON "LegalHold"("status");
CREATE INDEX "LegalHold_periodFrom_idx" ON "LegalHold"("periodFrom");
CREATE INDEX "LegalHold_periodTo_idx" ON "LegalHold"("periodTo");

CREATE INDEX "GovernanceRun_companyId_idx" ON "GovernanceRun"("companyId");
CREATE INDEX "GovernanceRun_status_idx" ON "GovernanceRun"("status");
CREATE INDEX "GovernanceRun_startedAt_idx" ON "GovernanceRun"("startedAt");

ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GovernanceRun" ADD CONSTRAINT "GovernanceRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernanceRun" ADD CONSTRAINT "GovernanceRun_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebhookLog" ADD COLUMN "companyId" TEXT;
CREATE INDEX "WebhookLog_companyId_idx" ON "WebhookLog"("companyId");
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BotCommandLog" ADD COLUMN "companyId" TEXT;
CREATE INDEX "BotCommandLog_companyId_idx" ON "BotCommandLog"("companyId");
ALTER TABLE "BotCommandLog" ADD CONSTRAINT "BotCommandLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
