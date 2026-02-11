-- Company themes
ALTER TABLE "CompanySettings" ADD COLUMN "storefrontTheme" text NOT NULL DEFAULT 'A';
ALTER TABLE "CompanySettings" ADD COLUMN "adminTheme" text NOT NULL DEFAULT 'A';
