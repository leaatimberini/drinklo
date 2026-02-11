ALTER TABLE "CompanySettings" ADD COLUMN "ageGateMode" text NOT NULL DEFAULT 'DISABLED';
ALTER TABLE "CompanySettings" ADD COLUMN "termsUrl" text;
ALTER TABLE "CompanySettings" ADD COLUMN "privacyUrl" text;
ALTER TABLE "CompanySettings" ADD COLUMN "cookiesUrl" text;
ALTER TABLE "CompanySettings" ADD COLUMN "marketingConsentRequired" boolean NOT NULL DEFAULT false;

CREATE TABLE "ConsentRecord" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "userId" text,
  "type" text NOT NULL,
  "accepted" boolean NOT NULL,
  "ipAddress" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_companyId_idx" ON "ConsentRecord"("companyId");
CREATE INDEX "ConsentRecord_type_idx" ON "ConsentRecord"("type");
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "isAlcoholic" boolean NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "abv" double precision;
