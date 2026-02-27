ALTER TABLE "LegalHold" ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "LegalHold"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "userEmailSnapshot" TEXT,
  ADD COLUMN "entityScopes" "GovernanceEntity"[] NOT NULL DEFAULT ARRAY['ORDERS','LOGS','EVENTS','MARKETING']::"GovernanceEntity"[],
  ADD COLUMN "evidence" JSONB,
  ADD COLUMN "evidenceHash" TEXT;

CREATE INDEX "LegalHold_userId_idx" ON "LegalHold"("userId");

ALTER TABLE "LegalHold" DROP CONSTRAINT "LegalHold_customerId_fkey";
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


