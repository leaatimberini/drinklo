CREATE TABLE "SodAccessReviewReport" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "activePolicies" INTEGER NOT NULL DEFAULT 0,
  "totalPolicies" INTEGER NOT NULL DEFAULT 0,
  "violations24h" INTEGER NOT NULL DEFAULT 0,
  "openCampaigns" INTEGER NOT NULL DEFAULT 0,
  "overdueCampaigns" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SodAccessReviewReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SodAccessReviewReport_installationId_capturedAt_idx" ON "SodAccessReviewReport"("installationId", "capturedAt");
CREATE INDEX "SodAccessReviewReport_instanceId_capturedAt_idx" ON "SodAccessReviewReport"("instanceId", "capturedAt");
CREATE INDEX "SodAccessReviewReport_capturedAt_idx" ON "SodAccessReviewReport"("capturedAt");

ALTER TABLE "SodAccessReviewReport"
  ADD CONSTRAINT "SodAccessReviewReport_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
