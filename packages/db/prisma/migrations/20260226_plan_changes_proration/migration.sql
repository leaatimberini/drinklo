CREATE TYPE "ProrationInvoiceStatus" AS ENUM ('ESTIMATED', 'FINALIZED', 'VOID');
CREATE TYPE "PlanChangeDirection" AS ENUM ('UPGRADE', 'DOWNGRADE', 'CANCEL', 'REACTIVATE');

ALTER TABLE "PlanEntitlement" ADD COLUMN "monthlyPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "softLimited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "softLimitReason" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "softLimitSnapshot" JSONB;

CREATE TABLE "ProrationInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "direction" "PlanChangeDirection" NOT NULL,
  "status" "ProrationInvoiceStatus" NOT NULL DEFAULT 'FINALIZED',
  "fromTier" "PlanTier",
  "toTier" "PlanTier",
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "remainingRatio" DECIMAL(10,6) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "details" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProrationInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProrationInvoiceItem" (
  "id" TEXT NOT NULL,
  "prorationInvoiceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProrationInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProrationInvoice_companyId_createdAt_idx" ON "ProrationInvoice"("companyId", "createdAt");
CREATE INDEX "ProrationInvoice_subscriptionId_createdAt_idx" ON "ProrationInvoice"("subscriptionId", "createdAt");
CREATE INDEX "ProrationInvoice_status_idx" ON "ProrationInvoice"("status");
CREATE INDEX "ProrationInvoiceItem_prorationInvoiceId_idx" ON "ProrationInvoiceItem"("prorationInvoiceId");
CREATE INDEX "ProrationInvoiceItem_type_idx" ON "ProrationInvoiceItem"("type");

ALTER TABLE "ProrationInvoice" ADD CONSTRAINT "ProrationInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProrationInvoice" ADD CONSTRAINT "ProrationInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProrationInvoiceItem" ADD CONSTRAINT "ProrationInvoiceItem_prorationInvoiceId_fkey" FOREIGN KEY ("prorationInvoiceId") REFERENCES "ProrationInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

