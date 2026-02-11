-- Quotes
CREATE TYPE "QuoteStatus" AS ENUM ('OPEN', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELED');

CREATE TABLE "Quote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL,
  "customerName" text NOT NULL,
  "customerEmail" text,
  "subtotal" numeric(10, 2) NOT NULL,
  "discount" numeric(10, 2) NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  "currency" text NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "QuoteItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quoteId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "variantId" uuid,
  "name" text NOT NULL,
  "sku" text,
  "quantity" integer NOT NULL,
  "unitPrice" numeric(10, 2) NOT NULL,
  "total" numeric(10, 2) NOT NULL,
  CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuoteItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Quote_companyId_idx" ON "Quote"("companyId");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");
