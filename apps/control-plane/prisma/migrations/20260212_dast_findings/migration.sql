CREATE TABLE "DastFinding" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT,
  "securityReportId" TEXT,
  "target" TEXT NOT NULL,
  "scanProfile" TEXT NOT NULL DEFAULT 'ZAP_BASELINE',
  "zapRuleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "evidence" TEXT,
  "recommendation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "slaDueAt" TIMESTAMP(3),
  "triagedAt" TIMESTAMP(3),
  "fixedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DastFinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DastFinding_instanceId_target_zapRuleId_route_key"
ON "DastFinding"("instanceId", "target", "zapRuleId", "route");
CREATE INDEX "DastFinding_installationId_severity_status_idx" ON "DastFinding"("installationId", "severity", "status");
CREATE INDEX "DastFinding_status_slaDueAt_idx" ON "DastFinding"("status", "slaDueAt");
CREATE INDEX "DastFinding_lastSeenAt_idx" ON "DastFinding"("lastSeenAt");

ALTER TABLE "DastFinding" ADD CONSTRAINT "DastFinding_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DastFinding" ADD CONSTRAINT "DastFinding_securityReportId_fkey"
  FOREIGN KEY ("securityReportId") REFERENCES "SecurityReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
