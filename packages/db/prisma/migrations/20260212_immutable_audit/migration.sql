CREATE TABLE "ImmutableAuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "aggregateType" TEXT,
  "aggregateId" TEXT,
  "aggregateVersion" INTEGER,
  "payload" JSONB,
  "payloadHash" TEXT NOT NULL,
  "previousHash" TEXT,
  "chainHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImmutableAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImmutableAuditLog_companyId_createdAt_idx" ON "ImmutableAuditLog"("companyId", "createdAt");
CREATE INDEX "ImmutableAuditLog_companyId_category_idx" ON "ImmutableAuditLog"("companyId", "category");
CREATE INDEX "ImmutableAuditLog_companyId_action_idx" ON "ImmutableAuditLog"("companyId", "action");
CREATE INDEX "ImmutableAuditLog_companyId_aggregateType_aggregateId_idx" ON "ImmutableAuditLog"("companyId", "aggregateType", "aggregateId");

ALTER TABLE "ImmutableAuditLog" ADD CONSTRAINT "ImmutableAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
