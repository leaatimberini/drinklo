ALTER TABLE "Installation" ADD COLUMN "drPlan" text;
ALTER TABLE "Installation" ADD COLUMN "rpoTargetMin" integer;
ALTER TABLE "Installation" ADD COLUMN "rtoTargetMin" integer;
ALTER TABLE "Installation" ADD COLUMN "lastDrillAt" timestamp(3);
ALTER TABLE "Installation" ADD COLUMN "lastDrillStatus" text;
ALTER TABLE "Installation" ADD COLUMN "lastDrillRpoMin" integer;
ALTER TABLE "Installation" ADD COLUMN "lastDrillRtoMin" integer;

CREATE TABLE "DisasterRecoveryDrill" (
  "id" text NOT NULL,
  "installationId" text NOT NULL,
  "instanceId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'scheduled',
  "rpoMinutes" integer,
  "rtoMinutes" integer,
  "startedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" timestamp(3),
  "notes" text,
  "meta" jsonb,
  CONSTRAINT "DisasterRecoveryDrill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisasterRecoveryDrill_installationId_idx" ON "DisasterRecoveryDrill"("installationId");
CREATE INDEX "DisasterRecoveryDrill_instanceId_idx" ON "DisasterRecoveryDrill"("instanceId");
CREATE INDEX "DisasterRecoveryDrill_status_idx" ON "DisasterRecoveryDrill"("status");
CREATE INDEX "DisasterRecoveryDrill_startedAt_idx" ON "DisasterRecoveryDrill"("startedAt");
CREATE INDEX "DisasterRecoveryDrill_finishedAt_idx" ON "DisasterRecoveryDrill"("finishedAt");

ALTER TABLE "DisasterRecoveryDrill" ADD CONSTRAINT "DisasterRecoveryDrill_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
