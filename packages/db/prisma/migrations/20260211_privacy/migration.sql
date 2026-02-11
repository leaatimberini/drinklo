ALTER TABLE "CompanySettings" ADD COLUMN "retentionLogsDays" integer NOT NULL DEFAULT 90;
ALTER TABLE "CompanySettings" ADD COLUMN "retentionOrdersDays" integer NOT NULL DEFAULT 365;
ALTER TABLE "CompanySettings" ADD COLUMN "retentionMarketingDays" integer NOT NULL DEFAULT 365;

CREATE TABLE "PrivacyRequest" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "customerId" text,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "requestedById" text,
  "notes" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivacyRequest_companyId_idx" ON "PrivacyRequest"("companyId");
CREATE INDEX "PrivacyRequest_customerId_idx" ON "PrivacyRequest"("customerId");
CREATE INDEX "PrivacyRequest_type_idx" ON "PrivacyRequest"("type");
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");

ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
