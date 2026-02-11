-- Company settings
CREATE TABLE "CompanySettings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL UNIQUE,
  "brandName" text NOT NULL,
  "domain" text NOT NULL,
  "logoUrl" text NOT NULL,
  "timezone" text NOT NULL,
  "currency" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
