ALTER TABLE IF EXISTS "ShippingZone" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE IF EXISTS "Order" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE IF EXISTS "PriceList" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE IF EXISTS "StockLocation" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE IF EXISTS "StockItem" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE IF EXISTS "StockReservation" ADD COLUMN IF NOT EXISTS "branchId" text;
ALTER TABLE IF EXISTS "StockMovement" ADD COLUMN IF NOT EXISTS "branchId" text;

CREATE TABLE IF NOT EXISTS "Branch" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "address" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Branch_companyId_idx" ON "Branch"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Branch_companyId_fkey') THEN
    ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "UserBranch" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "userId" text NOT NULL,
  "branchId" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");
CREATE INDEX IF NOT EXISTS "UserBranch_companyId_idx" ON "UserBranch"("companyId");
CREATE INDEX IF NOT EXISTS "UserBranch_branchId_idx" ON "UserBranch"("branchId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_companyId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_userId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_branchId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"ShippingZone"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShippingZone_branchId_fkey') THEN
    ALTER TABLE "ShippingZone" ADD CONSTRAINT "ShippingZone_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"Order"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_branchId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"PriceList"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PriceList_branchId_fkey') THEN
    ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockLocation"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockLocation_branchId_fkey') THEN
    ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockItem"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_branchId_fkey') THEN
    ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockReservation"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockReservation_branchId_fkey') THEN
    ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockMovement"') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_branchId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"ShippingZone"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "ShippingZone_branchId_idx" ON "ShippingZone"("branchId")';
  END IF;
  IF to_regclass('"Order"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Order_branchId_idx" ON "Order"("branchId")';
  END IF;
  IF to_regclass('"PriceList"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "PriceList_branchId_idx" ON "PriceList"("branchId")';
  END IF;
  IF to_regclass('"StockLocation"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "StockLocation_branchId_idx" ON "StockLocation"("branchId")';
  END IF;
  IF to_regclass('"StockItem"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "StockItem_branchId_idx" ON "StockItem"("branchId")';
  END IF;
  IF to_regclass('"StockReservation"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "StockReservation_branchId_idx" ON "StockReservation"("branchId")';
  END IF;
  IF to_regclass('"StockMovement"') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "StockMovement_branchId_idx" ON "StockMovement"("branchId")';
  END IF;
END
$$;
