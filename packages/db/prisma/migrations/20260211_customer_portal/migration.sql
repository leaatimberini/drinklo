ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "supportPlan" text DEFAULT 'standard';
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "supportSlaFirstResponseHours" integer DEFAULT 48;
ALTER TABLE IF EXISTS "CompanySettings" ADD COLUMN IF NOT EXISTS "supportSlaResolutionHours" integer DEFAULT 120;

CREATE TABLE "SupportCustomer" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "passwordHash" text NOT NULL,
  "lastLoginAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportCustomer_companyId_email_key" ON "SupportCustomer"("companyId", "email");
CREATE INDEX "SupportCustomer_companyId_idx" ON "SupportCustomer"("companyId");

CREATE TABLE "SupportTicket" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "customerId" text NOT NULL,
  "subject" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "priority" text NOT NULL DEFAULT 'NORMAL',
  "diagnosticsKey" text,
  "diagnosticsMeta" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_companyId_idx" ON "SupportTicket"("companyId");
CREATE INDEX "SupportTicket_customerId_idx" ON "SupportTicket"("customerId");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

CREATE TABLE "SupportTicketMessage" (
  "id" text NOT NULL,
  "ticketId" text NOT NULL,
  "authorType" text NOT NULL,
  "authorId" text,
  "message" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketMessage_ticketId_idx" ON "SupportTicketMessage"("ticketId");
CREATE INDEX "SupportTicketMessage_authorType_idx" ON "SupportTicketMessage"("authorType");

CREATE TABLE "SupportTicketAttachment" (
  "id" text NOT NULL,
  "ticketId" text NOT NULL,
  "key" text NOT NULL,
  "contentType" text,
  "sizeBytes" integer,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketAttachment_ticketId_idx" ON "SupportTicketAttachment"("ticketId");

CREATE TABLE "SupportIncident" (
  "id" text NOT NULL,
  "companyId" text NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "severity" text NOT NULL DEFAULT 'MEDIUM',
  "startedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportIncident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportIncident_companyId_idx" ON "SupportIncident"("companyId");
CREATE INDEX "SupportIncident_status_idx" ON "SupportIncident"("status");
CREATE INDEX "SupportIncident_severity_idx" ON "SupportIncident"("severity");

ALTER TABLE "SupportCustomer" ADD CONSTRAINT "SupportCustomer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "SupportCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportIncident" ADD CONSTRAINT "SupportIncident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

