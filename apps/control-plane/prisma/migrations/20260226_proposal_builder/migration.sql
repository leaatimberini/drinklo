-- CreateEnum
CREATE TYPE "ProposalTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProposalDocumentStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'ACCEPTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ProposalTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "planTier" TEXT,
  "addonKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "ProposalTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "variablesSchema" JSONB,
  "sections" JSONB NOT NULL,
  "pricingDefaults" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalDocument" (
  "id" TEXT NOT NULL,
  "templateId" TEXT,
  "installationId" TEXT,
  "instanceId" TEXT,
  "clientName" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "planTier" TEXT NOT NULL,
  "addonKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "ProposalDocumentStatus" NOT NULL DEFAULT 'GENERATED',
  "variables" JSONB NOT NULL,
  "pricingSummary" JSONB,
  "renderedPayload" JSONB NOT NULL,
  "manifest" JSONB,
  "signature" TEXT,
  "pdfHash" TEXT,
  "evidenceId" TEXT,
  "createdBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalDocument_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ProposalTemplate_key_key" ON "ProposalTemplate"("key");
CREATE INDEX "ProposalTemplate_status_locale_createdAt_idx" ON "ProposalTemplate"("status", "locale", "createdAt");
CREATE INDEX "ProposalTemplate_planTier_status_idx" ON "ProposalTemplate"("planTier", "status");

CREATE INDEX "ProposalDocument_installationId_createdAt_idx" ON "ProposalDocument"("installationId", "createdAt");
CREATE INDEX "ProposalDocument_instanceId_createdAt_idx" ON "ProposalDocument"("instanceId", "createdAt");
CREATE INDEX "ProposalDocument_planTier_createdAt_idx" ON "ProposalDocument"("planTier", "createdAt");
CREATE INDEX "ProposalDocument_status_createdAt_idx" ON "ProposalDocument"("status", "createdAt");

-- Foreign Keys
ALTER TABLE "ProposalDocument"
ADD CONSTRAINT "ProposalDocument_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ProposalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProposalDocument"
ADD CONSTRAINT "ProposalDocument_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

