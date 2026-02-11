CREATE TABLE "CompanyPlugin" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "allowedPermissions" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyPlugin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyPlugin_companyId_name_key" ON "CompanyPlugin"("companyId", "name");
CREATE INDEX "CompanyPlugin_companyId_idx" ON "CompanyPlugin"("companyId");
CREATE INDEX "CompanyPlugin_name_idx" ON "CompanyPlugin"("name");

ALTER TABLE "CompanyPlugin" ADD CONSTRAINT "CompanyPlugin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
