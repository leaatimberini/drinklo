CREATE TABLE "PlanPrice" (
  "id" TEXT NOT NULL,
  "planId" TEXT,
  "tier" TEXT NOT NULL,
  "billingPeriod" "BillingPeriod" NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanPrice_tier_billingPeriod_currency_effectiveFrom_idx"
  ON "PlanPrice"("tier", "billingPeriod", "currency", "effectiveFrom");
CREATE INDEX "PlanPrice_effectiveFrom_effectiveTo_idx"
  ON "PlanPrice"("effectiveFrom", "effectiveTo");
CREATE INDEX "PlanPrice_planId_idx"
  ON "PlanPrice"("planId");

ALTER TABLE "PlanPrice"
  ADD CONSTRAINT "PlanPrice_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
