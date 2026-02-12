CREATE TABLE "EdgeInvalidation" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "reason" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EdgeInvalidation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebVitalSample" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "rating" TEXT,
  "path" TEXT,
  "metricId" TEXT,
  "userAgent" TEXT,
  "ip" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebVitalSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EdgeInvalidation_installationId_requestedAt_idx" ON "EdgeInvalidation"("installationId", "requestedAt");
CREATE INDEX "EdgeInvalidation_instanceId_requestedAt_idx" ON "EdgeInvalidation"("instanceId", "requestedAt");
CREATE INDEX "EdgeInvalidation_status_idx" ON "EdgeInvalidation"("status");

CREATE INDEX "WebVitalSample_installationId_capturedAt_idx" ON "WebVitalSample"("installationId", "capturedAt");
CREATE INDEX "WebVitalSample_instanceId_capturedAt_idx" ON "WebVitalSample"("instanceId", "capturedAt");
CREATE INDEX "WebVitalSample_name_capturedAt_idx" ON "WebVitalSample"("name", "capturedAt");

ALTER TABLE "EdgeInvalidation"
  ADD CONSTRAINT "EdgeInvalidation_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebVitalSample"
  ADD CONSTRAINT "WebVitalSample_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
