ALTER TABLE "CompanySettings"
  ADD COLUMN "sandboxMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sandboxResetAt" TIMESTAMP(3);
