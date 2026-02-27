-- Audit fields (safe if this migration runs before init)
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "updatedById" text;

ALTER TABLE IF EXISTS "Customer" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE IF EXISTS "Customer" ADD COLUMN IF NOT EXISTS "updatedById" text;

ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE IF EXISTS "Product" ADD COLUMN IF NOT EXISTS "updatedById" text;

ALTER TABLE IF EXISTS "ProductVariant" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE IF EXISTS "ProductVariant" ADD COLUMN IF NOT EXISTS "updatedById" text;

ALTER TABLE IF EXISTS "StockLocation" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE IF EXISTS "StockLocation" ADD COLUMN IF NOT EXISTS "updatedById" text;

ALTER TABLE IF EXISTS "StockItem" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE IF EXISTS "StockItem" ADD COLUMN IF NOT EXISTS "updatedById" text;

DO $$
BEGIN
  IF to_regclass('"User"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_createdById_fkey'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"User"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_updatedById_fkey'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"Customer"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_createdById_fkey'
  ) THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"Customer"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_updatedById_fkey'
  ) THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"Product"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_createdById_fkey'
  ) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"Product"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_updatedById_fkey'
  ) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"ProductVariant"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_createdById_fkey'
  ) THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"ProductVariant"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_updatedById_fkey'
  ) THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockLocation"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockLocation_createdById_fkey'
  ) THEN
    ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockLocation"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockLocation_updatedById_fkey'
  ) THEN
    ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockItem"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_createdById_fkey'
  ) THEN
    ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"StockItem"') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_updatedById_fkey'
  ) THEN
    ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

