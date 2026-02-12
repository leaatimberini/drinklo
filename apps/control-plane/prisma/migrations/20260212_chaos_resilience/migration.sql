CREATE TABLE "ChaosRun" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "scenario" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sloP95Ms" DOUBLE PRECISION,
  "sloErrorRate" DOUBLE PRECISION,
  "sloWebhookRetryRate" DOUBLE PRECISION,
  "durationMs" INTEGER,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChaosRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChaosRun_installationId_createdAt_idx" ON "ChaosRun"("installationId", "createdAt");
CREATE INDEX "ChaosRun_instanceId_createdAt_idx" ON "ChaosRun"("instanceId", "createdAt");
CREATE INDEX "ChaosRun_environment_scenario_createdAt_idx" ON "ChaosRun"("environment", "scenario", "createdAt");

ALTER TABLE "ChaosRun"
  ADD CONSTRAINT "ChaosRun_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
