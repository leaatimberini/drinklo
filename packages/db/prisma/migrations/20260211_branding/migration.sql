-- Branding portability
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "faviconUrl" text;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "seoTitle" text;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "seoDescription" text;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "seoKeywords" text;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "templateId" text DEFAULT 'default';

