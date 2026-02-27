-- Initial schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Company" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz
);

CREATE TABLE "Role" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Role_companyId_name_key" UNIQUE ("companyId", "name")
);

CREATE TABLE "Permission" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Permission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Permission_companyId_code_key" UNIQUE ("companyId", "code")
);

CREATE TABLE "RolePermission" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "roleId" text NOT NULL,
  "permissionId" text NOT NULL,
  CONSTRAINT "RolePermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_roleId_permissionId_key" UNIQUE ("roleId", "permissionId")
);

CREATE TABLE "User" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "roleId" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "passwordHash" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "User_companyId_email_key" UNIQUE ("companyId", "email")
);

CREATE TABLE "Customer" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Address" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "customerId" text NOT NULL,
  "line1" text NOT NULL,
  "line2" text,
  "city" text NOT NULL,
  "state" text,
  "postalCode" text NOT NULL,
  "country" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "Address_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Category" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "parentId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Product" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProductVariant" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "productId" text NOT NULL,
  "name" text NOT NULL,
  "sku" text NOT NULL,
  "barcode" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "ProductVariant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductVariant_companyId_sku_key" UNIQUE ("companyId", "sku"),
  CONSTRAINT "ProductVariant_companyId_barcode_key" UNIQUE ("companyId", "barcode")
);

CREATE TABLE "ProductCategory" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "productId" text NOT NULL,
  "categoryId" text NOT NULL,
  CONSTRAINT "ProductCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_productId_categoryId_key" UNIQUE ("productId", "categoryId")
);

CREATE TABLE "PriceList" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "currency" text NOT NULL,
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "PriceList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PriceList_companyId_name_key" UNIQUE ("companyId", "name")
);

CREATE TABLE "PriceRule" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "priceListId" text NOT NULL,
  "productId" text,
  "variantId" text,
  "minQty" integer NOT NULL DEFAULT 1,
  "price" numeric(10, 2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "PriceRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PriceRule_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PriceRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PriceRule_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "StockLocation" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "StockLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StockItem" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "variantId" text NOT NULL,
  "locationId" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "StockItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockItem_variantId_locationId_key" UNIQUE ("variantId", "locationId")
);

CREATE TABLE "StockMovement" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "stockItemId" text NOT NULL,
  "delta" integer NOT NULL,
  "reason" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
CREATE INDEX "Permission_companyId_idx" ON "Permission"("companyId");
CREATE INDEX "RolePermission_companyId_idx" ON "RolePermission"("companyId");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "Address_companyId_idx" ON "Address"("companyId");
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");
CREATE INDEX "Category_companyId_idx" ON "Category"("companyId");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_barcode_idx" ON "ProductVariant"("barcode");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_companyId_idx" ON "ProductVariant"("companyId");
CREATE INDEX "ProductCategory_companyId_idx" ON "ProductCategory"("companyId");
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");
CREATE INDEX "PriceList_companyId_idx" ON "PriceList"("companyId");
CREATE INDEX "PriceRule_companyId_idx" ON "PriceRule"("companyId");
CREATE INDEX "PriceRule_priceListId_idx" ON "PriceRule"("priceListId");
CREATE INDEX "PriceRule_productId_idx" ON "PriceRule"("productId");
CREATE INDEX "PriceRule_variantId_idx" ON "PriceRule"("variantId");
CREATE INDEX "StockLocation_companyId_idx" ON "StockLocation"("companyId");
CREATE INDEX "StockItem_companyId_idx" ON "StockItem"("companyId");
CREATE INDEX "StockItem_variantId_idx" ON "StockItem"("variantId");
CREATE INDEX "StockMovement_companyId_idx" ON "StockMovement"("companyId");
CREATE INDEX "StockMovement_stockItemId_idx" ON "StockMovement"("stockItemId");

-- Ensure audit columns exist for fresh databases when 20260210_audit_fields runs before init.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedById" text;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "updatedById" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "updatedById" text;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "updatedById" text;
ALTER TABLE "StockLocation" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE "StockLocation" ADD COLUMN IF NOT EXISTS "updatedById" text;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "createdById" text;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "updatedById" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_createdById_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_updatedById_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_createdById_fkey') THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Customer_updatedById_fkey') THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_createdById_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_updatedById_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_createdById_fkey') THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_updatedById_fkey') THEN
    ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockLocation_createdById_fkey') THEN
    ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockLocation_updatedById_fkey') THEN
    ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_createdById_fkey') THEN
    ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_updatedById_fkey') THEN
    ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

