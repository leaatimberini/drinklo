-- Stock reservations
ALTER TABLE "StockItem" ADD COLUMN "reservedQuantity" integer NOT NULL DEFAULT 0;

CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'CANCELED', 'EXPIRED');

CREATE TABLE "StockReservation" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "branchId" text,
  "orderId" text NOT NULL,
  "variantId" text NOT NULL,
  "quantity" integer NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "expiresAt" timestamptz NOT NULL,
  "confirmedAt" timestamptz,
  "canceledAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "StockReservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StockReservation_companyId_idx" ON "StockReservation"("companyId");
CREATE INDEX "StockReservation_branchId_idx" ON "StockReservation"("branchId");
CREATE INDEX "StockReservation_orderId_idx" ON "StockReservation"("orderId");
CREATE INDEX "StockReservation_variantId_idx" ON "StockReservation"("variantId");
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");
CREATE INDEX "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");

