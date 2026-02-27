-- Email templates
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "brandTone" text DEFAULT 'Profesional';

CREATE TYPE "EmailTemplateStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "EmailTemplate" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL,
  "type" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "version" integer NOT NULL,
  "status" "EmailTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "EmailTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "EmailTemplate_companyId_idx" ON "EmailTemplate"("companyId");
CREATE INDEX "EmailTemplate_type_idx" ON "EmailTemplate"("type");
CREATE INDEX "EmailTemplate_status_idx" ON "EmailTemplate"("status");

