CREATE TABLE "EventLog" (
  "id" text NOT NULL,
  "companyId" text,
  "name" text NOT NULL,
  "source" text NOT NULL,
  "schemaVersion" integer NOT NULL,
  "occurredAt" timestamp(3) NOT NULL,
  "receivedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'stored',
  "error" text,
  CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventLog_companyId_idx" ON "EventLog"("companyId");
CREATE INDEX "EventLog_name_idx" ON "EventLog"("name");
CREATE INDEX "EventLog_source_idx" ON "EventLog"("source");
CREATE INDEX "EventLog_receivedAt_idx" ON "EventLog"("receivedAt");
CREATE INDEX "EventLog_status_idx" ON "EventLog"("status");

ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
