CREATE TABLE "MobileBrandProfile" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "appName" TEXT NOT NULL,
  "appSlug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "iconUrl" TEXT,
  "splashUrl" TEXT,
  "assets" JSONB,
  "themeTokens" JSONB NOT NULL,
  "otaStableChannel" TEXT NOT NULL DEFAULT 'stable',
  "otaBetaChannel" TEXT NOT NULL DEFAULT 'beta',
  "defaultChannel" TEXT NOT NULL DEFAULT 'stable',
  "apiBaseUrl" TEXT,
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileBrandProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileBuildProfile" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "brandProfileId" TEXT,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "profileName" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "runtimeVersion" TEXT NOT NULL,
  "appVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "config" JSONB NOT NULL,
  "generatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileBuildProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileOtaUpdate" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "brandProfileId" TEXT,
  "instanceId" TEXT NOT NULL,
  "companyId" TEXT,
  "channel" TEXT NOT NULL,
  "targetVersion" TEXT NOT NULL,
  "runtimeVersion" TEXT NOT NULL,
  "rolloutChannel" TEXT,
  "releaseId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "message" TEXT,
  "manifest" JSONB,
  "publishedBy" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobileOtaUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileBrandProfile_installationId_key" ON "MobileBrandProfile"("installationId");
CREATE UNIQUE INDEX "MobileBrandProfile_instanceId_key" ON "MobileBrandProfile"("instanceId");
CREATE INDEX "MobileBrandProfile_instanceId_idx" ON "MobileBrandProfile"("instanceId");
CREATE INDEX "MobileBrandProfile_companyId_idx" ON "MobileBrandProfile"("companyId");
CREATE INDEX "MobileBrandProfile_defaultChannel_idx" ON "MobileBrandProfile"("defaultChannel");

CREATE INDEX "MobileBuildProfile_installationId_createdAt_idx" ON "MobileBuildProfile"("installationId","createdAt");
CREATE INDEX "MobileBuildProfile_instanceId_createdAt_idx" ON "MobileBuildProfile"("instanceId","createdAt");
CREATE INDEX "MobileBuildProfile_channel_createdAt_idx" ON "MobileBuildProfile"("channel","createdAt");

CREATE INDEX "MobileOtaUpdate_installationId_createdAt_idx" ON "MobileOtaUpdate"("installationId","createdAt");
CREATE INDEX "MobileOtaUpdate_instanceId_createdAt_idx" ON "MobileOtaUpdate"("instanceId","createdAt");
CREATE INDEX "MobileOtaUpdate_channel_createdAt_idx" ON "MobileOtaUpdate"("channel","createdAt");
CREATE INDEX "MobileOtaUpdate_status_createdAt_idx" ON "MobileOtaUpdate"("status","createdAt");

ALTER TABLE "MobileBrandProfile"
  ADD CONSTRAINT "MobileBrandProfile_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MobileBuildProfile"
  ADD CONSTRAINT "MobileBuildProfile_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobileBuildProfile"
  ADD CONSTRAINT "MobileBuildProfile_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "MobileBrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MobileOtaUpdate"
  ADD CONSTRAINT "MobileOtaUpdate_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobileOtaUpdate"
  ADD CONSTRAINT "MobileOtaUpdate_brandProfileId_fkey"
  FOREIGN KEY ("brandProfileId") REFERENCES "MobileBrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

