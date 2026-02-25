CREATE TYPE "BulkBillingActionType" AS ENUM ('SET_TIER', 'EXTEND_TRIAL', 'FRAUD_PAUSE', 'FRAUD_CANCEL');
CREATE TYPE "BulkBillingActionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'EXECUTED', 'REJECTED', 'FAILED');

CREATE TABLE "BulkBillingAction" (
  "id" TEXT NOT NULL,
  "actionType" "BulkBillingActionType" NOT NULL,
  "status" "BulkBillingActionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "requestedByRole" TEXT NOT NULL,
  "requestedByActor" TEXT,
  "approvedByRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "approvalsNeeded" INTEGER NOT NULL DEFAULT 1,
  "requiresTwoPersonApproval" BOOLEAN NOT NULL DEFAULT false,
  "manifestHash" TEXT NOT NULL,
  "evidenceSignature" TEXT NOT NULL,
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "note" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  CONSTRAINT "BulkBillingAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulkBillingActionApproval" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "approverRole" TEXT NOT NULL,
  "approverActor" TEXT,
  "decision" TEXT NOT NULL DEFAULT 'APPROVE',
  "note" TEXT,
  "manifestHash" TEXT NOT NULL,
  "evidenceSignature" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BulkBillingActionApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BulkBillingActionApproval_actionId_approverRole_decision_key" ON "BulkBillingActionApproval"("actionId", "approverRole", "decision");
CREATE INDEX "BulkBillingAction_status_createdAt_idx" ON "BulkBillingAction"("status", "createdAt");
CREATE INDEX "BulkBillingAction_actionType_createdAt_idx" ON "BulkBillingAction"("actionType", "createdAt");
CREATE INDEX "BulkBillingAction_requestedByRole_createdAt_idx" ON "BulkBillingAction"("requestedByRole", "createdAt");
CREATE INDEX "BulkBillingAction_manifestHash_idx" ON "BulkBillingAction"("manifestHash");
CREATE INDEX "BulkBillingActionApproval_actionId_createdAt_idx" ON "BulkBillingActionApproval"("actionId", "createdAt");
CREATE INDEX "BulkBillingActionApproval_approverRole_createdAt_idx" ON "BulkBillingActionApproval"("approverRole", "createdAt");

ALTER TABLE "BulkBillingActionApproval"
  ADD CONSTRAINT "BulkBillingActionApproval_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "BulkBillingAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
