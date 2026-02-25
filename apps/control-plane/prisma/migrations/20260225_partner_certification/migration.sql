CREATE TYPE "PartnerCertificationRunStatus" AS ENUM ('SUBMITTED', 'PASSED', 'FAILED');
CREATE TYPE "PartnerCertificationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TABLE "PartnerCertificationRun" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "kitVersion" TEXT NOT NULL,
  "reportPayload" JSONB NOT NULL,
  "reportHash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "status" "PartnerCertificationRunStatus" NOT NULL DEFAULT 'SUBMITTED',
  "score" INTEGER NOT NULL DEFAULT 0,
  "validationErrors" JSONB,
  "validationSummary" JSONB,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCertificationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerCertification" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "runId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'INTEGRATION_PARTNER',
  "status" "PartnerCertificationStatus" NOT NULL DEFAULT 'ACTIVE',
  "certificateNo" TEXT NOT NULL,
  "issuedBy" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "evidenceHash" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCertification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerCertification_certificateNo_key" ON "PartnerCertification"("certificateNo");
CREATE INDEX "PartnerCertificationRun_partnerId_submittedAt_idx" ON "PartnerCertificationRun"("partnerId", "submittedAt");
CREATE INDEX "PartnerCertificationRun_status_submittedAt_idx" ON "PartnerCertificationRun"("status", "submittedAt");
CREATE INDEX "PartnerCertificationRun_kitVersion_idx" ON "PartnerCertificationRun"("kitVersion");
CREATE INDEX "PartnerCertification_partnerId_status_idx" ON "PartnerCertification"("partnerId", "status");
CREATE INDEX "PartnerCertification_expiresAt_idx" ON "PartnerCertification"("expiresAt");
CREATE INDEX "PartnerCertification_issuedAt_idx" ON "PartnerCertification"("issuedAt");

ALTER TABLE "PartnerCertificationRun"
  ADD CONSTRAINT "PartnerCertificationRun_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerCertification"
  ADD CONSTRAINT "PartnerCertification_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerCertification"
  ADD CONSTRAINT "PartnerCertification_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "PartnerCertificationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

