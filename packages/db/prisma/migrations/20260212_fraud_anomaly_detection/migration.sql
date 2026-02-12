CREATE TYPE "FraudAction" AS ENUM ('NONE', 'HOLD_ORDER', 'REQUIRE_VERIFICATION', 'NOTIFY_ONLY');
CREATE TYPE "FraudAssessmentStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "FraudRule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "weight" INTEGER NOT NULL,
  "threshold" NUMERIC(12,2),
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FraudRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FraudAssessment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "orderId" TEXT,
  "paymentId" TEXT,
  "score" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "action" "FraudAction" NOT NULL,
  "status" "FraudAssessmentStatus" NOT NULL DEFAULT 'OPEN',
  "reasonSummary" TEXT NOT NULL,
  "reasons" JSONB NOT NULL,
  "context" JSONB,
  "source" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FraudAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FraudRule_companyId_code_key" ON "FraudRule"("companyId", "code");
CREATE INDEX "FraudRule_companyId_idx" ON "FraudRule"("companyId");
CREATE INDEX "FraudAssessment_companyId_idx" ON "FraudAssessment"("companyId");
CREATE INDEX "FraudAssessment_orderId_idx" ON "FraudAssessment"("orderId");
CREATE INDEX "FraudAssessment_paymentId_idx" ON "FraudAssessment"("paymentId");
CREATE INDEX "FraudAssessment_status_idx" ON "FraudAssessment"("status");
CREATE INDEX "FraudAssessment_riskLevel_idx" ON "FraudAssessment"("riskLevel");
CREATE INDEX "FraudAssessment_createdAt_idx" ON "FraudAssessment"("createdAt");

ALTER TABLE "FraudRule" ADD CONSTRAINT "FraudRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FraudAssessment" ADD CONSTRAINT "FraudAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FraudAssessment" ADD CONSTRAINT "FraudAssessment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FraudAssessment" ADD CONSTRAINT "FraudAssessment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FraudAssessment" ADD CONSTRAINT "FraudAssessment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
