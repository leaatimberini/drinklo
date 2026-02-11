CREATE TABLE "IntegrationHealthLog" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "provider" text NOT NULL,
  "status" text NOT NULL,
  "message" text,
  "meta" jsonb,
  "checkedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" text,
  CONSTRAINT "IntegrationHealthLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationHealthLog_companyId_idx" ON "IntegrationHealthLog"("companyId");
CREATE INDEX "IntegrationHealthLog_provider_idx" ON "IntegrationHealthLog"("provider");
CREATE INDEX "IntegrationHealthLog_status_idx" ON "IntegrationHealthLog"("status");
CREATE INDEX "IntegrationHealthLog_checkedAt_idx" ON "IntegrationHealthLog"("checkedAt");

ALTER TABLE "IntegrationHealthLog" ADD CONSTRAINT "IntegrationHealthLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationHealthLog" ADD CONSTRAINT "IntegrationHealthLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
