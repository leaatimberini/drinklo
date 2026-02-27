-- CreateEnum
CREATE TYPE "AiCopilotProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiCopilotActionType" AS ENUM ('CREATE_COUPON', 'CREATE_PURCHASE_ORDER', 'ADJUST_STOCK');

-- CreateTable
CREATE TABLE "AiCopilotLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'admin',
    "promptRedacted" TEXT NOT NULL,
    "response" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "dlp" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCopilotLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCopilotProposal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "status" "AiCopilotProposalStatus" NOT NULL DEFAULT 'PENDING',
    "actionType" "AiCopilotActionType" NOT NULL,
    "requiredPermission" TEXT NOT NULL,
    "promptRedacted" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "executionResult" JSONB,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCopilotProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCopilotLog_companyId_createdAt_idx" ON "AiCopilotLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCopilotLog_userId_idx" ON "AiCopilotLog"("userId");

-- CreateIndex
CREATE INDEX "AiCopilotLog_mode_idx" ON "AiCopilotLog"("mode");

-- CreateIndex
CREATE INDEX "AiCopilotProposal_companyId_status_createdAt_idx" ON "AiCopilotProposal"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiCopilotProposal_createdByUserId_idx" ON "AiCopilotProposal"("createdByUserId");

-- CreateIndex
CREATE INDEX "AiCopilotProposal_approvedByUserId_idx" ON "AiCopilotProposal"("approvedByUserId");

-- CreateIndex
CREATE INDEX "AiCopilotProposal_actionType_idx" ON "AiCopilotProposal"("actionType");

-- AddForeignKey
ALTER TABLE "AiCopilotLog" ADD CONSTRAINT "AiCopilotLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCopilotLog" ADD CONSTRAINT "AiCopilotLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCopilotProposal" ADD CONSTRAINT "AiCopilotProposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCopilotProposal" ADD CONSTRAINT "AiCopilotProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCopilotProposal" ADD CONSTRAINT "AiCopilotProposal_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

