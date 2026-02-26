-- CreateEnum
CREATE TYPE "AcademyProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CERTIFIED');

-- CreateTable
CREATE TABLE "AcademyProgress" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "learnerKey" TEXT NOT NULL,
  "learnerUserId" TEXT,
  "learnerEmail" TEXT,
  "learnerName" TEXT,
  "icp" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "courseKey" TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  "completedModuleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "quizScores" JSONB,
  "progressPct" INTEGER NOT NULL DEFAULT 0,
  "status" "AcademyProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'academy',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademyProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademyCertificate" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "progressId" TEXT,
  "learnerKey" TEXT NOT NULL,
  "learnerUserId" TEXT,
  "learnerEmail" TEXT,
  "learnerName" TEXT,
  "courseKey" TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  "certificateType" TEXT NOT NULL DEFAULT 'ADMIN_CERTIFIED',
  "locale" TEXT NOT NULL DEFAULT 'es',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidencePayload" JSONB NOT NULL,
  "evidenceHash" TEXT NOT NULL,
  "evidenceSignature" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademyCertificate_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "AcademyProgress_instanceId_learnerKey_courseKey_key" ON "AcademyProgress"("instanceId", "learnerKey", "courseKey");
CREATE INDEX "AcademyProgress_installationId_status_updatedAt_idx" ON "AcademyProgress"("installationId", "status", "updatedAt");
CREATE INDEX "AcademyProgress_instanceId_updatedAt_idx" ON "AcademyProgress"("instanceId", "updatedAt");
CREATE INDEX "AcademyProgress_courseKey_status_idx" ON "AcademyProgress"("courseKey", "status");

CREATE INDEX "AcademyCertificate_installationId_issuedAt_idx" ON "AcademyCertificate"("installationId", "issuedAt");
CREATE INDEX "AcademyCertificate_instanceId_issuedAt_idx" ON "AcademyCertificate"("instanceId", "issuedAt");
CREATE INDEX "AcademyCertificate_learnerKey_issuedAt_idx" ON "AcademyCertificate"("learnerKey", "issuedAt");
CREATE INDEX "AcademyCertificate_courseKey_issuedAt_idx" ON "AcademyCertificate"("courseKey", "issuedAt");
CREATE INDEX "AcademyCertificate_evidenceHash_idx" ON "AcademyCertificate"("evidenceHash");

-- Foreign keys
ALTER TABLE "AcademyProgress"
ADD CONSTRAINT "AcademyProgress_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcademyCertificate"
ADD CONSTRAINT "AcademyCertificate_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcademyCertificate"
ADD CONSTRAINT "AcademyCertificate_progressId_fkey"
FOREIGN KEY ("progressId") REFERENCES "AcademyProgress"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

