CREATE TABLE "CompanyIamConfig" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
  "ssoProtocol" TEXT DEFAULT 'NONE',
  "oidcIssuer" TEXT,
  "oidcClientId" TEXT,
  "oidcClientSecret" TEXT,
  "oidcAuthUrl" TEXT,
  "oidcTokenUrl" TEXT,
  "oidcJwksUrl" TEXT,
  "oidcRedirectUri" TEXT,
  "oidcScopes" TEXT[] NOT NULL DEFAULT ARRAY['openid','profile','email'],
  "samlEntityId" TEXT,
  "samlSsoUrl" TEXT,
  "samlCertificate" TEXT,
  "samlAudience" TEXT,
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mfaRequiredRoles" TEXT[] NOT NULL DEFAULT ARRAY['admin','support'],
  "scimEnabled" BOOLEAN NOT NULL DEFAULT false,
  "scimBearerToken" TEXT,
  "testStatus" TEXT,
  "testLastError" TEXT,
  "testLastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyIamConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyIamConfig_companyId_key" ON "CompanyIamConfig"("companyId");

CREATE TABLE "UserMfaConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMfaConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMfaConfig_userId_key" ON "UserMfaConfig"("userId");

CREATE TABLE "ScimProvisionLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "externalId" TEXT,
  "email" TEXT,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScimProvisionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScimProvisionLog_companyId_idx" ON "ScimProvisionLog"("companyId");
CREATE INDEX "ScimProvisionLog_action_idx" ON "ScimProvisionLog"("action");
CREATE INDEX "ScimProvisionLog_status_idx" ON "ScimProvisionLog"("status");

ALTER TABLE "CompanyIamConfig" ADD CONSTRAINT "CompanyIamConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserMfaConfig" ADD CONSTRAINT "UserMfaConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScimProvisionLog" ADD CONSTRAINT "ScimProvisionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
