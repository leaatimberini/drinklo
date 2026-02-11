CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE','PAST_DUE','SUSPENDED','CANCELED');
CREATE TYPE "BillingProvider" AS ENUM ('MERCADOPAGO','MANUAL');
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY','YEARLY');
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN','PAID','VOID');

CREATE TABLE "BillingPlan" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "price" double precision NOT NULL,
  "currency" text NOT NULL,
  "period" "BillingPeriod" NOT NULL,
  "features" text[] NOT NULL,
  "rpoTargetMin" integer,
  "rtoTargetMin" integer,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingAccount" (
  "id" text NOT NULL,
  "installationId" text NOT NULL,
  "instanceId" text NOT NULL,
  "clientName" text,
  "email" text,
  "planId" text NOT NULL,
  "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "provider" "BillingProvider" NOT NULL DEFAULT 'MANUAL',
  "externalId" text,
  "nextBillingAt" timestamp(3),
  "warningCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingInvoice" (
  "id" text NOT NULL,
  "accountId" text NOT NULL,
  "amount" double precision NOT NULL,
  "currency" text NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" timestamp(3) NOT NULL,
  "paidAt" timestamp(3),
  "provider" "BillingProvider" NOT NULL,
  "externalId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPayment" (
  "id" text NOT NULL,
  "accountId" text NOT NULL,
  "invoiceId" text,
  "provider" "BillingProvider" NOT NULL,
  "status" text NOT NULL,
  "amount" double precision NOT NULL,
  "currency" text NOT NULL,
  "externalId" text,
  "raw" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingAccount_instanceId_key" ON "BillingAccount"("instanceId");
CREATE INDEX "BillingPlan_name_idx" ON "BillingPlan"("name");
CREATE INDEX "BillingAccount_installationId_idx" ON "BillingAccount"("installationId");
CREATE INDEX "BillingAccount_planId_idx" ON "BillingAccount"("planId");
CREATE INDEX "BillingAccount_status_idx" ON "BillingAccount"("status");
CREATE INDEX "BillingInvoice_accountId_idx" ON "BillingInvoice"("accountId");
CREATE INDEX "BillingInvoice_status_idx" ON "BillingInvoice"("status");
CREATE INDEX "BillingInvoice_dueAt_idx" ON "BillingInvoice"("dueAt");
CREATE INDEX "BillingPayment_accountId_idx" ON "BillingPayment"("accountId");
CREATE INDEX "BillingPayment_invoiceId_idx" ON "BillingPayment"("invoiceId");
CREATE INDEX "BillingPayment_provider_idx" ON "BillingPayment"("provider");
CREATE INDEX "BillingPayment_status_idx" ON "BillingPayment"("status");

ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
