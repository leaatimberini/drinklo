-- Company themes
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "storefrontTheme" text NOT NULL DEFAULT 'A';
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "adminTheme" text NOT NULL DEFAULT 'A';

