-- Partner Program

CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BLOCKED');
CREATE TYPE "ReferralLinkStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "LeadStatus" AS ENUM ('CLICKED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED');
CREATE TYPE "ConversionStatus" AS ENUM ('ATTRIBUTED', 'REVIEW', 'REJECTED', 'APPROVED');
CREATE TYPE "CommissionPlanType" AS ENUM ('PERCENT_REVENUE', 'FLAT_PER_CONVERSION', 'HYBRID');

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "contactEmail" TEXT,
  "websiteDomain" TEXT,
  "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
  "portalTokenHash" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionPlan" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CommissionPlanType" NOT NULL,
  "percentRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "flatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "cookieTtlDays" INTEGER NOT NULL DEFAULT 30,
  "recurringInvoiceCap" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralLink" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "targetUrl" TEXT,
  "status" "ReferralLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "commissionPlanId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "referralLinkId" TEXT,
  "cookieId" TEXT,
  "email" TEXT,
  "emailDomain" TEXT,
  "installationDomain" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmTerm" TEXT,
  "utmContent" TEXT,
  "landingUrl" TEXT,
  "sourceUrl" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "status" "LeadStatus" NOT NULL DEFAULT 'CLICKED',
  "fraudScore" INTEGER NOT NULL DEFAULT 0,
  "fraudFlags" JSONB,
  "fraudReason" TEXT,
  "metadata" JSONB,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversion" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "referralLinkId" TEXT,
  "leadId" TEXT,
  "commissionPlanId" TEXT,
  "installationId" TEXT,
  "billingAccountId" TEXT,
  "instanceId" TEXT,
  "status" "ConversionStatus" NOT NULL DEFAULT 'ATTRIBUTED',
  "attributionSource" TEXT NOT NULL DEFAULT 'cookie+utm',
  "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "accountCreationIp" TEXT,
  "accountEmailDomain" TEXT,
  "installationDomain" TEXT,
  "fraudScore" INTEGER NOT NULL DEFAULT 0,
  "fraudFlags" JSONB,
  "estimatedRevenueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedCommissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionCurrency" TEXT NOT NULL DEFAULT 'ARS',
  "invoiceCountApplied" INTEGER NOT NULL DEFAULT 0,
  "commissionSnapshot" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");
CREATE INDEX "Partner_status_idx" ON "Partner"("status");
CREATE INDEX "Partner_websiteDomain_idx" ON "Partner"("websiteDomain");

CREATE INDEX "CommissionPlan_partnerId_active_idx" ON "CommissionPlan"("partnerId", "active");
CREATE INDEX "CommissionPlan_partnerId_isDefault_idx" ON "CommissionPlan"("partnerId", "isDefault");

CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE INDEX "ReferralLink_partnerId_status_idx" ON "ReferralLink"("partnerId", "status");
CREATE INDEX "ReferralLink_commissionPlanId_idx" ON "ReferralLink"("commissionPlanId");

CREATE INDEX "Lead_partnerId_createdAt_idx" ON "Lead"("partnerId", "createdAt");
CREATE INDEX "Lead_referralLinkId_createdAt_idx" ON "Lead"("referralLinkId", "createdAt");
CREATE INDEX "Lead_cookieId_idx" ON "Lead"("cookieId");
CREATE INDEX "Lead_emailDomain_idx" ON "Lead"("emailDomain");
CREATE INDEX "Lead_ipAddress_idx" ON "Lead"("ipAddress");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

CREATE UNIQUE INDEX "Conversion_billingAccountId_key" ON "Conversion"("billingAccountId");
CREATE INDEX "Conversion_partnerId_createdAt_idx" ON "Conversion"("partnerId", "createdAt");
CREATE INDEX "Conversion_leadId_idx" ON "Conversion"("leadId");
CREATE INDEX "Conversion_installationId_idx" ON "Conversion"("installationId");
CREATE INDEX "Conversion_instanceId_idx" ON "Conversion"("instanceId");
CREATE INDEX "Conversion_status_idx" ON "Conversion"("status");

ALTER TABLE "CommissionPlan"
  ADD CONSTRAINT "CommissionPlan_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralLink"
  ADD CONSTRAINT "ReferralLink_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralLink"
  ADD CONSTRAINT "ReferralLink_commissionPlanId_fkey"
  FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_referralLinkId_fkey"
  FOREIGN KEY ("referralLinkId") REFERENCES "ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversion"
  ADD CONSTRAINT "Conversion_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversion"
  ADD CONSTRAINT "Conversion_referralLinkId_fkey"
  FOREIGN KEY ("referralLinkId") REFERENCES "ReferralLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversion"
  ADD CONSTRAINT "Conversion_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversion"
  ADD CONSTRAINT "Conversion_commissionPlanId_fkey"
  FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversion"
  ADD CONSTRAINT "Conversion_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversion"
  ADD CONSTRAINT "Conversion_billingAccountId_fkey"
  FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

