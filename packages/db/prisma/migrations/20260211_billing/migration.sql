-- Billing
ALTER TABLE "CompanySettings" ADD COLUMN "billingMode" text NOT NULL DEFAULT 'NO_FISCAL';
ALTER TABLE "CompanySettings" ADD COLUMN "afipCuit" text;
ALTER TABLE "CompanySettings" ADD COLUMN "afipPointOfSale" integer;
ALTER TABLE "CompanySettings" ADD COLUMN "afipEnvironment" text DEFAULT 'HOMO';

CREATE TABLE "Invoice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL,
  "saleId" uuid,
  "type" text NOT NULL,
  "pointOfSale" integer NOT NULL,
  "number" integer NOT NULL,
  "cae" text NOT NULL,
  "caeDue" timestamptz NOT NULL,
  "total" numeric(18, 2) NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL,
  "raw" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AfipLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid,
  "service" text NOT NULL,
  "environment" text NOT NULL,
  "request" jsonb,
  "response" jsonb,
  "error" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "AfipLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");
CREATE INDEX "Invoice_cae_idx" ON "Invoice"("cae");
CREATE INDEX "Invoice_number_idx" ON "Invoice"("number");
CREATE INDEX "AfipLog_companyId_idx" ON "AfipLog"("companyId");
CREATE INDEX "AfipLog_service_idx" ON "AfipLog"("service");
