-- Orders + shipping
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "depotAddress" text NOT NULL DEFAULT 'CABA';
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "depotLat" double precision NOT NULL DEFAULT -34.6037;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "depotLng" double precision NOT NULL DEFAULT -58.3816;

CREATE TYPE "ShippingMode" AS ENUM ('PICKUP', 'DELIVERY');
CREATE TYPE "ShippingProvider" AS ENUM ('ANDREANI', 'OWN');
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELED');

CREATE TABLE "ShippingZone" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "branchId" text,
  "name" text NOT NULL,
  "maxDistanceKm" double precision NOT NULL,
  "baseFee" numeric(10, 2) NOT NULL,
  "perKm" numeric(10, 2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ShippingZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShippingZone_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Order" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "branchId" text,
  "customerName" text NOT NULL,
  "customerEmail" text NOT NULL,
  "customerPhone" text,
  "shippingMode" "ShippingMode" NOT NULL,
  "shippingProvider" "ShippingProvider",
  "shippingCost" numeric(10, 2) NOT NULL,
  "shippingLabel" text,
  "shippingMeta" jsonb,
  "trackingCode" text,
  "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
  "addressLine1" text,
  "addressLine2" text,
  "city" text,
  "state" text,
  "postalCode" text,
  "country" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OrderItem" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" text NOT NULL,
  "productId" text NOT NULL,
  "variantId" text,
  "name" text NOT NULL,
  "sku" text,
  "quantity" integer NOT NULL,
  "unitPrice" numeric(10, 2) NOT NULL,
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OrderStatusEvent" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" text NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "message" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ShippingZone_companyId_idx" ON "ShippingZone"("companyId");
CREATE INDEX "ShippingZone_branchId_idx" ON "ShippingZone"("branchId");
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderStatusEvent_orderId_idx" ON "OrderStatusEvent"("orderId");
CREATE INDEX "OrderStatusEvent_status_idx" ON "OrderStatusEvent"("status");

