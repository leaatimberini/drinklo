CREATE TABLE "IntegrationBuilderReport" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "connectorsTotal" INTEGER NOT NULL DEFAULT 0,
  "connectorsActive" INTEGER NOT NULL DEFAULT 0,
  "deliveriesSuccess24h" INTEGER NOT NULL DEFAULT 0,
  "deliveriesFailed24h" INTEGER NOT NULL DEFAULT 0,
  "dlqOpen" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationBuilderReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationBuilderReport_installationId_capturedAt_idx" ON "IntegrationBuilderReport"("installationId", "capturedAt");
CREATE INDEX "IntegrationBuilderReport_instanceId_capturedAt_idx" ON "IntegrationBuilderReport"("instanceId", "capturedAt");
CREATE INDEX "IntegrationBuilderReport_capturedAt_idx" ON "IntegrationBuilderReport"("capturedAt");

ALTER TABLE "IntegrationBuilderReport"
  ADD CONSTRAINT "IntegrationBuilderReport_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

