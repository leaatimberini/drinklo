CREATE TABLE "ComplianceControl" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'MONITORED',
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvidence" (
  "id" TEXT NOT NULL,
  "controlId" TEXT,
  "installationId" TEXT,
  "evidenceType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "sourceCapturedAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedBy" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "ComplianceEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceControl_key_key" ON "ComplianceControl"("key");
CREATE INDEX "ComplianceControl_domain_idx" ON "ComplianceControl"("domain");
CREATE INDEX "ComplianceControl_status_idx" ON "ComplianceControl"("status");

CREATE INDEX "ComplianceEvidence_controlId_capturedAt_idx" ON "ComplianceEvidence"("controlId", "capturedAt");
CREATE INDEX "ComplianceEvidence_installationId_capturedAt_idx" ON "ComplianceEvidence"("installationId", "capturedAt");
CREATE INDEX "ComplianceEvidence_evidenceType_capturedAt_idx" ON "ComplianceEvidence"("evidenceType", "capturedAt");
CREATE INDEX "ComplianceEvidence_payloadHash_idx" ON "ComplianceEvidence"("payloadHash");

ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_controlId_fkey"
  FOREIGN KEY ("controlId") REFERENCES "ComplianceControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvidence" ADD CONSTRAINT "ComplianceEvidence_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
