CREATE TABLE "PluginRelease" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "compatibility" TEXT,
  "changelog" TEXT,
  "signature" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginRelease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginRelease_name_idx" ON "PluginRelease"("name");
CREATE INDEX "PluginRelease_version_idx" ON "PluginRelease"("version");
CREATE INDEX "PluginRelease_channel_idx" ON "PluginRelease"("channel");

CREATE TABLE "PluginRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "instanceId" TEXT NOT NULL,
  "pluginName" TEXT NOT NULL,
  "version" TEXT,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "PluginRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginRequest_instanceId_idx" ON "PluginRequest"("instanceId");
CREATE INDEX "PluginRequest_pluginName_idx" ON "PluginRequest"("pluginName");
CREATE INDEX "PluginRequest_status_idx" ON "PluginRequest"("status");

CREATE TABLE "PluginRollout" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pluginName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "batchSize" INTEGER NOT NULL,
  "batchIndex" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'running',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginRollout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginRollout_pluginName_idx" ON "PluginRollout"("pluginName");
CREATE INDEX "PluginRollout_channel_idx" ON "PluginRollout"("channel");
CREATE INDEX "PluginRollout_status_idx" ON "PluginRollout"("status");

CREATE TABLE "PluginRolloutBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rolloutId" UUID NOT NULL,
  "batchIndex" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginRolloutBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginRolloutBatch_rolloutId_batchIndex_key" ON "PluginRolloutBatch"("rolloutId", "batchIndex");
CREATE INDEX "PluginRolloutBatch_status_idx" ON "PluginRolloutBatch"("status");

CREATE TABLE "PluginJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "installationId" UUID NOT NULL,
  "instanceId" TEXT NOT NULL,
  "pluginName" TEXT NOT NULL,
  "version" TEXT,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "step" TEXT,
  "error" TEXT,
  "durationMs" INTEGER,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "batchId" UUID,
  CONSTRAINT "PluginJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginJob_installationId_idx" ON "PluginJob"("installationId");
CREATE INDEX "PluginJob_instanceId_idx" ON "PluginJob"("instanceId");
CREATE INDEX "PluginJob_pluginName_idx" ON "PluginJob"("pluginName");
CREATE INDEX "PluginJob_status_idx" ON "PluginJob"("status");

ALTER TABLE "PluginRolloutBatch" ADD CONSTRAINT "PluginRolloutBatch_rolloutId_fkey" FOREIGN KEY ("rolloutId") REFERENCES "PluginRollout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PluginJob" ADD CONSTRAINT "PluginJob_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PluginJob" ADD CONSTRAINT "PluginJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PluginRolloutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
