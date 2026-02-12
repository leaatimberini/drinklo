ALTER TABLE "Installation"
  ADD COLUMN "cpuUsagePct" DOUBLE PRECISION,
  ADD COLUMN "memoryUsedBytes" BIGINT,
  ADD COLUMN "memoryTotalBytes" BIGINT,
  ADD COLUMN "diskUsedBytes" BIGINT,
  ADD COLUMN "diskTotalBytes" BIGINT,
  ADD COLUMN "networkRxBytes" BIGINT,
  ADD COLUMN "networkTxBytes" BIGINT,
  ADD COLUMN "dbSizeBytes" BIGINT,
  ADD COLUMN "storageSizeBytes" BIGINT,
  ADD COLUMN "jobsProcessed1h" INTEGER,
  ADD COLUMN "jobsPending" INTEGER,
  ADD COLUMN "estimatedMonthlyCostUsd" DOUBLE PRECISION,
  ADD COLUMN "finopsUpdatedAt" TIMESTAMP(3);

CREATE TABLE "FinOpsPricing" (
  "id" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "usdPerUnit" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinOpsPricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinOpsPricing_resourceKey_key" ON "FinOpsPricing"("resourceKey");
CREATE INDEX "FinOpsPricing_enabled_idx" ON "FinOpsPricing"("enabled");

CREATE TABLE "FinOpsSnapshot" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cpuUsagePct" DOUBLE PRECISION,
  "memoryUsedBytes" BIGINT,
  "memoryTotalBytes" BIGINT,
  "diskUsedBytes" BIGINT,
  "diskTotalBytes" BIGINT,
  "networkRxBytes" BIGINT,
  "networkTxBytes" BIGINT,
  "dbSizeBytes" BIGINT,
  "storageSizeBytes" BIGINT,
  "jobsFailed" INTEGER,
  "jobsProcessed1h" INTEGER,
  "jobsPending" INTEGER,
  "estimatedMonthlyCostUsd" DOUBLE PRECISION,
  "meta" JSONB,

  CONSTRAINT "FinOpsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinOpsSnapshot_installationId_recordedAt_idx" ON "FinOpsSnapshot"("installationId", "recordedAt");

CREATE TABLE "FinOpsCostRecord" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
  "breakdown" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinOpsCostRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinOpsCostRecord_installationId_periodStart_periodEnd_idx" ON "FinOpsCostRecord"("installationId", "periodStart", "periodEnd");

ALTER TABLE "FinOpsSnapshot" ADD CONSTRAINT "FinOpsSnapshot_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinOpsCostRecord" ADD CONSTRAINT "FinOpsCostRecord_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

