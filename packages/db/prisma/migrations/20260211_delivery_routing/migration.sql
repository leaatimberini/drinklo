ALTER TABLE "Order" ADD COLUMN "deliveryWindowId" TEXT;

CREATE TYPE "DeliveryStopStatus" AS ENUM ('PENDING', 'EN_ROUTE', 'DELIVERED', 'FAILED', 'SKIPPED');

CREATE TABLE "DeliveryWindow" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryWindow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryRoute" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "windowId" TEXT,
  "driverName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryStop" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "DeliveryStopStatus" NOT NULL DEFAULT 'PENDING',
  "distanceKm" DOUBLE PRECISION,
  "etaMinutes" INTEGER,
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryWindow_companyId_name_key" ON "DeliveryWindow"("companyId", "name");
CREATE INDEX "DeliveryWindow_companyId_idx" ON "DeliveryWindow"("companyId");

CREATE INDEX "DeliveryRoute_companyId_idx" ON "DeliveryRoute"("companyId");
CREATE INDEX "DeliveryRoute_date_idx" ON "DeliveryRoute"("date");
CREATE INDEX "DeliveryRoute_windowId_idx" ON "DeliveryRoute"("windowId");

CREATE INDEX "DeliveryStop_routeId_idx" ON "DeliveryStop"("routeId");
CREATE INDEX "DeliveryStop_orderId_idx" ON "DeliveryStop"("orderId");
CREATE INDEX "DeliveryStop_status_idx" ON "DeliveryStop"("status");

CREATE INDEX "Order_deliveryWindowId_idx" ON "Order"("deliveryWindowId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryWindowId_fkey" FOREIGN KEY ("deliveryWindowId") REFERENCES "DeliveryWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryWindow" ADD CONSTRAINT "DeliveryWindow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRoute" ADD CONSTRAINT "DeliveryRoute_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "DeliveryWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryStop" ADD CONSTRAINT "DeliveryStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "DeliveryRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryStop" ADD CONSTRAINT "DeliveryStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
