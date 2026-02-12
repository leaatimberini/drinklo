ALTER TABLE "Installation"
  ADD COLUMN "primaryRegion" TEXT,
  ADD COLUMN "regionalHealth" JSONB;

CREATE INDEX "Installation_primaryRegion_idx" ON "Installation"("primaryRegion");
