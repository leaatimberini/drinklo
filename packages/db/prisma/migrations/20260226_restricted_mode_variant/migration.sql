ALTER TABLE IF EXISTS "CompanySettings"
  ADD COLUMN IF NOT EXISTS "restrictedModeVariant" TEXT NOT NULL DEFAULT 'ALLOW_BASIC_SALES';

CREATE INDEX IF NOT EXISTS "CompanySettings_restrictedModeVariant_idx"
  ON "CompanySettings"("restrictedModeVariant");

