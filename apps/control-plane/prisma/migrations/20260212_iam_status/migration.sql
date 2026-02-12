ALTER TABLE "Installation"
  ADD COLUMN "iamSsoEnabled" BOOLEAN,
  ADD COLUMN "iamMfaEnforced" BOOLEAN,
  ADD COLUMN "iamScimEnabled" BOOLEAN,
  ADD COLUMN "iamLastSyncAt" TIMESTAMP(3);
