CREATE TYPE "ExperimentTarget" AS ENUM ('HOME','PDP','CHECKOUT');
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','ARCHIVED');
CREATE TYPE "ExperimentEventType" AS ENUM ('ADD_TO_CART','CONVERSION');

CREATE TABLE "Experiment" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "target" "ExperimentTarget" NOT NULL,
  "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "objectives" text[] NOT NULL,
  "trafficSplit" jsonb NOT NULL,
  "startsAt" timestamp(3),
  "endsAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentVariant" (
  "id" text NOT NULL,
  "experimentId" text NOT NULL,
  "name" text NOT NULL,
  "weight" double precision NOT NULL DEFAULT 0.5,
  "payload" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentAssignment" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "experimentId" text NOT NULL,
  "variantId" text NOT NULL,
  "userId" text,
  "cookieId" text NOT NULL,
  "assignedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentEvent" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "experimentId" text NOT NULL,
  "variantId" text NOT NULL,
  "type" "ExperimentEventType" NOT NULL,
  "orderId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperimentEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompanySettings" ADD COLUMN "enableAbTesting" boolean NOT NULL DEFAULT false;

CREATE INDEX "Experiment_companyId_idx" ON "Experiment"("companyId");
CREATE INDEX "Experiment_target_idx" ON "Experiment"("target");
CREATE INDEX "Experiment_status_idx" ON "Experiment"("status");

CREATE INDEX "ExperimentVariant_experimentId_idx" ON "ExperimentVariant"("experimentId");

CREATE UNIQUE INDEX "ExperimentAssignment_experimentId_cookieId_key" ON "ExperimentAssignment"("experimentId", "cookieId");
CREATE INDEX "ExperimentAssignment_companyId_idx" ON "ExperimentAssignment"("companyId");
CREATE INDEX "ExperimentAssignment_experimentId_idx" ON "ExperimentAssignment"("experimentId");
CREATE INDEX "ExperimentAssignment_variantId_idx" ON "ExperimentAssignment"("variantId");
CREATE INDEX "ExperimentAssignment_userId_idx" ON "ExperimentAssignment"("userId");

CREATE INDEX "ExperimentEvent_companyId_idx" ON "ExperimentEvent"("companyId");
CREATE INDEX "ExperimentEvent_experimentId_idx" ON "ExperimentEvent"("experimentId");
CREATE INDEX "ExperimentEvent_variantId_idx" ON "ExperimentEvent"("variantId");
CREATE INDEX "ExperimentEvent_type_idx" ON "ExperimentEvent"("type");
CREATE INDEX "ExperimentEvent_createdAt_idx" ON "ExperimentEvent"("createdAt");

ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentEvent" ADD CONSTRAINT "ExperimentEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExperimentEvent" ADD CONSTRAINT "ExperimentEvent_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentEvent" ADD CONSTRAINT "ExperimentEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentEvent" ADD CONSTRAINT "ExperimentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
