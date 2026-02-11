ALTER TABLE "ShippingZone" ADD COLUMN "branchId" text;
ALTER TABLE "Order" ADD COLUMN "branchId" text;
ALTER TABLE "PriceList" ADD COLUMN "branchId" text;
ALTER TABLE "StockLocation" ADD COLUMN "branchId" text;
ALTER TABLE "StockItem" ADD COLUMN "branchId" text;
ALTER TABLE "StockReservation" ADD COLUMN "branchId" text;
ALTER TABLE "StockMovement" ADD COLUMN "branchId" text;

CREATE TABLE "Branch" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "address" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserBranch" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "userId" text NOT NULL,
  "branchId" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");
CREATE INDEX "UserBranch_companyId_idx" ON "UserBranch"("companyId");
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShippingZone" ADD CONSTRAINT "ShippingZone_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ShippingZone_branchId_idx" ON "ShippingZone"("branchId");
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");
CREATE INDEX "PriceList_branchId_idx" ON "PriceList"("branchId");
CREATE INDEX "StockLocation_branchId_idx" ON "StockLocation"("branchId");
CREATE INDEX "StockItem_branchId_idx" ON "StockItem"("branchId");
CREATE INDEX "StockReservation_branchId_idx" ON "StockReservation"("branchId");
CREATE INDEX "StockMovement_branchId_idx" ON "StockMovement"("branchId");
