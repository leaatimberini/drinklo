CREATE TABLE "ProductAttribute" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "productId" text NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductAttribute_companyId_idx" ON "ProductAttribute"("companyId");
CREATE INDEX "ProductAttribute_productId_idx" ON "ProductAttribute"("productId");
CREATE INDEX "ProductAttribute_key_idx" ON "ProductAttribute"("key");

ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AttributeDefinition" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "dataType" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttributeDefinition_companyId_key_key" ON "AttributeDefinition"("companyId", "key");
CREATE INDEX "AttributeDefinition_companyId_idx" ON "AttributeDefinition"("companyId");

ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DashboardTemplate" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "DashboardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardTemplate_companyId_idx" ON "DashboardTemplate"("companyId");
ALTER TABLE "DashboardTemplate" ADD CONSTRAINT "DashboardTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReportTemplate" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportTemplate_companyId_idx" ON "ReportTemplate"("companyId");
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
