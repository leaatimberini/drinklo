CREATE TABLE "EmailDomain" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "providerType" text NOT NULL,
  "providerName" text,
  "domain" text,
  "spfValue" text,
  "dkimSelector" text,
  "dkimValue" text,
  "dmarcValue" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "verifiedAt" timestamp(3),
  "verifiedById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "EmailDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDomain_companyId_key" ON "EmailDomain"("companyId");
CREATE INDEX "EmailDomain_companyId_idx" ON "EmailDomain"("companyId");
CREATE INDEX "EmailDomain_status_idx" ON "EmailDomain"("status");

ALTER TABLE "EmailDomain" ADD CONSTRAINT "EmailDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailDomain" ADD CONSTRAINT "EmailDomain_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailEventLog" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "provider" text NOT NULL,
  "type" text NOT NULL,
  "recipient" text,
  "messageId" text,
  "payload" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailEventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailEventLog_companyId_idx" ON "EmailEventLog"("companyId");
CREATE INDEX "EmailEventLog_provider_idx" ON "EmailEventLog"("provider");
CREATE INDEX "EmailEventLog_type_idx" ON "EmailEventLog"("type");
CREATE INDEX "EmailEventLog_messageId_idx" ON "EmailEventLog"("messageId");

ALTER TABLE "EmailEventLog" ADD CONSTRAINT "EmailEventLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

