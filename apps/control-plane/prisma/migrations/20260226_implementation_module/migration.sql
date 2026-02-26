-- CreateEnum
CREATE TYPE "ImplementationProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'READY_FOR_GO_LIVE', 'LIVE', 'BLOCKED');
CREATE TYPE "ImplementationChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'WAIVED');

-- CreateTable
CREATE TABLE "ImplementationProject" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "icp" TEXT NOT NULL DEFAULT 'kiosco',
  "status" "ImplementationProjectStatus" NOT NULL DEFAULT 'PLANNING',
  "ownerUserId" TEXT,
  "ownerName" TEXT,
  "kickoffAt" TIMESTAMP(3),
  "targetGoLiveAt" TIMESTAMP(3),
  "actualGoLiveAt" TIMESTAMP(3),
  "notes" TEXT,
  "lastReadinessColor" TEXT,
  "lastReadinessScore" INTEGER,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImplementationProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImplementationChecklistItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "phase" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" "ImplementationChecklistStatus" NOT NULL DEFAULT 'PENDING',
  "responsibleRole" TEXT,
  "responsibleUserId" TEXT,
  "responsibleName" TEXT,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'template',
  "linkedSignalKey" TEXT,
  "linkedCourseKey" TEXT,
  "linkedTourKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImplementationChecklistItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ImplementationProject_installationId_key" ON "ImplementationProject"("installationId");
CREATE INDEX "ImplementationProject_instanceId_idx" ON "ImplementationProject"("instanceId");
CREATE INDEX "ImplementationProject_status_targetGoLiveAt_idx" ON "ImplementationProject"("status", "targetGoLiveAt");

CREATE UNIQUE INDEX "ImplementationChecklistItem_projectId_taskKey_key" ON "ImplementationChecklistItem"("projectId", "taskKey");
CREATE INDEX "ImplementationChecklistItem_installationId_status_dueAt_idx" ON "ImplementationChecklistItem"("installationId", "status", "dueAt");
CREATE INDEX "ImplementationChecklistItem_instanceId_status_idx" ON "ImplementationChecklistItem"("instanceId", "status");
CREATE INDEX "ImplementationChecklistItem_required_status_idx" ON "ImplementationChecklistItem"("required", "status");

-- Foreign keys
ALTER TABLE "ImplementationProject"
ADD CONSTRAINT "ImplementationProject_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImplementationChecklistItem"
ADD CONSTRAINT "ImplementationChecklistItem_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ImplementationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImplementationChecklistItem"
ADD CONSTRAINT "ImplementationChecklistItem_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

