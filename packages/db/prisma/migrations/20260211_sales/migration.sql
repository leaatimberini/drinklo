-- Sales
CREATE TYPE "SaleStatus" AS ENUM ('OPEN', 'PAID', 'CANCELED');

CREATE TABLE "Sale" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL,
  "subtotal" numeric(10, 2) NOT NULL,
  "discount" numeric(10, 2) NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  "currency" text NOT NULL,
  "paymentMethod" text NOT NULL,
  "paidAmount" numeric(10, 2) NOT NULL,
  "changeAmount" numeric(10, 2) NOT NULL,
  "status" "SaleStatus" NOT NULL DEFAULT 'PAID',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SaleItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "saleId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "variantId" uuid,
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
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
