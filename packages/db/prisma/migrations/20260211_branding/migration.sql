-- Branding portability
ALTER TABLE "CompanySettings" ADD COLUMN "faviconUrl" text;
ALTER TABLE "CompanySettings" ADD COLUMN "seoTitle" text;
ALTER TABLE "CompanySettings" ADD COLUMN "seoDescription" text;
ALTER TABLE "CompanySettings" ADD COLUMN "seoKeywords" text;
ALTER TABLE "CompanySettings" ADD COLUMN "templateId" text DEFAULT 'default';
