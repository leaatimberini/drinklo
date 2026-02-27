CREATE TABLE "Secret" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "provider" text NOT NULL,
  "encData" text NOT NULL,
  "encDataIv" text NOT NULL,
  "encDataTag" text NOT NULL,
  "encKey" text NOT NULL,
  "encKeyIv" text NOT NULL,
  "encKeyTag" text NOT NULL,
  "alg" text NOT NULL DEFAULT 'AES-256-GCM',
  "keyVersion" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" timestamp(3),
  "verifiedAt" timestamp(3),
  "rotatedAt" timestamp(3),
  "meta" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecretAudit" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "secretId" text NOT NULL,
  "actorId" text,
  "action" text NOT NULL,
  "changes" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecretAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Secret_companyId_provider_key" ON "Secret"("companyId", "provider");
CREATE INDEX "Secret_companyId_idx" ON "Secret"("companyId");
CREATE INDEX "Secret_provider_idx" ON "Secret"("provider");
CREATE INDEX "Secret_status_idx" ON "Secret"("status");
CREATE INDEX "Secret_expiresAt_idx" ON "Secret"("expiresAt");

CREATE INDEX "SecretAudit_companyId_idx" ON "SecretAudit"("companyId");
CREATE INDEX "SecretAudit_secretId_idx" ON "SecretAudit"("secretId");
CREATE INDEX "SecretAudit_actorId_idx" ON "SecretAudit"("actorId");
CREATE INDEX "SecretAudit_action_idx" ON "SecretAudit"("action");

ALTER TABLE "Secret" ADD CONSTRAINT "Secret_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecretAudit" ADD CONSTRAINT "SecretAudit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecretAudit" ADD CONSTRAINT "SecretAudit_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecretAudit" ADD CONSTRAINT "SecretAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

