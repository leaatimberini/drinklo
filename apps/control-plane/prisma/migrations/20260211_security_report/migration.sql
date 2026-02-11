CREATE TABLE "SecurityReport" (
  "id" text NOT NULL,
  "installationId" text,
  "instanceId" text,
  "repo" text,
  "sha" text,
  "runId" text,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "summary" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityReport_installationId_idx" ON "SecurityReport"("installationId");
CREATE INDEX "SecurityReport_instanceId_idx" ON "SecurityReport"("instanceId");
CREATE INDEX "SecurityReport_repo_idx" ON "SecurityReport"("repo");
CREATE INDEX "SecurityReport_kind_idx" ON "SecurityReport"("kind");
CREATE INDEX "SecurityReport_status_idx" ON "SecurityReport"("status");
CREATE INDEX "SecurityReport_createdAt_idx" ON "SecurityReport"("createdAt");

ALTER TABLE "SecurityReport" ADD CONSTRAINT "SecurityReport_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
