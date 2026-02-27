ALTER TABLE "ProductVariant" ADD COLUMN "cost" NUMERIC(10,2);

CREATE TABLE "SearchConfig" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "synonyms" JSONB,
  "boosters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SearchConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchIndexState" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lastIndexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SearchIndexState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchConfig_companyId_key" ON "SearchConfig"("companyId");
CREATE UNIQUE INDEX "SearchIndexState_companyId_key" ON "SearchIndexState"("companyId");

ALTER TABLE "SearchConfig" ADD CONSTRAINT "SearchConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SearchIndexState" ADD CONSTRAINT "SearchIndexState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

