ALTER TABLE "Subscription" ADD COLUMN "billingProvider" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "mpPreapprovalId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "mpPreapprovalStatus" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "mpNextBillingDate" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "mpSubscriptionRaw" JSONB;

CREATE UNIQUE INDEX "Subscription_mpPreapprovalId_key" ON "Subscription"("mpPreapprovalId");
CREATE INDEX "Subscription_mpPreapprovalStatus_idx" ON "Subscription"("mpPreapprovalStatus");
