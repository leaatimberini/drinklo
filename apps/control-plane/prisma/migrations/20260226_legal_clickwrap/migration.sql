-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TOS', 'DPA', 'SLA', 'PRIVACY');

-- CreateTable
CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL,
  "type" "LegalDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "billingAccountId" TEXT,
  "companyId" TEXT,
  "userId" TEXT,
  "documentId" TEXT,
  "docType" "LegalDocumentType" NOT NULL,
  "version" TEXT NOT NULL,
  "locale" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "source" TEXT NOT NULL DEFAULT 'clickwrap',
  "evidenceHash" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_type_version_locale_key" ON "LegalDocument"("type", "version", "locale");
CREATE INDEX "LegalDocument_type_locale_effectiveAt_idx" ON "LegalDocument"("type", "locale", "effectiveAt");
CREATE INDEX "LegalDocument_effectiveAt_idx" ON "LegalDocument"("effectiveAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_installationId_acceptedAt_idx" ON "LegalAcceptance"("installationId", "acceptedAt");
CREATE INDEX "LegalAcceptance_billingAccountId_acceptedAt_idx" ON "LegalAcceptance"("billingAccountId", "acceptedAt");
CREATE INDEX "LegalAcceptance_companyId_acceptedAt_idx" ON "LegalAcceptance"("companyId", "acceptedAt");
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");
CREATE INDEX "LegalAcceptance_docType_version_acceptedAt_idx" ON "LegalAcceptance"("docType", "version", "acceptedAt");

-- AddForeignKey
ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_billingAccountId_fkey"
FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
