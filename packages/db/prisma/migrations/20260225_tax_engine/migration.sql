CREATE TYPE "TaxRuleKind" AS ENUM ('IVA', 'PERCEPTION', 'WITHHOLDING');
CREATE TYPE "TaxPriceMode" AS ENUM ('INCLUDED', 'EXCLUDED');
CREATE TYPE "TaxRoundingMode" AS ENUM ('HALF_UP', 'UP', 'DOWN');
CREATE TYPE "TaxRoundingScope" AS ENUM ('LINE', 'TOTAL');

CREATE TABLE "TaxProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default',
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "ivaDefaultMode" "TaxPriceMode" NOT NULL DEFAULT 'EXCLUDED',
  "roundingMode" "TaxRoundingMode" NOT NULL DEFAULT 'HALF_UP',
  "roundingScope" "TaxRoundingScope" NOT NULL DEFAULT 'TOTAL',
  "roundingIncrement" DECIMAL(10,4) NOT NULL DEFAULT 0.01,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxRule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taxProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "kind" "TaxRuleKind" NOT NULL,
  "rate" DECIMAL(10,6) NOT NULL,
  "priceMode" "TaxPriceMode",
  "priority" INTEGER NOT NULL DEFAULT 100,
  "applyToShipping" BOOLEAN NOT NULL DEFAULT false,
  "categoryId" TEXT,
  "productId" TEXT,
  "locationCountry" TEXT,
  "locationState" TEXT,
  "locationCity" TEXT,
  "postalCodePrefix" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderTaxBreakdown" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "taxProfileId" TEXT,
  "currency" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL DEFAULT 'v1',
  "baseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shippingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ivaAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "perceptionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "withholdingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalTaxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "roundingMode" "TaxRoundingMode" NOT NULL,
  "roundingScope" "TaxRoundingScope" NOT NULL,
  "roundingIncrement" DECIMAL(10,4) NOT NULL,
  "lines" JSONB NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderTaxBreakdown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxProfile_companyId_name_key" ON "TaxProfile"("companyId", "name");
CREATE INDEX "TaxProfile_companyId_idx" ON "TaxProfile"("companyId");
CREATE INDEX "TaxProfile_isDefault_idx" ON "TaxProfile"("isDefault");

CREATE INDEX "TaxRule_companyId_idx" ON "TaxRule"("companyId");
CREATE INDEX "TaxRule_taxProfileId_idx" ON "TaxRule"("taxProfileId");
CREATE INDEX "TaxRule_categoryId_idx" ON "TaxRule"("categoryId");
CREATE INDEX "TaxRule_productId_idx" ON "TaxRule"("productId");
CREATE INDEX "TaxRule_isActive_deletedAt_idx" ON "TaxRule"("isActive", "deletedAt");
CREATE INDEX "TaxRule_locationCountry_locationState_locationCity_idx" ON "TaxRule"("locationCountry", "locationState", "locationCity");

CREATE UNIQUE INDEX "OrderTaxBreakdown_orderId_key" ON "OrderTaxBreakdown"("orderId");
CREATE INDEX "OrderTaxBreakdown_companyId_idx" ON "OrderTaxBreakdown"("companyId");
CREATE INDEX "OrderTaxBreakdown_taxProfileId_idx" ON "OrderTaxBreakdown"("taxProfileId");
CREATE INDEX "OrderTaxBreakdown_createdAt_idx" ON "OrderTaxBreakdown"("createdAt");

ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxProfile" ADD CONSTRAINT "TaxProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "TaxProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderTaxBreakdown" ADD CONSTRAINT "OrderTaxBreakdown_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderTaxBreakdown" ADD CONSTRAINT "OrderTaxBreakdown_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderTaxBreakdown" ADD CONSTRAINT "OrderTaxBreakdown_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "TaxProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;


