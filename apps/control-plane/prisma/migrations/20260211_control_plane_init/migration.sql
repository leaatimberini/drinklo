CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Installation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "instanceId" TEXT NOT NULL,
  "domain" TEXT,
  "clientName" TEXT,
  "version" TEXT,
  "releaseChannel" TEXT,
  "healthStatus" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "backupStatus" TEXT,
  "lastBackupAt" TIMESTAMP(3),
  "sloP95Ms" DOUBLE PRECISION,
  "sloErrorRate" DOUBLE PRECISION,
  "sloWebhookRetryRate" DOUBLE PRECISION,
  "sloUpdatedAt" TIMESTAMP(3),
  "eventsTotal1h" INTEGER,
  "eventsFailed1h" INTEGER,
  "eventsAvgLagMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Installation_instanceId_key" ON "Installation"("instanceId");
CREATE INDEX "Installation_clientName_idx" ON "Installation"("clientName");
CREATE INDEX "Installation_domain_idx" ON "Installation"("domain");
CREATE INDEX "Installation_healthStatus_idx" ON "Installation"("healthStatus");

CREATE TABLE "Alert" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installationId" UUID NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Alert_installationId_idx" ON "Alert"("installationId");
CREATE INDEX "Alert_level_idx" ON "Alert"("level");

CREATE TABLE "JobFailure" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installationId" UUID NOT NULL,
  "queue" TEXT,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobFailure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobFailure_installationId_idx" ON "JobFailure"("installationId");
CREATE INDEX "JobFailure_queue_idx" ON "JobFailure"("queue");

CREATE TABLE "ReleaseManifest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "sha" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "migrationsRequired" BOOLEAN NOT NULL DEFAULT false,
  "breakingChanges" TEXT,
  "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signature" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReleaseManifest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReleaseManifest_version_idx" ON "ReleaseManifest"("version");
CREATE INDEX "ReleaseManifest_channel_idx" ON "ReleaseManifest"("channel");

CREATE TABLE "Rollout" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "manifestId" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "batchSize" INTEGER NOT NULL,
  "batchIndex" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'running',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rollout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Rollout_channel_idx" ON "Rollout"("channel");
CREATE INDEX "Rollout_status_idx" ON "Rollout"("status");

CREATE TABLE "RolloutBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rolloutId" UUID NOT NULL,
  "batchIndex" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolloutBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RolloutBatch_rolloutId_batchIndex_key" ON "RolloutBatch"("rolloutId", "batchIndex");
CREATE INDEX "RolloutBatch_status_idx" ON "RolloutBatch"("status");

CREATE TABLE "UpdateJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installationId" UUID NOT NULL,
  "manifestId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "step" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UpdateJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UpdateJob_installationId_idx" ON "UpdateJob"("installationId");
CREATE INDEX "UpdateJob_status_idx" ON "UpdateJob"("status");

CREATE TABLE "BackupRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installationId" UUID NOT NULL,
  "instanceId" TEXT NOT NULL,
  "backupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sizeBytes" INTEGER,
  "checksum" TEXT,
  "bucket" TEXT,
  "path" TEXT,
  "meta" JSONB,
  CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupRecord_installationId_idx" ON "BackupRecord"("installationId");
CREATE INDEX "BackupRecord_instanceId_idx" ON "BackupRecord"("instanceId");
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");
CREATE INDEX "BackupRecord_checksum_idx" ON "BackupRecord"("checksum");

CREATE TABLE "RestoreVerification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installationId" UUID NOT NULL,
  "instanceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "environment" TEXT NOT NULL DEFAULT 'staging',
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "message" TEXT,
  "meta" JSONB,
  CONSTRAINT "RestoreVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RestoreVerification_installationId_idx" ON "RestoreVerification"("installationId");
CREATE INDEX "RestoreVerification_instanceId_idx" ON "RestoreVerification"("instanceId");
CREATE INDEX "RestoreVerification_status_idx" ON "RestoreVerification"("status");
CREATE INDEX "RestoreVerification_scheduledAt_idx" ON "RestoreVerification"("scheduledAt");

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobFailure" ADD CONSTRAINT "JobFailure_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rollout" ADD CONSTRAINT "Rollout_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ReleaseManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolloutBatch" ADD CONSTRAINT "RolloutBatch_rolloutId_fkey" FOREIGN KEY ("rolloutId") REFERENCES "Rollout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UpdateJob" ADD CONSTRAINT "UpdateJob_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UpdateJob" ADD CONSTRAINT "UpdateJob_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ReleaseManifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UpdateJob" ADD CONSTRAINT "UpdateJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RolloutBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestoreVerification" ADD CONSTRAINT "RestoreVerification_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
