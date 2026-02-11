-- Orders + shipping
ALTER TABLE "CompanySettings" ADD COLUMN "depotAddress" text NOT NULL DEFAULT 'CABA';
ALTER TABLE "CompanySettings" ADD COLUMN "depotLat" double precision NOT NULL DEFAULT -34.6037;
ALTER TABLE "CompanySettings" ADD COLUMN "depotLng" double precision NOT NULL DEFAULT -58.3816;

CREATE TYPE "ShippingMode" AS ENUM ('PICKUP', 'DELIVERY');
CREATE TYPE "ShippingProvider" AS ENUM ('ANDREANI', 'OWN');
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELED');

CREATE TABLE "ShippingZone" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL,
  "name" text NOT NULL,
  "maxDistanceKm" double precision NOT NULL,
  "baseFee" numeric(10, 2) NOT NULL,
  "perKm" numeric(10, 2) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ShippingZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Order" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL,
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
  CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OrderItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "variantId" uuid,
  "name" text NOT NULL,
  "sku" text,
  "quantity" integer NOT NULL,
  "unitPrice" numeric(10, 2) NOT NULL,
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OrderStatusEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "message" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ShippingZone_companyId_idx" ON "ShippingZone"("companyId");
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderStatusEvent_orderId_idx" ON "OrderStatusEvent"("orderId");
CREATE INDEX "OrderStatusEvent_status_idx" ON "OrderStatusEvent"("status");
