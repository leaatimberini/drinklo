-- CreateEnum
CREATE TYPE "ProductTourSurface" AS ENUM ('ADMIN', 'STOREFRONT');
CREATE TYPE "ProductTourStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProductTourTriggerType" AS ENUM ('ALWAYS', 'FIRST_TIME', 'FEATURE_UNUSED', 'TRIAL_NEARING_END');
CREATE TYPE "ProductTourEventType" AS ENUM ('STARTED', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "ProductTour" (
  "id" TEXT NOT NULL,
  "installationId" TEXT,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "surface" "ProductTourSurface" NOT NULL,
  "status" "ProductTourStatus" NOT NULL DEFAULT 'DRAFT',
  "locale" TEXT NOT NULL DEFAULT 'es',
  "title" TEXT,
  "description" TEXT,
  "condition" JSONB,
  "triggerType" "ProductTourTriggerType" NOT NULL DEFAULT 'ALWAYS',
  "triggerConfig" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTour_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductTourStep" (
  "id" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "locale" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "targetSelector" TEXT NOT NULL,
  "placement" TEXT,
  "condition" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTourStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductTourEvent" (
  "id" TEXT NOT NULL,
  "tourId" TEXT NOT NULL,
  "installationId" TEXT,
  "instanceId" TEXT,
  "companyId" TEXT,
  "userId" TEXT,
  "role" TEXT,
  "icp" TEXT,
  "locale" TEXT,
  "surface" "ProductTourSurface" NOT NULL,
  "eventType" "ProductTourEventType" NOT NULL,
  "sessionId" TEXT,
  "stepIndex" INTEGER,
  "stepId" TEXT,
  "path" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductTourEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ProductTour_key_key" ON "ProductTour"("key");
CREATE INDEX "ProductTour_installationId_surface_status_idx" ON "ProductTour"("installationId", "surface", "status");
CREATE INDEX "ProductTour_surface_status_locale_idx" ON "ProductTour"("surface", "status", "locale");

CREATE UNIQUE INDEX "ProductTourStep_tourId_order_key" ON "ProductTourStep"("tourId", "order");
CREATE INDEX "ProductTourStep_tourId_order_idx" ON "ProductTourStep"("tourId", "order");

CREATE INDEX "ProductTourEvent_tourId_occurredAt_idx" ON "ProductTourEvent"("tourId", "occurredAt");
CREATE INDEX "ProductTourEvent_installationId_occurredAt_idx" ON "ProductTourEvent"("installationId", "occurredAt");
CREATE INDEX "ProductTourEvent_instanceId_occurredAt_idx" ON "ProductTourEvent"("instanceId", "occurredAt");
CREATE INDEX "ProductTourEvent_eventType_occurredAt_idx" ON "ProductTourEvent"("eventType", "occurredAt");
CREATE INDEX "ProductTourEvent_surface_occurredAt_idx" ON "ProductTourEvent"("surface", "occurredAt");

-- FKs
ALTER TABLE "ProductTour"
ADD CONSTRAINT "ProductTour_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductTourStep"
ADD CONSTRAINT "ProductTourStep_tourId_fkey"
FOREIGN KEY ("tourId") REFERENCES "ProductTour"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductTourEvent"
ADD CONSTRAINT "ProductTourEvent_tourId_fkey"
FOREIGN KEY ("tourId") REFERENCES "ProductTour"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductTourEvent"
ADD CONSTRAINT "ProductTourEvent_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
