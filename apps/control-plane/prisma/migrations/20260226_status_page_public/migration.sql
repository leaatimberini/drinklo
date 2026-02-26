CREATE TYPE "StatusPageIncidentImpact" AS ENUM ('DEGRADED', 'PARTIAL_OUTAGE', 'MAJOR_OUTAGE', 'MAINTENANCE');
CREATE TYPE "StatusPageIncidentState" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');
CREATE TYPE "StatusPageSubscriptionChannel" AS ENUM ('EMAIL', 'WEBHOOK');
CREATE TYPE "StatusPageSubscriptionStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'PAUSED');

CREATE TABLE "StatusPageIncident" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "installationId" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "impact" "StatusPageIncidentImpact" NOT NULL,
  "state" "StatusPageIncidentState" NOT NULL DEFAULT 'INVESTIGATING',
  "component" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "isClosed" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "postmortemTitle" TEXT,
  "postmortemBody" TEXT,
  "postmortemPublishedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StatusPageIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatusPageIncidentUpdate" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "state" "StatusPageIncidentState",
  "message" TEXT NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isPostmortem" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "StatusPageIncidentUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatusPageSubscription" (
  "id" TEXT NOT NULL,
  "channel" "StatusPageSubscriptionChannel" NOT NULL,
  "status" "StatusPageSubscriptionStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "email" TEXT,
  "webhookUrl" TEXT,
  "secret" TEXT,
  "lastNotifiedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StatusPageSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatusPageIncident_slug_key" ON "StatusPageIncident"("slug");
CREATE INDEX "StatusPageIncident_isPublic_isClosed_startedAt_idx" ON "StatusPageIncident"("isPublic", "isClosed", "startedAt");
CREATE INDEX "StatusPageIncident_impact_state_startedAt_idx" ON "StatusPageIncident"("impact", "state", "startedAt");
CREATE INDEX "StatusPageIncident_installationId_startedAt_idx" ON "StatusPageIncident"("installationId", "startedAt");

CREATE INDEX "StatusPageIncidentUpdate_incidentId_createdAt_idx" ON "StatusPageIncidentUpdate"("incidentId", "createdAt");
CREATE INDEX "StatusPageIncidentUpdate_isPublic_createdAt_idx" ON "StatusPageIncidentUpdate"("isPublic", "createdAt");
CREATE INDEX "StatusPageIncidentUpdate_isPostmortem_createdAt_idx" ON "StatusPageIncidentUpdate"("isPostmortem", "createdAt");

CREATE UNIQUE INDEX "StatusPageSubscription_channel_email_key" ON "StatusPageSubscription"("channel", "email");
CREATE UNIQUE INDEX "StatusPageSubscription_channel_webhookUrl_key" ON "StatusPageSubscription"("channel", "webhookUrl");
CREATE INDEX "StatusPageSubscription_status_createdAt_idx" ON "StatusPageSubscription"("status", "createdAt");

ALTER TABLE "StatusPageIncident"
ADD CONSTRAINT "StatusPageIncident_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StatusPageIncidentUpdate"
ADD CONSTRAINT "StatusPageIncidentUpdate_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "StatusPageIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
