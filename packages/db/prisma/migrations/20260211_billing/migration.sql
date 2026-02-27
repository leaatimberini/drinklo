-- Billing
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "billingMode" text NOT NULL DEFAULT 'NO_FISCAL';
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "afipCuit" text;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "afipPointOfSale" integer;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "afipEnvironment" text DEFAULT 'HOMO';

CREATE TABLE "Invoice" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "saleId" text,
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
  CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AfipLog" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text,
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

DO $$
BEGIN
  IF to_regclass('"Sale"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_saleId_fkey'
  ) THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

