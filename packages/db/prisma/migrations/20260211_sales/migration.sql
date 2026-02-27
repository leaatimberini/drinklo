-- Sales
CREATE TYPE "SaleStatus" AS ENUM ('OPEN', 'PAID', 'CANCELED');

CREATE TABLE "Sale" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "subtotal" numeric(10, 2) NOT NULL,
  "discount" numeric(10, 2) NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  "currency" text NOT NULL,
  "paymentMethod" text NOT NULL,
  "clientTxnId" text,
  "paidAmount" numeric(10, 2) NOT NULL,
  "changeAmount" numeric(10, 2) NOT NULL,
  "status" "SaleStatus" NOT NULL DEFAULT 'PAID',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SaleItem" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "saleId" text NOT NULL,
  "productId" text NOT NULL,
  "variantId" text,
  "name" text NOT NULL,
  "sku" text,
  "quantity" integer NOT NULL,
  "unitPrice" numeric(10, 2) NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Sale_companyId_idx" ON "Sale"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_companyId_clientTxnId_key" ON "Sale"("companyId", "clientTxnId");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

DO $$
BEGIN
  IF to_regclass('"Invoice"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_saleId_fkey'
  ) THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

