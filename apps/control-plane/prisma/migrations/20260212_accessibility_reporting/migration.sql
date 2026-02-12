CREATE TABLE "AccessibilityReport" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "criticalViolations" INTEGER NOT NULL DEFAULT 0,
  "seriousViolations" INTEGER NOT NULL DEFAULT 0,
  "totalViolations" INTEGER NOT NULL DEFAULT 0,
  "pages" JSONB,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessibilityReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessibilityReport_installationId_measuredAt_idx" ON "AccessibilityReport"("installationId", "measuredAt");
CREATE INDEX "AccessibilityReport_instanceId_measuredAt_idx" ON "AccessibilityReport"("instanceId", "measuredAt");
CREATE INDEX "AccessibilityReport_version_measuredAt_idx" ON "AccessibilityReport"("version", "measuredAt");

ALTER TABLE "AccessibilityReport"
  ADD CONSTRAINT "AccessibilityReport_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
