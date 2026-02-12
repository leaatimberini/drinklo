ALTER TABLE "CompanySettings"
  ADD COLUMN "pickingStrategy" TEXT NOT NULL DEFAULT 'FEFO',
  ADD COLUMN "blockExpiredLotSale" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BatchLot" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "stockItemId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "lotCode" TEXT NOT NULL,
  "manufacturingDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BatchLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockReservationLot" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockReservationLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BatchLot_stockItemId_lotCode_key" ON "BatchLot"("stockItemId", "lotCode");
CREATE INDEX "BatchLot_companyId_variantId_expiryDate_idx" ON "BatchLot"("companyId", "variantId", "expiryDate");
CREATE INDEX "BatchLot_companyId_lotCode_idx" ON "BatchLot"("companyId", "lotCode");
CREATE INDEX "StockReservationLot_companyId_idx" ON "StockReservationLot"("companyId");
CREATE INDEX "StockReservationLot_reservationId_idx" ON "StockReservationLot"("reservationId");
CREATE INDEX "StockReservationLot_lotId_idx" ON "StockReservationLot"("lotId");

ALTER TABLE "BatchLot" ADD CONSTRAINT "BatchLot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchLot" ADD CONSTRAINT "BatchLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BatchLot" ADD CONSTRAINT "BatchLot_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchLot" ADD CONSTRAINT "BatchLot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationLot" ADD CONSTRAINT "StockReservationLot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationLot" ADD CONSTRAINT "StockReservationLot_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationLot" ADD CONSTRAINT "StockReservationLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "BatchLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
