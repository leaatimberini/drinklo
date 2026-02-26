-- CreateEnum
CREATE TYPE "CaseStudyStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CaseStudy" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "billingAccountId" TEXT,
  "crmDealId" TEXT,
  "slug" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "CaseStudyStatus" NOT NULL DEFAULT 'DRAFT',
  "industry" TEXT DEFAULT 'bebidas',
  "icp" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "timeframeDays" INTEGER,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'auto-generator',
  "sourceSnapshot" JSONB,
  "metrics" JSONB,
  "content" JSONB NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedBy" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudy_slug_key" ON "CaseStudy"("slug");
CREATE INDEX "CaseStudy_installationId_createdAt_idx" ON "CaseStudy"("installationId", "createdAt");
CREATE INDEX "CaseStudy_instanceId_createdAt_idx" ON "CaseStudy"("instanceId", "createdAt");
CREATE INDEX "CaseStudy_status_publishedAt_idx" ON "CaseStudy"("status", "publishedAt");
CREATE INDEX "CaseStudy_icp_status_createdAt_idx" ON "CaseStudy"("icp", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "CaseStudy"
ADD CONSTRAINT "CaseStudy_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

