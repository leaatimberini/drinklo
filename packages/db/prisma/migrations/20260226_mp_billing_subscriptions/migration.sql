ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "billingProvider" TEXT;
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "mpPreapprovalId" TEXT;
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "mpPreapprovalStatus" TEXT;
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "mpNextBillingDate" TIMESTAMP(3);
ALTER TABLE IF EXISTS "Subscription" ADD COLUMN IF NOT EXISTS "mpSubscriptionRaw" JSONB;

DO $$
BEGIN
  IF to_regclass('"Subscription"') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_mpPreapprovalId_key" ON "Subscription"("mpPreapprovalId")';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Subscription_mpPreapprovalStatus_idx" ON "Subscription"("mpPreapprovalStatus")';
  END IF;
END
$$;

