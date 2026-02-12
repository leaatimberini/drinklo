CREATE TABLE "Publisher" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "website" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "verificationNotes" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "apiKey" TEXT NOT NULL,
  "signingSecret" TEXT NOT NULL,
  "defaultRevenueShareBps" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PluginSubmission" (
  "id" TEXT NOT NULL,
  "publisherId" TEXT NOT NULL,
  "pluginName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "compatibility" TEXT,
  "changelog" TEXT,
  "bundleUrl" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "signature" TEXT NOT NULL,
  "requestedPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "revenueShareBps" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
  "reviewReport" JSONB,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginSubmission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PluginRelease"
  ADD COLUMN "publisherId" TEXT,
  ADD COLUMN "sourceSubmissionId" TEXT,
  ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'approved';

CREATE UNIQUE INDEX "Publisher_apiKey_key" ON "Publisher"("apiKey");
CREATE INDEX "Publisher_verificationStatus_idx" ON "Publisher"("verificationStatus");
CREATE INDEX "Publisher_email_idx" ON "Publisher"("email");

CREATE UNIQUE INDEX "PluginSubmission_publisherId_pluginName_version_channel_key"
ON "PluginSubmission"("publisherId", "pluginName", "version", "channel");
CREATE INDEX "PluginSubmission_publisherId_idx" ON "PluginSubmission"("publisherId");
CREATE INDEX "PluginSubmission_status_idx" ON "PluginSubmission"("status");
CREATE INDEX "PluginSubmission_pluginName_version_idx" ON "PluginSubmission"("pluginName", "version");

CREATE UNIQUE INDEX "PluginRelease_name_version_channel_key" ON "PluginRelease"("name", "version", "channel");
CREATE INDEX "PluginRelease_publisherId_idx" ON "PluginRelease"("publisherId");

ALTER TABLE "PluginSubmission" ADD CONSTRAINT "PluginSubmission_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PluginRelease" ADD CONSTRAINT "PluginRelease_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PluginRelease" ADD CONSTRAINT "PluginRelease_sourceSubmissionId_fkey"
  FOREIGN KEY ("sourceSubmissionId") REFERENCES "PluginSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
