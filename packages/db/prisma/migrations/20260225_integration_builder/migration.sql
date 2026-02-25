CREATE TYPE "IntegrationConnectorDestinationType" AS ENUM ('WEBHOOK', 'API');
CREATE TYPE "IntegrationConnectorAuthMode" AS ENUM ('NONE', 'BEARER_TOKEN', 'API_KEY_HEADER');
CREATE TYPE "IntegrationConnectorDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY_SCHEDULED', 'SUCCESS', 'FAILED', 'DLQ');

CREATE TABLE "IntegrationConnector" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceEvent" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "destinationType" "IntegrationConnectorDestinationType" NOT NULL DEFAULT 'WEBHOOK',
  "method" TEXT NOT NULL DEFAULT 'POST',
  "destinationUrl" TEXT NOT NULL,
  "headers" JSONB,
  "mapping" JSONB NOT NULL,
  "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
  "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
  "retryBackoffBaseMs" INTEGER NOT NULL DEFAULT 1000,
  "authMode" "IntegrationConnectorAuthMode" NOT NULL DEFAULT 'NONE',
  "authHeaderName" TEXT,
  "secretProviderKey" TEXT,
  "lastTestAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationConnector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationConnectorDelivery" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sourceEvent" TEXT NOT NULL,
  "status" "IntegrationConnectorDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "requestPayload" JSONB,
  "requestHeaders" JSONB,
  "responseStatus" INTEGER,
  "responseBody" TEXT,
  "error" TEXT,
  "eventEnvelope" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnectorDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationConnector_companyId_name_key" ON "IntegrationConnector"("companyId", "name");
CREATE INDEX "IntegrationConnector_companyId_idx" ON "IntegrationConnector"("companyId");
CREATE INDEX "IntegrationConnector_companyId_enabled_idx" ON "IntegrationConnector"("companyId", "enabled");
CREATE INDEX "IntegrationConnector_sourceEvent_idx" ON "IntegrationConnector"("sourceEvent");
CREATE INDEX "IntegrationConnector_deletedAt_idx" ON "IntegrationConnector"("deletedAt");

CREATE UNIQUE INDEX "IntegrationConnectorDelivery_connectorId_eventId_key" ON "IntegrationConnectorDelivery"("connectorId", "eventId");
CREATE INDEX "IntegrationConnectorDelivery_companyId_createdAt_idx" ON "IntegrationConnectorDelivery"("companyId", "createdAt");
CREATE INDEX "IntegrationConnectorDelivery_connectorId_createdAt_idx" ON "IntegrationConnectorDelivery"("connectorId", "createdAt");
CREATE INDEX "IntegrationConnectorDelivery_status_nextAttemptAt_idx" ON "IntegrationConnectorDelivery"("status", "nextAttemptAt");
CREATE INDEX "IntegrationConnectorDelivery_sourceEvent_createdAt_idx" ON "IntegrationConnectorDelivery"("sourceEvent", "createdAt");

ALTER TABLE "IntegrationConnector" ADD CONSTRAINT "IntegrationConnector_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnectorDelivery" ADD CONSTRAINT "IntegrationConnectorDelivery_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnectorDelivery" ADD CONSTRAINT "IntegrationConnectorDelivery_connectorId_fkey"
  FOREIGN KEY ("connectorId") REFERENCES "IntegrationConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

