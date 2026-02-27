CREATE TABLE "LicenseKey" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "key" text NOT NULL,
  "plan" text NOT NULL,
  "expiresAt" timestamp(3) NOT NULL,
  "features" text[] NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "LicenseKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LicenseKey_companyId_key" ON "LicenseKey"("companyId");
CREATE INDEX "LicenseKey_expiresAt_idx" ON "LicenseKey"("expiresAt");

ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

