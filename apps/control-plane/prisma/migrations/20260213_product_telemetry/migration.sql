CREATE TABLE "FeatureUsageSample" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "version" TEXT,
  "feature" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "windowFrom" TIMESTAMP(3) NOT NULL,
  "windowTo" TIMESTAMP(3) NOT NULL,
  "windowMinutes" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureUsageSample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureUsageSample_instanceId_windowFrom_windowTo_feature_action_key" ON "FeatureUsageSample"("instanceId", "windowFrom", "windowTo", "feature", "action");

CREATE INDEX "FeatureUsageSample_installationId_capturedAt_idx" ON "FeatureUsageSample"("installationId", "capturedAt");
CREATE INDEX "FeatureUsageSample_instanceId_capturedAt_idx" ON "FeatureUsageSample"("instanceId", "capturedAt");
CREATE INDEX "FeatureUsageSample_feature_capturedAt_idx" ON "FeatureUsageSample"("feature", "capturedAt");

ALTER TABLE "FeatureUsageSample"
  ADD CONSTRAINT "FeatureUsageSample_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
