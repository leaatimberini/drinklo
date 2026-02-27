-- Company settings
CREATE TABLE "CompanySettings" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyId" text NOT NULL UNIQUE,
  "brandName" text NOT NULL,
  "domain" text NOT NULL,
  "logoUrl" text NOT NULL,
  "faviconUrl" text,
  "seoTitle" text,
  "seoDescription" text,
  "seoKeywords" text,
  "templateId" text DEFAULT 'default',
  "billingMode" text NOT NULL DEFAULT 'NO_FISCAL',
  "afipCuit" text,
  "afipPointOfSale" integer,
  "afipEnvironment" text DEFAULT 'HOMO',
  "afipCertIssuer" text,
  "enableAbTesting" boolean NOT NULL DEFAULT false,
  "timezone" text NOT NULL,
  "currency" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

