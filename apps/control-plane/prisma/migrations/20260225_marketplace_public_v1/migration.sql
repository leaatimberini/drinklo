ALTER TABLE "PluginRelease"
  ADD COLUMN "compatibilityMatrix" JSONB,
  ADD COLUMN "certified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "certifiedAt" TIMESTAMP(3),
  ADD COLUMN "certificationReport" JSONB;

ALTER TABLE "PluginSubmission"
  ADD COLUMN "compatibilityMatrix" JSONB;

CREATE TABLE "PluginMarketplaceReview" (
  "id" TEXT NOT NULL,
  "pluginName" TEXT NOT NULL,
  "releaseId" TEXT,
  "version" TEXT,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "reviewerName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PluginMarketplaceReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PluginMarketplaceReview_pluginName_idx" ON "PluginMarketplaceReview"("pluginName");
CREATE INDEX "PluginMarketplaceReview_releaseId_idx" ON "PluginMarketplaceReview"("releaseId");
CREATE INDEX "PluginMarketplaceReview_status_idx" ON "PluginMarketplaceReview"("status");
CREATE INDEX "PluginMarketplaceReview_createdAt_idx" ON "PluginMarketplaceReview"("createdAt");

ALTER TABLE "PluginMarketplaceReview"
  ADD CONSTRAINT "PluginMarketplaceReview_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "PluginRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

