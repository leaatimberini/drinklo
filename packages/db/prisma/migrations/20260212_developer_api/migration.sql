CREATE TABLE "DeveloperApiKey" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rateLimitPerMin" INTEGER NOT NULL DEFAULT 120,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperApiUsage" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "keyId" TEXT,
  "route" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "ipMasked" TEXT,
  "userAgent" TEXT,
  "scopeDenied" BOOLEAN NOT NULL DEFAULT false,
  "rateLimited" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperApiUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperWebhookEndpoint" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "secret" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "DeveloperWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperWebhookDelivery" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "statusCode" INTEGER,
  "error" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeveloperApiKey_companyId_keyPrefix_key" ON "DeveloperApiKey"("companyId", "keyPrefix");
CREATE INDEX "DeveloperApiKey_companyId_createdAt_idx" ON "DeveloperApiKey"("companyId", "createdAt");
CREATE INDEX "DeveloperApiKey_revokedAt_idx" ON "DeveloperApiKey"("revokedAt");

CREATE INDEX "DeveloperApiUsage_companyId_createdAt_idx" ON "DeveloperApiUsage"("companyId", "createdAt");
CREATE INDEX "DeveloperApiUsage_keyId_createdAt_idx" ON "DeveloperApiUsage"("keyId", "createdAt");
CREATE INDEX "DeveloperApiUsage_rateLimited_createdAt_idx" ON "DeveloperApiUsage"("rateLimited", "createdAt");

CREATE INDEX "DeveloperWebhookEndpoint_companyId_active_idx" ON "DeveloperWebhookEndpoint"("companyId", "active");

CREATE INDEX "DeveloperWebhookDelivery_companyId_eventType_createdAt_idx" ON "DeveloperWebhookDelivery"("companyId", "eventType", "createdAt");
CREATE INDEX "DeveloperWebhookDelivery_endpointId_createdAt_idx" ON "DeveloperWebhookDelivery"("endpointId", "createdAt");

ALTER TABLE "DeveloperApiKey" ADD CONSTRAINT "DeveloperApiKey_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiKey" ADD CONSTRAINT "DeveloperApiKey_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeveloperApiUsage" ADD CONSTRAINT "DeveloperApiUsage_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeveloperApiUsage" ADD CONSTRAINT "DeveloperApiUsage_keyId_fkey"
  FOREIGN KEY ("keyId") REFERENCES "DeveloperApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeveloperWebhookEndpoint" ADD CONSTRAINT "DeveloperWebhookEndpoint_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeveloperWebhookDelivery" ADD CONSTRAINT "DeveloperWebhookDelivery_endpointId_fkey"
  FOREIGN KEY ("endpointId") REFERENCES "DeveloperWebhookEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

